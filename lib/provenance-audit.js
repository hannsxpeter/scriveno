// Implements: P-MUST-01, P-MUST-02, P-MUST-03, P-MUST-04, P-MUST-05, P-MUST-06, P-MUST-07, P-MUST-12, P-MUST-14, P-MUST-15, P-MUST-18
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');

const SCHEMA_VERSION = 'scriveno.provenance.audit/v1';
const CONFIDENCE = new Set(['confirmed', 'probable', 'informational', 'likely_false_positive']);
const EXIT_CODES = Object.freeze({
  CLEAR: 0,
  FINDINGS: 1,
  DEGRADED: 2,
  INVALID: 64,
  INTERNAL: 70,
});
const LIMITS = Object.freeze({
  maxFiles: 1000,
  maxInputBytes: 64 * 1024 * 1024,
  maxDataUriBytes: 8 * 1024 * 1024,
  maxArchiveEntries: 10000,
  maxArchiveExpandedBytes: 256 * 1024 * 1024,
  maxCompressionRatio: 200,
  maxExternalToolMilliseconds: 2000,
  maxJobs: 8,
});

const ZIP_FORMATS = new Set(['docx', 'odt', 'epub', 'xlsx', 'pptx']);
const TEXT_FORMATS = new Set(['markdown', 'text', 'html', 'svg']);
const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.text', '.html', '.htm', '.svg', '.xml', '.json', '.yaml', '.yml', '.csv']);
const MEDIA_EXTERNAL_FORMATS = new Set(['png', 'jpeg', 'pdf', 'webp', 'avif', 'heic', 'tiff', 'bigtiff']);
const DATA_URI_MEDIA = Object.freeze({
  png: 'png',
  jpeg: 'jpeg',
  jpg: 'jpeg',
  webp: 'webp',
  gif: 'gif',
  bmp: 'bmp',
  tiff: 'tiff',
  avif: 'avif',
  heic: 'heic',
});

class ProvenanceInputError extends Error {
  constructor(message, code = 'unsafe_input') {
    super(message);
    this.name = 'ProvenanceInputError';
    this.code = code;
    this.exitCode = EXIT_CODES.INVALID;
  }
}

function mergeLimits(overrides = {}) {
  return { ...LIMITS, ...overrides };
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

function findEndOfCentralDirectory(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function unsafeArchiveName(name) {
  if (!name || name.includes('\0')) return true;
  if (name.startsWith('/') || name.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(name)) return true;
  const normalized = name.replace(/\\/g, '/');
  return normalized.split('/').some((part) => part === '..');
}

function extractZipEntry(buffer, entry) {
  if (entry.method !== 0 && entry.method !== 8) return null;
  const offset = entry.localHeaderOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new ProvenanceInputError(`Archive entry ${entry.name} has a malformed local header.`);
  }
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buffer.length) {
    throw new ProvenanceInputError(`Archive entry ${entry.name} exceeds the container boundary.`);
  }
  const compressed = buffer.subarray(dataStart, dataEnd);
  let data;
  try {
    data = entry.method === 0 ? Buffer.from(compressed) : zlib.inflateRawSync(compressed, {
      maxOutputLength: entry.uncompressedSize,
    });
  } catch (error) {
    throw new ProvenanceInputError(`Archive entry ${entry.name} could not be safely expanded: ${error.message}`);
  }
  if (data.length !== entry.uncompressedSize) {
    throw new ProvenanceInputError(`Archive entry ${entry.name} has a conflicting declared expansion size.`);
  }
  if (crc32(data) !== entry.crc32) {
    throw new ProvenanceInputError(`Archive entry ${entry.name} failed its checksum.`);
  }
  return data;
}

