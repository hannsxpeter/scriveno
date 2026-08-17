// Implements: P-MUST-01, P-MUST-02, P-MUST-04, P-MUST-05, P-MUST-06, P-MUST-07, P-MUST-08, P-MUST-10, P-MUST-11, P-MUST-12, P-MUST-14, P-MUST-15, P-MUST-18
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { auditTargets, EXIT_CODES, serializeReport } = require('../lib/provenance-audit.js');
const { parseArgs } = require('../bin/install.js');
const {
  ENV,
  PROVIDER_LIMITS,
  ProviderError,
  connectProvider,
  validateServiceUrl,
} = require('../lib/provenance-provider.js');
const { startProviderFixture } = require('../data/proof/provenance/provider-fixture.js');

function providerEnv(url, token = '') {
  return {
    [ENV.serviceUrl]: url,
    ...(token ? { [ENV.bearerToken]: token } : {}),
  };
}

function digest(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function textInspectReport(overrides = {}) {
  return {
    length: 10,
    suspicious_total: 0,
    hits: [],
    notes: [],
    stylometry: {
      path: 'input.txt',
      word_count: 2,
      sentence_count: 1,
      burstiness_cv: 0,
      lexical_diversity: 1,
      ai_ngram_density: 0,
      matched_markers: [],
      score: 0,
      confidence_level: 'CLEAN',
      status: 'ok',
      findings: [],
      findings_confidence: [],
      notes: [],
    },
    ...overrides,
  };
}

function imageInspectReport(overrides = {}) {
  return {
    path: '/tmp/input.png',
    format: 'png',
    has_c2pa: false,
    has_ai_metadata: false,
    findings: [],
    findings_confidence: [],
    tools: {},
    synthid: null,
    notes: [],
    ...overrides,
  };
}

function textCleanReport(overrides = {}) {
  return {
    kind: 'text',
    stats: {
      input_length: 10,
      output_length: 10,
      removed: {},
      replaced: {},
      removed_count: 0,
      replaced_count: 0,
      nfkc_changed: false,
    },
    length: 10,
    ...overrides,
  };
}

const UPSTREAM_LAYER_B_FINDINGS = Object.freeze([
  "AI phrase marker 'delve into' found (1x)",
  "AI cadence phrase 'in conclusion' (1x)",
  'Unnaturally uniform sentence cadence (CV=0.12 < 0.35)',
  'Elevated AI formulaic transition density (1.75/100w)',
  'n-gram density 1.75',
  'burstiness 0.12',
  'lexical diversity 0.88',
  'syntactic homogeneity score 0.91',
]);

function tempFiles(names) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provider-'));
  const files = names.map((name) => {
    const filePath = path.join(root, name);
    fs.writeFileSync(filePath, name.includes('marked') ? 'A\u200bB' : 'plain text');
    const buffer = fs.readFileSync(filePath);
    return {
      path: filePath,
      format: 'text',
      buffer,
      expectedBytes: buffer.length,
      expectedSha256: digest(buffer),
    };
  });
  return { root, files };
}

