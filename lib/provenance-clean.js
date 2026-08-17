// Implements: P-MUST-02, P-MUST-03, P-MUST-04, P-MUST-08, P-MUST-09, P-MUST-10, P-MUST-11, P-MUST-12, P-MUST-13, P-MUST-14, P-MUST-15, P-MUST-18
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const audit = require('./provenance-audit.js');
const provider = require('./provenance-provider.js');

const CLEAN_SCHEMA_VERSION = 'scriveno.provenance.clean/v1';
const TEXT_FORMATS = new Set(['markdown', 'text', 'html', 'svg']);
const ARCHIVE_FORMATS = new Set(['docx', 'odt', 'epub', 'xlsx', 'pptx']);
const METADATA_PATTERN = /(?:ai[-_ ]?(?:generated|assisted|tool)|content credentials|c2pa|provenance|watermark)/i;
const METADATA_FIELD_PATTERN = /(?:generator|software|creator|author|producer|application|provenance|tool|ai[-_])/i;
const ORDINARY_TOOL_FIELD_PATTERN = /(?:generator|software|producer|application|tool)/i;
const ORDINARY_TOOL_KEYS = new Set(['application', 'generator', 'producer', 'software', 'tool']);
const PROTECTED_METADATA_VALUE_PATTERN = /(?:accessibility|alt(?:ernative)?(?:\s+text)?|author|copyright|description|license|rights)/i;
const DATA_URI_FORMATS = Object.freeze({
  png: 'png', jpeg: 'jpeg', jpg: 'jpeg', webp: 'webp', gif: 'gif', bmp: 'bmp',
  tiff: 'tiff', avif: 'avif', heic: 'heic',
});

class ProvenanceCleanError extends Error {
  constructor(message, code = 'unsafe_input', exitCode = audit.EXIT_CODES.INVALID) {
    super(message);
    this.name = 'ProvenanceCleanError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
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

function isJoiningScript(value) {
  return /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}]/u.test(value || '');
}

function isEmojiLike(value) {
  return /\p{Extended_Pictographic}/u.test(value || '');
}

function codePointLabel(codePoint) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

function confirmedUnicodeEvidence(preAudit, member = null) {
  const evidence = new Map();
  for (const finding of preAudit?.findings || []) {
    if (finding.confidence !== 'confirmed' || !finding.codePoint) continue;
    const findingMember = finding.location?.member || null;
    if (findingMember !== member) continue;
    evidence.set(finding.codePoint, (evidence.get(finding.codePoint) || 0) + (finding.count || 1));
  }
  return evidence;
}

function preserveUnicodeContext(characters, index, codePoint) {
  const previous = characters[index - 1] || '';
  const next = characters[index + 1] || '';
  if ((codePoint === 0x200c || codePoint === 0x200d) && isJoiningScript(previous) && isJoiningScript(next)) return true;
  if ((codePoint === 0x200d || codePoint >= 0xfe00 && codePoint <= 0xfe0f)
    && (isEmojiLike(previous) || isEmojiLike(next))) return true;
  if (codePoint >= 0xe0000 && codePoint <= 0xe007f
    && characters.slice(Math.max(0, index - 8), index).some(isEmojiLike)) return true;
  return false;
}

function cleanLayerA(text, evidence = null) {
  const normalizedAudit = evidence
    ? null
    : audit.auditBuffer(Buffer.from(String(text)), 'in-memory.txt');
  const remaining = evidence || confirmedUnicodeEvidence(normalizedAudit);
  const characters = [...String(text)];
  let removed = 0;
  let replaced = 0;
  const codePointCounts = {};
  const output = characters.map((character, index) => {
    const codePoint = character.codePointAt(0);
    if (preserveUnicodeContext(characters, index, codePoint)) return character;
    if (codePoint === 0xfeff && index === 0) return character;
    const label = codePointLabel(codePoint);
    if (!remaining.has(label) || remaining.get(label) <= 0) return character;
    if ([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff].includes(codePoint)
      || codePoint >= 0x202a && codePoint <= 0x202e
      || codePoint >= 0x2066 && codePoint <= 0x2069
      || codePoint >= 0xe0000 && codePoint <= 0xe007f) {
      remaining.set(label, remaining.get(label) - 1);
      removed++;
      codePointCounts[label] = codePointCounts[label] || { removed: 0, replaced: 0 };
      codePointCounts[label].removed++;
      return '';
    }
    if ([0x00a0, 0x1680, 0x202f, 0x205f, 0x3000].includes(codePoint)
      || codePoint >= 0x2000 && codePoint <= 0x200a) {
      remaining.set(label, remaining.get(label) - 1);
      replaced++;
      codePointCounts[label] = codePointCounts[label] || { removed: 0, replaced: 0 };
      codePointCounts[label].replaced++;
      return ' ';
    }
    return character;
  }).join('');
  return { text: output, removed, replaced, codePointCounts, changed: output !== text };
}

function cleanRecognizedMetadataText(text) {
  let removed = 0;
  let result = String(text);
  result = result.replace(/<([\w:.-]*(?:generator|software|creator|author|producer|application|provenance|tool|ai[-_][\w:.-]*)[\w:.-]*)\b([^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, tag, attributes, value) => {
      if (!ORDINARY_TOOL_FIELD_PATTERN.test(tag) && !METADATA_PATTERN.test(`${tag} ${attributes} ${value}`)) return match;
      removed++;
      return `<${tag}${attributes}></${tag}>`;
    });
  result = result.replace(/\sdata-ai[\w:.-]*=(?:"[^"]*"|'[^']*')/gi, () => {
    removed++;
    return '';
  });
  return { text: result, removed, changed: result !== text };
}

function addCodePointCounts(target, source) {
  for (const [label, counts] of Object.entries(source || {})) {
    target[label] = target[label] || { removed: 0, replaced: 0 };
    target[label].removed += counts.removed || 0;
    target[label].replaced += counts.replaced || 0;
  }
}

function cleanXmlTextNodes(xml, evidence = null) {
  let removed = 0;
  let replaced = 0;
  const codePointCounts = {};
  const text = String(xml).replace(/>([^<]*)</g, (match, value) => {
    const cleaned = cleanLayerA(value, evidence);
    removed += cleaned.removed;
    replaced += cleaned.replaced;
    addCodePointCounts(codePointCounts, cleaned.codePointCounts);
    return `>${cleaned.text}<`;
  });
  return { text, removed, replaced, codePointCounts, changed: text !== xml };
}

function cleanMarkup(xml, evidence = null) {
  const protectedBlock = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let cursor = 0;
  let output = '';
  let removed = 0;
  let replaced = 0;
  const codePointCounts = {};
  for (const match of String(xml).matchAll(protectedBlock)) {
    const visible = String(xml).slice(cursor, match.index);
    const body = cleanXmlTextNodes(visible, evidence);
    const metadata = cleanRecognizedMetadataText(body.text);
    output += metadata.text + match[0];
    removed += body.removed + metadata.removed;
    replaced += body.replaced;
    addCodePointCounts(codePointCounts, body.codePointCounts);
    cursor = match.index + match[0].length;
  }
  const tail = String(xml).slice(cursor);
  const body = cleanXmlTextNodes(tail, evidence);
  const metadata = cleanRecognizedMetadataText(body.text);
  output += metadata.text;
  removed += body.removed + metadata.removed;
  replaced += body.replaced;
  addCodePointCounts(codePointCounts, body.codePointCounts);
  return { text: output, removed, replaced, codePointCounts, changed: output !== xml };
}

function cleanMarkdown(text, evidence = null) {
  const layer = cleanLayerA(text, evidence);
  let removedMetadata = 0;
  let output = layer.text;
  const frontmatter = output.match(/^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (frontmatter) {
    const cleaned = frontmatter[1].split(/\r?\n/).filter((line) => {
      const separator = line.indexOf(':');
      if (separator < 0) return true;
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1);
      if (ORDINARY_TOOL_FIELD_PATTERN.test(key) || METADATA_FIELD_PATTERN.test(key) && METADATA_PATTERN.test(value)) {
        removedMetadata++;
        return false;
      }
      return true;
    }).join('\n');
    output = output.replace(frontmatter[1], cleaned);
  }
  return {
    buffer: Buffer.from(output), changed: output !== text,
    actions: [], counts: { removed: layer.removed + removedMetadata, replaced: layer.replaced, byCodePoint: layer.codePointCounts },
  };
}

function parsePng(buffer) {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    throw new ProvenanceCleanError('PNG signature is invalid.', 'format_mismatch');
  }
  const chunks = [];
  let cursor = 8;
  while (cursor < buffer.length) {
    if (cursor + 12 > buffer.length) throw new ProvenanceCleanError('PNG chunk exceeds the file boundary.', 'malformed_media');
    const length = buffer.readUInt32BE(cursor);
    const end = cursor + 12 + length;
    if (end > buffer.length) throw new ProvenanceCleanError('PNG chunk exceeds the file boundary.', 'malformed_media');
    const type = buffer.toString('ascii', cursor + 4, cursor + 8);
    const data = buffer.subarray(cursor + 8, cursor + 8 + length);
    const expectedChecksum = buffer.readUInt32BE(cursor + 8 + length);
    const actualChecksum = crc32(Buffer.concat([buffer.subarray(cursor + 4, cursor + 8), data]));
    if (expectedChecksum !== actualChecksum) throw new ProvenanceCleanError(`PNG ${type} chunk failed its checksum.`, 'malformed_media');
    chunks.push({ type, data, raw: buffer.subarray(cursor, end) });
    cursor = end;
  }
  if (!chunks.some((item) => item.type === 'IEND')) throw new ProvenanceCleanError('PNG end chunk is missing.', 'malformed_media');
  return chunks;
}

function cleanPng(buffer) {
  const chunks = parsePng(buffer);
  const kept = [];
  let removed = 0;
  let residual = null;
  for (const item of chunks) {
    const text = item.data.toString('latin1');
    const separator = text.indexOf('\0');
    const keyword = separator >= 0 ? text.slice(0, separator) : '';
    const value = separator >= 0 ? text.slice(separator + 1) : '';
    const exactToolKey = ORDINARY_TOOL_KEYS.has(keyword.trim().toLowerCase());
    if (item.type === 'caBX') {
      removed++;
      continue;
    }
    if (['tEXt', 'zTXt', 'iTXt'].includes(item.type)) {
      const exactSafeTextField = item.type === 'tEXt' && exactToolKey
        && !PROTECTED_METADATA_VALUE_PATTERN.test(value);
      if (exactSafeTextField) {
        removed++;
        continue;
      }
      if (exactToolKey || METADATA_FIELD_PATTERN.test(keyword) || METADATA_PATTERN.test(text)) {
        residual = 'Mixed or protected PNG text metadata remains byte-for-byte because an exact whole-field removal cannot be proven safe.';
      }
    }
    if (item.type === 'eXIf' && (METADATA_FIELD_PATTERN.test(text) || METADATA_PATTERN.test(text))) {
      residual = 'PNG eXIf metadata remains byte-for-byte because field-level Exif removal cannot be proven safe.';
    }
    kept.push(item);
  }
  return { buffer: removed ? Buffer.concat([buffer.subarray(0, 8), ...kept.map((item) => item.raw)]) : Buffer.from(buffer), removed, residual };
}