function parseZipContainer(buffer, limitOverrides = LIMITS) {
  const limits = mergeLimits(limitOverrides);
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    throw new ProvenanceInputError('Malformed ZIP container: end record is missing.');
  }
  const endOffset = findEndOfCentralDirectory(buffer);
  if (endOffset < 0) throw new ProvenanceInputError('Malformed ZIP container: end record is missing.');
  const disk = buffer.readUInt16LE(endOffset + 4);
  const centralDisk = buffer.readUInt16LE(endOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(endOffset + 8);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    throw new ProvenanceInputError('Unsafe multi-disk ZIP containers are not supported.');
  }
  if (entryCount === 0xffff || centralOffset === 0xffffffff || centralSize === 0xffffffff) {
    throw new ProvenanceInputError('ZIP64 containers exceed the local audit contract.');
  }
  if (entryCount > limits.maxArchiveEntries) {
    throw new ProvenanceInputError(`Archive entry count ${entryCount} exceeds the limit ${limits.maxArchiveEntries}.`);
  }
  if (centralOffset + centralSize > endOffset || centralOffset + centralSize > buffer.length) {
    throw new ProvenanceInputError('Malformed ZIP container: central directory exceeds the container boundary.');
  }

  const entries = [];
  const seen = new Map();
  let cursor = centralOffset;
  let totalExpandedBytes = 0;
  for (let index = 0; index < entryCount; index++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new ProvenanceInputError('Malformed ZIP container: central entry is incomplete.');
    }
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const checksum = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const entryEnd = cursor + 46 + nameLength + extraLength + commentLength;
    if (entryEnd > buffer.length) {
      throw new ProvenanceInputError('Malformed ZIP container: entry name exceeds the container boundary.');
    }
    const nameBytes = buffer.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = nameBytes.toString((flags & 0x0800) !== 0 ? 'utf8' : 'latin1');
    if (unsafeArchiveName(name)) {
      throw new ProvenanceInputError(`Unsafe archive entry name: ${JSON.stringify(name)}.`);
    }
    if ((flags & 0x0001) !== 0) {
      throw new ProvenanceInputError(`Encrypted archive entry is not supported: ${name}.`);
    }
    const unixMode = (externalAttributes >>> 16) & 0xffff;
    if ((unixMode & 0o170000) === 0o120000) {
      throw new ProvenanceInputError(`Archive symlink entry is unsafe: ${name}.`);
    }
    totalExpandedBytes += uncompressedSize;
    if (totalExpandedBytes > limits.maxArchiveExpandedBytes) {
      throw new ProvenanceInputError(`Archive expansion exceeds ${limits.maxArchiveExpandedBytes} bytes.`);
    }
    const ratio = uncompressedSize === 0 ? 0 : compressedSize === 0 ? Infinity : uncompressedSize / compressedSize;
    if (ratio > limits.maxCompressionRatio) {
      throw new ProvenanceInputError(`Archive entry ${name} exceeds compression ratio ${limits.maxCompressionRatio}.`);
    }
    const normalizedName = name.replace(/\\/g, '/');
    const identity = `${method}:${checksum}:${compressedSize}:${uncompressedSize}`;
    if (seen.has(normalizedName) && seen.get(normalizedName) !== identity) {
      throw new ProvenanceInputError(`Archive contains a conflicting duplicate entry: ${name}.`);
    }
    seen.set(normalizedName, identity);
    if (!entries.some((entry) => entry.normalizedName === normalizedName)) {
      entries.push({
        name,
        normalizedName,
        flags,
        method,
        crc32: checksum,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
        externalAttributes,
      });
    }
    cursor = entryEnd;
  }
  if (cursor !== centralOffset + centralSize) {
    throw new ProvenanceInputError('Malformed ZIP container: central directory size conflicts with its entries.');
  }
  for (const entry of entries) entry.data = extractZipEntry(buffer, entry);
  return { entries, totalExpandedBytes };
}

function startsWith(buffer, bytes) {
  return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
}

function classifyZip(entries) {
  const names = new Set(entries.map((entry) => entry.name));
  const mimeEntry = entries.find((entry) => entry.name === 'mimetype');
  const mime = mimeEntry?.data?.toString('utf8').trim();
  if (names.has('xl/workbook.xml')) return 'xlsx';
  if (names.has('ppt/presentation.xml')) return 'pptx';
  if (names.has('word/document.xml')) return 'docx';
  if (mime === 'application/vnd.oasis.opendocument.text' || names.has('content.xml') && names.has('meta.xml')) return 'odt';
  if (mime === 'application/epub+zip' || names.has('META-INF/container.xml')) return 'epub';
  return 'zip';
}

function classifyIsoBmff(buffer) {
  if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') return null;
  const brands = [];
  for (let offset = 8; offset + 4 <= Math.min(buffer.length, 64); offset += 4) {
    brands.push(buffer.toString('ascii', offset, offset + 4));
  }
  if (brands.some((brand) => ['avif', 'avis'].includes(brand))) return 'avif';
  if (brands.some((brand) => ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand))) return 'heic';
  return null;
}

function isUtf8Text(buffer) {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function classifyText(buffer, fileName) {
  const extension = path.extname(fileName || '').toLowerCase();
  const prefix = buffer.subarray(0, 4096).toString('utf8').trimStart().toLowerCase();
  if (extension === '.md' || extension === '.markdown') return 'markdown';
  if (extension === '.svg' || prefix.startsWith('<svg') || /^<\?xml[^>]*>\s*<svg/.test(prefix)) return 'svg';
  if (extension === '.html' || extension === '.htm' || prefix.startsWith('<!doctype html') || prefix.startsWith('<html')) return 'html';
  return 'text';
}

function classifyBuffer(buffer, fileName = '') {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('classifyBuffer expects a Buffer.');
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { format: 'png', container: null };
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return { format: 'jpeg', container: null };
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { format: 'webp', container: 'riff' };
  const isoFormat = classifyIsoBmff(buffer);
  if (isoFormat) return { format: isoFormat, container: 'iso-bmff' };
  if (startsWith(buffer, [0x42, 0x4d])) return { format: 'bmp', container: null };
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) return { format: 'gif', container: null };
  if (startsWith(buffer, [0x49, 0x49, 0x2a, 0x00]) || startsWith(buffer, [0x4d, 0x4d, 0x00, 0x2a])) return { format: 'tiff', container: null };
  if (startsWith(buffer, [0x49, 0x49, 0x2b, 0x00]) || startsWith(buffer, [0x4d, 0x4d, 0x00, 0x2b])) return { format: 'bigtiff', container: null };
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') return { format: 'pdf', container: null };
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    const archive = parseZipContainer(buffer);
    return { format: classifyZip(archive.entries), container: 'zip', archive };
  }
  if (isUtf8Text(buffer)) return { format: classifyText(buffer, fileName), container: null };
  return { format: 'unsupported', container: null };
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function finding(fields) {
  if (!CONFIDENCE.has(fields.confidence)) throw new Error(`Unknown confidence label: ${fields.confidence}`);
  return {
    ruleId: fields.ruleId,
    confidence: fields.confidence,
    channel: fields.channel,
    target: fields.target,
    location: fields.location || null,
    message: fields.message,
    evidence: fields.evidence || '',
    suggestedAction: fields.suggestedAction || 'Review the evidence in context.',
    ...(fields.codePoint ? { codePoint: fields.codePoint } : {}),
    ...(fields.count ? { count: fields.count } : {}),
  };
}

