// Implements: P-MUST-01, P-MUST-07, P-MUST-11, P-MUST-14, P-MUST-16, P-MUST-17, P-MUST-18
'use strict';

const { after, before, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const { classifySpawnFailure, runBoundedSync } = require('../scripts/check-pack-reproducibility');
const DEFAULT_COMMAND_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const DEFAULT_KILL_GRACE_MS = 250;

function positiveInteger(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function makeCommandContext(command, args) {
  return {
    executable: path.basename(command),
    operation: args.length > 0 ? path.basename(String(args[0])) : null,
    argumentCount: args.length,
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_COMMAND_TIMEOUT_MS);
    const maxOutputBytes = positiveInteger(options.maxOutputBytes, DEFAULT_MAX_OUTPUT_BYTES);
    const killGraceMs = positiveInteger(options.killGraceMs, DEFAULT_KILL_GRACE_MS);
    const context = makeCommandContext(command, args);
    const commandLabel = context.operation
      ? `${context.executable} ${context.operation}`
      : context.executable;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    let outputLimitExceeded = false;
    let failure = null;
    let settled = false;
    let deadlineTimer;
    let killTimer;

    function cleanup() {
      clearTimeout(deadlineTimer);
      clearTimeout(killTimer);
      child.stdout.off('data', onStdout);
      child.stderr.off('data', onStderr);
      child.off('error', onError);
      child.off('close', onClose);
    }

    function terminate(type, stream) {
      if (failure) return;
      timedOut = type === 'timeout';
      outputLimitExceeded = type === 'output-limit';
      failure = type === 'timeout'
        ? { type, message: `Command ${commandLabel} timed out after ${timeoutMs} ms.` }
        : {
            type,
            message: `Command ${commandLabel} ${stream} exceeded its ${maxOutputBytes}-byte capture limit.`,
          };
      const terminationRequested = child.kill('SIGTERM');
      if (terminationRequested && process.platform !== 'win32') {
        killTimer = setTimeout(() => {
          if (!settled && child.exitCode === null && child.signalCode === null) {
            child.kill('SIGKILL');
          }
        }, killGraceMs);
      }
    }

    function capture(chunks, chunk, stream) {
      const capturedBytes = stream === 'stdout' ? stdoutBytes : stderrBytes;
      const remaining = Math.max(0, maxOutputBytes - capturedBytes);
      if (remaining > 0) chunks.push(chunk.subarray(0, remaining));
      const nextBytes = capturedBytes + Math.min(chunk.length, remaining);
      if (stream === 'stdout') stdoutBytes = nextBytes;
      else stderrBytes = nextBytes;
      if (chunk.length > remaining) terminate('output-limit', stream);
    }

    function onStdout(chunk) {
      capture(stdout, chunk, 'stdout');
    }

    function onStderr(chunk) {
      capture(stderr, chunk, 'stderr');
    }

    function onError(error) {
      if (settled) return;
      settled = true;
      cleanup();
      const code = error && error.code ? error.code : 'unknown spawn error';
      reject(new Error(`Command ${commandLabel} could not start (${code}).`));
    }

    function onClose(code, signal) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        code,
        signal,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        timedOut,
        outputLimitExceeded,
        failure,
        context,
      });
    }

    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);
    child.on('error', onError);
    child.on('close', onClose);
    deadlineTimer = setTimeout(() => terminate('timeout'), timeoutMs);
  });
}

function assertNoCommandFailure(result) {
  if (result.failure) assert.fail(result.failure.message);
}

function assertCommandExit(result, expectedCode) {
  assertNoCommandFailure(result);
  const context = result.context || { executable: 'command', operation: null };
  const commandLabel = context.operation
    ? `${context.executable} ${context.operation}`
    : context.executable;
  assert.equal(result.signal, null, `Command ${commandLabel} terminated by signal ${result.signal}.`);
  assert.equal(result.code, expectedCode, result.stderr || `Command ${commandLabel} exited ${result.code}.`);
}