function cleanWebp(buffer) {
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    throw new ProvenanceCleanError('WebP signature is invalid.', 'format_mismatch');
  }
  const kept = [];
  let removed = 0;
  let cursor = 12;
  while (cursor < buffer.length) {
    if (cursor + 8 > buffer.length) throw new ProvenanceCleanError('WebP chunk exceeds the file boundary.', 'malformed_media');
    const type = buffer.toString('ascii', cursor, cursor + 4);
    const length = buffer.readUInt32LE(cursor + 4);
    const end = cursor + 8 + length + (length % 2);
    if (end > buffer.length) throw new ProvenanceCleanError('WebP chunk exceeds the file boundary.', 'malformed_media');
    const raw = buffer.subarray(cursor, end);
    const data = buffer.subarray(cursor + 8, cursor + 8 + length);
    if (type === 'C2PA') {
      removed++;
    } else kept.push({ type, raw });
    cursor = end;
  }
  const chunks = kept.map((item) => {
    if (item.type !== 'VP8X' || item.raw.length < 18) return item.raw;
    const raw = Buffer.from(item.raw);
    return raw;
  });
  const size = Buffer.alloc(4);
  size.writeUInt32LE(4 + chunks.reduce((sum, item) => sum + item.length, 0));
  const mixed = kept.some((item) => ['XMP ', 'EXIF'].includes(item.type));
  return {
    buffer: removed ? Buffer.concat([Buffer.from('RIFF'), size, Buffer.from('WEBP'), ...chunks]) : Buffer.from(buffer),
    removed,
    residual: mixed ? 'WebP XMP and EXIF metadata remain byte-for-byte because field-level removal cannot be proven safe.' : null,
  };
}

function parseIsoBoxes(buffer, start, end, limits, depth = 0, state = { count: 0 }) {
  if (depth > 8) throw new ProvenanceCleanError('ISO BMFF nesting exceeds the safe depth.', 'malformed_media');
  const boxes = [];
  let cursor = start;
  const containers = new Set(['moov', 'trak', 'mdia', 'minf', 'dinf', 'stbl', 'edts', 'udta', 'iprp', 'ipco', 'sinf', 'schi', 'meta']);
  while (cursor < end) {
    if (cursor + 8 > end) throw new ProvenanceCleanError('ISO BMFF box exceeds the file boundary.', 'malformed_media');
    let size = buffer.readUInt32BE(cursor);
    const type = buffer.toString('ascii', cursor + 4, cursor + 8);
    let headerSize = 8;
    if (size === 1) {
      if (cursor + 16 > end) throw new ProvenanceCleanError('ISO BMFF large box header is incomplete.', 'malformed_media');
      const large = buffer.readBigUInt64BE(cursor + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) throw new ProvenanceCleanError('ISO BMFF box exceeds the safe local range.', 'malformed_media');
      size = Number(large);
      headerSize = 16;
    } else if (size === 0) size = end - cursor;
    if (size < headerSize || cursor + size > end) throw new ProvenanceCleanError('ISO BMFF box exceeds the file boundary.', 'malformed_media');
    state.count++;
    if (state.count > limits.maxArchiveEntries) throw new ProvenanceCleanError('ISO BMFF box count exceeds the safe limit.', 'malformed_media');
    const box = { type, start: cursor, end: cursor + size, headerSize, depth, children: [] };
    if (containers.has(type)) {
      const preamble = type === 'meta' ? 4 : 0;
      const childStart = cursor + headerSize + preamble;
      if (childStart > box.end) throw new ProvenanceCleanError('ISO BMFF container preamble exceeds its box.', 'malformed_media');
      box.children = parseIsoBoxes(buffer, childStart, box.end, limits, depth + 1, state);
    }
    boxes.push(box);
    cursor += size;
  }
  return boxes;
}

function cleanIsoBmff(buffer, limits) {
  const boxes = parseIsoBoxes(buffer, 0, buffer.length, limits);
  const flatten = (items) => items.flatMap((item) => [item, ...flatten(item.children)]);
  const all = flatten(boxes);
  const metadataTypes = new Set(['Exif', 'xml ', 'uuid', 'c2pa', 'jumb']);
  const candidates = all.filter((box) => metadataTypes.has(box.type) && (
    box.type !== 'uuid'
    || METADATA_PATTERN.test(buffer.subarray(box.start + box.headerSize, box.end).toString('latin1'))
  ));
  if (candidates.length === 0) return { buffer: Buffer.from(buffer), removed: 0, residual: null };
  const nested = candidates.some((box) => box.depth > 0) ? 'Nested ' : '';
  const types = [...new Set(candidates.map((box) => box.type))].join(', ');
  return {
    buffer: Buffer.from(buffer),
    removed: 0,
    residual: `${nested}ISO BMFF metadata (${types}) remains unchanged because field-level removal and an offset-safe rewrite cannot be proven; iloc or other absolute offsets may reference later boxes.`,
  };
}

function readGifSubBlocks(buffer, cursor) {
  const start = cursor;
  while (cursor < buffer.length) {
    const size = buffer[cursor++];
    if (size === 0) return { end: cursor, data: buffer.subarray(start, cursor) };
    if (cursor + size > buffer.length) throw new ProvenanceCleanError('GIF sub-block exceeds the file boundary.', 'malformed_media');
    cursor += size;
  }
  throw new ProvenanceCleanError('GIF sub-block terminator is missing.', 'malformed_media');
}

function cleanGif(buffer) {
  if (buffer.length < 13 || !['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) {
    throw new ProvenanceCleanError('GIF signature is invalid.', 'format_mismatch');
  }
  const globalTableBytes = buffer[10] & 0x80 ? 3 * (2 ** ((buffer[10] & 0x07) + 1)) : 0;
  let cursor = 13 + globalTableBytes;
  if (cursor > buffer.length) throw new ProvenanceCleanError('GIF color table exceeds the file boundary.', 'malformed_media');
  const kept = [buffer.subarray(0, cursor)];
  let removed = 0;
  let residual = false;
  while (cursor < buffer.length) {
    const start = cursor;
    const introducer = buffer[cursor++];
    if (introducer === 0x3b) {
      kept.push(buffer.subarray(start));
      cursor = buffer.length;
      break;
    }
    if (introducer === 0x2c) {
      if (cursor + 9 > buffer.length) throw new ProvenanceCleanError('GIF image descriptor exceeds the file boundary.', 'malformed_media');
      const packed = buffer[cursor + 8];
      cursor += 9;
      if (packed & 0x80) cursor += 3 * (2 ** ((packed & 0x07) + 1));
      if (cursor >= buffer.length) throw new ProvenanceCleanError('GIF image data is incomplete.', 'malformed_media');
      cursor++;
      cursor = readGifSubBlocks(buffer, cursor).end;
      kept.push(buffer.subarray(start, cursor));
      continue;
    }
    if (introducer !== 0x21 || cursor >= buffer.length) throw new ProvenanceCleanError('GIF block is malformed.', 'malformed_media');
    const label = buffer[cursor++];
    if (label === 0xf9) {
      if (cursor >= buffer.length) throw new ProvenanceCleanError('GIF control block is malformed.', 'malformed_media');
      const length = buffer[cursor];
      cursor += 1 + length + 1;
    } else if (label === 0xff || label === 0x01) {
      if (cursor >= buffer.length) throw new ProvenanceCleanError('GIF extension is malformed.', 'malformed_media');
      const length = buffer[cursor];
      cursor += 1 + length;
      cursor = readGifSubBlocks(buffer, cursor).end;
    } else {
      cursor = readGifSubBlocks(buffer, cursor).end;
    }
    if (cursor > buffer.length) throw new ProvenanceCleanError('GIF extension exceeds the file boundary.', 'malformed_media');
    const raw = buffer.subarray(start, cursor);
    kept.push(raw);
    if (label === 0xfe && METADATA_PATTERN.test(raw.toString('latin1'))) residual = true;
  }
  return {
    buffer: Buffer.concat(kept), removed,
    residual: residual ? 'GIF comment metadata remains byte-for-byte because field-level removal cannot be proven safe.' : null,
  };
}

function cleanBmp(buffer) {
  if (buffer.length < 54 || buffer.toString('ascii', 0, 2) !== 'BM') throw new ProvenanceCleanError('BMP signature is invalid.', 'format_mismatch');
  const pixelOffset = buffer.readUInt32LE(10);
  const dibSize = buffer.readUInt32LE(14);
  let pixelLength = 0;
  if (dibSize >= 40 && buffer.length >= 38) pixelLength = buffer.readUInt32LE(34);
  if (!pixelLength && dibSize >= 40) {
    const width = Math.abs(buffer.readInt32LE(18));
    const height = Math.abs(buffer.readInt32LE(22));
    const bits = buffer.readUInt16LE(28);
    pixelLength = Math.ceil(width * bits / 32) * 4 * height;
  }
  const contentEnd = pixelOffset + pixelLength;
  if (pixelOffset < 14 + dibSize || contentEnd > buffer.length) throw new ProvenanceCleanError('BMP pixel boundary is invalid.', 'malformed_media');
  if (dibSize >= 124) {
    if (buffer.length < 14 + 124) throw new ProvenanceCleanError('BMP V5 header is incomplete.', 'malformed_media');
    const profileOffset = buffer.readUInt32LE(14 + 112);
    const profileSize = buffer.readUInt32LE(14 + 116);
    if (profileSize > 0) {
      const profileStart = 14 + profileOffset;
      if (profileOffset < dibSize || profileStart + profileSize > buffer.length) {
        throw new ProvenanceCleanError('BMP V5 ICC profile boundary is invalid.', 'malformed_media');
      }
    }
  }
  const outsidePixels = Buffer.concat([buffer.subarray(0, pixelOffset), buffer.subarray(contentEnd)]);
  return {
    buffer: Buffer.from(buffer),
    removed: 0,
    residual: METADATA_PATTERN.test(outsidePixels.toString('latin1'))
      ? 'BMP metadata-like bytes remain because a safe structured rewrite cannot be proven locally.'
      : null,
  };
}

function cleanTiff(buffer, big = false, limits = audit.LIMITS) {
  const little = buffer.toString('ascii', 0, 2) === 'II';
  if (!little && buffer.toString('ascii', 0, 2) !== 'MM') throw new ProvenanceCleanError('TIFF byte order is invalid.', 'format_mismatch');
  if (big) return cleanBigTiff(buffer, little, limits);
  if (buffer.length < 8) throw new ProvenanceCleanError('TIFF header is incomplete.', 'malformed_media');
  const u16 = (offset) => little ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
  const u32 = (offset) => little ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
  const first = u32(4);
  const metadataTags = new Set([270, 305, 315, 316, 33432, 37510, 700]);
  const units = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4 };
  const entries = [];
  const directories = [];
  const seen = new Set();
  let ifdOffset = first;
  while (ifdOffset !== 0) {
    if (ifdOffset < 8 || seen.has(ifdOffset)) throw new ProvenanceCleanError('TIFF IFD chain contains an invalid offset or cycle.', 'malformed_media');
    if (seen.size >= limits.maxArchiveEntries || ifdOffset + 2 > buffer.length) {
      throw new ProvenanceCleanError('TIFF IFD chain exceeds the safe count or file boundary.', 'malformed_media');
    }
    seen.add(ifdOffset);
    const count = u16(ifdOffset);
    const nextOffsetAt = ifdOffset + 2 + count * 12;
    if (entries.length + count > limits.maxArchiveEntries || nextOffsetAt + 4 > buffer.length) {
      throw new ProvenanceCleanError('TIFF IFD entry count exceeds the safe limit or file boundary.', 'malformed_media');
    }
    const directory = [];
    for (let index = 0; index < count; index++) {
      const offset = ifdOffset + 2 + index * 12;
      const tag = u16(offset);
      const type = u16(offset + 2);
      const values = u32(offset + 4);
      const unit = units[type] || 0;
      if (!unit || values > Math.floor(Number.MAX_SAFE_INTEGER / unit)) throw new ProvenanceCleanError('TIFF metadata size is invalid.', 'malformed_media');
      const bytes = values * unit;
      const valueOffset = bytes <= 4 ? offset + 8 : u32(offset + 8);
      if (valueOffset + bytes > buffer.length) throw new ProvenanceCleanError('TIFF metadata value exceeds the file boundary.', 'malformed_media');
      const parsed = { offset, tag, type, values, unit, bytes, valueOffset };
      entries.push(parsed);
      directory.push(parsed);
    }
    directories.push(directory);
    ifdOffset = u32(nextOffsetAt);
  }
  const numericValues = (entry) => {
    if (!entry || ![3, 4].includes(entry.type)) return null;
    if (entry.values > limits.maxArchiveEntries) throw new ProvenanceCleanError('TIFF strip or tile value count exceeds the safe limit.', 'malformed_media');
    return Array.from({ length: entry.values }, (_, index) => entry.type === 3
      ? u16(entry.valueOffset + index * 2)
      : u32(entry.valueOffset + index * 4));
  };
  const pixelRanges = [];
  for (const directory of directories) {
    for (const [offsetTag, countTag] of [[273, 279], [324, 325]]) {
      const offsetEntries = directory.filter((entry) => entry.tag === offsetTag);
      const countEntries = directory.filter((entry) => entry.tag === countTag);
      if (offsetEntries.length === 0 && countEntries.length === 0) continue;
      if (offsetEntries.length !== 1 || countEntries.length !== 1) {
        return { buffer: Buffer.from(buffer), removed: 0, residual: 'TIFF pixel strip or tile ranges are incomplete, so metadata rewriting cannot be proven safe.' };
      }
      const offsets = numericValues(offsetEntries[0]);
      const byteCounts = numericValues(countEntries[0]);
      if (!offsets || !byteCounts || !(byteCounts.length === offsets.length || byteCounts.length === 1)) {
        return { buffer: Buffer.from(buffer), removed: 0, residual: 'TIFF pixel strip or tile ranges are incomplete, so metadata rewriting cannot be proven safe.' };
      }
      offsets.forEach((start, index) => {
        const length = byteCounts.length === 1 ? byteCounts[0] : byteCounts[index];
        if (start + length > buffer.length) throw new ProvenanceCleanError('TIFF pixel strip or tile exceeds the file boundary.', 'malformed_media');
        pixelRanges.push({ start, end: start + length });
      });
    }
  }
  const candidates = entries.filter((entry) => metadataTags.has(entry.tag)).filter((entry) => {
    const value = buffer.subarray(entry.valueOffset, entry.valueOffset + entry.bytes);
    return entry.tag === 305 || METADATA_PATTERN.test(value.toString('latin1'));
  });
  if (candidates.some((entry) => pixelRanges.some((range) => entry.valueOffset < range.end && entry.valueOffset + entry.bytes > range.start))) {
    return { buffer: Buffer.from(buffer), removed: 0, residual: 'TIFF metadata value overlaps a pixel strip or tile range, so no bytes were changed.' };
  }
  return {
    buffer: Buffer.from(buffer), removed: 0,
    residual: candidates.length
      ? 'TIFF metadata remains unchanged because protected IFD structures and unrelated referenced values make local mutation unproven.'
      : null,
  };
}