function codePointLabel(codePoint) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

function lineAndColumn(text, offset) {
  const before = text.slice(0, offset);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1, offset };
}

function isJoiningScript(value) {
  return /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}]/u.test(value || '');
}

function isEmojiLike(value) {
  return /\p{Extended_Pictographic}/u.test(value || '');
}

function unicodeClass(codePoint) {
  if ([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff].includes(codePoint)) return ['unicode.zero_width', 'zero-width carrier'];
  if ((codePoint >= 0x202a && codePoint <= 0x202e) || (codePoint >= 0x2066 && codePoint <= 0x2069)) return ['unicode.bidi_control', 'bidi control'];
  if (codePoint >= 0xe0000 && codePoint <= 0xe007f) return ['unicode.tag', 'Unicode tag character'];
  if ((codePoint >= 0xfe00 && codePoint <= 0xfe0f) || (codePoint >= 0xe0100 && codePoint <= 0xe01ef)) return ['unicode.variation_selector', 'variation selector'];
  if ([0x00a0, 0x1680, 0x180e, 0x202f, 0x205f, 0x3000].includes(codePoint) || (codePoint >= 0x2000 && codePoint <= 0x200a)) return ['unicode.exotic_space', 'exotic space'];
  return null;
}

function preserveUnicodeContext(characters, index, codePoint) {
  const previous = characters[index - 1] || '';
  const next = characters[index + 1] || '';
  if ((codePoint === 0x200c || codePoint === 0x200d) && isJoiningScript(previous) && isJoiningScript(next)) return true;
  if ((codePoint === 0x200d || (codePoint >= 0xfe00 && codePoint <= 0xfe0f)) && (isEmojiLike(previous) || isEmojiLike(next))) return true;
  if (codePoint >= 0xe0000 && codePoint <= 0xe007f && characters.slice(Math.max(0, index - 8), index).some(isEmojiLike)) return true;
  return false;
}

function inspectUnicode(text, target) {
  const findings = [];
  const grouped = new Map();
  const characters = [...text];
  let utf16Offset = 0;
  characters.forEach((character, index) => {
    const codePoint = character.codePointAt(0);
    const classification = unicodeClass(codePoint);
    if (classification && !(codePoint === 0xfeff && utf16Offset === 0) && !preserveUnicodeContext(characters, index, codePoint)) {
      const key = `${classification[0]}:${codePoint}`;
      const record = grouped.get(key) || {
        ruleId: classification[0],
        label: classification[1],
        codePoint,
        count: 0,
        offset: utf16Offset,
      };
      record.count++;
      grouped.set(key, record);
    }
    utf16Offset += character.length;
  });
  for (const record of grouped.values()) {
    const confidence = record.ruleId === 'unicode.exotic_space' || record.ruleId === 'unicode.variation_selector'
      ? 'probable'
      : 'confirmed';
    findings.push(finding({
      ruleId: record.ruleId,
      confidence,
      channel: 'unicode',
      target,
      location: lineAndColumn(text, record.offset),
      codePoint: codePointLabel(record.codePoint),
      count: record.count,
      message: `${record.label} ${codePointLabel(record.codePoint)} appears ${record.count} time(s).`,
      evidence: `${record.label} at UTF-16 offset ${record.offset}`,
      suggestedAction: 'Confirm that the code point is intentional before using provenance-clean.',
    }));
  }
  return findings;
}

function inspectRecognizedMetadata(text, target, locationPrefix = null) {
  const findings = [];
  const provenancePattern = /(?:ai[-_ ]?(?:generated|assisted|tool)|content credentials|c2pa|provenance|watermark)/i;
  const fieldPattern = /(?:generator|software|creator|author|producer|application|provenance|tool|ai[-_])/i;
  const lines = String(text).split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!fieldPattern.test(line)) return;
    const hasProvenance = provenancePattern.test(line);
    findings.push(finding({
      ruleId: hasProvenance ? 'metadata.provenance' : 'metadata.generator',
      confidence: hasProvenance ? 'probable' : 'informational',
      channel: 'metadata',
      target,
      location: locationPrefix ? { member: locationPrefix, line: index + 1 } : { line: index + 1, column: 1 },
      message: hasProvenance ? 'Recognized metadata contains a provenance-related value.' : 'Recognized metadata contains a generator or creator field.',
      evidence: line.trim().slice(0, 240),
      suggestedAction: 'Review the metadata field and preserve disclosure truth.',
    }));
  });
  return findings;
}

