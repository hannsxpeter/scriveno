// Implements: P-MUST-01, P-MUST-02, P-MUST-03, P-MUST-04, P-MUST-05, P-MUST-06, P-MUST-07, P-MUST-12, P-MUST-14, P-MUST-15, P-MUST-18
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CASES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'provenance', 'cases.json'), 'utf8'));
const {
  EXIT_CODES,
  LIMITS,
  auditTargets,
  classifyBuffer,
  parseZipContainer,
  recommendedExitCode,
  serializeReport,
} = require('../lib/provenance-audit.js');

function hash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(entries, overrides = {}) {
  const local = [];
  const central = [];
  let offset = 0;

  entries.forEach(([name, value, flags = 0], index) => {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(value);
    const declaredSize = overrides.declaredSize?.[index] ?? data.length;
    const checksum = crc32(data);
    const method = overrides.methods?.[index] ?? 0;
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(flags, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(declaredSize, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    local.push(localHeader, nameBuffer, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(flags, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(declaredSize, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt32LE(overrides.externalAttributes?.[index] ?? 0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + data.length;
  });

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBuffer, end]);
}

function writeFixtureSet(root) {
  for (const fixture of CASES.signatureCases) {
    fs.writeFileSync(path.join(root, fixture.name), Buffer.from(fixture.hex, 'hex'));
  }
  for (const fixture of CASES.archiveCases) {
    fs.writeFileSync(path.join(root, fixture.name), makeZip(fixture.entries));
  }
}

describe('P-MUST-04: dependency-free provenance format classification', () => {
  it('classifies raster signatures without trusting extensions', () => {
    for (const fixture of CASES.signatureCases) {
      const buffer = Buffer.from(fixture.hex, 'hex');
      assert.equal(classifyBuffer(buffer, fixture.name).format, fixture.format, fixture.name);
      assert.equal(classifyBuffer(buffer, 'misleading.txt').format, fixture.format, fixture.name);
    }
  });

  it('classifies supported ZIP containers from their members', () => {
    for (const fixture of CASES.archiveCases) {
      const buffer = makeZip(fixture.entries);
      const classification = classifyBuffer(buffer, fixture.name);
      assert.equal(classification.format, fixture.format, fixture.name);
      assert.equal(classification.container, 'zip');
    }
  });
});

describe('P-MUST-02 and P-MUST-15: bounded input and archive safety', () => {
  it('rejects malformed, traversing, absolute, encrypted, conflicting duplicate, and symlink entries', () => {
    assert.throws(() => parseZipContainer(Buffer.from('PK\u0003\u0004')), /malformed/i);
    for (const fixture of CASES.unsafeArchiveCases) {
      assert.throws(() => parseZipContainer(makeZip(fixture.entries)), /unsafe|encrypted/i, fixture.name);
    }
    assert.throws(
      () => parseZipContainer(makeZip([['same.xml', 'a', 0], ['same.xml', 'different', 0]])),
      /duplicate/i
    );
    assert.throws(
      () => parseZipContainer(makeZip([['folder/file.xml', 'a', 0], ['folder\\file.xml', 'different', 0]])),
      /duplicate/i
    );
    assert.throws(
      () => parseZipContainer(makeZip([['link', 'target', 0]], { externalAttributes: [(0o120777 << 16) >>> 0] })),
      /symlink/i
    );
  });

  it('caps archive entries, expansion, compression ratio, data URI bytes, files, bytes, and jobs', async () => {
    assert.throws(
      () => parseZipContainer(makeZip([['large.bin', 'x', 0]], { declaredSize: [1000] }), {
        ...LIMITS,
        maxArchiveExpandedBytes: 100,
      }),
      /expansion/i
    );
    assert.throws(
      () => parseZipContainer(makeZip([['ratio.bin', 'x', 0]], { declaredSize: [1000] }), {
        ...LIMITS,
        maxArchiveExpandedBytes: 2000,
        maxCompressionRatio: 10,
      }),
      /compression ratio/i
    );

    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-limits-'));
    try {
      fs.writeFileSync(path.join(temp, 'a.txt'), `prefix data:image/png;base64,${'A'.repeat(80)}`);
      fs.writeFileSync(path.join(temp, 'b.txt'), 'two');
      const report = await auditTargets([temp], {
        jobs: LIMITS.maxJobs + 50,
        limits: { ...LIMITS, maxFiles: 1, maxInputBytes: 20, maxDataUriBytes: 8 },
      });
      assert.equal(report.status, 'unsafe');
      assert.equal(report.recommendedExitCode, EXIT_CODES.INVALID);
      assert.equal(report.execution.jobs, LIMITS.maxJobs);
      assert.ok(report.errors.some((error) => /file count|input bytes|data URI/i.test(error.message)));
    } finally {
      fs.rmSync(temp, { recursive: true });
    }
  });

  it('rejects local symlinks without following them', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-link-'));
    try {
      const outside = path.join(os.tmpdir(), `scriveno-outside-${process.pid}.txt`);
      fs.writeFileSync(outside, 'outside');
      fs.symlinkSync(outside, path.join(temp, 'link.txt'));
      const report = await auditTargets([temp]);
      assert.equal(report.recommendedExitCode, EXIT_CODES.INVALID);
      assert.ok(report.errors.some((error) => /symlink/i.test(error.message)));
      fs.rmSync(outside);
    } finally {
      fs.rmSync(temp, { recursive: true });
    }
  });

  it('reports unsupported ZIP compression methods as degraded', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-method-'));
    try {
      const target = path.join(temp, 'unsupported.docx');
      fs.writeFileSync(target, makeZip([
        ['[Content_Types].xml', '<Types/>', 0],
        ['word/document.xml', '<w:document/>', 0],
      ], { methods: [0, 99] }));
      const report = await auditTargets([target]);
      assert.equal(report.targets[0].status, 'degraded');
      assert.equal(report.recommendedExitCode, EXIT_CODES.DEGRADED);
      assert.ok(report.errors.some((error) => /compression method 99/i.test(error.message)));
    } finally {
      fs.rmSync(temp, { recursive: true });
    }
  });
});

describe('P-MUST-01, P-MUST-03, and P-MUST-05: normalized read-only audit', () => {
  it('audits a directory deterministically with bounded jobs and unchanged bytes', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-batch-'));
    try {
      writeFixtureSet(temp);
      fs.writeFileSync(path.join(temp, 'notes.md'), `safe joiner: \u0644\u200d\u0627\ncarrier: A\u200bB\n${CASES.dataUri}\n`);
      const before = new Map(fs.readdirSync(temp).map((name) => [name, hash(path.join(temp, name))]));
      const report = await auditTargets([temp], { jobs: 3 });

      assert.deepStrictEqual(report.targets.map((target) => target.path), [...report.targets.map((target) => target.path)].sort());
      assert.ok(report.execution.peakWorkers <= 3);
      assert.equal(report.execution.jobs, 3);
      assert.ok(report.findings.some((finding) => finding.ruleId === 'unicode.zero_width' && finding.codePoint === 'U+200B'));
      assert.ok(!report.findings.some((finding) => finding.codePoint === 'U+200D'));
      assert.ok(report.targets.some((target) => target.embedded && target.format === 'png'));
      assert.deepStrictEqual(
        new Map(fs.readdirSync(temp).map((name) => [name, hash(path.join(temp, name))])),
        before
      );
    } finally {
      fs.rmSync(temp, { recursive: true });
    }
  });

  it('keeps visible Office content distinct from recognized metadata', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-office-'));
    try {
      const workbook = CASES.archiveCases.find((fixture) => fixture.format === 'xlsx');
      const filePath = path.join(temp, workbook.name);
      fs.writeFileSync(filePath, makeZip(workbook.entries));
      const report = await auditTargets([filePath]);
      assert.ok(report.findings.some((finding) => finding.channel === 'metadata'));
      assert.ok(report.findings.every((finding) => !finding.evidence.includes('Draft')));
      assert.equal(report.targets[0].format, 'xlsx');
    } finally {
      fs.rmSync(temp, { recursive: true });
    }
  });

  it('preserves a legitimate emoji ZWJ sequence', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-emoji-'));
    try {
      const target = path.join(temp, 'emoji.md');
      fs.writeFileSync(target, `Developer: \u{1F469}\u200D\u{1F4BB}\n`);
      const report = await auditTargets([target]);
      assert.ok(!report.findings.some((item) => item.codePoint === 'U+200D'));
    } finally {
      fs.rmSync(temp, { recursive: true });
    }
  });

  it('does not treat a later thematic-rule block as Markdown frontmatter', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-frontmatter-'));
    try {
      const target = path.join(temp, 'visible.md');
      fs.writeFileSync(target, 'Opening prose\n---\nauthor: AI tool\n---\nClosing prose\n');
      const report = await auditTargets([target]);
      assert.ok(!report.findings.some((item) => item.channel === 'metadata'));
    } finally {
      fs.rmSync(temp, { recursive: true });
    }
  });

  it('does not confirm negative c2patool claim and manifest phrases', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-c2pa-'));
    const tools = path.join(temp, 'tools');
    const originalPath = process.env.PATH;
    try {
      fs.mkdirSync(tools);
      const c2patool = path.join(tools, 'c2patool');
      const exiftool = path.join(tools, 'exiftool');
      fs.writeFileSync(c2patool, '#!/bin/sh\nprintf "No claim found. No manifest found.\\n"\n');
      fs.writeFileSync(exiftool, '#!/bin/sh\nprintf "[]\\n"\n');
      fs.chmodSync(c2patool, 0o755);
      fs.chmodSync(exiftool, 0o755);
      process.env.PATH = `${tools}${path.delimiter}${originalPath || ''}`;
      const target = path.join(temp, 'clear.png');
      fs.writeFileSync(target, Buffer.from(CASES.signatureCases.find((item) => item.format === 'png').hex, 'hex'));
      const report = await auditTargets([target]);
      assert.ok(!report.findings.some((item) => item.ruleId === 'c2pa.external_manifest'));
    } finally {
      process.env.PATH = originalPath;
      fs.rmSync(temp, { recursive: true });
    }
  });

  it('bounds stalled external provenance tools and reports degraded coverage', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-tool-timeout-'));
    const tools = path.join(temp, 'tools');
    const originalPath = process.env.PATH;
    try {
      fs.mkdirSync(tools);
      for (const tool of ['c2patool', 'exiftool']) {
        const executable = path.join(tools, tool);
        fs.writeFileSync(executable, '#!/usr/bin/env node\nsetInterval(() => {}, 1000);\n');
        fs.chmodSync(executable, 0o755);
      }
      process.env.PATH = `${tools}${path.delimiter}${originalPath || ''}`;
      const target = path.join(temp, 'clear.png');
      fs.writeFileSync(target, Buffer.from(CASES.signatureCases.find((item) => item.format === 'png').hex, 'hex'));
      const started = Date.now();
      const report = await auditTargets([target], {
        limits: { ...LIMITS, maxExternalToolMilliseconds: 50 },
      });
      assert.ok(Date.now() - started < 1000, 'external tool inspection should return within its bounded timeout');
      assert.equal(report.status, 'degraded');
      assert.equal(report.recommendedExitCode, EXIT_CODES.DEGRADED);
      assert.ok(report.errors.some((error) => error.code === 'exiftool_timeout'));
      assert.ok(report.errors.some((error) => error.code === 'c2patool_timeout'));
      const timeoutFindings = report.findings.filter((item) => item.ruleId === 'coverage.external_tool_timeout');
      assert.deepStrictEqual(timeoutFindings.map((item) => item.location.tool).sort(), ['c2patool', 'exiftool']);
      assert.ok(timeoutFindings.every((item) => item.confidence === 'informational' && item.channel === 'residual'));
    } finally {
      process.env.PATH = originalPath;
      fs.rmSync(temp, { recursive: true });
    }
  });
});