function cleanBigTiff(buffer, little, limits) {
  if (buffer.length < 16) throw new ProvenanceCleanError('BigTIFF header is incomplete.', 'malformed_media');
  const u16 = (offset) => little ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
  const u64 = (offset) => little ? buffer.readBigUInt64LE(offset) : buffer.readBigUInt64BE(offset);
  if (u16(4) !== 8 || u16(6) !== 0) throw new ProvenanceCleanError('BigTIFF offset size is unsupported.', 'malformed_media');
  const asOffset = (value) => {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new ProvenanceCleanError('BigTIFF offset exceeds the safe local range.', 'malformed_media');
    return Number(value);
  };
  const first = asOffset(u64(8));
  const metadataTags = new Set([270, 305, 315, 316, 33432, 37510, 700]);
  const units = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4, 16: 8, 17: 8, 18: 8 };
  const entries = [];
  const directories = [];
  const seen = new Set();
  let ifdOffset = first;
  while (ifdOffset !== 0) {
    if (ifdOffset < 16 || seen.has(ifdOffset)) throw new ProvenanceCleanError('BigTIFF IFD chain contains an invalid offset or cycle.', 'malformed_media');
    if (seen.size >= limits.maxArchiveEntries || ifdOffset + 8 > buffer.length) {
      throw new ProvenanceCleanError('BigTIFF IFD chain exceeds the safe count or file boundary.', 'malformed_media');
    }
    seen.add(ifdOffset);
    const count = asOffset(u64(ifdOffset));
    const nextOffsetAt = ifdOffset + 8 + count * 20;
    if (entries.length + count > limits.maxArchiveEntries || nextOffsetAt + 8 > buffer.length) {
      throw new ProvenanceCleanError('BigTIFF IFD entry count exceeds the safe limit or file boundary.', 'malformed_media');
    }
    const directory = [];
    for (let index = 0; index < count; index++) {
      const offset = ifdOffset + 8 + index * 20;
      const tag = u16(offset);
      const type = u16(offset + 2);
      const values = asOffset(u64(offset + 4));
      const unit = units[type] || 0;
      if (!unit || values > Math.floor(Number.MAX_SAFE_INTEGER / unit)) throw new ProvenanceCleanError('BigTIFF metadata size is invalid.', 'malformed_media');
      const bytes = values * unit;
      const valueOffset = bytes <= 8 ? offset + 12 : asOffset(u64(offset + 12));
      if (valueOffset + bytes > buffer.length) throw new ProvenanceCleanError('BigTIFF metadata value exceeds the file boundary.', 'malformed_media');
      const parsed = { offset, tag, type, values, unit, bytes, valueOffset };
      entries.push(parsed);
      directory.push(parsed);
    }
    directories.push(directory);
    ifdOffset = asOffset(u64(nextOffsetAt));
  }
  const numericValues = (entry) => {
    if (!entry || ![3, 4, 16, 18].includes(entry.type)) return null;
    if (entry.values > limits.maxArchiveEntries) throw new ProvenanceCleanError('BigTIFF strip or tile value count exceeds the safe limit.', 'malformed_media');
    return Array.from({ length: entry.values }, (_, index) => {
      if (entry.type === 3) return u16(entry.valueOffset + index * 2);
      if (entry.type === 4) {
        return little ? buffer.readUInt32LE(entry.valueOffset + index * 4) : buffer.readUInt32BE(entry.valueOffset + index * 4);
      }
      return asOffset(u64(entry.valueOffset + index * 8));
    });
  };
  const pixelRanges = [];
  for (const directory of directories) {
    for (const [offsetTag, countTag] of [[273, 279], [324, 325]]) {
      const offsetEntries = directory.filter((entry) => entry.tag === offsetTag);
      const countEntries = directory.filter((entry) => entry.tag === countTag);
      if (offsetEntries.length === 0 && countEntries.length === 0) continue;
      if (offsetEntries.length !== 1 || countEntries.length !== 1) {
        return { buffer: Buffer.from(buffer), removed: 0, residual: 'BigTIFF pixel strip or tile ranges are incomplete, so metadata rewriting cannot be proven safe.' };
      }
      const offsets = numericValues(offsetEntries[0]);
      const byteCounts = numericValues(countEntries[0]);
      if (!offsets || !byteCounts || !(byteCounts.length === offsets.length || byteCounts.length === 1)) {
        return { buffer: Buffer.from(buffer), removed: 0, residual: 'BigTIFF pixel strip or tile ranges are incomplete, so metadata rewriting cannot be proven safe.' };
      }
      offsets.forEach((start, index) => {
        const length = byteCounts.length === 1 ? byteCounts[0] : byteCounts[index];
        if (start + length > buffer.length) throw new ProvenanceCleanError('BigTIFF pixel strip or tile exceeds the file boundary.', 'malformed_media');
        pixelRanges.push({ start, end: start + length });
      });
    }
  }
  const candidates = entries.filter((entry) => metadataTags.has(entry.tag)).filter((entry) => {
    const value = buffer.subarray(entry.valueOffset, entry.valueOffset + entry.bytes);
    return entry.tag === 305 || METADATA_PATTERN.test(value.toString('latin1'));
  });
  if (candidates.some((entry) => pixelRanges.some((range) => entry.valueOffset < range.end && entry.valueOffset + entry.bytes > range.start))) {
    return { buffer: Buffer.from(buffer), removed: 0, residual: 'BigTIFF metadata value overlaps a pixel strip or tile range, so no bytes were changed.' };
  }
  return {
    buffer: Buffer.from(buffer), removed: 0,
    residual: candidates.length
      ? 'BigTIFF metadata remains unchanged because protected IFD structures and unrelated referenced values make local mutation unproven.'
      : null,
  };
}

function cleanJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new ProvenanceCleanError('JPEG signature is invalid.', 'format_mismatch');
  const kept = [buffer.subarray(0, 2)];
  let cursor = 2;
  let removed = 0;
  let residual = null;
  while (cursor < buffer.length) {
    if (buffer[cursor] !== 0xff) throw new ProvenanceCleanError('JPEG marker is malformed.', 'malformed_media');
    const markerStart = cursor;
    while (buffer[cursor] === 0xff) cursor++;
    const marker = buffer[cursor++];
    if (marker === 0xd9) {
      kept.push(buffer.subarray(markerStart));
      cursor = buffer.length;
      break;
    }
    if (marker === 0xda) {
      kept.push(buffer.subarray(markerStart));
      cursor = buffer.length;
      break;
    }
    if (cursor + 2 > buffer.length) throw new ProvenanceCleanError('JPEG segment is incomplete.', 'malformed_media');
    const size = buffer.readUInt16BE(cursor);
    const end = cursor + size;
    if (size < 2 || end > buffer.length) throw new ProvenanceCleanError('JPEG segment exceeds the file boundary.', 'malformed_media');
    const raw = buffer.subarray(markerStart, end);
    const data = buffer.subarray(cursor + 2, end);
    const text = data.toString('latin1');
    const exif = marker === 0xe1 && text.startsWith('Exif\0\0');
    const xmp = marker === 0xe1 && text.startsWith('http://ns.adobe.com/xap/1.0/\0');
    const protectedComment = marker === 0xfe && PROTECTED_METADATA_VALUE_PATTERN.test(text);
    const exactComment = marker === 0xfe && !protectedComment
      && /^(?:generator|software|producer|application|tool)\s*[:=]\s*[^\r\n;<>{}]+$/i.test(text.trim());
    const exactRemovable = marker === 0xeb && /c2pa|jumb/i.test(text) || exactComment;
    if (exif) {
      kept.push(raw);
      if (METADATA_FIELD_PATTERN.test(text) || METADATA_PATTERN.test(text)) {
        residual = 'JPEG Exif generator metadata remains because field-level Exif rewriting cannot be proven safe while preserving Orientation and all other Exif fields.';
      }
    } else if (xmp) {
      kept.push(raw);
      if (METADATA_FIELD_PATTERN.test(text) || METADATA_PATTERN.test(text)) {
        residual = 'JPEG XMP generator metadata remains because field-level XMP rewriting cannot be proven safe while preserving alt text, rights, copyright, accessibility, and all other protected XMP fields.';
      }
    } else if (marker === 0xed && (METADATA_FIELD_PATTERN.test(text) || METADATA_PATTERN.test(text))) {
      kept.push(raw);
      residual = 'JPEG APP13 metadata remains byte-for-byte because field-level removal cannot be proven safe.';
    } else if (marker === 0xfe && !exactComment
      && (protectedComment || METADATA_FIELD_PATTERN.test(text) || METADATA_PATTERN.test(text))) {
      kept.push(raw);
      residual = 'Mixed JPEG COM metadata remains byte-for-byte because field-level removal cannot be proven safe.';
    } else if (exactRemovable) removed++;
    else kept.push(raw);
    cursor = end;
  }
  return { buffer: Buffer.concat(kept), removed, residual };
}

function buildZipContainer(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    if (![0, 8].includes(entry.method)) throw new ProvenanceCleanError(`Archive uses unsupported compression method ${entry.method}.`, 'archive_compression_unsupported');
    const name = Buffer.from(entry.name, entry.flags & 0x0800 ? 'utf8' : 'latin1');
    const data = Buffer.from(entry.data);
    const compressed = entry.method === 8 ? zlib.deflateRawSync(data) : data;
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(entry.flags & 0x0800, 6);
    localHeader.writeUInt16LE(entry.method, 8);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    local.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(entry.flags & 0x0800, 8);
    centralHeader.writeUInt16LE(entry.method, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(entry.externalAttributes || 0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);
    offset += localHeader.length + name.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBuffer, end]);
}

function archiveMetadataMember(format, name) {
  const patterns = {
    docx: [/^docProps\//, /^customXml\//],
    xlsx: [/^docProps\//, /^customXml\//],
    pptx: [/^docProps\//, /^customXml\//],
    odt: [/^meta\.xml$/],
    epub: [/\.opf$/i],
  };
  return (patterns[format] || []).some((pattern) => pattern.test(name));
}

function epubBodyMembers(entries) {
  const container = entries.find((entry) => entry.name === 'META-INF/container.xml');
  const rootfile = container?.data.toString('utf8').match(/\bfull-path=(?:"([^"]+)"|'([^']+)')/i);
  if (!rootfile) return new Set();
  const opfName = rootfile[1] || rootfile[2];
  const opf = entries.find((entry) => entry.name === opfName);
  if (!opf) return new Set();
  const base = path.posix.dirname(opfName);
  const bodies = new Set();
  for (const match of opf.data.toString('utf8').matchAll(/<item\b([^>]*)>/gi)) {
    const attributes = match[1];
    const href = attributes.match(/\bhref=(?:"([^"]+)"|'([^']+)')/i);
    const media = attributes.match(/\bmedia-type=(?:"([^"]+)"|'([^']+)')/i);
    const properties = attributes.match(/\bproperties=(?:"([^"]+)"|'([^']+)')/i);
    if (!href || !media || !/^(?:application\/xhtml\+xml|text\/html)$/i.test(media[1] || media[2])) continue;
    if (/(?:^|\s)nav(?:\s|$)/i.test(properties?.[1] || properties?.[2] || '')) continue;
    const normalized = path.posix.normalize(path.posix.join(base, decodeURIComponent(href[1] || href[2]).split('#')[0]));
    if (normalized.startsWith('../') || path.posix.isAbsolute(normalized)) throw new ProvenanceCleanError('EPUB manifest resource escapes the package boundary.', 'archive_traversal');
    bodies.add(normalized);
  }
  return bodies;
}

function archiveBodyMember(format, name, epubBodies) {
  if (format === 'docx') return /^word\/(?:document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(name);
  if (format === 'odt') return name === 'content.xml';
  if (format === 'epub') return epubBodies.has(name);
  return false;
}

function decodeArchiveXml(data) {
  const utf16Bom = data.length >= 2 && (data[0] === 0xff && data[1] === 0xfe || data[0] === 0xfe && data[1] === 0xff);
  const utf16Pattern = data.length >= 4 && (data.subarray(0, 4).equals(Buffer.from([0x3c, 0x00, 0x3f, 0x00]))
    || data.subarray(0, 4).equals(Buffer.from([0x00, 0x3c, 0x00, 0x3f])));
  if (utf16Bom || utf16Pattern) return { supported: false, encoding: 'UTF-16' };
  const bom = data.length >= 3 && data.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
  const content = data.subarray(bom ? 3 : 0);
  const declaration = content.subarray(0, 512).toString('latin1')
    .match(/^\s*<\?xml\b[^>]*\bencoding\s*=\s*["']([^"']+)["']/i);
  const encoding = declaration?.[1] || 'UTF-8';
  if (!/^utf-?8$/i.test(encoding)) return { supported: false, encoding };
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(content);
    return { supported: true, text, bom };
  } catch {
    return { supported: false, encoding: 'invalid UTF-8' };
  }
}

function encodeArchiveXml(text, bom) {
  return bom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text)]) : Buffer.from(text);
}

function cleanArchive(buffer, format, options = {}) {
  const archive = audit.parseZipContainer(buffer, options.limits);
  if (archive.entries.some((entry) => entry.data === null)) {
    const method = archive.entries.find((entry) => entry.data === null).method;
    throw new ProvenanceCleanError(
      `Archive uses unsupported compression method ${method}.`,
      'archive_compression_unsupported',
      audit.EXIT_CODES.DEGRADED
    );
  }
  const epubBodies = format === 'epub' ? epubBodyMembers(archive.entries) : new Set();
  let removed = 0;
  let replaced = 0;
  let changed = false;
  const codePointCounts = {};
  const residuals = [];
  const entries = archive.entries.map((entry) => {
    let data = entry.data;
    if (archiveMetadataMember(format, entry.name) || archiveBodyMember(format, entry.name, epubBodies)) {
      const decoded = decodeArchiveXml(data);
      if (!decoded.supported) {
        residuals.push(`Archive member ${entry.name} uses unsupported or invalid XML encoding (${decoded.encoding || 'unknown'}) and remains byte-for-byte unchanged.`);
        return { ...entry, data };
      }
      let text = decoded.text;
      if (archiveMetadataMember(format, entry.name)) {
        const cleaned = cleanRecognizedMetadataText(text);
        text = cleaned.text;
        removed += cleaned.removed;
      }
      if (archiveBodyMember(format, entry.name, epubBodies)) {
        const evidence = confirmedUnicodeEvidence(options.preAudit, entry.name);
        const cleaned = format === 'epub' ? cleanMarkup(text, evidence) : cleanXmlTextNodes(text, evidence);
        text = cleaned.text;
        removed += cleaned.removed;
        replaced += cleaned.replaced;
        addCodePointCounts(codePointCounts, cleaned.codePointCounts);
      }
      const encoded = encodeArchiveXml(text, decoded.bom);
      if (!encoded.equals(data)) {
        data = encoded;
        changed = true;
      }
    }
    return { ...entry, data };
  });
  if (!changed) {
    return { buffer: Buffer.from(buffer), removed: 0, replaced: 0, codePointCounts: {}, residual: residuals.join(' ') || null };
  }
  const rebuilt = buildZipContainer(entries);
  const verified = audit.parseZipContainer(rebuilt, options.limits);
  if (verified.entries.length !== entries.length || verified.entries.some((entry, index) => (
    entry.name !== entries[index].name || entry.method !== entries[index].method || !entry.data.equals(entries[index].data)
  ))) {
    throw new ProvenanceCleanError('Rebuilt archive failed package invariant verification.', 'verification_failed');
  }
  return { buffer: rebuilt, removed, replaced, codePointCounts, residual: residuals.join(' ') || null };
}

async function cleanDataUris(text, filePath, limits) {
  const expression = /data:image\/(png|jpe?g|webp|gif|bmp|tiff|avif|heic);base64,([a-z0-9+/=]+)/gi;
  let totalDecodedBytes = 0;
  const pieces = [];
  let cursor = 0;
  let removed = 0;
  let index = 0;
  for (const match of text.matchAll(expression)) {
    index++;
    if (index > limits.maxDataUriMatches) throw new ProvenanceCleanError('Embedded data URI match count exceeds the configured limit.', 'data_uri_count_limit');
    const expected = DATA_URI_FORMATS[match[1].toLowerCase()];
    const estimated = Math.floor(match[2].length * 3 / 4);
    if (estimated > limits.maxDataUriBytes) throw new ProvenanceCleanError('Embedded data URI exceeds the configured byte limit.', 'data_uri_limit');
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > limits.maxDataUriBytes) throw new ProvenanceCleanError('Embedded data URI exceeds the configured byte limit.', 'data_uri_limit');
    totalDecodedBytes += buffer.length;
    if (totalDecodedBytes > limits.maxDataUriTotalBytes) throw new ProvenanceCleanError('Aggregate embedded data URI bytes exceed the configured total limit.', 'data_uri_total_limit');
    const classification = audit.classifyBuffer(buffer, `${filePath}#data-uri-${index}.${match[1]}`);
    if (classification.format !== expected) {
      throw new ProvenanceCleanError(`Embedded data URI declares ${expected} but its signature is ${classification.format}.`, 'data_uri_signature_mismatch');
    }
    const cleaned = await cleanBuffer(buffer, `${filePath}#data-uri-${index}`, classification, { limits });
    removed += cleaned.counts.removed;
    const replacement = `${match[0].slice(0, match[0].indexOf(',') + 1)}${cleaned.buffer.toString('base64')}`;
    pieces.push(text.slice(cursor, match.index), replacement);
    cursor = match.index + match[0].length;
  }
  pieces.push(text.slice(cursor));
  return { text: pieces.join(''), removed };
}