function inspectHtmlOrSvg(text, target, format) {
  const findings = [];
  if (format === 'html') {
    for (const match of text.matchAll(/<meta\b[^>]*(?:name|property)=["'](?:generator|author|provenance|ai[^"']*)["'][^>]*>/gi)) {
      findings.push(...inspectRecognizedMetadata(match[0], target));
    }
    for (const match of text.matchAll(/\bdata-ai[^=\s>]*=(?:"[^"]*"|'[^']*')/gi)) {
      findings.push(finding({
        ruleId: 'metadata.provenance', confidence: 'confirmed', channel: 'metadata', target,
        message: 'HTML contains a data-ai provenance attribute.', evidence: match[0].slice(0, 240),
      }));
    }
  } else {
    for (const match of text.matchAll(/<metadata\b[^>]*>[\s\S]*?<\/metadata>/gi)) {
      findings.push(...inspectRecognizedMetadata(match[0], target));
    }
  }
  return findings;
}

function decodeDataUris(text, target, limits) {
  const targets = [];
  const errors = [];
  const findings = [];
  const expression = /data:image\/(png|jpe?g|webp|gif|bmp|tiff|avif|heic);base64,([a-z0-9+/=]+)/gi;
  let index = 0;
  for (const match of text.matchAll(expression)) {
    index++;
    const expected = DATA_URI_MEDIA[match[1].toLowerCase()];
    const encoded = match[2];
    const estimatedBytes = Math.floor(encoded.length * 3 / 4);
    if (estimatedBytes > limits.maxDataUriBytes) {
      errors.push({ code: 'data_uri_limit', target, message: `Embedded data URI exceeds ${limits.maxDataUriBytes} bytes.` });
      continue;
    }
    const buffer = Buffer.from(encoded, 'base64');
    if (buffer.length > limits.maxDataUriBytes) {
      errors.push({ code: 'data_uri_limit', target, message: `Embedded data URI exceeds ${limits.maxDataUriBytes} bytes.` });
      continue;
    }
    let classification;
    try {
      classification = classifyBuffer(buffer, `embedded.${match[1]}`);
    } catch (error) {
      errors.push({ code: 'data_uri_malformed', target, message: `Embedded data URI is malformed: ${error.message}` });
      continue;
    }
    const embeddedTarget = `${target}#data-uri-${index}`;
    if (classification.format !== expected) {
      errors.push({
        code: 'data_uri_signature_mismatch',
        target: embeddedTarget,
        message: `Embedded data URI declares ${expected} but contains ${classification.format}.`,
      });
      continue;
    }
    targets.push({
      path: embeddedTarget,
      format: classification.format,
      container: classification.container,
      bytes: buffer.length,
      sha256: sha256(buffer),
      lane: 'embedded-raster',
      status: 'complete',
      embedded: true,
    });
    findings.push(...inspectBinaryMetadata(buffer, embeddedTarget, classification.format));
  }
  return { targets, errors, findings };
}

function recognizedBinarySegments(buffer, format) {
  const segments = [];
  if (format === 'webp') {
    for (let offset = 12; offset + 8 <= buffer.length;) {
      const type = buffer.toString('ascii', offset, offset + 4);
      const size = buffer.readUInt32LE(offset + 4);
      const end = offset + 8 + size;
      if (end > buffer.length) break;
      if (['XMP ', 'EXIF', 'C2PA'].includes(type)) segments.push([type.trim(), buffer.subarray(offset + 8, end)]);
      offset = end + (size % 2);
    }
  } else if (format === 'png') {
    for (let offset = 8; offset + 12 <= buffer.length;) {
      const size = buffer.readUInt32BE(offset);
      const type = buffer.toString('ascii', offset + 4, offset + 8);
      const end = offset + 12 + size;
      if (end > buffer.length) break;
      if (['tEXt', 'iTXt', 'zTXt', 'eXIf', 'caBX'].includes(type)) segments.push([type, buffer.subarray(offset + 8, offset + 8 + size)]);
      offset = end;
    }
  } else if (format === 'gif') {
    for (let offset = 13; offset + 2 <= buffer.length; offset++) {
      if (buffer[offset] !== 0x21 || buffer[offset + 1] !== 0xfe) continue;
      let cursor = offset + 2;
      const blocks = [];
      while (cursor < buffer.length && buffer[cursor] !== 0) {
        const size = buffer[cursor++];
        if (cursor + size > buffer.length) break;
        blocks.push(buffer.subarray(cursor, cursor + size));
        cursor += size;
      }
      if (blocks.length) segments.push(['comment', Buffer.concat(blocks)]);
      offset = cursor;
    }
  } else if (format === 'jpeg') {
    for (let offset = 2; offset + 4 <= buffer.length && buffer[offset] === 0xff;) {
      const marker = buffer[offset + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const size = buffer.readUInt16BE(offset + 2);
      if (size < 2 || offset + 2 + size > buffer.length) break;
      if (marker >= 0xe0 && marker <= 0xef) segments.push([`APP${marker - 0xe0}`, buffer.subarray(offset + 4, offset + 2 + size)]);
      offset += 2 + size;
    }
  } else if (format === 'avif' || format === 'heic') {
    for (let offset = 0; offset + 8 <= buffer.length;) {
      const size = buffer.readUInt32BE(offset);
      const type = buffer.toString('ascii', offset + 4, offset + 8);
      if (size < 8 || offset + size > buffer.length) break;
      if (['meta', 'uuid', 'Exif', 'mime', 'jumb'].includes(type)) segments.push([type, buffer.subarray(offset + 8, offset + size)]);
      offset += size;
    }
  }
  return segments;
}

function inspectBinaryMetadata(buffer, target, format) {
  const findings = [];
  for (const [segment, data] of recognizedBinarySegments(buffer, format)) {
    const text = data.toString('utf8');
    if (/c2pa|content credentials|jumb/i.test(`${segment} ${text}`)) {
      findings.push(finding({
        ruleId: 'c2pa.embedded_manifest', confidence: 'confirmed', channel: 'c2pa', target,
        location: { segment }, message: 'A recognized media segment contains hard-bound provenance evidence.',
        evidence: `${segment}: ${text.slice(0, 200)}`, suggestedAction: 'Inspect the manifest with c2patool before making publishing decisions.',
      }));
    } else {
      findings.push(...inspectRecognizedMetadata(text, target, segment));
    }
  }
  const rawText = buffer.toString('latin1');
  if (findings.length === 0 && /c2pa|content credentials|ai[-_ ]generated/i.test(rawText)) {
    findings.push(finding({
      ruleId: 'binary.raw_marker', confidence: 'likely_false_positive', channel: 'residual', target,
      message: 'A raw byte string resembles provenance text outside a parsed structure.',
      evidence: 'Unstructured byte-string match', suggestedAction: 'Use a format-aware parser before treating this as provenance evidence.',
    }));
  }
  return findings;
}

function archiveMetadataMembers(format, entries) {
  const patterns = {
    docx: [/^docProps\//, /^customXml\//],
    xlsx: [/^docProps\//, /^customXml\//],
    pptx: [/^docProps\//, /^customXml\//],
    odt: [/^meta\.xml$/, /^META-INF\/manifest\.xml$/],
    epub: [/\.opf$/i, /^META-INF\//],
  };
  return entries.filter((entry) => (patterns[format] || []).some((pattern) => pattern.test(entry.name)));
}

function archiveVisibleMembers(format, entries) {
  const patterns = {
    docx: [/^word\/(?:document|header\d*|footer\d*|footnotes|endnotes)\.xml$/],
    xlsx: [/^xl\/(?:sharedStrings|worksheets\/[^/]+)\.xml$/],
    pptx: [/^ppt\/(?:slides|notesSlides)\/[^/]+\.xml$/],
    odt: [/^content\.xml$/],
    epub: [/\.(?:xhtml|html|htm)$/i],
  };
  return entries.filter((entry) => (patterns[format] || []).some((pattern) => pattern.test(entry.name)));
}

function inspectArchive(classification, target) {
  const findings = [];
  const archive = classification.archive;
  for (const entry of archiveMetadataMembers(classification.format, archive.entries)) {
    if (!entry.data) continue;
    findings.push(...inspectRecognizedMetadata(entry.data.toString('utf8'), target, entry.name));
  }
  for (const entry of archiveVisibleMembers(classification.format, archive.entries)) {
    if (!entry.data) continue;
    findings.push(...inspectUnicode(entry.data.toString('utf8'), target).map((item) => ({
      ...item,
      location: { ...item.location, member: entry.name },
      channel: 'visible-content',
    })));
  }
  return findings;
}

function findExecutable(command) {
  const searchPath = process.env.PATH || '';
  for (const directory of searchPath.split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, command);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Continue through PATH.
    }
  }
  return null;
}

function capabilityInventory() {
  return ['c2patool', 'exiftool', 'qpdf', 'unzip'].map((tool) => ({
    tool,
    status: findExecutable(tool) ? 'available' : 'missing',
    effect: tool === 'qpdf' ? 'PDF rewrite capability is outside this read-only audit.' : 'Missing tools degrade only the formats that require them.',
  }));
}

function inspectExternal(filePath, format, capabilities, requestedTimeout) {
  const findings = [];
  const errors = [];
  const capability = Object.fromEntries(capabilities.map((item) => [item.tool, item.status]));
  if (!MEDIA_EXTERNAL_FORMATS.has(format)) return { findings, errors, degraded: false };
  const timeout = Math.max(1, Math.min(requestedTimeout || LIMITS.maxExternalToolMilliseconds, LIMITS.maxExternalToolMilliseconds));
  let used = false;
  if (capability.exiftool === 'available') {
    used = true;
    const result = spawnSync('exiftool', ['-j', '-G', '-a', '-s', filePath], {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
      timeout,
      killSignal: 'SIGKILL',
    });
    if (result.error?.code === 'ETIMEDOUT') {
      errors.push({ code: 'exiftool_timeout', target: filePath, message: `ExifTool timed out after ${timeout} milliseconds.` });
      findings.push(finding({
        ruleId: 'coverage.external_tool_timeout',
        confidence: 'informational',
        channel: 'residual',
        target: filePath,
        location: { tool: 'exiftool' },
        message: `ExifTool inspection timed out after ${timeout} milliseconds.`,
        evidence: 'The metadata lane did not complete within its bounded execution time.',
        suggestedAction: 'Retry with a responsive ExifTool installation or treat metadata coverage as degraded.',
      }));
    } else if (result.status === 0) findings.push(...inspectRecognizedMetadata(result.stdout, filePath, 'exiftool'));
    else errors.push({ code: 'exiftool_failed', target: filePath, message: 'ExifTool could not complete read-only inspection.' });
  }
  if (capability.c2patool === 'available') {
    used = true;
    const result = spawnSync('c2patool', [filePath], {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
      timeout,
      killSignal: 'SIGKILL',
    });
    const c2paOutput = `${result.stdout}\n${result.stderr}`;
    const reportsNoEvidence = /\bno (?:claim|manifest)(?: was)? found\b|\b(?:claim|manifest) not found\b|\bdoes not contain (?:a )?(?:claim|manifest)\b/i.test(c2paOutput);
    if (result.error?.code === 'ETIMEDOUT') {
      errors.push({ code: 'c2patool_timeout', target: filePath, message: `c2patool timed out after ${timeout} milliseconds.` });
      findings.push(finding({
        ruleId: 'coverage.external_tool_timeout',
        confidence: 'informational',
        channel: 'residual',
        target: filePath,
        location: { tool: 'c2patool' },
        message: `c2patool inspection timed out after ${timeout} milliseconds.`,
        evidence: 'The C2PA lane did not complete within its bounded execution time.',
        suggestedAction: 'Retry with a responsive c2patool installation or treat C2PA coverage as degraded.',
      }));
    } else if (result.status === 0 && !reportsNoEvidence && /manifest|claim|content credentials/i.test(result.stdout)) {
      findings.push(finding({
        ruleId: 'c2pa.external_manifest', confidence: 'confirmed', channel: 'c2pa', target: filePath,
        location: { tool: 'c2patool' }, message: 'c2patool reported manifest evidence.',
        evidence: result.stdout.slice(0, 240), suggestedAction: 'Review the full c2patool result and preserve disclosure truth.',
      }));
    } else if (result.status !== 0 && !/no claim|no manifest|not found/i.test(`${result.stdout}\n${result.stderr}`)) {
      errors.push({ code: 'c2patool_failed', target: filePath, message: 'c2patool could not complete read-only inspection.' });
    }
  }
  return { findings, errors, degraded: !used || errors.length > 0 };
}

function inspectBuffer(buffer, filePath, classification, limits, capabilities) {
  const findings = [];
  const targets = [];
  const errors = [];
  let degraded = false;
  let lane = 'signature';
  let status = 'complete';

  if (TEXT_FORMATS.has(classification.format)) {
    lane = 'text-unicode';
    const text = buffer.toString('utf8');
    findings.push(...inspectUnicode(text, filePath));
    const frontmatter = classification.format === 'markdown'
      ? text.match(/^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)
      : null;
    if (frontmatter) {
      findings.push(...inspectRecognizedMetadata(frontmatter[0], filePath));
    }
    if (classification.format === 'html' || classification.format === 'svg') {
      findings.push(...inspectHtmlOrSvg(text, filePath, classification.format));
    }
    const embedded = decodeDataUris(text, filePath, limits);
    findings.push(...embedded.findings);
    targets.push(...embedded.targets);
    errors.push(...embedded.errors);
  } else if (ZIP_FORMATS.has(classification.format)) {
    lane = 'zip-container';
    findings.push(...inspectArchive(classification, filePath));
    const unsupportedMethods = classification.archive.entries
      .filter((entry) => entry.data === null)
      .map((entry) => entry.method);
    if (unsupportedMethods.length > 0) {
      const methods = [...new Set(unsupportedMethods)].sort((left, right) => left - right);
      errors.push({
        code: 'archive_compression_unsupported',
        target: filePath,
        message: `Archive uses unsupported compression method ${methods.join(', ')}.`,
      });
      degraded = true;
      status = 'degraded';
    }
  } else if (classification.format === 'zip' || classification.format === 'unsupported') {
    lane = 'unsupported';
    status = 'unsupported';
    degraded = true;
  } else {
    lane = 'media-container';
    findings.push(...inspectBinaryMetadata(buffer, filePath, classification.format));
    const external = inspectExternal(filePath, classification.format, capabilities, limits.maxExternalToolMilliseconds);
    findings.push(...external.findings);
    errors.push(...external.errors);
    degraded = external.degraded;
    if (degraded) status = 'degraded';
  }

  if (errors.some((error) => error.code.startsWith('data_uri_'))) status = 'unsafe';
  return { findings, targets, errors, degraded, lane, status };
}

function ignoredDirectory(name) {
  return ['.git', 'node_modules', '.cache', '.scriveno-cache'].includes(name);
}

function collectFiles(rawTargets, limits) {
  const files = [];
  const errors = [];
  let totalBytes = 0;

  function addFile(filePath) {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) throw new ProvenanceInputError(`Symlink targets are not followed: ${filePath}.`);
    if (!stat.isFile()) return;
    files.push(path.resolve(filePath));
    totalBytes += stat.size;
    if (files.length > limits.maxFiles) {
      throw new ProvenanceInputError(`Target file count exceeds the limit ${limits.maxFiles}.`, 'file_count_limit');
    }
    if (totalBytes > limits.maxInputBytes) {
      throw new ProvenanceInputError(`Target input bytes exceed the limit ${limits.maxInputBytes}.`, 'input_bytes_limit');
    }
  }

  function walk(directory, root) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      if (ignoredDirectory(entry.name)) continue;
      const candidate = path.join(directory, entry.name);
      const stat = fs.lstatSync(candidate);
      if (stat.isSymbolicLink()) throw new ProvenanceInputError(`Symlink targets are not followed: ${candidate}.`);
      const resolved = path.resolve(candidate);
      if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
        throw new ProvenanceInputError(`Target escapes the selected root: ${candidate}.`);
      }
      if (stat.isDirectory()) walk(candidate, root);
      else if (stat.isFile()) addFile(candidate);
    }
  }

  try {
    for (const rawTarget of rawTargets) {
      const value = String(rawTarget);
      if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
        if (/^https?:/i.test(value)) {
          errors.push({ code: 'remote_unsupported', target: value, message: 'Remote targets are read-only but unsupported by the local provider.' });
          continue;
        }
        throw new ProvenanceInputError(`Unsupported target scheme: ${value}.`, 'unsupported_scheme');
      }
      const target = path.resolve(value);
      if (!fs.existsSync(target)) throw new ProvenanceInputError(`Target does not exist: ${target}.`, 'missing_target');
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) throw new ProvenanceInputError(`Symlink targets are not followed: ${target}.`);
      if (stat.isDirectory()) walk(target, target);
      else addFile(target);
    }
  } catch (error) {
    if (error instanceof ProvenanceInputError) {
      errors.push({ code: error.code, target: null, message: error.message });
    } else {
      throw error;
    }
  }
  return { files: [...new Set(files)].sort(), errors, totalBytes };
}

