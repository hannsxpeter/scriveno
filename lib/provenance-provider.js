// Implements: P-MUST-02, P-MUST-03, P-MUST-04, P-MUST-05, P-MUST-06, P-MUST-08, P-MUST-09, P-MUST-10, P-MUST-11, P-MUST-12, P-MUST-13, P-MUST-14, P-MUST-15, P-MUST-18
'use strict';

const crypto = require('node:crypto');
const dns = require('node:dns');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const path = require('node:path');

const ENV = Object.freeze({
  serviceUrl: 'SCRIVENO_WATERMARKS_SERVICE_URL',
  bearerToken: 'SCRIVENO_WATERMARKS_SERVICE_TOKEN',
});

const PROVIDER_LIMITS = Object.freeze({
  maxInputBytes: 64 * 1024 * 1024,
  maxRequestBytes: 96 * 1024 * 1024,
  maxReportBytes: 4 * 1024 * 1024,
  maxCleanResponseBytes: Math.ceil(64 * 1024 * 1024 / 3) * 4 + 4 * 1024 * 1024,
  maxJsonDepth: 32,
  maxJsonNodes: 50000,
  timeoutMilliseconds: 3000,
  maxJobs: 4,
});

const CONTRACT_VERSION = '0.5.0';
const CLEAN_SCHEMA_VERSION = 'scriveno.provenance.clean/v1';
const CONTRACT_FORMATS = new Set([
  'markdown', 'text', 'html', 'svg', 'png', 'jpeg', 'pdf', 'docx', 'odt', 'epub',
  'webp', 'avif', 'heic', 'bmp', 'gif', 'tiff', 'bigtiff', 'xlsx', 'pptx',
]);
const CONFIDENCE = new Set(['confirmed', 'probable', 'informational', 'likely_false_positive']);

class ProviderError extends Error {
  constructor(code, message, { recoverable = true, attempts = null } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.recoverable = recoverable;
    if (Array.isArray(attempts)) this.attempts = attempts;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      ...(this.attempts ? { attempts: this.attempts } : {}),
    };
  }
}

function mergeLimits(overrides = {}) {
  return Object.fromEntries(Object.entries(PROVIDER_LIMITS).map(([key, ceiling]) => {
    const requested = overrides[key];
    return [key, Number.isInteger(requested) && requested > 0 ? Math.min(requested, ceiling) : ceiling];
  }));
}

function validateProviderComplexity(value, limits = PROVIDER_LIMITS) {
  const stack = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const current = stack.pop();
    nodes++;
    if (nodes > limits.maxJsonNodes) {
      throw new ProviderError('provider_response_too_complex', 'The provider response exceeds the JSON node limit.');
    }
    if (current.value && typeof current.value === 'object') {
      const children = Array.isArray(current.value) ? current.value : Object.values(current.value);
      if (children.length && current.depth + 1 > limits.maxJsonDepth) {
        throw new ProviderError('provider_response_too_complex', 'The provider response exceeds the JSON depth limit.');
      }
      if (nodes + children.length > limits.maxJsonNodes) {
        throw new ProviderError('provider_response_too_complex', 'The provider response exceeds the JSON node limit.');
      }
      for (let index = children.length - 1; index >= 0; index--) {
        stack.push({ value: children[index], depth: current.depth + 1 });
      }
    }
  }
  return value;
}

function redactProviderText(value, secret) {
  if (typeof value !== 'string' || typeof secret !== 'string' || secret.length === 0) return value;
  return value.split(secret).join('[REDACTED]');
}

function ipv4Parts(address) {
  if (net.isIP(address) !== 4) return null;
  return address.split('.').map(Number);
}

function canonicalIp(address) {
  if (net.isIP(address) !== 6) return address.toLowerCase();
  try {
    return new URL(`http://[${address}]/`).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    return address.toLowerCase();
  }
}

function isExactLoopback(address) {
  const normalized = canonicalIp(address);
  return normalized === '127.0.0.1' || normalized === '::1';
}

function ipv4BigInt(address) {
  const parts = ipv4Parts(address);
  if (!parts) return null;
  return parts.reduce((value, part) => value * 256n + BigInt(part), 0n);
}