describe('P-MUST-04 and P-MUST-10: provider negotiation and normalization', () => {
  it('validates health and capabilities before upload, captures version, and clamps concurrency', async () => {
    const fixture = await startProviderFixture({
      capabilities: {
        limits: { max_concurrency: 2, max_input_bytes: 4096 },
        operations: ['inspect', 'clean'],
        formats: ['text'],
      },
      delayPath: '/inspect',
      delayMilliseconds: 20,
    });
    const temp = tempFiles(['marked-one.txt', 'clear.txt', 'marked-two.txt']);
    try {
      const client = await connectProvider({ env: providerEnv(fixture.url), jobs: 7 });
      const result = await client.inspectFiles(temp.files);
      assert.equal(client.serviceVersion, '0.5.0');
      assert.equal(client.jobs, 2);
      assert.equal(result.peakWorkers, 2);
      assert.ok(fixture.peakRequests <= 2);
      assert.deepStrictEqual(fixture.requests.slice(0, 2).map((item) => item.path), ['/health', '/capabilities']);
      assert.ok(fixture.requests.slice(2).every((item) => item.path === '/inspect'));
      assert.deepStrictEqual(result.findings.map((item) => item.ruleId), [
        'provider.unicode.zwj_family',
        'provider.unicode.zwj_family',
      ]);
      assert.ok(result.findings.every((item) => item.confidence === 'probable' && item.channel === 'unicode'));
      assert.deepStrictEqual(result.ignoredEvidence, ['stylometry']);
      assert.ok(result.findings.every((item) => !JSON.stringify(item).includes('likely_ai')));
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('checks advertised operations and formats before sending file bytes', async () => {
    const fixture = await startProviderFixture({
      capabilities: { operations: ['inspect'], formats: ['png'], limits: { max_concurrency: 1 } },
    });
    const temp = tempFiles(['clear.txt']);
    try {
      const client = await connectProvider({ env: providerEnv(fixture.url) });
      await assert.rejects(() => client.inspectFiles(temp.files), (error) => {
        assert.equal(error.code, 'provider_format_unsupported');
        return true;
      });
      assert.deepStrictEqual(fixture.requests.map((item) => item.path), ['/health', '/capabilities']);
      await assert.rejects(() => client.cleanFile(temp.files[0]), (error) => {
        assert.equal(error.code, 'provider_operation_unsupported');
        return true;
      });
      assert.deepStrictEqual(fixture.requests.map((item) => item.path), ['/health', '/capabilities']);
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('uses only conservative cleaning options and never requests pixel or humanizing work', async () => {
    const fixture = await startProviderFixture({
      capabilities: { operations: ['inspect', 'clean'], formats: ['text'] },
    });
    const temp = tempFiles(['clear.txt']);
    try {
      const client = await connectProvider({ env: providerEnv(fixture.url) });
      const result = await client.cleanFile(temp.files[0]);
      const request = fixture.requests.find((item) => item.path === '/clean');
      assert.deepStrictEqual(request.body.options, {
        keep_non_ai_metadata: true,
        also_layer_a_text: true,
      });
      assert.equal('remove_pixel' in request.body.options, false);
      assert.equal('nfkc' in request.body.options, false);
      assert.equal('aggressive_homoglyphs' in request.body.options, false);
      assert.deepStrictEqual(result.cleaned, temp.files[0].buffer);
      assert.equal(result.schemaVersion, 'scriveno.provenance.clean/v1');
      assert.equal(result.provider, 'watermarks-remover');
      assert.equal(result.kind, 'text');
      assert.equal(result.format, 'text');
      assert.deepStrictEqual(result.changes, { actions: [], removedCount: 0, replacedCount: 0 });
      assert.deepStrictEqual(result.bytes, {
        input: temp.files[0].buffer.length,
        output: temp.files[0].buffer.length,
      });
      assert.deepStrictEqual(result.residual, {
        c2pa: null,
        aiMetadata: null,
        findings: [],
      });
      assert.equal('report' in result, false);
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('normalizes faithful container layer_a_hits into Scriveno findings', async () => {
    const fixture = await startProviderFixture({
      capabilities: { formats: ['epub'] },
      inspectKind: 'container',
      inspectReport: {
        path: '/tmp/input.epub',
        format: 'epub',
        has_c2pa: false,
        has_ai_metadata: false,
        findings: [],
        findings_confidence: [],
        tools: {},
        details: {},
        notes: [],
        suspicious_total: 1,
        layer_a_hits: [{
          codepoint: 'U+200B',
          label: 'U+200B ZERO WIDTH SPACE (Cf)',
          count: 1,
          kind: 'strip',
          confidence: 'probable',
          sample_offsets: [17],
        }],
      },
    });
    const temp = tempFiles(['book.epub']);
    temp.files[0].format = 'epub';
    try {
      const client = await connectProvider({ env: providerEnv(fixture.url) });
      const result = await client.inspectFiles(temp.files);
      assert.deepStrictEqual(result.findings.map((item) => ({
        ruleId: item.ruleId,
        codePoint: item.codePoint,
        location: item.location,
      })), [{
        ruleId: 'provider.unicode.strip',
        codePoint: 'U+200B',
        location: { offset: 17 },
      }]);
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('rejects empty, contradictory, and malformed kind-specific inspect payloads', async () => {
    const scenarios = [
      {
        response: {},
        format: 'text',
      },
      {
        response: { ok: true, kind: 'text', suspicious: false, report: {} },
        format: 'text',
      },
      {
        response: {
          ok: true,
          kind: 'text',
          suspicious: false,
          report: textInspectReport({ findings: [] }),
        },
        format: 'text',
      },
      {
        response: {
          ok: true,
          kind: 'text',
          suspicious: true,
          report: textInspectReport({ suspicious_total: 1, hits: [null] }),
        },
        format: 'text',
      },
      {
        response: {
          ok: true,
          kind: 'text',
          suspicious: false,
          report: textInspectReport({
            suspicious_total: 0,
            hits: [{
              codepoint: 'U+200B', label: 'ZERO WIDTH SPACE', count: 1, kind: 'strip',
              confidence: 'probable', sample_offsets: [1],
            }],
          }),
        },
        format: 'text',
      },
      {
        response: {
          ok: true,
          kind: 'text',
          suspicious: false,
          report: textInspectReport({ stylometry: undefined }),
        },
        format: 'text',
      },
      {
        response: {
          ok: true,
          kind: 'text',
          suspicious: true,
          report: textInspectReport({
            suspicious_total: 1,
            hits: [{
              codepoint: 'U+200B', label: 'ZERO WIDTH SPACE', count: 1, kind: 'strip',
              confidence: 'probable', sample_offsets: [1], stylometry: 'likely_ai',
            }],
          }),
        },
        format: 'text',
      },
      {
        response: { ok: true, kind: 'image', suspicious: false, report: imageInspectReport() },
        format: 'text',
      },
      {
        response: {
          ok: true,
          kind: 'image',
          suspicious: true,
          report: imageInspectReport({ has_c2pa: 'yes' }),
        },
        format: 'png',
      },
      {
        response: {
          ok: true,
          kind: 'container',
          suspicious: true,
          report: {
            path: '/tmp/input.epub', format: 'epub', has_c2pa: false, has_ai_metadata: false,
            findings: [], findings_confidence: [], tools: {}, details: {}, notes: [],
            suspicious_total: 1, layer_a_hits: ['not-a-hit'],
          },
        },
        format: 'epub',
      },
      {
        response: {
          ok: true,
          kind: 'container',
          suspicious: true,
          report: {
            path: '/tmp/input.epub', format: 'epub', has_c2pa: false, has_ai_metadata: false,
            findings: [], findings_confidence: [], tools: {}, details: {}, notes: [],
            suspicious_total: 0, layer_a_hits: [],
          },
        },
        format: 'epub',
      },
    ];
    for (const [index, scenario] of scenarios.entries()) {
      const fixture = await startProviderFixture({
        capabilities: { formats: [scenario.format] },
        inspectResponse: scenario.response,
      });
      const temp = tempFiles([`input-${index}.txt`]);
      temp.files[0].format = scenario.format;
      try {
        const client = await connectProvider({ env: providerEnv(fixture.url) });
        await assert.rejects(() => client.inspectFiles(temp.files), (error) => {
          assert.ok(error instanceof ProviderError);
          assert.equal(error.code, 'provider_malformed_response', `scenario ${index}`);
          return true;
        });
      } finally {
        fs.rmSync(temp.root, { recursive: true });
        await fixture.close();
      }
    }
  });

  it('normalizes authoritative image booleans and excludes every Layer B string and aggregate', async () => {
    const fixture = await startProviderFixture({
      capabilities: { formats: ['png'] },
      inspectResponse: {
        ok: true,
        kind: 'image',
        suspicious: true,
        report: imageInspectReport({
          has_c2pa: true,
          has_ai_metadata: true,
          findings: [
            'C2PA manifest present',
            'generator metadata present',
            'Layer B stylometry likely_ai aggregate score 0.99',
            ...UPSTREAM_LAYER_B_FINDINGS,
          ],
          findings_confidence: [
            'confirmed', 'confirmed', 'probable',
            ...UPSTREAM_LAYER_B_FINDINGS.map(() => 'probable'),
          ],
        }),
      },
    });
    const temp = tempFiles(['photo.png']);
    temp.files[0].format = 'png';
    try {
      const client = await connectProvider({ env: providerEnv(fixture.url) });
      const result = await client.inspectFiles(temp.files);
      assert.ok(result.findings.some((item) => item.ruleId === 'provider.c2pa.present'));
      assert.ok(result.findings.some((item) => item.ruleId === 'provider.metadata.ai_present'));
      assert.equal(
        /stylometr|layer b|likely_ai|aggregate|phrase marker|cadence phrase|uniform sentence|formulaic transition|n-gram|burstiness|lexical diversity/i
          .test(JSON.stringify(result.findings)),
        false
      );
      assert.deepStrictEqual(result.ignoredEvidence, ['provider-freeform']);
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('ignores every untyped inspect finding while preserving boolean summary findings', async () => {
    const untypedFindings = [
      'syntactic authorship claim confidence 0.91',
      'authorship-model metadata confidence 0.88',
    ];
    const fixture = await startProviderFixture({
      capabilities: { formats: ['png'] },
      inspectResponse: {
        ok: true,
        kind: 'image',
        suspicious: true,
        report: imageInspectReport({
          has_c2pa: true,
          has_ai_metadata: true,
          findings: untypedFindings,
          findings_confidence: ['confirmed', 'confirmed'],
        }),
      },
    });
    const temp = tempFiles(['photo.png']);
    temp.files[0].format = 'png';
    try {
      const client = await connectProvider({ env: providerEnv(fixture.url) });
      const result = await client.inspectFiles(temp.files);
      assert.deepStrictEqual(result.findings.map((item) => item.ruleId), [
        'provider.c2pa.present',
        'provider.metadata.ai_present',
      ]);
      assert.equal(untypedFindings.some((value) => JSON.stringify(result).includes(value)), false);
      assert.deepStrictEqual(result.ignoredEvidence, ['provider-freeform']);
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('rejects empty, contradictory, and malformed kind-specific clean payloads', async () => {
    const scenarios = [
      { response: {}, format: 'text' },
      {
        response: { ok: true, kind: 'image', cleaned: Buffer.from('plain text').toString('base64'), report: imageInspectReport() },
        format: 'text',
      },
      {
        response: { ok: true, kind: 'text', cleaned: Buffer.from('plain text').toString('base64'), report: {} },
        format: 'text',
      },
      {
        response: {
          ok: true, kind: 'text', cleaned: Buffer.from('plain text').toString('base64'),
          report: textCleanReport({ actions: [] }),
        },
        format: 'text',
      },
      {
        response: {
          ok: true, kind: 'text', cleaned: Buffer.from('plain text').toString('base64'),
          report: textCleanReport({ stats: { removed_count: 'zero' } }),
        },
        format: 'text',
      },
      {
        response: {
          ok: true, kind: 'text', cleaned: Buffer.from('plain text').toString('base64'),
          report: textCleanReport({ stats: {
            input_length: 10, output_length: 10, removed: {}, replaced: {},
            removed_count: 0, replaced_count: 0, nfkc_changed: true,
          } }),
        },
        format: 'text',
      },
      {
        response: {
          ok: true, kind: 'container', cleaned: Buffer.from('plain text').toString('base64'),
          report: {
            kind: 'container', format: 'epub', actions: [], bytes_in: 10, bytes_out: 10,
            still_has_c2pa: false, still_has_ai_metadata: 'no', post_findings: [],
          },
        },
        format: 'epub',
      },
      {
        response: {
          ok: true, kind: 'container', cleaned: Buffer.from('plain text').toString('base64'),
          report: {
            kind: 'container', format: 'epub', actions: [], bytes_in: 10, bytes_out: 10,
            still_has_c2pa: false, still_has_ai_metadata: false, post_findings: [],
          },
        },
        format: 'epub',
      },
      {
        response: {
          ok: true, kind: 'image', cleaned: Buffer.from('plain text').toString('base64'),
          report: {
            kind: 'image', format: 'png', actions: ['CtrlRegen pixel removal'],
            bytes_in: 10, bytes_out: 10, still_has_c2pa: false, still_has_ai_metadata: false,
            post_findings: [], synthid_before: null, synthid_after: null,
            pixel_removal: { available: true },
          },
        },
        format: 'png',
      },
      {
        response: { ok: true, kind: 'text', cleaned: 'not-base64', report: textCleanReport() },
        format: 'text',
      },
    ];
    for (const [index, scenario] of scenarios.entries()) {
      const fixture = await startProviderFixture({
        capabilities: { formats: [scenario.format] },
        cleanResponse: scenario.response,
      });
      const temp = tempFiles([`clean-${index}.txt`]);
      temp.files[0].format = scenario.format;
      try {
        const client = await connectProvider({ env: providerEnv(fixture.url) });
        await assert.rejects(() => client.cleanFile(temp.files[0]), (error) => {
          assert.ok(error instanceof ProviderError);
          assert.equal(error.code, 'provider_malformed_response', `scenario ${index}`);
          return true;
        });
      } finally {
        fs.rmSync(temp.root, { recursive: true });
        await fixture.close();
      }
    }
  });

  it('normalizes authoritative container clean residual booleans', async () => {
    const fixture = await startProviderFixture({
      capabilities: { formats: ['epub'] },
      cleanResponse: {
        ok: true,
        kind: 'container',
        cleaned: Buffer.from('plain text').toString('base64'),
        report: {
          kind: 'container', format: 'epub', actions: ['removed metadata'],
          bytes_in: 10, bytes_out: 10, still_has_c2pa: true, still_has_ai_metadata: false,
          post_findings: ['C2PA manifest remains', ...UPSTREAM_LAYER_B_FINDINGS],
          meta: { format: 'epub' },
        },
      },
    });
    const temp = tempFiles(['book.epub']);
    temp.files[0].format = 'epub';
    try {
      const client = await connectProvider({ env: providerEnv(fixture.url) });
      const result = await client.cleanFile(temp.files[0]);
      assert.deepStrictEqual(result.residual, {
        c2pa: true,
        aiMetadata: false,
        findings: ['Provider C2PA summary: present.'],
      });
      assert.deepStrictEqual(result.ignoredEvidence, ['provider-freeform']);
      assert.equal('report' in result, false);
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('ignores every untyped clean finding while preserving residual boolean summary findings', async () => {
    const untypedFindings = [
      'syntactic authorship claim confidence 0.91',
      'authorship-model metadata confidence 0.88',
    ];
    const fixture = await startProviderFixture({
      capabilities: { formats: ['epub'] },
      cleanResponse: {
        ok: true,
        kind: 'container',
        cleaned: Buffer.from('plain text').toString('base64'),
        report: {
          kind: 'container', format: 'epub', actions: ['removed metadata'],
          bytes_in: 10, bytes_out: 10, still_has_c2pa: true, still_has_ai_metadata: true,
          post_findings: untypedFindings,
          meta: { format: 'epub' },
        },
      },
    });
    const temp = tempFiles(['book.epub']);
    temp.files[0].format = 'epub';
    try {
      const client = await connectProvider({ env: providerEnv(fixture.url) });
      const result = await client.cleanFile(temp.files[0]);
      assert.deepStrictEqual(result.residual, {
        c2pa: true,
        aiMetadata: true,
        findings: [
          'Provider C2PA summary: present.',
          'Provider AI metadata summary: present.',
        ],
      });
      assert.equal(untypedFindings.some((value) => JSON.stringify(result).includes(value)), false);
      assert.deepStrictEqual(result.ignoredEvidence, ['provider-freeform']);
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('rejects untested versions and overstated capabilities before upload', async () => {
    for (const fixtureOptions of [
      { version: '0.6.0', capabilities: { version: '0.6.0' } },
      { capabilities: { operations: ['inspect', 'clean', 'pixel-clean'] } },
      { capabilities: { formats: ['text', 'video'] } },
      { capabilities: { limits: { max_concurrency: 'many' } } },
      { capabilities: { tools: [] } },
    ]) {
      const fixture = await startProviderFixture(fixtureOptions);
      try {
        await assert.rejects(() => connectProvider({ env: providerEnv(fixture.url) }), (error) => {
          assert.equal(error.code, 'provider_capabilities_invalid');
          return true;
        });
        assert.deepStrictEqual(fixture.requests.map((item) => item.path), ['/health', '/capabilities']);
      } finally {
        await fixture.close();
      }
    }
  });
});

describe('P-MUST-02 and P-MUST-15: bounded provider transport', () => {
  it('rejects oversized requests before upload', async () => {
    const fixture = await startProviderFixture({ capabilities: { formats: ['text'] } });
    const temp = tempFiles(['large.txt']);
    const input = Buffer.from('too large');
    fs.writeFileSync(temp.files[0].path, input);
    Object.assign(temp.files[0], {
      buffer: input,
      expectedBytes: input.length,
      expectedSha256: digest(input),
    });
    try {
      const client = await connectProvider({
        env: providerEnv(fixture.url),
        limits: { ...PROVIDER_LIMITS, maxInputBytes: 4 },
      });
      await assert.rejects(() => client.inspectFiles(temp.files), (error) => {
        assert.equal(error.code, 'provider_request_too_large');
        return true;
      });
      assert.deepStrictEqual(fixture.requests.map((item) => item.path), ['/health', '/capabilities']);
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('applies maxRequestBytes to the encoded envelope independently of maxInputBytes', async () => {
    const fixture = await startProviderFixture({ capabilities: { formats: ['text'] } });
    const temp = tempFiles(['clear.txt']);
    try {
      const client = await connectProvider({
        env: providerEnv(fixture.url),
        limits: { maxInputBytes: 1024, maxRequestBytes: 32 },
      });
      assert.ok(temp.files[0].buffer.length < 1024);
      await assert.rejects(() => client.inspectFiles(temp.files), (error) => {
        assert.equal(error.code, 'provider_request_too_large');
        assert.match(error.message, /request/i);
        return true;
      });
      assert.deepStrictEqual(fixture.requests.map((item) => item.path), ['/health', '/capabilities']);
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('bounds time and response bytes and rejects malformed JSON', async () => {
    for (const scenario of [
      { fixture: { delayPath: '/health', delayMilliseconds: 100 }, code: 'provider_timeout' },
      { fixture: { oversizedPath: '/health', oversizedBytes: 4096 }, code: 'provider_response_too_large' },
      { fixture: { malformedPath: '/health' }, code: 'provider_malformed_response' },
    ]) {
      const fixture = await startProviderFixture(scenario.fixture);
      try {
        await assert.rejects(() => connectProvider({
          env: providerEnv(fixture.url),
          limits: { ...PROVIDER_LIMITS, timeoutMilliseconds: 30, maxReportBytes: 512 },
        }), (error) => {
          assert.equal(error.code, scenario.code);
          return true;
        });
      } finally {
        await fixture.close();
      }
    }
  });

  it('uses absolute DNS and response deadlines, including a response that drips continuously', async () => {
    await assert.rejects(() => Promise.race([
      validateServiceUrl('https://provider.example', {
        lookup: async () => new Promise(() => {}),
        timeoutMilliseconds: 30,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('outer DNS test deadline')), 200)),
    ]), (error) => {
      assert.equal(error.code, 'provider_dns_timeout');
      return true;
    });

    const fixture = await startProviderFixture({
      slowDripPath: '/health',
      slowDripChunks: 20,
      slowDripMilliseconds: 10,
    });
    try {
      await assert.rejects(() => connectProvider({
        env: providerEnv(fixture.url),
        limits: { timeoutMilliseconds: 50 },
      }), (error) => {
        assert.equal(error.code, 'provider_timeout');
        return true;
      });
    } finally {
      await fixture.close();
    }
  });

  it('uses separate small-report and bounded clean-response caps for large accepted inputs', async () => {
    assert.ok(PROVIDER_LIMITS.maxCleanResponseBytes > PROVIDER_LIMITS.maxReportBytes);
    const fixture = await startProviderFixture({ capabilities: { formats: ['text'] } });
    const temp = tempFiles(['large-clean.txt']);
    const input = Buffer.alloc(512 * 1024, 0x61);
    fs.writeFileSync(temp.files[0].path, input);
    Object.assign(temp.files[0], {
      buffer: input,
      expectedBytes: input.length,
      expectedSha256: digest(input),
    });
    try {
      const client = await connectProvider({
        env: providerEnv(fixture.url),
        limits: {
          maxInputBytes: 1024 * 1024,
          maxRequestBytes: 1024 * 1024,
          maxReportBytes: 512,
          maxCleanResponseBytes: 1024 * 1024,
          timeoutMilliseconds: 1000,
        },
      });
      const result = await client.cleanFile(temp.files[0]);
      assert.equal(result.cleaned.length, input.length);
      assert.deepStrictEqual(result.cleaned, input);
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('refuses redirects instead of following them', async () => {
    const fixture = await startProviderFixture({ redirectPath: '/health' });
    try {
      await assert.rejects(() => connectProvider({ env: providerEnv(fixture.url) }), (error) => {
        assert.equal(error.code, 'provider_redirect_refused');
        return true;
      });
      assert.equal(fixture.requests.length, 1);
    } finally {
      await fixture.close();
    }
  });
});

describe('P-MUST-15: endpoint and credential safety', () => {
  it('does not redact token collisions from health, capabilities, inspect protocol fields, or cleaned base64', async () => {
    const healthFixture = await startProviderFixture();
    try {
      const client = await connectProvider({ env: providerEnv(healthFixture.url, '0.5.0') });
      assert.equal(client.serviceVersion, '0.5.0');
      assert.equal(client.capabilities.version, '0.5.0');
    } finally {
      await healthFixture.close();
    }

    const capabilityFixture = await startProviderFixture({
      capabilities: { operations: ['inspect', 'clean'], formats: ['text'] },
    });
    try {
      const client = await connectProvider({ env: providerEnv(capabilityFixture.url, 'inspect') });
      assert.deepStrictEqual(client.capabilities.operations, ['inspect', 'clean']);
    } finally {
      await capabilityFixture.close();
    }

    const inspectFixture = await startProviderFixture({ capabilities: { formats: ['text'] } });
    const inspectTemp = tempFiles(['marked.txt']);
    try {
      const client = await connectProvider({ env: providerEnv(inspectFixture.url, 'text') });
      const result = await client.inspectFiles(inspectTemp.files);
      assert.equal(result.attempts[0].status, 'succeeded');
      assert.equal(result.findings[0].ruleId, 'provider.unicode.zwj_family');
    } finally {
      fs.rmSync(inspectTemp.root, { recursive: true });
      await inspectFixture.close();
    }

    const cleanFixture = await startProviderFixture({ capabilities: { formats: ['text'] } });
    const cleanTemp = tempFiles(['clear.txt']);
    try {
      assert.ok(cleanTemp.files[0].buffer.toString('base64').includes('aW'));
      const client = await connectProvider({ env: providerEnv(cleanFixture.url, 'aW') });
      const result = await client.cleanFile(cleanTemp.files[0]);
      assert.deepStrictEqual(result.cleaned, cleanTemp.files[0].buffer);
    } finally {
      fs.rmSync(cleanTemp.root, { recursive: true });
      await cleanFixture.close();
    }
  });

  it('permits HTTP only on loopback and rejects unsafe remote DNS answers', async () => {
    const loopback = await validateServiceUrl('http://localhost:8765', {
      lookup: async () => [{ address: '127.0.0.1', family: 4 }],
    });
    assert.equal(loopback.url.protocol, 'http:');

    await assert.rejects(
      () => validateServiceUrl('http://example.test', { lookup: async () => [{ address: '203.0.113.10', family: 4 }] }),
      /HTTPS/i
    );
    for (const address of [
      '0.0.0.0', '10.0.0.2', '127.0.0.2', '169.254.169.254', '172.16.0.1', '192.168.1.1',
      '192.0.2.1', '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255',
      '::', '::1', '0:0:0:0:0:0:0:1', '::192.0.2.1', '::c000:201',
      '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a00:1', '64:ff9b::c000:201',
      '2001:db8::1', '2002:c000:0201::1', '3ffe::1', 'fc00::1', 'fec0::1', 'fe80::1', 'ff02::1',
    ]) {
      await assert.rejects(
        () => validateServiceUrl('https://provider.example', {
          lookup: async () => [{ address, family: address.includes(':') ? 6 : 4 }],
        }),
        (error) => {
          assert.equal(error.code, 'provider_address_refused', address);
          return true;
        }
      );
    }
    const publicEndpoint = await validateServiceUrl('https://provider.example', {
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    });
    assert.deepStrictEqual(publicEndpoint.addresses, [{ address: '93.184.216.34', family: 4 }]);
  });

  it('bounds redaction depth and converts complex provider JSON into visible local fallback', async () => {
    let nested = 'leaf';
    for (let depth = 0; depth < 80; depth++) nested = { nested };
    const fixture = await startProviderFixture({
      capabilities: { formats: ['text'] },
      inspectReport: textInspectReport({ nested }),
    });
    const temp = tempFiles(['clear.txt']);
    try {
      const report = await auditTargets([temp.files[0].path], {
        provider: 'watermarks-remover',
        providerEnv: providerEnv(fixture.url),
      });
      assert.equal(report.status, 'degraded');
      assert.equal(report.providerAttempts[0].status, 'failed');
      assert.equal(report.providerAttempts[0].code, 'provider_response_too_complex');
      assert.equal(report.recommendedExitCode, EXIT_CODES.DEGRADED);
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('turns normalization exceptions into visible fallback instead of crashing audit', async () => {
    const fixture = await startProviderFixture({
      capabilities: { formats: ['text'] },
      inspectResponse: { ok: true, kind: 'text', suspicious: false, report: {} },
    });
    const temp = tempFiles(['clear.txt']);
    try {
      const report = await auditTargets([temp.files[0].path], {
        provider: 'watermarks-remover',
        providerEnv: providerEnv(fixture.url),
      });
      assert.equal(report.status, 'degraded');
      assert.equal(report.providerAttempts[0].status, 'failed');
      assert.equal(report.providerAttempts[0].code, 'provider_malformed_response');
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('reads URL and bearer token only from environment-backed configuration and redacts failures', async () => {
    const secret = 'fixture-secret-token';
    const fixture = await startProviderFixture({ inspectStatus: 500, echoSecret: secret });
    const temp = tempFiles(['clear.txt']);
    try {
      const parsed = parseArgs(['provenance-check', temp.files[0].path, '--provider', 'watermarks-remover']);
      assert.equal(parsed.provenanceProvider, 'watermarks-remover');
      assert.throws(
        () => parseArgs(['provenance-check', temp.files[0].path, '--service-url', fixture.url]),
        /unknown/i
      );
      assert.throws(
        () => parseArgs(['provenance-check', temp.files[0].path, '--token', secret]),
        /unknown/i
      );
      const client = await connectProvider({ env: providerEnv(fixture.url, secret) });
      await assert.rejects(() => client.inspectFiles(temp.files), (error) => {
        assert.ok(error instanceof ProviderError);
        assert.equal(String(error.message).includes(secret), false);
        assert.equal(JSON.stringify(error).includes(secret), false);
        return true;
      });
      assert.ok(fixture.requests.every((item) => item.authorization === `Bearer ${secret}`));
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('redacts the environment bearer token with bounded traversal in every serialization', async () => {
    const secret = 'fixture-success-secret-token';
    const fixture = await startProviderFixture({
      capabilities: { formats: ['svg'] },
      inspectKind: 'container',
      inspectReport: {
        path: '/tmp/input.svg',
        format: 'svg',
        has_c2pa: true,
        has_ai_metadata: false,
        findings: [`C2PA evidence ${secret}`],
        findings_confidence: ['confirmed'],
        tools: {},
        details: {},
        notes: [],
        suspicious_total: 1,
        layer_a_hits: [{
          codepoint: 'U+200B',
          label: `carrier label ${secret}`,
          count: 1,
          kind: 'strip',
          confidence: 'probable',
          sample_offsets: [1],
        }],
      },
    });
    const temp = tempFiles(['clear.svg']);
    fs.writeFileSync(temp.files[0].path, '<svg><!-- plain --></svg>');
    try {
      const report = await auditTargets([temp.files[0].path], {
        provider: 'watermarks-remover',
        providerEnv: providerEnv(fixture.url, secret),
      });
      assert.equal(report.provider, 'watermarks-remover');
      const providerEvidence = report.findings
        .filter((item) => item.ruleId.startsWith('provider.'))
        .map((item) => item.evidence);
      assert.ok(providerEvidence.length >= 2);
      assert.ok(providerEvidence.every((item) => !item.includes(secret)));
      assert.ok(providerEvidence.filter((item) => item.includes('[REDACTED]')).length >= 1);
      for (const format of ['markdown', 'json', 'sarif']) {
        const serialized = serializeReport(report, format);
        assert.equal(serialized.includes(secret), false, format);
        assert.equal(serialized.includes('[REDACTED]'), true, format);
      }
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('redacts approved clean actions and ignores untyped residual evidence without changing cleaned bytes', async () => {
    const secret = 'fixture-clean-secret-token';
    const input = Buffer.from('plain text');
    const fixture = await startProviderFixture({
      capabilities: { formats: ['epub'] },
      cleanResponse: {
        ok: true,
        kind: 'container',
        cleaned: input.toString('base64'),
        report: {
          kind: 'container', format: 'epub', actions: [`removed metadata ${secret}`],
          bytes_in: input.length, bytes_out: input.length,
          still_has_c2pa: true, still_has_ai_metadata: false,
          post_findings: [`C2PA manifest ${secret}`], meta: { format: 'epub' },
        },
      },
    });
    const temp = tempFiles(['book.epub']);
    temp.files[0].format = 'epub';
    try {
      const client = await connectProvider({ env: providerEnv(fixture.url, secret) });
      const result = await client.cleanFile(temp.files[0]);
      assert.deepStrictEqual(result.cleaned, input);
      assert.deepStrictEqual(result.changes.actions, ['removed metadata [REDACTED]']);
      assert.deepStrictEqual(result.residual.findings, ['Provider C2PA summary: present.']);
      assert.deepStrictEqual(result.ignoredEvidence, ['provider-freeform']);
      assert.equal(JSON.stringify({ ...result, cleaned: '<bytes>' }).includes(secret), false);
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });
});

describe('P-MUST-01, P-MUST-05, P-MUST-06, P-MUST-07, P-MUST-14, and P-MUST-18: selection and fallback', () => {
  it('keeps local as the default and supports local, auto, and watermarks-remover selection', async () => {
    const fixture = await startProviderFixture({ capabilities: { formats: ['text'] } });
    const temp = tempFiles(['marked.txt']);
    try {
      const defaultReport = await auditTargets([temp.files[0].path], { providerEnv: providerEnv(fixture.url) });
      assert.equal(defaultReport.provider, 'local');
      assert.equal(fixture.requests.length, 0);

      const localReport = await auditTargets([temp.files[0].path], {
        provider: 'local',
        providerEnv: providerEnv(fixture.url),
      });
      assert.equal(localReport.provider, 'local');
      assert.equal(fixture.requests.length, 0);

      const autoWithoutConfiguration = await auditTargets([temp.files[0].path], {
        provider: 'auto',
        providerEnv: {},
      });
      assert.equal(autoWithoutConfiguration.provider, 'local');
      assert.equal(autoWithoutConfiguration.providerAttempts[0].status, 'not_configured');

      const requiredAutoWithoutConfiguration = await auditTargets([temp.files[0].path], {
        provider: 'auto',
        requireProvider: true,
        providerEnv: {},
      });
      assert.equal(requiredAutoWithoutConfiguration.status, 'error');
      assert.equal(requiredAutoWithoutConfiguration.recommendedExitCode, EXIT_CODES.INTERNAL);
      assert.equal(requiredAutoWithoutConfiguration.providerAttempts[0].status, 'failed');

      const autoReport = await auditTargets([temp.files[0].path], {
        provider: 'auto',
        providerEnv: providerEnv(fixture.url),
      });
      assert.equal(autoReport.provider, 'watermarks-remover');
      assert.equal(autoReport.serviceVersion, '0.5.0');
      assert.ok(autoReport.providerAttempts.some((item) => item.status === 'succeeded'));
      assert.ok(autoReport.findings.some((item) => item.ruleId === 'provider.unicode.zwj_family'));
      assert.equal(JSON.stringify(autoReport).includes('stylometry'), true);
      assert.ok(autoReport.findings.every((item) => !item.ruleId.includes('stylometry')));
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('records visible local fallback and returns exit 70 when the provider is required', async () => {
    const temp = tempFiles(['clear.txt']);
    try {
      const fallback = await auditTargets([temp.files[0].path], {
        provider: 'watermarks-remover',
        providerEnv: {},
      });
      assert.equal(fallback.provider, 'local');
      assert.equal(fallback.status, 'degraded');
      assert.equal(fallback.recommendedExitCode, EXIT_CODES.DEGRADED);
      assert.equal(fallback.providerAttempts[0].status, 'failed');
      assert.match(fallback.providerAttempts[0].reason, /not configured/i);

      const required = await auditTargets([temp.files[0].path], {
        provider: 'watermarks-remover',
        requireProvider: true,
        providerEnv: {},
      });
      assert.equal(required.status, 'error');
      assert.equal(required.recommendedExitCode, EXIT_CODES.INTERNAL);
      assert.equal(required.providerAttempts[0].status, 'failed');
    } finally {
      fs.rmSync(temp.root, { recursive: true });
    }
  });

  it('does not upload bytes that changed after the local validation pass', async () => {
    const fixture = await startProviderFixture({ capabilities: { formats: ['text'] } });
    const temp = tempFiles(['clear.txt']);
    const originalOpen = fs.promises.open;
    let changed = false;
    try {
      fs.promises.open = async (target, ...args) => {
        if (target === temp.files[0].path && !changed) {
          changed = true;
          fs.writeFileSync(target, 'changed after validation');
        }
        return originalOpen.call(fs.promises, target, ...args);
      };
      const report = await auditTargets([temp.files[0].path], {
        provider: 'watermarks-remover',
        providerEnv: providerEnv(fixture.url),
      });
      assert.equal(report.status, 'degraded');
      assert.equal(report.providerAttempts[0].code, 'provider_input_changed');
      assert.equal(fixture.requests.some((item) => item.path === '/inspect'), false);
    } finally {
      fs.promises.open = originalOpen;
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('uploads bytes from one stable non-symlink handle for inspect and clean path-replacement races', async () => {
    for (const operation of ['inspect', 'clean']) {
      const fixture = await startProviderFixture({ capabilities: { formats: ['text'] } });
      const temp = tempFiles([`${operation}.txt`]);
      const original = Buffer.from(temp.files[0].buffer);
      const replacement = Buffer.from('replacement bytes');
      temp.files[0].buffer = Buffer.from('untrusted cached bytes');
      const originalOpen = fs.promises.open;
      let raced = false;
      try {
        const client = await connectProvider({ env: providerEnv(fixture.url) });
        fs.promises.open = async (target, ...args) => {
          const handle = await originalOpen.call(fs.promises, target, ...args);
          if (target === temp.files[0].path && !raced) {
            raced = true;
            fs.renameSync(target, `${target}.original`);
            fs.writeFileSync(target, replacement);
          }
          return handle;
        };
        const result = operation === 'inspect'
          ? await client.inspectFiles(temp.files)
          : await client.cleanFile(temp.files[0]);
        const request = fixture.requests.find((item) => item.path === `/${operation}`);
        assert.deepStrictEqual(Buffer.from(request.body.file, 'base64'), original, operation);
        if (operation === 'clean') assert.deepStrictEqual(result.cleaned, original);
      } finally {
        fs.promises.open = originalOpen;
        fs.rmSync(temp.root, { recursive: true });
        await fixture.close();
      }
    }
  });

  it('fails closed for inspect and clean when current-user ownership cannot be established', async () => {
    const fixture = await startProviderFixture({ capabilities: { formats: ['text'] } });
    const temp = tempFiles(['ownership.txt']);
    const originalOpen = fs.promises.open;
    try {
      const client = await connectProvider({ env: providerEnv(fixture.url) });
      fs.promises.open = async (target, ...args) => {
        const handle = await originalOpen.call(fs.promises, target, ...args);
        if (target !== temp.files[0].path) return handle;
        return {
          async stat() {
            const stat = await handle.stat();
            return { isFile: () => stat.isFile(), size: stat.size, uid: undefined, dev: stat.dev, ino: stat.ino };
          },
          readFile: (...readArgs) => handle.readFile(...readArgs),
          close: () => handle.close(),
        };
      };
      for (const operation of ['inspect', 'clean']) {
        await assert.rejects(
          () => operation === 'inspect' ? client.inspectFiles(temp.files) : client.cleanFile(temp.files[0]),
          (error) => {
            assert.equal(error.code, 'provider_input_ownership_unknown', operation);
            return true;
          }
        );
      }
      assert.equal(fixture.requests.some((item) => ['/inspect', '/clean'].includes(item.path)), false);
    } finally {
      fs.promises.open = originalOpen;
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('bounds audit provider rereads by negotiated jobs', async () => {
    const fixture = await startProviderFixture({
      capabilities: { formats: ['text'], limits: { max_concurrency: 2, max_input_bytes: 4096 } },
    });
    const temp = tempFiles(['one.txt', 'two.txt', 'three.txt', 'four.txt', 'five.txt']);
    const originalOpen = fs.promises.open;
    const originalReadFile = fs.promises.readFile;
    const readsByPath = new Map();
    let active = 0;
    let peak = 0;
    let providerReadCount = 0;
    try {
      fs.promises.readFile = async (target, ...args) => {
        if (!temp.files.some((file) => file.path === target)) {
          return originalReadFile.call(fs.promises, target, ...args);
        }
        const count = (readsByPath.get(target) || 0) + 1;
        readsByPath.set(target, count);
        if (count === 1) return originalReadFile.call(fs.promises, target, ...args);
        providerReadCount++;
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        try {
          return await originalReadFile.call(fs.promises, target, ...args);
        } finally {
          active--;
        }
      };
      fs.promises.open = async (target, ...args) => {
        const handle = await originalOpen.call(fs.promises, target, ...args);
        if (!temp.files.some((file) => file.path === target)) return handle;
        providerReadCount++;
        active++;
        peak = Math.max(peak, active);
        return {
          stat: (...statArgs) => handle.stat(...statArgs),
          async readFile(...readArgs) {
            await new Promise((resolve) => setTimeout(resolve, 20));
            return handle.readFile(...readArgs);
          },
          async close() {
            active--;
            return handle.close();
          },
        };
      };
      const report = await auditTargets(temp.files.map((file) => file.path), {
        provider: 'watermarks-remover',
        providerEnv: providerEnv(fixture.url),
        jobs: 7,
      });
      assert.equal(report.provider, 'watermarks-remover');
      assert.equal(providerReadCount, temp.files.length);
      assert.ok(peak <= 2, `peak provider rereads was ${peak}`);
      assert.equal(report.execution.providerPeakWorkers, 2);
    } finally {
      fs.promises.open = originalOpen;
      fs.promises.readFile = originalReadFile;
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('waits for and accounts for every batch attempt when one member fails', async () => {
    const fixture = await startProviderFixture({
      capabilities: { formats: ['text'], limits: { max_concurrency: 2, max_input_bytes: 4096 } },
      failInspectName: 'fail.txt',
      delayPath: '/inspect',
      delayMilliseconds: 15,
    });
    const temp = tempFiles(['one.txt', 'fail.txt', 'three.txt', 'four.txt']);
    try {
      const report = await auditTargets(temp.files.map((file) => file.path), {
        provider: 'watermarks-remover',
        providerEnv: providerEnv(fixture.url),
        jobs: 2,
      });
      assert.equal(report.status, 'degraded');
      assert.equal(report.providerAttempts.length, 4);
      assert.equal(report.providerAttempts.filter((item) => item.status === 'failed').length, 1);
      assert.equal(report.providerAttempts.filter((item) => item.status === 'succeeded').length, 3);
      const completedRequests = fixture.requests.filter((item) => item.path === '/inspect').length;
      assert.equal(completedRequests, 4);
      await new Promise((resolve) => setTimeout(resolve, 40));
      assert.equal(fixture.requests.filter((item) => item.path === '/inspect').length, completedRequests);
    } finally {
      fs.rmSync(temp.root, { recursive: true });
      await fixture.close();
    }
  });

  it('parses every provider mode and rejects an impossible required-local request', () => {
    for (const provider of ['auto', 'watermarks-remover', 'local']) {
      assert.equal(parseArgs(['provenance-check', 'draft.md', '--provider', provider]).provenanceProvider, provider);
    }
    assert.equal(
      parseArgs(['provenance-check', 'draft.md', '--provider', 'watermarks-remover', '--require-provider']).provenanceRequireProvider,
      true
    );
    assert.throws(
      () => parseArgs(['provenance-check', 'draft.md', '--provider', 'local', '--require-provider']),
      /require-provider.*local/i
    );
  });
});