async function cleanBuffer(buffer, filePath, classification = audit.classifyBuffer(buffer, filePath), options = {}) {
  const limits = { ...audit.LIMITS, ...(options.limits || {}) };
  if (!Buffer.isBuffer(buffer)) throw new TypeError('cleanBuffer expects a Buffer.');
  const preAudit = options.preAudit || audit.auditBuffer(buffer, filePath, { limits });
  let result = { buffer: Buffer.from(buffer), removed: 0, replaced: 0 };
  if (TEXT_FORMATS.has(classification.format)) {
    let text = buffer.toString('utf8');
    let removed = 0;
    let replaced = 0;
    const codePointCounts = {};
    const evidence = confirmedUnicodeEvidence(preAudit);
    if (classification.format === 'markdown') {
      const cleaned = cleanMarkdown(text, evidence);
      text = cleaned.buffer.toString('utf8');
      removed += cleaned.counts.removed;
      replaced += cleaned.counts.replaced;
      addCodePointCounts(codePointCounts, cleaned.counts.byCodePoint);
    } else if (classification.format === 'html' || classification.format === 'svg') {
      const cleaned = cleanMarkup(text, evidence);
      text = cleaned.text;
      removed += cleaned.removed;
      replaced += cleaned.replaced;
      addCodePointCounts(codePointCounts, cleaned.codePointCounts);
    } else {
      const cleaned = cleanLayerA(text, evidence);
      text = cleaned.text;
      removed += cleaned.removed;
      replaced += cleaned.replaced;
      addCodePointCounts(codePointCounts, cleaned.codePointCounts);
    }
    const embedded = await cleanDataUris(text, filePath, limits);
    text = embedded.text;
    removed += embedded.removed;
    result = { buffer: Buffer.from(text), removed, replaced, codePointCounts };
  } else if (ARCHIVE_FORMATS.has(classification.format)) result = cleanArchive(buffer, classification.format, { limits, preAudit });
  else if (classification.format === 'png') result = cleanPng(buffer);
  else if (classification.format === 'jpeg') result = cleanJpeg(buffer);
  else if (classification.format === 'webp') result = cleanWebp(buffer);
  else if (classification.format === 'avif' || classification.format === 'heic') result = cleanIsoBmff(buffer, limits);
  else if (classification.format === 'gif') result = cleanGif(buffer);
  else if (classification.format === 'bmp') result = cleanBmp(buffer);
  else if (classification.format === 'tiff') result = cleanTiff(buffer, false, limits);
  else if (classification.format === 'bigtiff') result = cleanTiff(buffer, true, limits);
  else throw new ProvenanceCleanError(`Local cleaning is unsupported for ${classification.format}.`, 'unsupported_format', audit.EXIT_CODES.DEGRADED);
  const outputClassification = audit.classifyBuffer(result.buffer, filePath);
  if (outputClassification.format !== classification.format) {
    throw new ProvenanceCleanError(`Cleaning changed the format from ${classification.format} to ${outputClassification.format}.`, 'verification_format_changed');
  }
  return {
    buffer: result.buffer,
    changed: !buffer.equals(result.buffer),
    counts: { removed: result.removed || 0, replaced: result.replaced || 0, byCodePoint: result.codePointCounts || {} },
    actions: result.removed || result.replaced ? [cleanAction(classification.format, result)] : [],
    residualRisks: result.residual ? [result.residual] : [],
  };
}

function cleanAction(format, result) {
  if (TEXT_FORMATS.has(format)) {
    return {
      type: 'remove confirmed Layer A carriers',
      channel: 'unicode',
      evidence: `${result.removed || 0} removable carrier or metadata value(s), ${result.replaced || 0} safe space replacement(s)`,
      protected: 'Visible prose, valid script joiners, emoji sequences, script payloads, and style payloads.',
      verificationLane: 'normalized local re-audit',
      residualRisk: 'Statistical text marks are outside deterministic cleaning.',
      codePointCounts: result.codePointCounts || {},
      status: 'planned',
    };
  }
  if (ARCHIVE_FORMATS.has(format)) {
    return {
      type: 'remove recognized package metadata or Layer A body carriers',
      channel: 'container',
      evidence: `${result.removed || 0} removable value(s), ${result.replaced || 0} safe space replacement(s)`,
      protected: 'Relationships, styles, media, navigation, accessibility data, entry order, and compression method.',
      verificationLane: 'normalized local re-audit',
      residualRisk: 'Unknown package extensions can retain unrecognized metadata.',
      codePointCounts: result.codePointCounts || {},
      status: 'planned',
    };
  }
  return {
    type: 'remove recognized raster metadata',
    channel: 'metadata',
    evidence: `${result.removed || 0} removable metadata structure(s)`,
    protected: 'Pixel bytes, image frames, animation loop data, and ICC color data.',
    verificationLane: 'normalized local re-audit',
    residualRisk: 'Soft binding and pixel-domain signals can remain.',
    status: 'planned',
  };
}

function cleanedCopyPath(filePath) {
  const extension = path.extname(filePath);
  if (!extension) return `${filePath}.cleaned`;
  return `${filePath.slice(0, -extension.length)}.cleaned${extension}`;
}

function backupPath(filePath, now = () => new Date()) {
  return `${filePath}.${now().toISOString().replace(/[-:.]/g, '')}.bak`;
}

function ensureSafePath(targetPath, boundary) {
  const resolved = path.resolve(targetPath);
  const root = path.resolve(boundary);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new ProvenanceCleanError(`Output escapes the selected boundary: ${resolved}.`, 'unsafe_output');
  }
  if (fs.existsSync(root)) {
    const rootStat = fs.lstatSync(root);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      throw new ProvenanceCleanError(`Output boundary must be a real directory: ${root}.`, 'unsafe_output');
    }
  }
  let cursor = root;
  const relative = path.relative(root, resolved);
  for (const part of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) {
      throw new ProvenanceCleanError(`Refusing output through a symlink: ${cursor}.`, 'unsafe_output');
    }
  }
  return resolved;
}

function canonicalizePlannedPath(targetPath) {
  const resolved = path.resolve(targetPath);
  let cursor = resolved;
  const suffix = [];
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    suffix.unshift(path.basename(cursor));
    cursor = parent;
  }
  const stat = fs.lstatSync(cursor);
  if (stat.isSymbolicLink()) throw new ProvenanceCleanError(`Planned path uses a symlink component: ${cursor}.`, 'unsafe_output');
  if (!stat.isDirectory() && cursor !== resolved) throw new ProvenanceCleanError(`Planned path parent is not a directory: ${cursor}.`, 'unsafe_output');
  return path.join(fs.realpathSync(cursor), ...suffix);
}

function captureBoundary(boundaryPath, create = false) {
  const resolved = path.resolve(boundaryPath);
  canonicalizePlannedPath(resolved);
  if (create && !fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
  if (!fs.existsSync(resolved)) return { path: resolved, canonical: canonicalizePlannedPath(resolved), pending: true };
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new ProvenanceCleanError(`Output boundary must be a real directory: ${resolved}.`, 'unsafe_output');
  }
  return { path: resolved, canonical: fs.realpathSync(resolved), dev: stat.dev, ino: stat.ino, pending: false };
}

function revalidateBoundary(boundary) {
  if (!fs.existsSync(boundary.path)) throw new ProvenanceCleanError(`Output boundary disappeared: ${boundary.path}.`, 'unsafe_output');
  const stat = fs.lstatSync(boundary.path);
  if (stat.isSymbolicLink() || !stat.isDirectory() || stat.dev !== boundary.dev || stat.ino !== boundary.ino
    || fs.realpathSync(boundary.path) !== boundary.canonical) {
    throw new ProvenanceCleanError(`Output boundary identity changed: ${boundary.path}.`, 'unsafe_output');
  }
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function readStableSource(sourcePath, inPlace) {
  const noFollow = fs.constants.O_NOFOLLOW || 0;
  let descriptor;
  try {
    descriptor = fs.openSync(sourcePath, fs.constants.O_RDONLY | noFollow);
    const before = fs.fstatSync(descriptor);
    if (!before.isFile()) throw new ProvenanceCleanError(`Source is not a regular file: ${sourcePath}.`, 'unsafe_input');
    if (inPlace && before.nlink > 1) throw new ProvenanceCleanError(`In-place cleaning refuses a hardlinked source: ${sourcePath}.`, 'unsafe_input');
    const buffer = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor);
    if (!sameIdentity(before, after) || before.size !== after.size || buffer.length !== after.size) {
      throw new ProvenanceCleanError(`Source changed during its stable read: ${sourcePath}.`, 'source_changed');
    }
    return {
      buffer,
      identity: { dev: after.dev, ino: after.ino, size: after.size, hash: sha256(buffer), mode: after.mode, nlink: after.nlink },
    };
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function assertSourceIdentity(sourcePath, identity) {
  const stat = fs.lstatSync(sourcePath);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.dev !== identity.dev || stat.ino !== identity.ino
    || stat.size !== identity.size) {
    throw new ProvenanceCleanError(`Source identity changed during cleaning: ${sourcePath}.`, 'source_changed');
  }
  const current = readStableSource(sourcePath, false);
  if (!sameIdentity(current.identity, identity) || current.identity.hash !== identity.hash) {
    throw new ProvenanceCleanError(`Source bytes or identity changed during cleaning: ${sourcePath}.`, 'source_changed');
  }
}

function assertRestoredSource(sourcePath, identity) {
  const restored = readStableSource(sourcePath, false);
  if (restored.identity.size !== identity.size || restored.identity.hash !== identity.hash
    || (restored.identity.mode & 0o7777) !== (identity.mode & 0o7777)) {
    throw new ProvenanceCleanError(`Restored source bytes or mode do not match the original: ${sourcePath}.`, 'rollback_failed', audit.EXIT_CODES.INTERNAL);
  }
}

function collectSources(rawTargets, limits) {
  const sources = [];
  let bytes = 0;
  let directoryCount = 0;
  function add(filePath, root = null) {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) throw new ProvenanceCleanError(`Symlink targets are not followed: ${filePath}.`, 'unsafe_input');
    if (!stat.isFile()) return;
    bytes += stat.size;
    sources.push({ path: path.resolve(filePath), root });
    if (sources.length > limits.maxFiles) throw new ProvenanceCleanError(`Target file count exceeds ${limits.maxFiles}.`, 'file_count_limit');
    if (bytes > limits.maxInputBytes) throw new ProvenanceCleanError(`Target input bytes exceed ${limits.maxInputBytes}.`, 'input_bytes_limit');
  }
  function walk(directory, root, depth = 0) {
    if (depth > limits.maxDirectoryDepth) throw new ProvenanceCleanError(`Target directory depth exceeds ${limits.maxDirectoryDepth}.`, 'directory_depth_limit');
    directoryCount++;
    if (directoryCount > limits.maxDirectories) throw new ProvenanceCleanError(`Target directory count exceeds ${limits.maxDirectories}.`, 'directory_count_limit');
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      if (['.git', 'node_modules', '.cache', '.scriveno-cache', 'cleaned'].includes(entry.name)) continue;
      const candidate = path.join(directory, entry.name);
      const stat = fs.lstatSync(candidate);
      if (stat.isSymbolicLink()) throw new ProvenanceCleanError(`Symlink targets are not followed: ${candidate}.`, 'unsafe_input');
      if (stat.isDirectory()) walk(candidate, root, depth + 1);
      else add(candidate, root);
    }
  }
  for (const raw of rawTargets) {
    const target = path.resolve(String(raw));
    if (!fs.existsSync(target)) throw new ProvenanceCleanError(`Target does not exist: ${target}.`, 'missing_target');
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) throw new ProvenanceCleanError(`Symlink targets are not followed: ${target}.`, 'unsafe_input');
    if (stat.isDirectory()) walk(target, target, 0);
    else add(target, null);
  }
  return { sources: [...new Map(sources.map((item) => [item.path, item])).values()].sort((left, right) => left.path.localeCompare(right.path)), bytes };
}