function ipv6BigInt(address) {
  const normalized = canonicalIp(address);
  if (net.isIP(normalized) !== 6) return null;
  const sides = normalized.split('::');
  if (sides.length > 2) return null;
  const left = sides[0] ? sides[0].split(':') : [];
  const right = sides[1] ? sides[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((sides.length === 1 && missing !== 0) || missing < 0) return null;
  const parts = [...left, ...Array(missing).fill('0'), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) return null;
  return parts.reduce((value, part) => value * 65536n + BigInt(Number.parseInt(part, 16)), 0n);
}

function inCidr(value, base, prefix, bits) {
  const shift = BigInt(bits - prefix);
  return value >> shift === base >> shift;
}

const SPECIAL_IPV4 = Object.freeze([
  [0x00000000n, 8], [0x0a000000n, 8], [0x64400000n, 10], [0x7f000000n, 8],
  [0xa9fe0000n, 16], [0xac100000n, 12], [0xc0000000n, 24], [0xc0000200n, 24],
  [0xc01fc400n, 24], [0xc034c100n, 24], [0xc0586300n, 24], [0xc0a80000n, 16],
  [0xc0af3000n, 24], [0xc6120000n, 15],
  [0xc6336400n, 24], [0xcb007100n, 24], [0xe0000000n, 4], [0xf0000000n, 4],
]);

function isGlobalUnicast(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const value = ipv4BigInt(address);
    return !SPECIAL_IPV4.some(([base, prefix]) => inCidr(value, base, prefix, 32));
  }
  if (family !== 6) return false;
  const value = ipv6BigInt(address);
  if (value == null || !inCidr(value, 0x20000000000000000000000000000000n, 3, 128)) return false;
  return ![
    [0x20010000000000000000000000000000n, 23],
    [0x20010db8000000000000000000000000n, 32],
    [0x20020000000000000000000000000000n, 16],
    [0x3ffe0000000000000000000000000000n, 16],
  ].some(([base, prefix]) => inCidr(value, base, prefix, 128));
}

function isForbiddenAddress(address) {
  return !isGlobalUnicast(address);
}

function normalizeLookupResult(result) {
  const entries = Array.isArray(result) ? result : [result];
  return entries.map((entry) => {
    if (typeof entry === 'string') return { address: entry, family: net.isIP(entry) };
    return { address: entry?.address, family: Number(entry?.family) || net.isIP(entry?.address || '') };
  }).filter((entry) => entry.address && (entry.family === 4 || entry.family === 6));
}

function withDeadline(promise, milliseconds, code, message) {
  let timer;
  return new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new ProviderError(code, message)), milliseconds);
    Promise.resolve(promise).then(resolve, reject);
  }).finally(() => clearTimeout(timer));
}