function parseJsonResult(result) {
  assertNoCommandFailure(result);
  assert.equal(result.signal, null, result.stderr);
  assert.ok(result.stdout.trim(), `Expected JSON output. stderr: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

describe('bounded release subprocess helpers', () => {
  it('classifies synchronous timeout, output-limit, and signal failures without command output', () => {
    assert.throws(
      () => runBoundedSync(process.execPath, ['-e', 'setTimeout(() => {}, 250)'], {
        cwd: ROOT,
        label: 'test timeout',
        timeoutMs: 25,
        maxBuffer: 1024,
      }),
      /test timeout timed out after 25 ms/
    );
    assert.throws(
      () => runBoundedSync(process.execPath, ['-e', "process.stdout.write('sensitive'.repeat(8192))"], {
        cwd: ROOT,
        label: 'test output',
        timeoutMs: 2_000,
        maxBuffer: 1024,
      }),
      (error) => {
        assert.match(error.message, /test output exceeded its 1024-byte output limit/);
        assert.doesNotMatch(error.message, /sensitive/);
        return true;
      }
    );
    assert.deepStrictEqual(
      classifySpawnFailure({ error: undefined, status: null, signal: 'SIGTERM' }, {
        label: 'test signal', timeoutMs: 25, maxBuffer: 1024,
      }),
      { kind: 'signal', message: 'test signal terminated by signal SIGTERM.' }
    );
  });

  it('enforces the synchronous deadline when a child ignores SIGTERM', () => {
    const resistantProgram = process.platform === 'win32'
      ? 'setTimeout(() => {}, 500)'
      : "process.on('SIGTERM', () => {}); setTimeout(() => {}, 500)";
    const startedAt = Date.now();

    assert.throws(
      () => runBoundedSync(process.execPath, ['-e', resistantProgram], {
        cwd: ROOT,
        label: 'hard deadline test',
        timeoutMs: 50,
        maxBuffer: 1024,
      }),
      /hard deadline test timed out after 50 ms/
    );
    const elapsedMs = Date.now() - startedAt;
    assert.ok(elapsedMs >= 40, `hard deadline returned too early after ${elapsedMs} ms`);
    assert.ok(elapsedMs < 250, `hard deadline returned late after ${elapsedMs} ms`);
  });

  it('surfaces bounded-runner failure context before exit-code assertions', () => {
    const result = {
      code: null,
      signal: 'SIGKILL',
      stdout: '',
      stderr: '',
      failure: {
        type: 'timeout',
        message: 'Command npm pack timed out after 30 ms.',
      },
    };

    assert.throws(
      () => assertCommandExit(result, 0),
      /Command npm pack timed out after 30 ms\./
    );
  });

  it('terminates a stalled asynchronous child within its deadline', async () => {
    const startedAt = Date.now();
    const stalledProgram = process.platform === 'win32'
      ? 'setTimeout(() => {}, 600)'
      : "process.on('SIGTERM', () => {}); setTimeout(() => {}, 600)";
    const result = await run(process.execPath, ['-e', stalledProgram], {
      cwd: ROOT,
      timeoutMs: 150,
      killGraceMs: 50,
      maxOutputBytes: 1024,
    });

    assert.equal(result.timedOut, true);
    assert.equal(result.outputLimitExceeded, false);
    assert.equal(result.failure.type, 'timeout');
    assert.match(result.failure.message, /node.*timed out after 150 ms/i);
    assert.equal(result.context.executable, path.basename(process.execPath));
    assert.equal(result.context.argumentCount, 2);
    if (process.platform !== 'win32') assert.equal(result.signal, 'SIGKILL');
    assert.ok(Date.now() - startedAt < 500, 'stalled child exceeded its bounded deadline');
  });

  it('caps asynchronous stdout and stderr and terminates excessive output', async () => {
    for (const stream of ['stdout', 'stderr']) {
      const result = await run(process.execPath, [
        '-e', `process.${stream}.write('private-output'.repeat(8192))`,
      ], {
        cwd: ROOT,
        timeoutMs: 2_000,
        killGraceMs: 25,
        maxOutputBytes: 1024,
      });

      assert.equal(result.timedOut, false);
      assert.equal(result.outputLimitExceeded, true);
      assert.equal(result.failure.type, 'output-limit');
      assert.match(
        result.failure.message,
        new RegExp(`node.*${stream} exceeded its 1024-byte capture limit`, 'i')
      );
      assert.ok(Buffer.byteLength(result[stream]) <= 1024);
      assert.doesNotMatch(result.failure.message, /private-output/);
    }
  });
});

describe('P-MUST-16: packed provenance consumer proof', { concurrency: 1 }, () => {
  let tempRoot;
  let consumerRoot;
  let packageRoot;
  let cliPath;
  let startProviderFixture;

  before(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-provenance-consumer-'));
    const packRoot = path.join(tempRoot, 'pack');
    consumerRoot = path.join(tempRoot, 'consumer');
    fs.mkdirSync(packRoot);
    fs.mkdirSync(consumerRoot);
    fs.writeFileSync(path.join(consumerRoot, 'package.json'), JSON.stringify({
      name: 'scriveno-provenance-consumer-proof',
      version: '1.0.0',
      private: true,
    }, null, 2));

    const pack = await run(NPM, [
      'pack', '--ignore-scripts', '--json', '--pack-destination', packRoot,
    ], {
      cwd: ROOT,
      env: {
        ...process.env,
        npm_config_audit: 'false',
        npm_config_fund: 'false',
        npm_config_update_notifier: 'false',
      },
    });
    assertCommandExit(pack, 0);
    const [{ filename }] = JSON.parse(pack.stdout);
    const tarball = path.join(packRoot, filename);
    const install = await run(NPM, [
      'install', '--ignore-scripts', '--offline', '--no-audit', '--no-fund',
      '--package-lock=false', tarball,
    ], {
      cwd: consumerRoot,
      env: {
        ...process.env,
        npm_config_audit: 'false',
        npm_config_fund: 'false',
        npm_config_update_notifier: 'false',
      },
    });
    assertCommandExit(install, 0);

    packageRoot = path.join(consumerRoot, 'node_modules', 'scriveno');
    cliPath = path.join(packageRoot, 'bin', 'install.js');
    ({ startProviderFixture } = require(path.join(
      packageRoot, 'data', 'proof', 'provenance', 'provider-fixture.js'
    )));
  });

  after(() => {
    if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  function runCli(args, env = {}) {
    return run(process.execPath, [cliPath, ...args], {
      cwd: consumerRoot,
      env: {
        ...process.env,
        NO_COLOR: '1',
        ...env,
      },
    });
  }

  it('installs the complete provenance runtime without lifecycle scripts', () => {
    const expected = [
      'lib/provenance-audit.js',
      'lib/provenance-provider.js',
      'lib/provenance-clean.js',
      'commands/scr/provenance-check.md',
      'commands/scr/provenance-clean.md',
      'docs/provenance-hygiene.md',
      'data/proof/provenance/provider-fixture.js',
      'data/proof/provenance/README.md',
    ];
    for (const relativePath of expected) {
      assert.ok(fs.existsSync(path.join(packageRoot, relativePath)), `${relativePath} is missing`);
    }
    const installer = require(cliPath);
    assert.equal(typeof installer.runProvenanceCheck, 'function');
    assert.equal(typeof installer.runProvenanceClean, 'function');
    assert.equal(typeof installer.parseArgs, 'function');
    assert.equal(require(path.join(packageRoot, 'package.json')).version, '3.8.0');
  });

  it('runs provider audit success as normalized JSON', async () => {
    const target = path.join(consumerRoot, 'clear.txt');
    fs.writeFileSync(target, 'Plain writer-owned text.');
    const fixture = await startProviderFixture({
      capabilities: {
        operations: ['inspect', 'clean'],
        formats: ['text'],
        limits: { max_concurrency: 2, max_input_bytes: 4096 },
      },
    });
    try {
      const result = await runCli([
        'provenance-check', target, '--provider', 'watermarks-remover', '--format', 'json',
      ], { SCRIVENO_WATERMARKS_SERVICE_URL: fixture.url });
      assertCommandExit(result, 0);
      const report = parseJsonResult(result);
      assert.equal(report.schemaVersion, 'scriveno.provenance.audit/v1');
      assert.equal(report.provider, 'watermarks-remover');
      assert.equal(report.serviceVersion, '0.5.0');
      assert.equal(report.recommendedExitCode, 0);
      assert.ok(report.providerAttempts.some((attempt) => attempt.status === 'succeeded'));
    } finally {
      await fixture.close();
    }
  });

  it('reports provider failure, local fallback, and required-provider exit behavior', async () => {
    const target = path.join(consumerRoot, 'fallback.txt');
    fs.writeFileSync(target, 'Plain writer-owned text.');
    const fixture = await startProviderFixture({
      capabilities: {
        operations: ['inspect', 'clean'],
        formats: ['text'],
        limits: { max_concurrency: 1, max_input_bytes: 4096 },
      },
      inspectStatus: 500,
    });
    try {
      const env = { SCRIVENO_WATERMARKS_SERVICE_URL: fixture.url };
      const fallback = await runCli([
        'provenance-check', target, '--provider', 'watermarks-remover', '--format', 'json',
      ], env);
      assertCommandExit(fallback, 2);
      const fallbackReport = parseJsonResult(fallback);
      assert.equal(fallbackReport.status, 'degraded');
      assert.equal(fallbackReport.recommendedExitCode, 2);
      assert.equal(fallbackReport.provider, 'local');
      assert.ok(fallbackReport.providerAttempts.some((attempt) => attempt.status === 'failed'));

      const required = await runCli([
        'provenance-check', target, '--provider', 'watermarks-remover',
        '--require-provider', '--format', 'json',
      ], env);
      assertCommandExit(required, 70);
      const requiredReport = parseJsonResult(required);
      assert.equal(requiredReport.status, 'error');
      assert.equal(requiredReport.recommendedExitCode, 70);
    } finally {
      await fixture.close();
    }
  });

  it('keeps cleaning dry-run by default and writes a verified cleaned copy on apply', async () => {
    const dryRunTarget = path.join(consumerRoot, 'dry-run.txt');
    fs.writeFileSync(dryRunTarget, 'A\u200bB');
    const dryRun = await runCli([
      'provenance-clean', dryRunTarget, '--provider', 'local', '--format', 'json',
    ]);
    assertCommandExit(dryRun, 1);
    const dryRunReport = parseJsonResult(dryRun);
    assert.equal(dryRunReport.execution.mode, 'dry-run');
    assert.equal(dryRunReport.recommendedExitCode, 1);
    assert.equal(fs.existsSync(path.join(consumerRoot, 'dry-run.cleaned.txt')), false);
    assert.equal(fs.readFileSync(dryRunTarget, 'utf8'), 'A\u200bB');

    const target = path.join(consumerRoot, 'marked.txt');
    fs.writeFileSync(target, 'A\u200bB');
    const fixture = await startProviderFixture({
      capabilities: {
        operations: ['inspect', 'clean'],
        formats: ['text'],
        limits: { max_concurrency: 1, max_input_bytes: 4096 },
      },
      cleanResponse: {
        ok: true,
        kind: 'text',
        cleaned: Buffer.from('AB').toString('base64'),
        report: {
          kind: 'text',
          stats: {
            input_length: 3,
            output_length: 2,
            removed: { 'U+200B': 1 },
            replaced: {},
            removed_count: 1,
            replaced_count: 0,
            nfkc_changed: false,
          },
          length: 2,
        },
      },
    });
    try {
      const applied = await runCli([
        'provenance-clean', target, '--apply', '--provider', 'watermarks-remover', '--format', 'json',
      ], { SCRIVENO_WATERMARKS_SERVICE_URL: fixture.url });
      assertCommandExit(applied, 0);
      const report = parseJsonResult(applied);
      assert.equal(report.schemaVersion, 'scriveno.provenance.clean/v1');
      assert.equal(report.provider, 'watermarks-remover');
      assert.equal(report.recommendedExitCode, 0);
      assert.equal(fs.readFileSync(target, 'utf8'), 'A\u200bB');
      assert.equal(fs.readFileSync(path.join(consumerRoot, 'marked.cleaned.txt'), 'utf8'), 'AB');
    } finally {
      await fixture.close();
    }
  });

  it('emits SARIF and rejects a signature mismatch with exit 64', async () => {
    const clear = path.join(consumerRoot, 'sarif.txt');
    fs.writeFileSync(clear, 'Plain writer-owned text.');
    const sarif = await runCli([
      'provenance-check', clear, '--provider', 'local', '--format', 'sarif',
    ]);
    assertCommandExit(sarif, 0);
    const sarifReport = parseJsonResult(sarif);
    assert.equal(sarifReport.version, '2.1.0');
    assert.equal(sarifReport.runs[0].invocations[0].exitCode, 0);

    const invalid = path.join(consumerRoot, 'misrouted.txt');
    fs.writeFileSync(invalid, Buffer.from('89504e470d0a1a0a', 'hex'));
    const rejected = await runCli([
      'provenance-check', invalid, '--provider', 'local', '--format', 'json',
    ]);
    assertCommandExit(rejected, 64);
    const rejectedReport = parseJsonResult(rejected);
    assert.equal(rejectedReport.recommendedExitCode, 64);
    assert.match(JSON.stringify(rejectedReport.errors), /mismatch|misroute|signature/i);
  });
});