function outputForSource(source, options) {
  if (options.inPlace) return source.path;
  if (options.output && !source.root) return path.resolve(options.output);
  if (source.root) {
    const root = options.outputDirectory ? path.resolve(options.outputDirectory) : path.join(source.root, 'cleaned');
    return path.join(root, path.relative(source.root, source.path));
  }
  return cleanedCopyPath(source.path);
}

function atomicWrite(targetPath, buffer, mode, temporary = null) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  temporary = temporary || path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  fs.writeFileSync(temporary, buffer, { flag: 'wx', mode });
  return temporary;
}

function temporaryPathFor(output) {
  const extension = path.extname(output);
  const basename = path.basename(output, extension);
  return path.join(
    path.dirname(output),
    `.${basename}.${process.pid}.${crypto.randomBytes(12).toString('hex')}.tmp${extension}`
  );
}

function buildArtifactPlans(sources, stableSources, options) {
  const plans = sources.map((source) => {
    const output = outputForSource(source, options);
    const boundaryPath = source.root
      ? path.resolve(options.outputDirectory || path.join(source.root, 'cleaned'))
      : path.dirname(source.path);
    const boundary = captureBoundary(boundaryPath, false);
    ensureSafePath(output, boundaryPath);
    const backup = options.inPlace ? backupPath(source.path, options.now) : null;
    const temporary = temporaryPathFor(output);
    return {
      source,
      stable: stableSources.get(source.path),
      output: path.resolve(output),
      outputCanonical: canonicalizePlannedPath(output),
      backup: backup && path.resolve(backup),
      backupCanonical: backup ? canonicalizePlannedPath(backup) : null,
      temporary,
      temporaryCanonical: canonicalizePlannedPath(temporary),
      boundary,
    };
  });
  const artifactRecords = [];
  for (const plan of plans) {
    artifactRecords.push({ kind: 'output', path: plan.output, canonical: plan.outputCanonical, plan });
    artifactRecords.push({ kind: 'temporary', path: plan.temporary, canonical: plan.temporaryCanonical, plan });
    if (plan.backup) artifactRecords.push({ kind: 'backup', path: plan.backup, canonical: plan.backupCanonical, plan });
  }
  if (options.reportOutput) {
    const reportPath = path.resolve(options.reportOutput);
    artifactRecords.push({ kind: 'report', path: reportPath, canonical: canonicalizePlannedPath(reportPath), plan: null });
  }
  for (let index = 0; index < artifactRecords.length; index++) {
    const left = artifactRecords[index];
    if (fs.existsSync(left.path)) {
      const leftStat = fs.statSync(left.path);
      for (const stable of stableSources.values()) {
        if (sameIdentity(leftStat, stable.identity)
          && !(left.kind === 'output' && options.inPlace && left.path === stable.path)) {
          throw new ProvenanceCleanError(`Planned ${left.kind} aliases a source file: ${left.path}.`, 'unsafe_output');
        }
      }
    }
    if (left.kind !== 'report' && left.kind !== 'output' && fs.existsSync(left.path)) {
      throw new ProvenanceCleanError(`Planned ${left.kind} already exists: ${left.path}.`, 'output_exists');
    }
    if (left.kind === 'output' && !options.inPlace && fs.existsSync(left.path)) {
      throw new ProvenanceCleanError(`Cleaned output already exists and will not be overwritten: ${left.path}.`, 'output_exists');
    }
    for (let other = index + 1; other < artifactRecords.length; other++) {
      const right = artifactRecords[other];
      const intentionalInPlace = options.inPlace && left.kind === 'output' && right.kind === 'output'
        && left.plan === right.plan;
      if (!intentionalInPlace && left.canonical === right.canonical) {
        throw new ProvenanceCleanError(`Planned artifacts alias the same path: ${left.path} and ${right.path}.`, 'unsafe_output');
      }
      if (fs.existsSync(left.path) && fs.existsSync(right.path)
        && sameIdentity(fs.statSync(left.path), fs.statSync(right.path))) {
        throw new ProvenanceCleanError(`Planned artifacts share a hardlink identity: ${left.path} and ${right.path}.`, 'unsafe_output');
      }
    }
  }
  return plans;
}

function activateArtifactPlans(plans) {
  const boundaries = new Map();
  for (const plan of plans) {
    let boundary = boundaries.get(plan.boundary.path);
    if (!boundary) {
      boundary = captureBoundary(plan.boundary.path, true);
      boundaries.set(plan.boundary.path, boundary);
    }
    plan.boundary = boundary;
    const parent = path.dirname(plan.output);
    ensureSafePath(parent, boundary.path);
    fs.mkdirSync(parent, { recursive: true });
    ensureSafePath(plan.output, boundary.path);
    if (canonicalizePlannedPath(plan.output) !== plan.outputCanonical
      || canonicalizePlannedPath(plan.temporary) !== plan.temporaryCanonical) {
      throw new ProvenanceCleanError(`Artifact canonical path changed before staging: ${plan.output}.`, 'unsafe_output');
    }
  }
}

function revalidateArtifactPlan(plan, options, allowBackup = false) {
  revalidateBoundary(plan.boundary);
  ensureSafePath(plan.output, plan.boundary.path);
  if (canonicalizePlannedPath(plan.output) !== plan.outputCanonical) {
    throw new ProvenanceCleanError(`Output canonical path changed before publication: ${plan.output}.`, 'unsafe_output');
  }
  assertSourceIdentity(plan.source.path, plan.stable.identity);
  if (!options.inPlace && fs.existsSync(plan.output)) {
    throw new ProvenanceCleanError(`Cleaned output appeared before publication: ${plan.output}.`, 'output_exists');
  }
  if (!allowBackup && plan.backup && fs.existsSync(plan.backup)) {
    throw new ProvenanceCleanError(`Backup appeared before publication: ${plan.backup}.`, 'output_exists');
  }
}

function commitArtifactStages(stages, options) {
  const committed = [];
  const createdBackups = [];
  try {
    for (const stage of stages) {
      revalidateArtifactPlan(stage.plan, options);
      const tempStat = fs.lstatSync(stage.temporary);
      if (tempStat.isSymbolicLink() || !tempStat.isFile()
        || fs.realpathSync(stage.temporary) !== stage.plan.temporaryCanonical) {
        throw new ProvenanceCleanError(`Staged artifact identity changed: ${stage.temporary}.`, 'unsafe_output');
      }
    }
    if (options.inPlace) {
      for (const stage of stages) {
        ensureSafePath(stage.plan.backup, path.dirname(stage.plan.source.path));
        assertSourceIdentity(stage.plan.source.path, stage.plan.stable.identity);
        fs.copyFileSync(stage.plan.source.path, stage.plan.backup, fs.constants.COPYFILE_EXCL);
        createdBackups.push(stage.plan.backup);
      }
    }
    for (const stage of stages) {
      revalidateArtifactPlan(stage.plan, options, Boolean(options.inPlace));
      if (options.inPlace) {
        fs.renameSync(stage.temporary, stage.plan.output);
        committed.push({ stage, identity: fs.lstatSync(stage.plan.output) });
      } else {
        fs.linkSync(stage.temporary, stage.plan.output);
        const identity = fs.lstatSync(stage.plan.output);
        fs.unlinkSync(stage.temporary);
        committed.push({ stage, identity });
      }
    }
  } catch (error) {
    const rollbackErrors = [];
    const restored = new Set();
    for (const item of committed.reverse()) {
      const { stage, identity } = item;
      try {
        if (options.inPlace) {
          const restore = stage.plan.temporary;
          if (fs.existsSync(restore)) fs.rmSync(restore);
          fs.copyFileSync(stage.plan.backup, restore, fs.constants.COPYFILE_EXCL);
          fs.renameSync(restore, stage.plan.source.path);
          assertRestoredSource(stage.plan.source.path, stage.plan.stable.identity);
          restored.add(stage.plan.backup);
        } else if (fs.existsSync(stage.plan.output)) {
          const current = fs.lstatSync(stage.plan.output);
          if (sameIdentity(current, identity)) fs.unlinkSync(stage.plan.output);
        }
      } catch (rollbackError) {
        rollbackErrors.push({
          code: 'rollback_failed',
          target: stage.plan.source.path,
          backup: stage.plan.backup,
          message: `Rollback failed for ${stage.plan.source.path}: ${rollbackError.message} Recover from ${stage.plan.backup}.`,
          exitCode: audit.EXIT_CODES.INTERNAL,
        });
      }
    }
    for (const stage of stages) {
      try { if (fs.existsSync(stage.temporary)) fs.unlinkSync(stage.temporary); } catch { /* best effort cleanup */ }
    }
    if (options.inPlace && rollbackErrors.length === 0) {
      for (const stage of stages) {
        if (!createdBackups.includes(stage.plan.backup) || restored.has(stage.plan.backup)) continue;
        try {
          assertSourceIdentity(stage.plan.source.path, stage.plan.stable.identity);
          restored.add(stage.plan.backup);
        } catch (rollbackError) {
          rollbackErrors.push({
            code: 'rollback_failed',
            target: stage.plan.source.path,
            backup: stage.plan.backup,
            message: `Rollback verification failed for ${stage.plan.source.path}: ${rollbackError.message} Recover from ${stage.plan.backup}.`,
            exitCode: audit.EXIT_CODES.INTERNAL,
          });
        }
      }
    }
    if (rollbackErrors.length === 0) {
      for (const backup of createdBackups) {
        if (!restored.has(backup)) continue;
        try { if (fs.existsSync(backup)) fs.unlinkSync(backup); } catch { /* a retained backup is safe */ }
      }
    }
    const publicationError = error instanceof ProvenanceCleanError
      ? error
      : new ProvenanceCleanError(`Artifact transaction failed: ${error.message}`, 'publication_failed', audit.EXIT_CODES.INTERNAL);
    publicationError.rollbackErrors = rollbackErrors;
    publicationError.recoveryPaths = rollbackErrors.length > 0
      ? createdBackups.map((backup, index) => ({ target: stages[index].plan.source.path, backup }))
      : [];
    throw publicationError;
  }
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
  await Promise.all(Array.from({ length: Math.min(jobs, Math.max(1, values.length)) }, runWorker));
  return { results, peakWorkers };
}