async function boundedMap(values, jobs, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  let active = 0;
  let peakWorkers = 0;
  async function runWorker() {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      active++;
      peakWorkers = Math.max(peakWorkers, active);
      try {
        results[index] = await worker(values[index], index);
      } finally {
        active--;
      }
    }
  }
  const workerCount = Math.min(jobs, Math.max(values.length, 1));
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return { results, peakWorkers };
}

function recommendedExitCode(report) {
  if (report.status === 'clear') return EXIT_CODES.CLEAR;
  if (report.status === 'findings') return EXIT_CODES.FINDINGS;
  if (report.status === 'degraded' || report.status === 'unsupported') return EXIT_CODES.DEGRADED;
  if (report.status === 'unsafe' || report.status === 'invalid') return EXIT_CODES.INVALID;
  return EXIT_CODES.INTERNAL;
}

function finalizeStatus({ findings, targets, errors }) {
  const degradedErrorCodes = [
    'remote_unsupported',
    'exiftool_failed',
    'c2patool_failed',
    'exiftool_timeout',
    'c2patool_timeout',
    'archive_compression_unsupported',
  ];
  if (errors.some((error) => error.code === 'internal')) return 'error';
  if (errors.some((error) => !degradedErrorCodes.includes(error.code))) return 'unsafe';
  if (errors.some((error) => degradedErrorCodes.includes(error.code))) return 'degraded';
  if (targets.some((target) => target.status === 'degraded' || target.status === 'unsupported')) return 'degraded';
  if (findings.length > 0) return 'findings';
  return 'clear';
}

