// Implements: P-MUST-18
'use strict';

const http = require('node:http');

const DEFAULT_CAPABILITIES = Object.freeze({
  ok: true,
  version: '0.5.0',
  tools: { c2patool: true, exiftool: true, qpdf: true },
  pixel_backends: { ctrlregen: false, diffusion: false },
  scorers: { synthid: false, stylometry: true },
  harnesses: { markllm: false },
});

function stylometryReport(name) {
  return {
    path: name,
    word_count: 2,
    sentence_count: 1,
    burstiness_cv: 0,
    lexical_diversity: 1,
    ai_ngram_density: 0,
    matched_markers: [],
    score: 0.99,
    confidence_level: 'HIGH',
    status: 'ok',
    findings: ['Layer B stylometry likely_ai aggregate score 0.99'],
    findings_confidence: ['probable'],
    notes: [],
  };
}

function json(response, status, body, headers = {}) {
  const data = Buffer.from(JSON.stringify(body));
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store',
    ...headers,
  });
  response.end(data);
}

async function slowJson(response, body, options) {
  const data = Buffer.from(JSON.stringify(body));
  response.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store',
  });
  const chunks = Math.max(2, options.slowDripChunks || 8);
  const size = Math.max(1, Math.ceil(data.length / chunks));
  for (let offset = 0; offset < data.length; offset += size) {
    response.write(data.subarray(offset, offset + size));
    await new Promise((resolve) => setTimeout(resolve, options.slowDripMilliseconds || 20));
  }
  response.end();
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('error', reject);
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function startProviderFixture(options = {}) {
  const requests = [];
  let active = 0;
  let peak = 0;
  const capabilities = {
    ...DEFAULT_CAPABILITIES,
    ...(options.capabilities || {}),
  };
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://fixture.invalid').pathname;
    const record = {
      method: request.method,
      path: pathname,
      authorization: request.headers.authorization || null,
      body: null,
    };
    requests.push(record);
    active++;
    peak = Math.max(peak, active);
    try {
      if (options.redirectPath === pathname) {
        response.writeHead(302, { location: '/health' });
        response.end();
        return;
      }
      if (options.delayPath === pathname) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMilliseconds || 200));
      }
      if (options.slowDripPath === pathname) {
        await slowJson(response, options.slowDripBody || { ok: true, version: '0.5.0' }, options);
        return;
      }
      if (options.malformedPath === pathname) {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{not-json');
        return;
      }
      if (options.oversizedPath === pathname) {
        json(response, 200, { ok: true, padding: 'x'.repeat(options.oversizedBytes || 4096) });
        return;
      }
      if (pathname === '/health' && request.method === 'GET') {
        json(response, 200, { ok: true, version: options.version || '0.5.0' });
        return;
      }
      if (pathname === '/capabilities' && request.method === 'GET') {
        json(response, 200, capabilities);
        return;
      }
      if (pathname === '/inspect' && request.method === 'POST') {
        record.body = await readJson(request);
        if (options.inspectStatus || options.failInspectName === record.body.name) {
          json(response, options.inspectStatus || 500, { ok: false, error: options.echoSecret || 'inspection failed' });
          return;
        }
        const cleanName = String(record.body.name || 'input');
        const report = options.inspectReport || {
          length: Buffer.from(record.body.file, 'base64').length,
          suspicious_total: cleanName.includes('marked') ? 1 : 0,
          hits: cleanName.includes('marked') ? [{
            codepoint: 'U+200B',
            label: 'U+200B ZERO WIDTH SPACE (Cf)',
            count: 1,
            kind: 'zwj_family',
            confidence: 'probable',
            sample_offsets: [1],
          }] : [],
          notes: [],
          stylometry: stylometryReport(cleanName),
        };
        json(response, 200, options.inspectResponse || {
          ok: true,
          kind: options.inspectKind || 'text',
          suspicious: true,
          report,
        });
        return;
      }
      if (pathname === '/clean' && request.method === 'POST') {
        record.body = await readJson(request);
        if (options.cleanStatus) {
          json(response, options.cleanStatus, { ok: false, error: 'clean failed' });
          return;
        }
        json(response, 200, options.cleanResponse || {
          ok: true,
          kind: options.cleanKind || 'text',
          cleaned: record.body.file,
          report: options.cleanReport || {
            kind: 'text',
            stats: {
              input_length: Buffer.from(record.body.file, 'base64').length,
              output_length: Buffer.from(record.body.file, 'base64').length,
              removed: {},
              replaced: {},
              removed_count: 0,
              replaced_count: 0,
              nfkc_changed: false,
            },
            length: Buffer.from(record.body.file, 'base64').length,
          },
        });
        return;
      }
      json(response, 404, { ok: false, error: 'not found' });
    } finally {
      active--;
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    get peakRequests() {
      return peak;
    },
    async close() {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

module.exports = {
  DEFAULT_CAPABILITIES,
  startProviderFixture,
};