function retargetAudit(sourceReport, oldPath, newPath) {
  const report = JSON.parse(JSON.stringify(sourceReport));
  const replace = (value) => typeof value === 'string' && value.startsWith(oldPath)
    ? `${newPath}${value.slice(oldPath.length)}`
    : value;
  for (const target of report.targets || []) target.path = replace(target.path);
  for (const finding of report.findings || []) finding.target = replace(finding.target);
  for (const error of report.errors || []) error.target = replace(error.target);
  return report;
}

function normalizedFinding(item) {
  return {
    ruleId: item.ruleId,
    confidence: item.confidence,
    channel: item.channel,
    codePoint: item.codePoint || null,
    count: item.count || 1,
    member: item.location?.member || null,
  };
}

function compareFindings(beforeReport, afterReport) {
  const identity = (item) => JSON.stringify({
    ruleId: item.ruleId,
    confidence: item.confidence,
    channel: item.channel,
    codePoint: item.codePoint || null,
    member: item.location?.member || item.member || null,
  });
  const group = (findings) => {
    const grouped = new Map();
    for (const finding of findings || []) {
      const normalized = normalizedFinding(finding);
      const key = identity(normalized);
      const current = grouped.get(key) || { ...normalized, count: 0 };
      current.count += finding.count || 1;
      grouped.set(key, current);
    }
    return grouped;
  };
  const before = group(beforeReport.findings);
  const after = group(afterReport.findings);
  const removed = [];
  const remaining = [];
  const added = [];
  const keys = new Set([...before.keys(), ...after.keys()]);
  for (const key of keys) {
    const beforeItem = before.get(key);
    const afterItem = after.get(key);
    const beforeCount = beforeItem?.count || 0;
    const afterCount = afterItem?.count || 0;
    const paired = Math.min(beforeCount, afterCount);
    if (paired > 0) remaining.push({ ...(beforeItem || afterItem), count: paired });
    if (beforeCount > paired) removed.push({ ...beforeItem, count: beforeCount - paired });
    if (afterCount > paired) added.push({ ...afterItem, count: afterCount - paired });
  }
  const sum = (items) => items.reduce((total, item) => total + (item.count || 1), 0);
  return {
    beforeCount: sum([...before.values()]),
    afterCount: sum([...after.values()]),
    removedCount: sum(removed),
    remainingCount: sum(remaining),
    addedCount: sum(added),
    removed,
    remaining,
    added,
  };
}

function actionHasResidual(action, findings) {
  const codePoints = new Set(Object.keys(action.codePointCounts || {}));
  if (codePoints.size > 0) {
    return findings.some((finding) => codePoints.has(finding.codePoint)
      || (!finding.codePoint && ['unicode', 'visible-content'].includes(finding.channel)));
  }
  if (action.channel === 'metadata') return findings.some((finding) => ['metadata', 'c2pa'].includes(finding.channel));
  if (action.channel === 'container') return findings.some((finding) => ['metadata', 'visible-content', 'c2pa'].includes(finding.channel));
  return findings.length > 0;
}

async function assertProviderProtectedContent(original, candidate, filePath, classification, limits, preAudit) {
  const candidateClassification = audit.classifyBuffer(candidate, filePath, limits);
  if (candidateClassification.format !== classification.format) {
    throw new ProvenanceCleanError('Provider output changed the protected file format.', 'provider_invariant', audit.EXIT_CODES.INTERNAL);
  }
  const locallyProven = await cleanBuffer(original, filePath, classification, { limits, preAudit });
  const candidateAudit = audit.auditBuffer(candidate, filePath, { limits });
  const addedFindings = compareFindings(preAudit, candidateAudit).addedCount;
  if (!candidate.equals(locallyProven.buffer) || addedFindings > 0) {
    throw new ProvenanceCleanError(
      'Provider output differs from the exact locally proven safe result or adds provenance findings.',
      'provider_invariant',
      audit.EXIT_CODES.INTERNAL
    );
  }
}

function cleanStatus(report) {
  if (report.errors.some((item) => item.exitCode === audit.EXIT_CODES.INTERNAL)) return 'error';
  if (report.errors.some((item) => item.exitCode === audit.EXIT_CODES.INVALID)) return 'unsafe';
  if (report.errors.length || report.residualRisks.length) return 'degraded';
  if (report.findings.length) return 'findings';
  if (!report.execution.apply && report.actions.some((item) => item.actionable !== false)) return 'findings';
  return 'clear';
}

function exitForStatus(status) {
  return {
    clear: audit.EXIT_CODES.CLEAR,
    findings: audit.EXIT_CODES.FINDINGS,
    degraded: audit.EXIT_CODES.DEGRADED,
    unsafe: audit.EXIT_CODES.INVALID,
    error: audit.EXIT_CODES.INTERNAL,
  }[status] ?? audit.EXIT_CODES.INTERNAL;
}