describe('P-MUST-06 and P-MUST-07: equivalent serializers and exit contract', () => {
  it('serializes the same stable findings to Markdown, JSON, and SARIF 2.1.0', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-output-'));
    try {
      const target = path.join(temp, 'finding.md');
      fs.writeFileSync(target, 'A\u200bB');
      const report = await auditTargets([target]);
      const markdown = serializeReport(report, 'markdown');
      const json = JSON.parse(serializeReport(report, 'json'));
      const sarif = JSON.parse(serializeReport(report, 'sarif'));
      const ids = report.findings.map((finding) => finding.ruleId);

      assert.deepStrictEqual(json.findings.map((finding) => finding.ruleId), ids);
      assert.equal(sarif.version, '2.1.0');
      assert.deepStrictEqual(sarif.runs[0].results.map((result) => result.ruleId), ids);
      assert.deepStrictEqual(
        sarif.runs[0].results.map((result) => result.locations[0].physicalLocation.artifactLocation.uri),
        report.findings.map((finding) => finding.target)
      );
      for (const id of ids) assert.match(markdown, new RegExp(id.replace('.', '\\.')));
      const unicodeFinding = report.findings.find((item) => item.ruleId === 'unicode.zero_width');
      assert.ok(markdown.includes(unicodeFinding.codePoint));
      assert.match(markdown, new RegExp(`\\| ${unicodeFinding.count} \\|`));
      assert.match(markdown, new RegExp(unicodeFinding.message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(markdown, /line 1, column 2, offset 1/);
    } finally {
      fs.rmSync(temp, { recursive: true });
    }
  });

  it('maps clear, findings, degraded, unsafe, and internal statuses to stable exits', () => {
    assert.equal(recommendedExitCode({ status: 'clear' }), 0);
    assert.equal(recommendedExitCode({ status: 'findings' }), 1);
    assert.equal(recommendedExitCode({ status: 'degraded' }), 2);
    assert.equal(recommendedExitCode({ status: 'unsafe' }), 64);
    assert.equal(recommendedExitCode({ status: 'error' }), 70);
  });

  it('reports an unrecovered local read failure as internal exit 70', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-internal-'));
    const originalReadFile = fs.promises.readFile;
    try {
      const target = path.join(temp, 'input.txt');
      fs.writeFileSync(target, 'plain text');
      fs.promises.readFile = async () => { throw new Error('simulated read failure'); };
      const report = await auditTargets([target]);
      assert.equal(report.status, 'error');
      assert.equal(report.recommendedExitCode, EXIT_CODES.INTERNAL);
    } finally {
      fs.promises.readFile = originalReadFile;
      fs.rmSync(temp, { recursive: true });
    }
  });
});