async function validateServiceUrl(rawUrl, options = {}) {
  let url;
  try {
    url = new URL(String(rawUrl || ''));
  } catch {
    throw new ProviderError('provider_url_invalid', 'The provider service URL is invalid.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ProviderError('provider_url_invalid', 'The provider service URL must use HTTP or HTTPS.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new ProviderError('provider_url_invalid', 'The provider service URL must not contain credentials, query text, or a fragment.');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const literalFamily = net.isIP(hostname);
  const lookup = options.lookup || dns.promises.lookup;
  const timeoutMilliseconds = Number.isInteger(options.timeoutMilliseconds) && options.timeoutMilliseconds > 0
    ? Math.min(options.timeoutMilliseconds, PROVIDER_LIMITS.timeoutMilliseconds)
    : PROVIDER_LIMITS.timeoutMilliseconds;
  let addresses;
  try {
    addresses = literalFamily
      ? [{ address: hostname, family: literalFamily }]
      : normalizeLookupResult(await withDeadline(
        lookup(hostname, { all: true, verbatim: true }),
        timeoutMilliseconds,
        'provider_dns_timeout',
        `The provider DNS lookup did not complete within ${timeoutMilliseconds} milliseconds.`
      ));
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError('provider_dns_failed', 'The provider host could not be resolved.');
  }
  if (addresses.length === 0) {
    throw new ProviderError('provider_dns_failed', 'The provider host returned no usable addresses.');
  }
  if (url.protocol === 'http:') {
    if (!['localhost', '127.0.0.1', '::1'].includes(hostname.toLowerCase())
      || addresses.some((entry) => !isExactLoopback(entry.address))) {
      throw new ProviderError('provider_https_required', 'Plain HTTP is permitted only for the documented loopback service. Remote providers require HTTPS.');
    }
  } else if (addresses.some((entry) => isForbiddenAddress(entry.address))) {
    throw new ProviderError('provider_address_refused', 'The provider host resolves to a private, loopback, link-local, multicast, unspecified, shared, or metadata address.');
  }
  return { url, addresses };
}

function pinnedLookup(addresses) {
  return (_hostname, options, callback) => {
    const list = addresses.map((entry) => ({ ...entry }));
    if (options?.all) callback(null, list);
    else callback(null, list[0].address, list[0].family);
  };
}

function requestJson(endpoint, route, {
  method = 'GET', body = null, token = '', limits, responseLimit = limits.maxReportBytes,
}) {
  const transport = endpoint.url.protocol === 'https:' ? https : http;
  const pathname = `${endpoint.url.pathname.replace(/\/$/, '')}${route}` || route;
  let encoded;
  try {
    encoded = body == null ? null : Buffer.from(JSON.stringify(body));
  } catch {
    return Promise.reject(new ProviderError('provider_request_invalid', 'The provider request could not be encoded.'));
  }
  if (encoded && encoded.length > limits.maxRequestBytes) {
    return Promise.reject(new ProviderError('provider_request_too_large', 'The provider request exceeds the configured byte limit.'));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let deadlineTimer;
    let request;
    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(deadlineTimer);
      if (error) reject(error);
      else resolve(value);
    }
    try {
      request = transport.request({
        protocol: endpoint.url.protocol,
        hostname: endpoint.url.hostname,
        port: endpoint.url.port || undefined,
        method,
        path: pathname,
        lookup: pinnedLookup(endpoint.addresses),
        servername: net.isIP(endpoint.url.hostname.replace(/^\[|\]$/g, '')) ? undefined : endpoint.url.hostname,
        headers: {
          accept: 'application/json',
          ...(encoded ? { 'content-type': 'application/json', 'content-length': encoded.length } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400) {
          response.destroy();
          finish(new ProviderError('provider_redirect_refused', 'The provider returned a redirect, which Scriveno refuses to follow.'));
          return;
        }
        const declaredLength = Number(response.headers['content-length']);
        if (Number.isFinite(declaredLength) && declaredLength > responseLimit) {
          response.destroy();
          finish(new ProviderError('provider_response_too_large', 'The provider response exceeds the configured byte limit.'));
          return;
        }
        const chunks = [];
        let received = 0;
        response.on('data', (chunk) => {
          received += chunk.length;
          if (received > responseLimit) {
            response.destroy();
            finish(new ProviderError('provider_response_too_large', 'The provider response exceeds the configured byte limit.'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('error', (error) => {
          if (!settled) finish(error instanceof ProviderError ? error : new ProviderError('provider_transport_failed', 'The provider response was interrupted.'));
        });
        response.on('end', () => {
          if (settled) return;
          if (response.statusCode < 200 || response.statusCode >= 300) {
            finish(new ProviderError('provider_http_error', `The provider returned HTTP status ${response.statusCode}.`));
            return;
          }
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            validateProviderComplexity(parsed, limits);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              throw new ProviderError('provider_malformed_response', 'The provider returned an invalid response object.');
            }
            finish(null, parsed);
          } catch (error) {
            finish(error instanceof ProviderError
              ? error
              : new ProviderError('provider_malformed_response', 'The provider returned malformed JSON.'));
          }
        });
      });
    } catch {
      finish(new ProviderError('provider_transport_failed', 'The provider request could not be started.'));
      return;
    }
    deadlineTimer = setTimeout(() => {
      request?.destroy();
      finish(new ProviderError('provider_timeout', `The provider did not respond within ${limits.timeoutMilliseconds} milliseconds.`));
    }, limits.timeoutMilliseconds);
    request.on('error', (error) => {
      if (!settled) finish(error instanceof ProviderError ? error : new ProviderError('provider_transport_failed', 'The provider request failed.'));
    });
    if (encoded) request.write(encoded);
    request.end();
  });
}

function validateCapabilities(health, capabilities) {
  const normalizedVersion = typeof health.version === 'string' ? health.version.replace(/^v/, '') : '';
  const booleanRecord = (value, keys) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && keys.every((key) => typeof value[key] === 'boolean');
  if (health.ok !== true || typeof health.version !== 'string' || !health.version.trim()) {
    throw new ProviderError('provider_health_invalid', 'The provider health response is missing a valid version.');
  }
  if (normalizedVersion !== CONTRACT_VERSION
    || capabilities.ok !== true || typeof capabilities.version !== 'string'
    || capabilities.version !== health.version
    || !booleanRecord(capabilities.tools, ['c2patool', 'exiftool', 'qpdf'])
    || !booleanRecord(capabilities.pixel_backends, ['ctrlregen', 'diffusion'])
    || !booleanRecord(capabilities.scorers, ['synthid', 'stylometry'])
    || !booleanRecord(capabilities.harnesses, ['markllm'])) {
    throw new ProviderError('provider_capabilities_invalid', 'The provider capabilities response is missing or conflicts with health.');
  }
  if (capabilities.operations && (!Array.isArray(capabilities.operations)
    || capabilities.operations.some((item) => typeof item !== 'string' || !['inspect', 'clean'].includes(item)))) {
    throw new ProviderError('provider_capabilities_invalid', 'The provider operations capability is malformed.');
  }
  if (capabilities.formats && (!Array.isArray(capabilities.formats)
    || capabilities.formats.some((item) => typeof item !== 'string' || !CONTRACT_FORMATS.has(item)))) {
    throw new ProviderError('provider_capabilities_invalid', 'The provider formats capability is malformed.');
  }
  if (capabilities.limits && (typeof capabilities.limits !== 'object' || Array.isArray(capabilities.limits)
    || ['max_concurrency', 'max_input_bytes'].some((key) => capabilities.limits[key] != null
      && (!Number.isInteger(capabilities.limits[key]) || capabilities.limits[key] <= 0)))) {
    throw new ProviderError('provider_capabilities_invalid', 'The provider limits capability is malformed.');
  }
}

function assertOperation(capabilities, operation) {
  const operations = capabilities.operations || ['inspect', 'clean'];
  if (!operations.includes(operation)) {
    throw new ProviderError('provider_operation_unsupported', `The provider does not advertise the ${operation} operation.`);
  }
}

function assertFormat(capabilities, format) {
  const formats = new Set(capabilities.formats || CONTRACT_FORMATS);
  if (!formats.has(format)) {
    throw new ProviderError('provider_format_unsupported', `The provider does not advertise the ${format} format.`);
  }
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function assertValidatedDescriptor(file) {
  if (!file || typeof file.path !== 'string' || !file.path
    || !Number.isInteger(file.expectedBytes) || file.expectedBytes < 0
    || typeof file.expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(file.expectedSha256)) {
    throw new ProviderError('provider_input_unvalidated', 'The provider input is missing its validated size or digest.');
  }
}

async function readOwnedFile(file, maxInputBytes) {
  assertValidatedDescriptor(file);
  const noFollow = fs.constants.O_NOFOLLOW;
  if (!Number.isInteger(noFollow)) {
    throw new ProviderError('provider_input_unsafe', 'This runtime cannot open provider inputs without following symlinks.');
  }
  let handle;
  try {
    handle = await fs.promises.open(file.path, fs.constants.O_RDONLY | noFollow);
  } catch (error) {
    if (error?.code === 'ELOOP') {
      throw new ProviderError('provider_input_unsafe', 'Provider inputs must not be symlinks.');
    }
    throw new ProviderError('provider_input_unavailable', 'The provider input is no longer available.');
  }
  try {
    const before = await handle.stat();
    if (!before || typeof before.isFile !== 'function' || !before.isFile()) {
      throw new ProviderError('provider_input_unsafe', 'Only regular files can be uploaded to a provider.');
    }
    if (typeof process.getuid !== 'function' || !Number.isInteger(before.uid)) {
      throw new ProviderError('provider_input_ownership_unknown', 'Scriveno could not establish current-user ownership for the provider input.');
    }
    if (before.uid !== process.getuid()) {
      throw new ProviderError('provider_input_not_owned', 'The provider input is not owned by the current user.');
    }
    if (!Number.isInteger(before.dev) || !Number.isInteger(before.ino)) {
      throw new ProviderError('provider_input_identity_unknown', 'Scriveno could not establish a stable identity for the provider input.');
    }
    if (!Number.isInteger(before.size) || before.size < 0 || before.size > maxInputBytes) {
      throw new ProviderError('provider_request_too_large', 'The provider input exceeds the configured byte limit.');
    }
    if (before.size !== file.expectedBytes) {
      throw new ProviderError('provider_input_changed', 'The provider input changed after local validation.');
    }
    const buffer = await handle.readFile();
    const after = await handle.stat();
    if (after.dev !== before.dev || after.ino !== before.ino || after.uid !== before.uid || after.size !== before.size
      || buffer.length !== before.size || sha256(buffer) !== file.expectedSha256.toLowerCase()) {
      throw new ProviderError('provider_input_changed', 'The provider input changed after local validation.');
    }
    return { ...file, buffer };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError('provider_input_unavailable', 'The provider input could not be read through its stable handle.');
  } finally {
    try {
      await handle.close();
    } catch {
      // The read result is already bound to the closed handle's identity.
    }
  }
}

function finding(fields) {
  return {
    ruleId: fields.ruleId,
    confidence: CONFIDENCE.has(fields.confidence) ? fields.confidence : 'informational',
    channel: fields.channel,
    target: fields.target,
    location: fields.location || null,
    message: fields.message,
    evidence: fields.evidence || '',
    suggestedAction: fields.suggestedAction || 'Review the provider evidence in context.',
    ...(fields.codePoint ? { codePoint: fields.codePoint } : {}),
    ...(fields.count ? { count: fields.count } : {}),
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function malformed(message) {
  throw new ProviderError('provider_malformed_response', message);
}

function expectedKind(format) {
  if (format === 'text') return 'text';
  if (['png', 'jpeg', 'webp', 'avif', 'heic', 'bmp', 'gif', 'tiff', 'bigtiff'].includes(format)) return 'image';
  return 'container';
}

function expectedProviderFormat(format) {
  return format === 'bigtiff' ? 'tiff' : format;
}

function validStringArray(value, { allowEmptyStrings = false } = {}) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string'
    && (allowEmptyStrings || item.length > 0));
}

function hasOnlyKeys(value, allowed) {
  const names = new Set(allowed);
  return Object.keys(value).every((key) => names.has(key));
}

function hasExactKeys(value, expected) {
  return Object.keys(value).length === expected.length && hasOnlyKeys(value, expected);
}

function validCountRecord(value) {
  return isRecord(value) && Object.entries(value).every(([key, count]) => key.length > 0
    && Number.isInteger(count) && count >= 0);
}

function sumCounts(value) {
  return Object.values(value).reduce((sum, count) => sum + count, 0);
}

const HIT_KINDS = new Set([
  'strip', 'bidi', 'tag_chars', 'variation_selector', 'zwj_family', 'private_use',
  'space', 'confusable', 'other_cf',
]);

function validateHit(hit, length = null) {
  if (!isRecord(hit)
    || !hasExactKeys(hit, ['codepoint', 'label', 'count', 'kind', 'confidence', 'sample_offsets'])
    || typeof hit.codepoint !== 'string' || !/^U\+[0-9A-F]{4,6}$/i.test(hit.codepoint)
    || typeof hit.label !== 'string' || !hit.label
    || !Number.isInteger(hit.count) || hit.count <= 0
    || typeof hit.kind !== 'string' || !HIT_KINDS.has(hit.kind)
    || !['probable', 'informational'].includes(hit.confidence)
    || !Array.isArray(hit.sample_offsets)
    || hit.sample_offsets.some((offset) => !Number.isInteger(offset) || offset < 0
      || Number.isInteger(length) && offset >= length)) {
    malformed('The provider inspection response contains a malformed Layer A hit.');
  }
}

function validFiniteNumber(value, { minimum = 0, maximum = Infinity } = {}) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function validateStylometryReport(report) {
  const keys = [
    'path', 'word_count', 'sentence_count', 'burstiness_cv', 'lexical_diversity',
    'ai_ngram_density', 'matched_markers', 'score', 'confidence_level', 'status',
    'findings', 'findings_confidence', 'notes',
  ];
  const validMarker = (marker) => isRecord(marker)
    && hasExactKeys(marker, ['phrase', 'count', 'weight', 'samples'])
    && typeof marker.phrase === 'string' && marker.phrase.length > 0
    && Number.isInteger(marker.count) && marker.count > 0
    && validFiniteNumber(marker.weight)
    && validStringArray(marker.samples);
  if (!isRecord(report) || !hasExactKeys(report, keys)
    || typeof report.path !== 'string' || !report.path
    || !Number.isInteger(report.word_count) || report.word_count < 0
    || !Number.isInteger(report.sentence_count) || report.sentence_count < 0
    || !validFiniteNumber(report.burstiness_cv)
    || !validFiniteNumber(report.lexical_diversity, { maximum: 1 })
    || !validFiniteNumber(report.ai_ngram_density)
    || !Array.isArray(report.matched_markers) || report.matched_markers.some((item) => !validMarker(item))
    || !validFiniteNumber(report.score, { maximum: 1 })
    || !['CLEAN', 'LOW', 'MEDIUM', 'HIGH'].includes(report.confidence_level)
    || !['ok', 'insufficient_length'].includes(report.status)
    || !validStringArray(report.findings)
    || !Array.isArray(report.findings_confidence)
    || report.findings_confidence.length !== report.findings.length
    || report.findings_confidence.some((value) => !CONFIDENCE.has(value))
    || !validStringArray(report.notes)) {
    malformed('The provider text inspection response contains malformed Layer B output.');
  }
}

function validateEvidenceReport(report, format) {
  if (typeof report.path !== 'string' || !report.path
    || report.format !== expectedProviderFormat(format)
    || typeof report.has_c2pa !== 'boolean'
    || typeof report.has_ai_metadata !== 'boolean'
    || !validStringArray(report.findings)
    || !Array.isArray(report.findings_confidence)
    || report.findings_confidence.length !== report.findings.length
    || report.findings_confidence.some((value) => !CONFIDENCE.has(value))
    || !isRecord(report.tools)
    || !validStringArray(report.notes)) {
    malformed('The provider inspection evidence report is malformed or contradicts the requested format.');
  }
}

function validateInspectResponse(response, format) {
  if (!isRecord(response) || response.ok !== true || !['text', 'image', 'container'].includes(response.kind)
    || response.kind !== expectedKind(format) || typeof response.suspicious !== 'boolean'
    || !isRecord(response.report) || !hasExactKeys(response, ['ok', 'kind', 'suspicious', 'report'])) {
    malformed('The provider inspection response is incomplete or contradicts the requested format.');
  }
  const report = response.report;
  if (response.kind === 'text') {
    validateStylometryReport(report.stylometry);
    if (!Number.isInteger(report.length) || report.length < 0
      || !Number.isInteger(report.suspicious_total) || report.suspicious_total < 0
      || !Array.isArray(report.hits) || !validStringArray(report.notes)
      || report.hits.some((hit) => {
        validateHit(hit, report.length);
        return false;
      })
      || report.hits.reduce((sum, hit) => sum + hit.count, 0) !== report.suspicious_total
      || response.suspicious !== Boolean(report.suspicious_total || report.stylometry.score >= 0.65)
      || !hasExactKeys(report, ['length', 'suspicious_total', 'hits', 'notes', 'stylometry'])) {
      malformed('The provider text inspection report is malformed or contradictory.');
    }
    return report;
  }
  validateEvidenceReport(report, format);
  if (response.kind === 'image') {
    if (report.synthid != null && !isRecord(report.synthid)
      || !hasExactKeys(report, [
        'path', 'format', 'has_c2pa', 'has_ai_metadata', 'findings',
        'findings_confidence', 'tools', 'synthid', 'notes',
      ])) {
      malformed('The provider image inspection report contains malformed scorer output.');
    }
    if (response.suspicious !== Boolean(report.has_c2pa || report.has_ai_metadata)) {
      malformed('The provider image inspection response contradicts its evidence summary.');
    }
    return report;
  }
  if (!isRecord(report.details)
    || !Number.isInteger(report.suspicious_total) || report.suspicious_total < 0
    || !Array.isArray(report.layer_a_hits)
    || report.layer_a_hits.some((hit) => {
      validateHit(hit);
      return false;
    })
    || report.layer_a_hits.reduce((sum, hit) => sum + hit.count, 0) !== report.suspicious_total
    || !hasExactKeys(report, [
      'path', 'format', 'has_c2pa', 'has_ai_metadata', 'findings', 'findings_confidence',
      'tools', 'details', 'notes', 'suspicious_total', 'layer_a_hits',
    ])
    || response.suspicious !== Boolean(report.has_c2pa || report.has_ai_metadata || report.suspicious_total)) {
    malformed('The provider container inspection report is malformed or contradictory.');
  }
  return report;
}

function normalizeInspectResponseUnchecked(response, target, format, token) {
  const report = validateInspectResponse(response, format);
  const ignoredEvidence = new Set();
  if (isRecord(report.stylometry)) ignoredEvidence.add('stylometry');
  const findings = [];
  if (report.has_c2pa === true) {
    findings.push(finding({
      ruleId: 'provider.c2pa.present', confidence: 'confirmed', channel: 'c2pa', target,
      message: 'The watermarks-remover provider confirmed attached C2PA evidence.',
      evidence: 'Provider C2PA summary: present.',
    }));
  }
  if (report.has_ai_metadata === true) {
    findings.push(finding({
      ruleId: 'provider.metadata.ai_present', confidence: 'confirmed', channel: 'metadata', target,
      message: 'The watermarks-remover provider confirmed AI-related metadata.',
      evidence: 'Provider AI metadata summary: present.',
    }));
  }
  const hitLists = [report.hits, report.layer_a_hits].filter(Array.isArray);
  for (const hits of hitLists) {
    for (const hit of hits) {
      const offset = Array.isArray(hit.sample_offsets) && Number.isInteger(hit.sample_offsets[0])
        ? hit.sample_offsets[0]
        : null;
      findings.push(finding({
        ruleId: `provider.unicode.${hit.kind.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase()}`,
        confidence: hit.confidence,
        channel: 'unicode',
        target,
        location: offset == null ? null : { offset },
        codePoint: typeof hit.codepoint === 'string' ? hit.codepoint : undefined,
        count: Number.isInteger(hit.count) && hit.count > 0 ? hit.count : undefined,
        message: `The watermarks-remover provider reported ${hit.kind} Unicode evidence.`,
        evidence: redactProviderText(hit.label, token),
        suggestedAction: 'Confirm the character context before any cleaning action.',
      }));
    }
  }
  if (Array.isArray(report.findings) && report.findings.length > 0) ignoredEvidence.add('provider-freeform');
  return {
    findings,
    ignoredEvidence: [...ignoredEvidence].sort(),
  };
}

function normalizeInspectResponse(response, target, format = 'text', token = '') {
  try {
    return normalizeInspectResponseUnchecked(response, target, format, token);
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError('provider_malformed_response', 'The provider inspection response could not be normalized.');
  }
}

function nonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizedStrings(value, token = '') {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string').slice(0, 100)
    .map((item) => redactProviderText(item, token).slice(0, 512));
}

function validateCleanResponse(response, file, cleaned) {
  if (!isRecord(response) || response.ok !== true || !['text', 'image', 'container'].includes(response.kind)
    || response.kind !== expectedKind(file.format) || typeof response.cleaned !== 'string'
    || !isRecord(response.report) || response.report.kind !== response.kind
    || !hasExactKeys(response, ['ok', 'kind', 'cleaned', 'report'])) {
    malformed('The provider clean response is incomplete or contradicts the requested format.');
  }
  const report = response.report;
  if (response.kind === 'text') {
    const stats = report.stats;
    if (!isRecord(stats)
      || !Number.isInteger(stats.input_length) || stats.input_length < 0
      || !Number.isInteger(stats.output_length) || stats.output_length < 0
      || !validCountRecord(stats.removed) || !validCountRecord(stats.replaced)
      || !Number.isInteger(stats.removed_count) || stats.removed_count < 0
      || !Number.isInteger(stats.replaced_count) || stats.replaced_count < 0
      || stats.removed_count !== sumCounts(stats.removed)
      || stats.replaced_count !== sumCounts(stats.replaced)
      || stats.nfkc_changed !== false
      || !Number.isInteger(report.length) || report.length < 0
      || report.length !== stats.output_length
      || !hasExactKeys(report, ['kind', 'stats', 'length'])
      || !hasExactKeys(stats, [
        'input_length', 'output_length', 'removed', 'replaced',
        'removed_count', 'replaced_count', 'nfkc_changed',
      ])) {
      malformed('The provider text clean report is malformed or contradictory.');
    }
    return report;
  }
  const isImage = response.kind === 'image';
  const exactKeys = isImage ? [
    'kind', 'format', 'actions', 'bytes_in', 'bytes_out', 'still_has_c2pa',
    'still_has_ai_metadata', 'post_findings', 'synthid_before', 'synthid_after', 'pixel_removal',
  ] : [
    'kind', 'format', 'actions', 'bytes_in', 'bytes_out', 'still_has_c2pa',
    'still_has_ai_metadata', 'post_findings', 'meta',
  ];
  const unsafeAction = (action) => /pixel removal|ctrlregen|diffusion|nfkc|aggressive homoglyph|humaniz/i.test(action);
  if (report.format !== expectedProviderFormat(file.format)
    || !validStringArray(report.actions)
    || report.actions.some(unsafeAction)
    || !Number.isInteger(report.bytes_in) || report.bytes_in !== file.buffer.length
    || !Number.isInteger(report.bytes_out) || report.bytes_out !== cleaned.length
    || typeof report.still_has_c2pa !== 'boolean'
    || typeof report.still_has_ai_metadata !== 'boolean'
    || !validStringArray(report.post_findings)
    || !hasExactKeys(report, exactKeys)
    || isImage && report.pixel_removal !== null
    || isImage && report.synthid_before != null && !isRecord(report.synthid_before)
    || isImage && report.synthid_after != null && !isRecord(report.synthid_after)
    || !isImage && !isRecord(report.meta)
  ) {
    malformed('The provider media or container clean report is malformed or contradictory.');
  }
  return report;
}

function normalizeCleanResponseUnchecked(response, file, cleaned, serviceVersion, token) {
  const report = validateCleanResponse(response, file, cleaned);
  const stats = response.kind === 'text' ? report.stats : {};
  const ignoredEvidence = new Set();
  const residualFindings = [];
  if (report.still_has_c2pa === true) residualFindings.push('Provider C2PA summary: present.');
  if (report.still_has_ai_metadata === true) residualFindings.push('Provider AI metadata summary: present.');
  if (Array.isArray(report.post_findings) && report.post_findings.length > 0) {
    ignoredEvidence.add('provider-freeform');
  }
  return {
    cleaned,
    schemaVersion: CLEAN_SCHEMA_VERSION,
    provider: 'watermarks-remover',
    serviceVersion,
    kind: response.kind,
    format: file.format,
    changes: {
      actions: normalizedStrings(report.actions, token),
      removedCount: nonnegativeInteger(stats.removed_count),
      replacedCount: nonnegativeInteger(stats.replaced_count),
    },
    bytes: {
      input: file.buffer.length,
      output: cleaned.length,
    },
    residual: {
      c2pa: typeof report.still_has_c2pa === 'boolean' ? report.still_has_c2pa : null,
      aiMetadata: typeof report.still_has_ai_metadata === 'boolean' ? report.still_has_ai_metadata : null,
      findings: residualFindings,
    },
    ignoredEvidence: [...ignoredEvidence].sort(),
  };
}

function normalizeCleanResponse(response, file, cleaned, serviceVersion, token) {
  try {
    return normalizeCleanResponseUnchecked(response, file, cleaned, serviceVersion, token);
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError('provider_malformed_response', 'The provider clean response could not be normalized.');
  }
}

async function boundedMap(values, jobs, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  let active = 0;
  let peakWorkers = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      active++;
      peakWorkers = Math.max(peakWorkers, active);
      try {
        results[index] = await worker(values[index]);
      } finally {
        active--;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(jobs, Math.max(values.length, 1)) }, run));
  return { results, peakWorkers };
}

function decodeBase64(value) {
  if (typeof value !== 'string' || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new ProviderError('provider_malformed_response', 'The provider returned invalid cleaned bytes.');
  }
  return Buffer.from(value, 'base64');
}

async function connectProvider(options = {}) {
  const env = options.env || process.env;
  const rawUrl = env[ENV.serviceUrl];
  if (!rawUrl) {
    throw new ProviderError('provider_not_configured', `The provider is not configured. Set ${ENV.serviceUrl} to opt into the watermarks-remover service.`);
  }
  const limits = mergeLimits(options.limits);
  const endpoint = await validateServiceUrl(rawUrl, {
    lookup: options.lookup,
    timeoutMilliseconds: limits.timeoutMilliseconds,
  });
  const token = String(env[ENV.bearerToken] || '');
  const health = await requestJson(endpoint, '/health', {
    token, limits, responseLimit: limits.maxReportBytes,
  });
  const capabilities = await requestJson(endpoint, '/capabilities', {
    token, limits, responseLimit: limits.maxReportBytes,
  });
  validateCapabilities(health, capabilities);
  const advertisedJobs = Number.isInteger(capabilities.limits?.max_concurrency)
    && capabilities.limits.max_concurrency > 0
    ? capabilities.limits.max_concurrency
    : 1;
  const requestedJobs = Number.isInteger(options.jobs) ? options.jobs : 1;
  const jobs = Math.max(1, Math.min(requestedJobs, advertisedJobs, limits.maxJobs, PROVIDER_LIMITS.maxJobs));
  const advertisedInput = Number.isInteger(capabilities.limits?.max_input_bytes)
    && capabilities.limits.max_input_bytes > 0
    ? capabilities.limits.max_input_bytes
    : limits.maxInputBytes;
  const maxInputBytes = Math.min(limits.maxInputBytes, advertisedInput, PROVIDER_LIMITS.maxInputBytes);

  async function inspectOne(file) {
    assertOperation(capabilities, 'inspect');
    assertFormat(capabilities, file.format);
    const validated = await readOwnedFile(file, maxInputBytes);
    const response = await requestJson(endpoint, '/inspect', {
      method: 'POST',
      token,
      limits,
      responseLimit: limits.maxReportBytes,
      body: { file: validated.buffer.toString('base64'), name: path.basename(validated.path) },
    });
    return { target: validated.path, ...normalizeInspectResponse(response, validated.path, validated.format, token) };
  }

  return {
    name: 'watermarks-remover',
    serviceVersion: health.version,
    contractVersion: CONTRACT_VERSION,
    capabilities,
    jobs,
    async inspectFiles(files) {
      for (const file of files) {
        assertOperation(capabilities, 'inspect');
        assertFormat(capabilities, file.format);
        assertValidatedDescriptor(file);
      }
      const execution = await boundedMap(files, jobs, async (file) => {
        try {
          return { ok: true, value: await inspectOne(file) };
        } catch (error) {
          return {
            ok: false,
            target: file.path,
            error: error instanceof ProviderError
              ? error
              : new ProviderError('provider_malformed_response', 'The provider result could not be processed.'),
          };
        }
      });
      const attempts = execution.results.map((outcome, index) => outcome.ok ? {
        provider: 'watermarks-remover', operation: 'inspect', target: outcome.value.target,
        status: 'succeeded', serviceVersion: health.version,
      } : {
        provider: 'watermarks-remover', operation: 'inspect', target: outcome.target || files[index].path,
        status: 'failed', code: outcome.error.code, reason: outcome.error.message,
        serviceVersion: health.version,
      });
      const failed = execution.results.find((outcome) => !outcome.ok);
      if (failed) {
        throw new ProviderError(failed.error.code, failed.error.message, { attempts });
      }
      return {
        findings: execution.results.flatMap((item) => item.value.findings),
        ignoredEvidence: [...new Set(execution.results.flatMap((item) => item.value.ignoredEvidence))].sort(),
        attempts,
        peakWorkers: execution.peakWorkers,
      };
    },
    async cleanFile(file) {
      assertOperation(capabilities, 'clean');
      assertFormat(capabilities, file.format);
      const validated = await readOwnedFile(file, maxInputBytes);
      const response = await requestJson(endpoint, '/clean', {
        method: 'POST',
        token,
        limits,
        responseLimit: limits.maxCleanResponseBytes,
        body: {
          file: validated.buffer.toString('base64'),
          name: path.basename(validated.path),
          options: { keep_non_ai_metadata: true, also_layer_a_text: true },
        },
      });
      const cleaned = decodeBase64(response.cleaned);
      if (cleaned.length > maxInputBytes) {
        throw new ProviderError('provider_response_too_large', 'The cleaned provider output exceeds the configured byte limit.');
      }
      return normalizeCleanResponse(response, validated, cleaned, health.version, token);
    },
  };
}

module.exports = {
  CLEAN_SCHEMA_VERSION,
  CONTRACT_VERSION,
  ENV,
  PROVIDER_LIMITS,
  ProviderError,
  connectProvider,
  isForbiddenAddress,
  normalizeInspectResponse,
  redactProviderText,
  validateProviderComplexity,
  validateServiceUrl,
};