async function auditTargets(rawTargets, options = {}) {
  const limits = mergeLimits(options.limits);
  const requestedJobs = Number.isFinite(options.jobs) ? Math.trunc(options.jobs) : 4;
  const jobs = Math.max(1, Math.min(requestedJobs, limits.maxJobs, LIMITS.maxJobs));
  const strict = Boolean(options.strict);
  const capabilities = capabilityInventory();
  const inventory = collectFiles(rawTargets, limits);
  const targets = [];
  const findings = [];
  const errors = [...inventory.errors];

  const execution = await boundedMap(inventory.files, jobs, async (filePath) => {
    try {
      const buffer = await fs.promises.readFile(filePath);
      const classification = classifyBuffer(buffer, filePath);
      const extension = path.extname(filePath).toLowerCase();
      if (TEXT_EXTENSIONS.has(extension) && !TEXT_FORMATS.has(classification.format)) {
        throw new ProvenanceInputError(`Binary ${classification.format} input was routed through a text path: ${filePath}.`);
      }
      const inspection = inspectBuffer(buffer, filePath, classification, limits, capabilities);
      const target = {
        path: filePath,
        format: classification.format,
        container: classification.container,
        bytes: buffer.length,
        sha256: sha256(buffer),
        lane: inspection.lane,
        status: inspection.status,
        embedded: false,
      };
      if (strict && ['degraded', 'unsupported'].includes(target.status)) {
        inspection.findings.push(finding({
          ruleId: 'coverage.unresolved', confidence: 'informational', channel: 'residual', target: filePath,
          message: `Strict audit has unresolved ${target.status} coverage.`, evidence: `${classification.format} ${inspection.lane}`,
          suggestedAction: 'Install the documented optional inspection tool or use a supported format.',
        }));
      }
      return { target, ...inspection };
    } catch (error) {
      if (error instanceof ProvenanceInputError) {
        return { errors: [{ code: error.code, target: filePath, message: error.message }], findings: [], targets: [] };
      }
      return { errors: [{ code: 'internal', target: filePath, message: error.message }], findings: [], targets: [] };
    }
  });

  for (const result of execution.results) {
    if (!result) continue;
    if (result.target) targets.push(result.target);
    targets.push(...(result.targets || []));
    findings.push(...(result.findings || []));
    errors.push(...(result.errors || []));
  }
  targets.sort((left, right) => left.path.localeCompare(right.path));
  findings.sort((left, right) => left.target.localeCompare(right.target)
    || left.ruleId.localeCompare(right.ruleId)
    || JSON.stringify(left.location).localeCompare(JSON.stringify(right.location)));
  errors.sort((left, right) => String(left.target).localeCompare(String(right.target)) || left.code.localeCompare(right.code));

  const report = {
    schemaVersion: SCHEMA_VERSION,
    operation: 'audit',
    provider: 'local',
    targets,
    capabilities,
    findings,
    actions: [],
    outputs: [],
    residualRisks: [
      'Soft-bound and pixel-domain media signals are not cleared by a metadata audit.',
      'Statistical text marks are unverifiable without the vendor detector and key.',
      'Metadata state does not change creation history or platform disclosure duties.',
    ],
    errors,
    status: finalizeStatus({ findings, targets, errors }),
    execution: {
      jobs,
      peakWorkers: execution.peakWorkers,
      fileCount: inventory.files.length,
      inputBytes: inventory.totalBytes,
      limits,
      strict,
    },
  };
  report.recommendedExitCode = recommendedExitCode(report);
  return report;
}