describe('P-MUST-18: provenance-check CLI contract', () => {
  it('emits JSON and SARIF for local targets and reserves provider selection', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-cli-'));
    try {
      fs.writeFileSync(path.join(temp, 'clear.txt'), 'plain text');
      const before = hash(path.join(temp, 'clear.txt'));
      const jsonRun = spawnSync(process.execPath, [
        path.join(ROOT, 'bin', 'install.js'), 'provenance-check', temp,
        '--jobs', '2', '--format', 'json', '--provider', 'local',
      ], { encoding: 'utf8' });
      assert.equal(jsonRun.status, 0, jsonRun.stderr);
      assert.equal(JSON.parse(jsonRun.stdout).operation, 'audit');

      const sarifRun = spawnSync(process.execPath, [
        path.join(ROOT, 'bin', 'install.js'), 'provenance-check', temp,
        '--format=sarif', '--strict', '--provider=local',
      ], { encoding: 'utf8' });
      assert.equal(JSON.parse(sarifRun.stdout).version, '2.1.0');
      assert.equal(hash(path.join(temp, 'clear.txt')), before);

      const invalidProvider = spawnSync(process.execPath, [
        path.join(ROOT, 'bin', 'install.js'), 'provenance-check', temp,
        '--provider', 'remote',
      ], { encoding: 'utf8' });
      assert.equal(invalidProvider.status, EXIT_CODES.INVALID);
    } finally {
      fs.rmSync(temp, { recursive: true });
    }
  });

  it('refuses to overwrite an existing report that is also an audited input', () => {
    const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-output-guard-')));
    try {
      const output = path.join(temp, 'audit.json');
      fs.writeFileSync(output, 'original report input');
      const before = hash(output);
      const run = spawnSync(process.execPath, [
        path.join(ROOT, 'bin', 'install.js'), 'provenance-check', temp,
        '--format', 'json', '--output', output, '--provider', 'local',
      ], { encoding: 'utf8' });
      assert.equal(run.status, EXIT_CODES.INVALID);
      assert.equal(hash(output), before);
    } finally {
      fs.rmSync(temp, { recursive: true });
    }
  });

  it('never overwrites an explicitly targeted input that fails classification', () => {
    const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-rejected-output-')));
    try {
      const target = path.join(temp, 'bad.txt');
      fs.writeFileSync(target, Buffer.from(CASES.signatureCases.find((item) => item.format === 'png').hex, 'hex'));
      const before = hash(target);
      const run = spawnSync(process.execPath, [
        path.join(ROOT, 'bin', 'install.js'), 'provenance-check', target,
        '--format', 'json', '--output', target, '--provider', 'local',
      ], { encoding: 'utf8' });
      assert.equal(run.status, EXIT_CODES.INVALID);
      assert.equal(hash(target), before);
    } finally {
      fs.rmSync(temp, { recursive: true });
    }
  });

  it('rejects a new report path inside an audited directory root', () => {
    const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-directory-output-')));
    try {
      fs.writeFileSync(path.join(temp, 'input.txt'), 'plain text');
      const output = path.join(temp, 'new-report.json');
      const run = spawnSync(process.execPath, [
        path.join(ROOT, 'bin', 'install.js'), 'provenance-check', temp,
        '--format', 'json', '--output', output, '--provider', 'local',
      ], { encoding: 'utf8' });
      assert.equal(run.status, EXIT_CODES.INVALID);
      assert.equal(fs.existsSync(output), false);
    } finally {
      fs.rmSync(temp, { recursive: true });
    }
  });

  it('rejects an output that aliases an input through a symlinked parent', () => {
    const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-alias-output-')));
    try {
      const real = path.join(temp, 'real');
      const alias = path.join(temp, 'alias');
      fs.mkdirSync(real);
      fs.symlinkSync(real, alias);
      const realInput = path.join(real, 'input.txt');
      const aliasedInput = path.join(alias, 'input.txt');
      fs.writeFileSync(realInput, 'plain text');
      const before = hash(realInput);
      const run = spawnSync(process.execPath, [
        path.join(ROOT, 'bin', 'install.js'), 'provenance-check', aliasedInput,
        '--format', 'json', '--output', realInput, '--provider', 'local',
      ], { encoding: 'utf8' });
      assert.equal(run.status, EXIT_CODES.INVALID);
      assert.equal(hash(realInput), before);
    } finally {
      fs.rmSync(temp, { recursive: true });
    }
  });

  it('rejects output inside the real directory of a symlinked directory target', () => {
    const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-directory-alias-')));
    try {
      const real = path.join(temp, 'real');
      const alias = path.join(temp, 'alias');
      fs.mkdirSync(real);
      fs.writeFileSync(path.join(real, 'input.txt'), 'plain text');
      fs.symlinkSync(real, alias);
      const output = path.join(real, 'audit.json');
      const run = spawnSync(process.execPath, [
        path.join(ROOT, 'bin', 'install.js'), 'provenance-check', alias,
        '--format', 'json', '--output', output, '--provider', 'local',
      ], { encoding: 'utf8' });
      assert.equal(run.status, EXIT_CODES.INVALID);
      assert.equal(fs.existsSync(output), false);
    } finally {
      fs.rmSync(temp, { recursive: true });
    }
  });
});
