#!/usr/bin/env node
// Implements: P-MUST-16, P-MUST-17
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const PACK_TIMEOUT_MS = 30_000;
const PACK_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
const PACK_TIMEOUT_SIGNAL = process.platform === 'win32' ? 'SIGTERM' : 'SIGKILL';

function classifySpawnFailure(result, limits) {
  const errorCode = result.error && result.error.code;
  if (errorCode === 'ETIMEDOUT') {
    return {
      kind: 'timeout',
      message: `${limits.label} timed out after ${limits.timeoutMs} ms.`,
    };
  }
  if (errorCode === 'ENOBUFS' || (result.error && /maxBuffer/i.test(result.error.message))) {
    return {
      kind: 'output-limit',
      message: `${limits.label} exceeded its ${limits.maxBuffer}-byte output limit.`,
    };
  }
  if (result.error) {
    return {
      kind: 'spawn-error',
      message: `${limits.label} could not start (${errorCode || 'unknown spawn error'}).`,
    };
  }
  if (result.signal) {
    return {
      kind: 'signal',
      message: `${limits.label} terminated by signal ${result.signal}.`,
    };
  }
  if (result.status !== 0) {
    return {
      kind: 'exit',
      message: `${limits.label} failed with exit ${result.status}.`,
    };
  }
  return null;
}

function runBoundedSync(command, args, options = {}) {
  const {
    label = path.basename(command),
    timeoutMs = PACK_TIMEOUT_MS,
    maxBuffer = PACK_MAX_BUFFER_BYTES,
    ...spawnOptions
  } = options;
  const result = spawnSync(command, args, {
    ...spawnOptions,
    timeout: timeoutMs,
    maxBuffer,
    killSignal: PACK_TIMEOUT_SIGNAL,
  });
  const failure = classifySpawnFailure(result, { label, timeoutMs, maxBuffer });
  if (failure) throw new Error(failure.message);
  return result;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function normalizedManifest(files) {
  return files
    .map((file) => ({ path: file.path, size: file.size, mode: file.mode }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function pack(destination) {
  const result = runBoundedSync(NPM, [
    'pack', '--ignore-scripts', '--json', '--pack-destination', destination,
  ], {
    cwd: ROOT,
    label: 'npm pack',
    timeoutMs: PACK_TIMEOUT_MS,
    maxBuffer: PACK_MAX_BUFFER_BYTES,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_ignore_scripts: 'true',
      npm_config_offline: 'true',
      npm_config_update_notifier: 'false',
    },
  });
  let entries;
  try {
    entries = JSON.parse(result.stdout);
  } catch {
    throw new Error('npm pack returned invalid JSON.');
  }
  if (!Array.isArray(entries) || entries.length !== 1 || !entries[0].filename) {
    throw new Error('npm pack did not describe exactly one tarball.');
  }
  const metadata = entries[0];
  const tarball = path.resolve(destination, metadata.filename);
  const relative = path.relative(path.resolve(destination), tarball);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(tarball).isFile()) {
    throw new Error('npm pack reported an unsafe tarball path.');
  }
  return {
    digest: sha256(tarball),
    manifest: normalizedManifest(metadata.files || []),
    filename: metadata.filename,
  };
}

function main() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-pack-repro-'));
  const firstDestination = path.join(temporaryRoot, 'first');
  const secondDestination = path.join(temporaryRoot, 'second');
  fs.mkdirSync(firstDestination);
  fs.mkdirSync(secondDestination);
  try {
    const first = pack(firstDestination);
    const second = pack(secondDestination);
    assert.equal(second.filename, first.filename, 'Pack filenames differ.');
    assert.deepStrictEqual(second.manifest, first.manifest, 'Normalized pack manifests differ.');
    assert.equal(second.digest, first.digest, 'Tarball SHA-256 digests differ.');
    process.stdout.write(`${JSON.stringify({
      ok: true,
      filename: first.filename,
      sha256: first.digest,
      fileCount: first.manifest.length,
    })}\n`);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Pack reproducibility check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  classifySpawnFailure,
  normalizedManifest,
  pack,
  runBoundedSync,
};