function markdownEscape(value) {
  return String(value == null ? '' : value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function formatFindingLocation(location) {
  if (!location) return '';
  const parts = [];
  if (location.member) parts.push(`member ${location.member}`);
  if (location.segment) parts.push(`segment ${location.segment}`);
  if (location.tool) parts.push(`tool ${location.tool}`);
  if (location.line) parts.push(`line ${location.line}`);
  if (location.column) parts.push(`column ${location.column}`);
  if (Number.isInteger(location.offset)) parts.push(`offset ${location.offset}`);
  return parts.join(', ');
}

function serializeMarkdown(report) {
  const lines = [
    '# Provenance Audit',
    '',
    '## Verdict',
    '',
    report.status.toUpperCase(),
    '',
    '## Target Inventory',
    '',
    '| Target | Format | Lane | Status | Bytes |',
    '|---|---|---|---|---:|',
    ...report.targets.map((target) => `| ${markdownEscape(target.path)} | ${target.format} | ${target.lane} | ${target.status} | ${target.bytes} |`),
    '',
    '## Capability Inventory',
    '',
    '| Tool or lane | Status | Effect on coverage |',
    '|---|---|---|',
    ...report.capabilities.map((item) => `| ${item.tool} | ${item.status} | ${markdownEscape(item.effect)} |`),
    '',
    '## Findings',
    '',
    '| Rule | Confidence | Channel | Target | Code point | Count | Message | Location | Evidence | Suggested action |',
    '|---|---|---|---|---|---:|---|---|---|---|',
    ...report.findings.map((item) => `| ${item.ruleId} | ${item.confidence} | ${item.channel} | ${markdownEscape(item.target)} | ${item.codePoint || ''} | ${item.count || ''} | ${markdownEscape(item.message)} | ${markdownEscape(formatFindingLocation(item.location))} | ${markdownEscape(item.evidence)} | ${markdownEscape(item.suggestedAction)} |`),
    ...(report.findings.length === 0 ? ['| none | informational | none | none |  |  | No targeted findings. |  | No targeted findings. | Keep the residual risks in view. |'] : []),
    '',
    '## Errors And Unsupported Paths',
    '',
    ...(report.errors.length ? report.errors.map((error) => `- ${error.code}: ${error.message}`) : ['- None.']),
    '',
    '## Residual Risk',
    '',
    ...report.residualRisks.map((risk) => `- ${risk}`),
    '',
    '## Disclosure Note',
    '',
    'Metadata cleaning does not change creation history or platform disclosure duties.',
    '',
    'Next commands:',
    '- `/scr:provenance-clean`: Preview safe metadata cleanup for writer-owned files.',
    '- `/scr:compliance-check`: Review platform disclosure and rights duties before publishing.',
  ];
  return `${lines.join('\n')}\n`;
}

function sarifLevel(confidence) {
  if (confidence === 'confirmed') return 'error';
  if (confidence === 'probable') return 'warning';
  return 'note';
}

function serializeSarif(report) {
  const ruleIds = [...new Set(report.findings.map((item) => item.ruleId))].sort();
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'Scriveno provenance-check',
          informationUri: 'https://github.com/hannsxpeter/scriveno',
          rules: ruleIds.map((id) => ({ id, shortDescription: { text: id } })),
        },
      },
      results: report.findings.map((item) => ({
        ruleId: item.ruleId,
        level: sarifLevel(item.confidence),
        message: { text: item.message },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: item.target },
            ...(item.location?.line ? { region: { startLine: item.location.line, startColumn: item.location.column || 1 } } : {}),
          },
        }],
        properties: {
          confidence: item.confidence,
          channel: item.channel,
          evidence: item.evidence,
          location: item.location,
          suggestedAction: item.suggestedAction,
        },
      })),
      invocations: [{
        executionSuccessful: report.status !== 'error',
        exitCode: report.recommendedExitCode,
        properties: {
          schemaVersion: report.schemaVersion,
          operation: report.operation,
          provider: report.provider,
          status: report.status,
          residualRisks: report.residualRisks,
          errors: report.errors,
        },
      }],
    }],
  };
}

function serializeReport(report, format = 'markdown') {
  if (format === 'markdown') return serializeMarkdown(report);
  if (format === 'json') return `${JSON.stringify(report, null, 2)}\n`;
  if (format === 'sarif') return `${JSON.stringify(serializeSarif(report), null, 2)}\n`;
  throw new ProvenanceInputError(`Unknown report format ${JSON.stringify(format)}.`);
}

module.exports = {
  SCHEMA_VERSION,
  EXIT_CODES,
  LIMITS,
  ProvenanceInputError,
  auditTargets,
  classifyBuffer,
  parseZipContainer,
  recommendedExitCode,
  serializeReport,
};