async function cleanTargets(rawTargets, options = {}) {
  const limits = { ...audit.LIMITS, ...(options.limits || {}) };
  const report = {
    schemaVersion: CLEAN_SCHEMA_VERSION,
    operation: 'clean',
    provider: 'local',
    targets: [],
    capabilities: [{
      tool: 'local-cleaner',
      status: 'available',
      effect: 'Dependency-free structural cleaning with bounded verification.',
    }],
    findings: [],
    actions: [],
    outputs: [],
    residualRisks: [],
    errors: [],
    providerAttempts: [],
    recoveryPaths: [],
    status: 'clear',
    recommendedExitCode: audit.EXIT_CODES.CLEAR,
    execution: {
      mode: options.inPlace ? 'in-place apply' : options.apply ? 'cleaned-copy apply' : 'dry-run',
      apply: Boolean(options.apply),
      inPlace: Boolean(options.inPlace),
      jobs: Math.max(1, Math.min(Number.isInteger(options.jobs) ? options.jobs : 4, limits.maxJobs)),
      inputBytes: 0,
      fileCount: 0,
    },
  };
  if (options.inPlace && !options.apply) {
    report.errors.push({ code: 'in_place_requires_apply', message: '--in-place requires --apply.', exitCode: audit.EXIT_CODES.INVALID });
  }
  if (options.inPlace && !options.confirmInPlace) {
    report.errors.push({ code: 'in_place_confirmation_required', message: 'In-place cleaning requires explicit confirmation.', exitCode: audit.EXIT_CODES.INVALID });
  }
  if (report.errors.length) {
    report.status = cleanStatus(report);
    report.recommendedExitCode = exitForStatus(report.status);
    return report;
  }

  let inventory;
  try {
    inventory = collectSources(rawTargets, limits);
    report.execution.fileCount = inventory.sources.length;
  } catch (error) {
    const cleanError = error instanceof ProvenanceCleanError ? error : new ProvenanceCleanError(error.message, 'internal', audit.EXIT_CODES.INTERNAL);
    report.errors.push({ code: cleanError.code, message: cleanError.message, exitCode: cleanError.exitCode });
    report.status = cleanStatus(report);
    report.recommendedExitCode = exitForStatus(report.status);
    return report;
  }

  const stableSources = new Map();
  let artifactPlans;
  try {
    let actualBytes = 0;
    for (const source of inventory.sources) {
      const stable = readStableSource(source.path, Boolean(options.inPlace));
      actualBytes += stable.buffer.length;
      if (actualBytes > limits.maxInputBytes) throw new ProvenanceCleanError(`Stable-read input bytes exceed ${limits.maxInputBytes}.`, 'input_bytes_limit');
      stableSources.set(source.path, { ...stable, path: source.path });
    }
    report.execution.inputBytes = actualBytes;
    artifactPlans = buildArtifactPlans(inventory.sources, stableSources, options);
    if (options.apply) activateArtifactPlans(artifactPlans);
  } catch (error) {
    const cleanError = error instanceof ProvenanceCleanError ? error : new ProvenanceCleanError(error.message, 'internal', audit.EXIT_CODES.INTERNAL);
    report.errors.push({ code: cleanError.code, message: cleanError.message, exitCode: cleanError.exitCode });
    report.status = cleanStatus(report);
    report.recommendedExitCode = exitForStatus(report.status);
    return report;
  }
  const plansBySource = new Map(artifactPlans.map((plan) => [plan.source.path, plan]));

  const selection = options.provider || 'local';
  if (!['local', 'auto', 'watermarks-remover'].includes(selection)) {
    report.errors.push({ code: 'invalid_provider', message: `Unknown provenance provider ${JSON.stringify(selection)}.`, exitCode: audit.EXIT_CODES.INVALID });
    report.status = cleanStatus(report);
    report.recommendedExitCode = exitForStatus(report.status);
    return report;
  }
  const providerEnvironment = options.providerEnv || process.env;
  const preAuditFn = options.preAuditFn || audit.auditTargets;
  const providerSecret = String(providerEnvironment[provider.ENV.bearerToken] || '');
  const publicProviderMessage = (error) => provider.redactProviderText(error?.message || 'The provider failed.', providerSecret);
  let providerClient = null;
  if (selection !== 'local' && (selection !== 'auto' || providerEnvironment[provider.ENV.serviceUrl])) {
    try {
      providerClient = await (options.providerConnect || provider.connectProvider)({
        env: providerEnvironment, jobs: report.execution.jobs,
        limits: options.providerLimits, lookup: options.providerLookup,
      });
      report.capabilities.push({
        tool: 'watermarks-remover', status: 'available',
        effect: `Provider ${providerClient.serviceVersion || 'unknown'} passed cleaning negotiation.`,
      });
    } catch (error) {
      const reason = publicProviderMessage(error);
      report.providerAttempts.push({ provider: 'watermarks-remover', operation: 'clean', target: null, status: 'failed', code: error.code || 'provider_internal', reason });
      report.capabilities.push({ tool: 'watermarks-remover', status: 'failed', effect: reason });
      if (options.requireProvider) {
        report.errors.push({ code: 'provider_required', message: reason, exitCode: audit.EXIT_CODES.INTERNAL });
        report.status = cleanStatus(report);
        report.recommendedExitCode = exitForStatus(report.status);
        return report;
      }
      report.residualRisks.push('The selected provider failed. Local cleaning completed as a visible fallback.');
    }
  } else if (options.requireProvider) {
    report.errors.push({ code: 'provider_required', message: 'The required provider is not configured.', exitCode: audit.EXIT_CODES.INTERNAL });
    report.status = cleanStatus(report);
    report.recommendedExitCode = exitForStatus(report.status);
    return report;
  }

  const requiredProviderResults = new Map();
  if (providerClient && options.requireProvider) {
    const preflight = await boundedMap(inventory.sources, report.execution.jobs, async (source) => {
      try {
        const original = stableSources.get(source.path).buffer;
        const classification = audit.classifyBuffer(original, source.path, limits);
        const preAudit = await preAuditFn([source.path], { provider: 'local', strict: false, limits });
        const providerResult = await providerClient.cleanFile({
          path: source.path,
          format: classification.format,
          expectedBytes: original.length,
          expectedSha256: sha256(original),
        });
        await assertProviderProtectedContent(original, providerResult.cleaned, source.path, classification, limits, preAudit);
        return { source, original, classification, preAudit, providerResult, attempt: {
          provider: 'watermarks-remover', operation: 'clean', target: source.path,
          status: 'succeeded', serviceVersion: providerClient.serviceVersion,
        } };
      } catch (error) {
        const reason = publicProviderMessage(error);
        return { source, error, attempt: {
          provider: 'watermarks-remover', operation: 'clean', target: source.path,
          status: 'failed', code: error.code || 'provider_internal', reason,
        } };
      }
    });
    for (const result of preflight.results) {
      report.providerAttempts.push(result.attempt);
      if (result.error) {
        report.errors.push({
          code: result.error.code || 'provider_required',
          target: result.source.path,
          message: result.attempt.reason,
          exitCode: audit.EXIT_CODES.INTERNAL,
        });
      } else {
        requiredProviderResults.set(result.source.path, result);
      }
    }
    if (report.errors.length) {
      report.status = cleanStatus(report);
      report.recommendedExitCode = exitForStatus(report.status);
      return report;
    }
  }

  const execution = await boundedMap(inventory.sources, report.execution.jobs, async (source) => {
    let temporary = null;
    try {
      const artifactPlan = plansBySource.get(source.path);
      const required = requiredProviderResults.get(source.path);
      const original = required?.original || artifactPlan.stable.buffer;
      const classification = required?.classification || audit.classifyBuffer(original, source.path, limits);
      const preAudit = required?.preAudit || await preAuditFn([source.path], { provider: 'local', strict: false, limits });
      if (['unsafe', 'invalid', 'error'].includes(preAudit.status)
        || [audit.EXIT_CODES.INVALID, audit.EXIT_CODES.INTERNAL].includes(preAudit.recommendedExitCode)) {
        throw new ProvenanceCleanError(`Pre-clean audit failed for ${source.path}.`, 'pre_audit_failed');
      }
      const extension = path.extname(source.path).toLowerCase();
      if (['.md', '.markdown', '.txt', '.html', '.htm', '.svg', '.xml'].includes(extension) && !TEXT_FORMATS.has(classification.format)) {
        throw new ProvenanceCleanError(`Binary ${classification.format} input was routed through a text path: ${source.path}.`, 'binary_misroute');
      }
      let cleaned;
      let usedProvider = false;
      if (providerClient) {
        try {
          const providerResult = required?.providerResult || await providerClient.cleanFile({
            path: source.path, format: classification.format,
            expectedBytes: original.length, expectedSha256: sha256(original),
          });
          if (!required) {
            await assertProviderProtectedContent(original, providerResult.cleaned, source.path, classification, limits, preAudit);
          }
          cleaned = {
            buffer: providerResult.cleaned,
            changed: !original.equals(providerResult.cleaned),
            counts: { removed: providerResult.changes?.removedCount || 0, replaced: providerResult.changes?.replacedCount || 0, byCodePoint: {} },
            actions: (providerResult.changes?.actions || []).map((type) => ({ type, status: 'planned', actionable: true, codePointCounts: {} })),
            residualRisks: providerResult.residual?.findings || [],
          };
          usedProvider = true;
        } catch (error) {
          const reason = publicProviderMessage(error);
          if (error instanceof ProvenanceCleanError && error.code === 'provider_invariant') {
            source.providerAttempt = {
              provider: 'watermarks-remover', operation: 'clean', target: source.path,
              status: 'failed', code: error.code, reason,
            };
            throw error;
          }
          if (options.requireProvider) throw new ProvenanceCleanError(reason, 'provider_required', audit.EXIT_CODES.INTERNAL);
          cleaned = null;
          usedProvider = false;
          source.providerAttempt = { provider: 'watermarks-remover', operation: 'clean', target: source.path, status: 'failed', code: error.code || 'provider_internal', reason };
          source.providerResidual = `Provider cleaning failed for ${source.path}. Local cleaning was used.`;
        }
      }
      if (!cleaned) cleaned = await (options.cleanFn || cleanBuffer)(original, source.path, classification, { limits, preAudit });

      const outputPath = artifactPlan.output;
      if (options.apply) revalidateArtifactPlan(artifactPlan, options);
      const actions = cleaned.actions.length
        ? cleaned.actions.map((action) => ({ ...action, actionable: action.actionable !== false, target: source.path, output: outputPath }))
        : [{ type: 'no_safe_change', status: 'informational', actionable: false, target: source.path, output: outputPath }];
      let verification;
      const backup = artifactPlan.backup;
      if (options.apply) {
        temporary = atomicWrite(outputPath, cleaned.buffer, artifactPlan.stable.identity.mode, artifactPlan.temporary);
        const auditFn = options.auditFn || audit.auditTargets;
        verification = await auditFn([temporary], { provider: 'local', strict: false, limits });
        const staged = readStableSource(temporary, false);
        if (!staged.buffer.equals(cleaned.buffer)) {
          throw new ProvenanceCleanError(`Staged bytes changed during post-clean verification for ${source.path}.`, 'verification_failed');
        }
      } else {
        verification = audit.auditBuffer(cleaned.buffer, outputPath, { limits });
      }
      const verifiedClassification = audit.classifyBuffer(cleaned.buffer, outputPath, limits);
      if (verifiedClassification.format !== classification.format
        || ['unsafe', 'invalid', 'error'].includes(verification.status)
        || [audit.EXIT_CODES.INVALID, audit.EXIT_CODES.INTERNAL].includes(verification.recommendedExitCode)) {
        throw new ProvenanceCleanError(`Post-clean verification failed for ${source.path}.`, 'verification_failed');
      }
      const normalizedPostAudit = options.apply
        ? retargetAudit(verification, temporary, outputPath)
        : verification;
      const remainingFindings = normalizedPostAudit.findings || [];
      const degradedPreAudit = ['degraded', 'unsupported'].includes(preAudit.status);
      const degradedPostAudit = ['degraded', 'unsupported'].includes(normalizedPostAudit.status);
      if (options.apply) revalidateArtifactPlan(artifactPlan, options);
      for (const action of actions) {
        if (action.status === 'planned') {
          action.status = actionHasResidual(action, remainingFindings)
            ? 'not removed'
            : degradedPreAudit || degradedPostAudit ? 'removed but verification degraded' : 'removed and verified';
        }
      }
      return {
        target: {
          path: source.path, format: classification.format, bytes: original.length,
          sha256: sha256(original), status: degradedPreAudit || degradedPostAudit ? 'degraded' : 'complete',
          lane: usedProvider ? 'provider-clean' : 'local-clean',
          preAudit,
          postAudit: normalizedPostAudit,
          findingComparison: compareFindings(preAudit, normalizedPostAudit),
        },
        actions,
        findings: remainingFindings,
        residualRisks: [
          ...cleaned.residualRisks,
          ...(degradedPreAudit ? [
            `Pre-clean audit was degraded for ${source.path}.`,
            ...(preAudit.residualRisks || []),
          ] : []),
          ...(source.providerResidual ? [source.providerResidual] : []),
          ...(degradedPostAudit
            ? [`Post-clean verification was degraded for ${source.path}.`] : []),
        ],
        output: options.apply ? { path: outputPath, source: source.path, backup, verified: true, format: classification.format } : null,
        stage: options.apply ? { plan: artifactPlan, temporary } : null,
        providerAttempt: source.providerAttempt || (!required && usedProvider
          ? { provider: 'watermarks-remover', operation: 'clean', target: source.path, status: 'succeeded', serviceVersion: providerClient.serviceVersion }
          : null),
        usedProvider,
      };
    } catch (error) {
      if (temporary && fs.existsSync(temporary)) fs.rmSync(temporary);
      const cleanError = error instanceof ProvenanceCleanError
        ? error
        : error instanceof audit.ProvenanceInputError
          ? new ProvenanceCleanError(error.message, error.code || 'unsafe_input', audit.EXIT_CODES.INVALID)
        : new ProvenanceCleanError(
          error.message,
          error.code || 'internal',
          error.exitCode === audit.EXIT_CODES.INVALID ? audit.EXIT_CODES.INVALID : audit.EXIT_CODES.INTERNAL
        );
      return {
        error: { code: cleanError.code, target: source.path, message: cleanError.message, exitCode: cleanError.exitCode },
        providerAttempt: source.providerAttempt || null,
      };
    }
  });
  report.execution.peakWorkers = execution.peakWorkers;
  const workerFailed = execution.results.some((result) => result.error);
  const stages = execution.results.filter((result) => result.stage).map((result) => result.stage);
  let publicationError = null;
  let publicationRollbackErrors = [];
  if (options.apply && workerFailed) {
    for (const stage of stages) {
      try { if (fs.existsSync(stage.temporary)) fs.unlinkSync(stage.temporary); } catch { /* best effort cleanup */ }
    }
  } else if (options.apply) {
    try {
      if (options.beforeCommit) await options.beforeCommit();
      commitArtifactStages(stages, options);
    } catch (error) {
      const cleanError = error instanceof ProvenanceCleanError
        ? error
        : new ProvenanceCleanError(error.message, 'publication_failed', audit.EXIT_CODES.INTERNAL);
      publicationError = {
        code: cleanError.code,
        message: cleanError.message,
        exitCode: cleanError.exitCode,
      };
      publicationRollbackErrors = cleanError.rollbackErrors || [];
      report.recoveryPaths.push(...(cleanError.recoveryPaths || []));
    }
  }
  if (publicationError) report.errors.push(publicationError, ...publicationRollbackErrors);
  for (const result of execution.results) {
    if (result.error) {
      report.errors.push(result.error);
      if (result.providerAttempt) report.providerAttempts.push(result.providerAttempt);
      continue;
    }
    report.targets.push(result.target);
    if (options.apply && (workerFailed || publicationError)) {
      for (const action of result.actions) action.status = 'not removed';
    }
    report.actions.push(...result.actions);
    report.findings.push(...result.findings);
    report.residualRisks.push(...result.residualRisks);
    if (result.output && !workerFailed && !publicationError) report.outputs.push(result.output);
    if (result.providerAttempt) report.providerAttempts.push(result.providerAttempt);
    if (result.usedProvider) {
      report.provider = 'watermarks-remover';
      report.serviceVersion = providerClient.serviceVersion;
      report.providerContractVersion = providerClient.contractVersion;
    }
  }
  report.targets.sort((left, right) => left.path.localeCompare(right.path));
  report.actions.sort((left, right) => left.target.localeCompare(right.target));
  report.findings.sort((left, right) => left.target.localeCompare(right.target) || left.ruleId.localeCompare(right.ruleId));
  report.outputs.sort((left, right) => left.path.localeCompare(right.path));
  report.residualRisks = [...new Set(report.residualRisks)];
  report.status = cleanStatus(report);
  report.recommendedExitCode = exitForStatus(report.status);
  return report;
}

module.exports = {
  CLEAN_SCHEMA_VERSION,
  ProvenanceCleanError,
  buildZipContainer,
  cleanBuffer,
  cleanLayerA,
  cleanTargets,
  cleanedCopyPath,
};
