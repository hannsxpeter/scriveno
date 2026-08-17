// Implements: P-MUST-02, P-MUST-03, P-MUST-04, P-MUST-08, P-MUST-09, P-MUST-10, P-MUST-11, P-MUST-12, P-MUST-13, P-MUST-14, P-MUST-15, P-MUST-18
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CASES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'provenance', 'cases.json'), 'utf8'));
const {
  EXIT_CODES,
  auditTargets,
  classifyBuffer,
  parseZipContainer,
  serializeReport,
} = require('../lib/provenance-audit.js');
const provenanceCleanModule = require('../lib/provenance-clean.js');
const {
  CLEAN_SCHEMA_VERSION,
  cleanBuffer,
  cleanTargets,
  cleanedCopyPath,
} = provenanceCleanModule;
const { parseArgs, runProvenanceClean } = require('../bin/install.js');

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

function makeZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  entries.forEach((entry) => {
    const name = Buffer.from(entry.name);
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const method = entry.method ?? 0;
    const compressed = method === 8 ? zlib.deflateRawSync(data) : data;
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(entry.flags || 0, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    local.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(entry.flags || 0, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(entry.externalAttributes || 0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);
    offset += localHeader.length + name.length + compressed.length;
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

function zipEntries(buffer) {
  return parseZipContainer(buffer).entries.map((entry) => ({
    name: entry.name,
    method: entry.method,
    data: entry.data,
  }));
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function pngFixture(software = 'AI-generated tool', pixel = 'pixel-stream') {
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', Buffer.from('00000001000000010802000000', 'hex')),
    chunk('iCCP', Buffer.from('profile\0\0color-profile')),
    chunk('tEXt', Buffer.from(`Software\0${software}`)),
    chunk('IDAT', Buffer.from(pixel)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngMixedMetadataFixture() {
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', Buffer.from('00000001000000010802000000', 'hex')),
    chunk('eXIf', Buffer.from('Orientation=6;Software=AI-generated tool;Copyright=Author')),
    chunk('tEXt', Buffer.from('Description\0Accessible alt text; AI-generated reference')),
    chunk('IDAT', Buffer.from('pixel-stream')),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function riffChunk(type, data) {
  const padding = data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(data.length);
  return Buffer.concat([Buffer.from(type), size, data, padding]);
}

function webpFixture() {
  const extended = Buffer.alloc(10);
  extended[0] = 0x26;
  const chunks = [
    riffChunk('VP8X', extended),
    riffChunk('ICCP', Buffer.from('color-profile')),
    riffChunk('XMP ', Buffer.from('generator=AI-generated tool')),
    riffChunk('ANIM', Buffer.from('loop-data')),
    riffChunk('ANMF', Buffer.from('frame-data')),
  ];
  const size = Buffer.alloc(4);
  size.writeUInt32LE(4 + chunks.reduce((sum, item) => sum + item.length, 0));
  return Buffer.concat([Buffer.from('RIFF'), size, Buffer.from('WEBP'), ...chunks]);
}

function webpMixedMetadataFixture(altText = 'Original alt text') {
  const extended = Buffer.alloc(10);
  extended[0] = 0x0e;
  const chunks = [
    riffChunk('VP8X', extended),
    riffChunk('EXIF', Buffer.from('Orientation=6;Software=AI-generated tool')),
    riffChunk('XMP ', Buffer.from(`<dc:description>${altText}</dc:description><dc:rights>Copyright Author</dc:rights><xmp:CreatorTool>AI tool</xmp:CreatorTool>`)),
    riffChunk('VP8 ', Buffer.from('pixel-stream')),
  ];
  const size = Buffer.alloc(4);
  size.writeUInt32LE(4 + chunks.reduce((sum, item) => sum + item.length, 0));
  return Buffer.concat([Buffer.from('RIFF'), size, Buffer.from('WEBP'), ...chunks]);
}

function isoBox(type, data) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length + 8, 0);
  header.write(type, 4, 4, 'ascii');
  return Buffer.concat([header, data]);
}

function isoFixture(brand) {
  return Buffer.concat([
    isoBox('ftyp', Buffer.concat([Buffer.from(brand), Buffer.alloc(4), Buffer.from(brand)])),
    isoBox('Exif', Buffer.from('AI-generated metadata')),
    isoBox('mdat', Buffer.from('pixel-item-data')),
  ]);
}

function nestedIsoFixture(brand) {
  return Buffer.concat([
    isoBox('ftyp', Buffer.concat([Buffer.from(brand), Buffer.alloc(4), Buffer.from(brand)])),
    isoBox('moov', isoBox('Exif', Buffer.from('AI-generated nested metadata'))),
    isoBox('mdat', Buffer.from('pixel-item-data')),
  ]);
}

function mixedIsoFixture(brand) {
  return Buffer.concat([
    isoBox('ftyp', Buffer.concat([Buffer.from(brand), Buffer.alloc(4), Buffer.from(brand)])),
    isoBox('Exif', Buffer.from('Orientation=6;Software=AI-generated tool')),
    isoBox('xml ', Buffer.from('<dc:description>Accessible alt text</dc:description><xmp:CreatorTool>AI tool</xmp:CreatorTool>')),
    isoBox('mdat', Buffer.from('pixel-item-data')),
  ]);
}

function offsetBearingIsoFixture(brand) {
  const location = Buffer.alloc(16);
  location.writeUInt32BE(0x00000100, 12);
  return Buffer.concat([
    isoBox('ftyp', Buffer.concat([Buffer.from(brand), Buffer.alloc(4), Buffer.from(brand)])),
    isoBox('meta', Buffer.concat([Buffer.alloc(4), isoBox('iloc', location)])),
    isoBox('c2pa', Buffer.from('content credentials manifest')),
    isoBox('mdat', Buffer.from('pixel-item-data')),
  ]);
}

function jpegSegment(marker, data) {
  const size = Buffer.alloc(2);
  size.writeUInt16BE(data.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), size, data]);
}

function jpegFixture(orientation = 6) {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    jpegSegment(0xe1, Buffer.from(`Exif\0\0Orientation=${orientation};Software=Photoshop 2026`)),
    jpegSegment(0xe2, Buffer.from('ICC_PROFILE\0color-profile')),
    Buffer.from([0xff, 0xda, 0x00, 0x02]),
    Buffer.from('visible-scan-data'),
    Buffer.from([0xff, 0xd9]),
  ]);
}

function jpegSafeGeneratorFixture() {
  const segment = (marker, data) => {
    const size = Buffer.alloc(2);
    size.writeUInt16BE(data.length + 2);
    return Buffer.concat([Buffer.from([0xff, marker]), size, data]);
  };
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xfe, Buffer.from('Software=Photoshop 2026')),
    segment(0xe2, Buffer.from('ICC_PROFILE\0color-profile')),
    Buffer.from([0xff, 0xda, 0x00, 0x02]),
    Buffer.from('visible-scan-data'),
    Buffer.from([0xff, 0xd9]),
  ]);
}

function jpegXmpFixture({ generator = true, description = 'Original alt text' } = {}) {
  const creator = generator ? '<xmp:CreatorTool>Photoshop 2026</xmp:CreatorTool>' : '';
  const xmp = [
    'http://ns.adobe.com/xap/1.0/\0',
    '<x:xmpmeta>',
    creator,
    `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${description}</rdf:li></rdf:Alt></dc:description>`,
    '<dc:rights>Copyright 2026 Example Author</dc:rights>',
    '<pdfuaid:part>1</pdfuaid:part>',
    '</x:xmpmeta>',
  ].join('');
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    jpegSegment(0xe1, Buffer.from(xmp)),
    jpegSegment(0xe2, Buffer.from('ICC_PROFILE\0color-profile')),
    Buffer.from([0xff, 0xda, 0x00, 0x02]),
    Buffer.from('visible-scan-data'),
    Buffer.from([0xff, 0xd9]),
  ]);
}

function jpegMixedAppFixture() {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    jpegSegment(0xed, Buffer.from('Photoshop 3.0\0Copyright=Author;Software=AI tool;Accessibility=Alt text')),
    jpegSegment(0xfe, Buffer.from('Copyright=Author;Software=AI tool;Alt=Accessible description')),
    jpegSegment(0xe2, Buffer.from('ICC_PROFILE\0color-profile')),
    Buffer.from([0xff, 0xda, 0x00, 0x02]),
    Buffer.from('visible-scan-data'),
    Buffer.from([0xff, 0xd9]),
  ]);
}

function gifFixture() {
  return Buffer.concat([
    Buffer.from('47494638396101000100800000000000ffffff', 'hex'),
    Buffer.from('21ff0b4e45545343415045322e300301000000', 'hex'),
    Buffer.from([0x21, 0xfe, 0x11]), Buffer.from('AI-generated tool'), Buffer.from([0]),
    Buffer.from('2c00000000010001000002024401003b', 'hex'),
  ]);
}

function bmpFixture() {
  const buffer = Buffer.alloc(70);
  buffer.write('BM');
  buffer.writeUInt32LE(buffer.length, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(1, 18);
  buffer.writeInt32LE(1, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(4, 34);
  Buffer.from([1, 2, 3, 0]).copy(buffer, 54);
  Buffer.from('AI-generated').copy(buffer, 58);
  return buffer;
}

function bmpV5Fixture() {
  const dibSize = 124;
  const pixelOffset = 14 + dibSize;
  const pixels = Buffer.from([1, 2, 3, 0]);
  const profile = Buffer.from('ICC_PROFILE_EXACT_BYTES');
  const profileOffsetFromDib = dibSize + pixels.length;
  const trailer = Buffer.from('AI-generated unparsed trailer');
  const buffer = Buffer.alloc(pixelOffset + pixels.length + profile.length + trailer.length);
  buffer.write('BM');
  buffer.writeUInt32LE(buffer.length, 2);
  buffer.writeUInt32LE(pixelOffset, 10);
  buffer.writeUInt32LE(dibSize, 14);
  buffer.writeInt32LE(1, 18);
  buffer.writeInt32LE(1, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(pixels.length, 34);
  buffer.write('MBED', 14 + 56, 4, 'ascii');
  buffer.writeUInt32LE(profileOffsetFromDib, 14 + 112);
  buffer.writeUInt32LE(profile.length, 14 + 116);
  pixels.copy(buffer, pixelOffset);
  profile.copy(buffer, 14 + profileOffsetFromDib);
  trailer.copy(buffer, 14 + profileOffsetFromDib + profile.length);
  return { buffer, pixels, profile };
}

function tiffFixture() {
  const software = Buffer.from('AI tool\0');
  const pixel = Buffer.from([9, 8, 7, 6]);
  const buffer = Buffer.alloc(8 + 2 + 3 * 12 + 4 + software.length + pixel.length);
  buffer.write('II', 0, 2, 'ascii');
  buffer.writeUInt16LE(42, 2);
  buffer.writeUInt32LE(8, 4);
  buffer.writeUInt16LE(3, 8);
  let entry = 10;
  buffer.writeUInt16LE(273, entry); buffer.writeUInt16LE(4, entry + 2); buffer.writeUInt32LE(1, entry + 4); buffer.writeUInt32LE(buffer.length - pixel.length, entry + 8); entry += 12;
  buffer.writeUInt16LE(279, entry); buffer.writeUInt16LE(4, entry + 2); buffer.writeUInt32LE(1, entry + 4); buffer.writeUInt32LE(pixel.length, entry + 8); entry += 12;
  buffer.writeUInt16LE(305, entry); buffer.writeUInt16LE(2, entry + 2); buffer.writeUInt32LE(software.length, entry + 4); buffer.writeUInt32LE(50, entry + 8);
  software.copy(buffer, 50);
  pixel.copy(buffer, buffer.length - pixel.length);
  return buffer;
}

function bigTiffFixture() {
  const software = Buffer.from('AI tool!\0');
  const pixel = Buffer.from([6, 7, 8, 9]);
  const softwareOffset = 92;
  const pixelOffset = softwareOffset + software.length;
  const buffer = Buffer.alloc(pixelOffset + pixel.length);
  buffer.write('II', 0, 2, 'ascii');
  buffer.writeUInt16LE(43, 2);
  buffer.writeUInt16LE(8, 4);
  buffer.writeUInt16LE(0, 6);
  buffer.writeBigUInt64LE(16n, 8);
  buffer.writeBigUInt64LE(3n, 16);
  let entry = 24;
  buffer.writeUInt16LE(273, entry); buffer.writeUInt16LE(16, entry + 2); buffer.writeBigUInt64LE(1n, entry + 4); buffer.writeBigUInt64LE(BigInt(pixelOffset), entry + 12); entry += 20;
  buffer.writeUInt16LE(279, entry); buffer.writeUInt16LE(16, entry + 2); buffer.writeBigUInt64LE(1n, entry + 4); buffer.writeBigUInt64LE(BigInt(pixel.length), entry + 12); entry += 20;
  buffer.writeUInt16LE(305, entry); buffer.writeUInt16LE(2, entry + 2); buffer.writeBigUInt64LE(BigInt(software.length), entry + 4); buffer.writeBigUInt64LE(BigInt(softwareOffset), entry + 12);
  software.copy(buffer, softwareOffset);
  pixel.copy(buffer, pixelOffset);
  return buffer;
}

function sharedRangeTiffFixture(big = false) {
  if (!big) {
    const shared = Buffer.from('AI tool\0');
    const sharedOffset = 50;
    const buffer = Buffer.alloc(sharedOffset + shared.length);
    buffer.write('II', 0, 2, 'ascii');
    buffer.writeUInt16LE(42, 2);
    buffer.writeUInt32LE(8, 4);
    buffer.writeUInt16LE(3, 8);
    let entry = 10;
    buffer.writeUInt16LE(273, entry); buffer.writeUInt16LE(4, entry + 2); buffer.writeUInt32LE(1, entry + 4); buffer.writeUInt32LE(sharedOffset, entry + 8); entry += 12;
    buffer.writeUInt16LE(279, entry); buffer.writeUInt16LE(4, entry + 2); buffer.writeUInt32LE(1, entry + 4); buffer.writeUInt32LE(shared.length, entry + 8); entry += 12;
    buffer.writeUInt16LE(305, entry); buffer.writeUInt16LE(2, entry + 2); buffer.writeUInt32LE(shared.length, entry + 4); buffer.writeUInt32LE(sharedOffset, entry + 8);
    shared.copy(buffer, sharedOffset);
    return buffer;
  }
  const shared = Buffer.from('AI tool!\0');
  const sharedOffset = 92;
  const buffer = Buffer.alloc(sharedOffset + shared.length);
  buffer.write('II', 0, 2, 'ascii');
  buffer.writeUInt16LE(43, 2);
  buffer.writeUInt16LE(8, 4);
  buffer.writeUInt16LE(0, 6);
  buffer.writeBigUInt64LE(16n, 8);
  buffer.writeBigUInt64LE(3n, 16);
  let entry = 24;
  buffer.writeUInt16LE(273, entry); buffer.writeUInt16LE(16, entry + 2); buffer.writeBigUInt64LE(1n, entry + 4); buffer.writeBigUInt64LE(BigInt(sharedOffset), entry + 12); entry += 20;
  buffer.writeUInt16LE(279, entry); buffer.writeUInt16LE(16, entry + 2); buffer.writeBigUInt64LE(1n, entry + 4); buffer.writeBigUInt64LE(BigInt(shared.length), entry + 12); entry += 20;
  buffer.writeUInt16LE(305, entry); buffer.writeUInt16LE(2, entry + 2); buffer.writeBigUInt64LE(BigInt(shared.length), entry + 4); buffer.writeBigUInt64LE(BigInt(sharedOffset), entry + 12);
  shared.copy(buffer, sharedOffset);
  return buffer;
}

function laterIfdSharedRangeTiffFixture(big = false) {
  const shared = Buffer.from(big ? 'AI tool!\0' : 'AI tool\0');
  if (!big) {
    const secondIfd = 26;
    const sharedOffset = 56;
    const buffer = Buffer.alloc(sharedOffset + shared.length);
    buffer.write('II', 0, 2, 'ascii');
    buffer.writeUInt16LE(42, 2);
    buffer.writeUInt32LE(8, 4);
    buffer.writeUInt16LE(1, 8);
    buffer.writeUInt16LE(305, 10); buffer.writeUInt16LE(2, 12); buffer.writeUInt32LE(shared.length, 14); buffer.writeUInt32LE(sharedOffset, 18);
    buffer.writeUInt32LE(secondIfd, 22);
    buffer.writeUInt16LE(2, secondIfd);
    let entry = secondIfd + 2;
    buffer.writeUInt16LE(273, entry); buffer.writeUInt16LE(4, entry + 2); buffer.writeUInt32LE(1, entry + 4); buffer.writeUInt32LE(sharedOffset, entry + 8); entry += 12;
    buffer.writeUInt16LE(279, entry); buffer.writeUInt16LE(4, entry + 2); buffer.writeUInt32LE(1, entry + 4); buffer.writeUInt32LE(shared.length, entry + 8);
    shared.copy(buffer, sharedOffset);
    return buffer;
  }
  const secondIfd = 52;
  const sharedOffset = 108;
  const buffer = Buffer.alloc(sharedOffset + shared.length);
  buffer.write('II', 0, 2, 'ascii');
  buffer.writeUInt16LE(43, 2);
  buffer.writeUInt16LE(8, 4);
  buffer.writeUInt16LE(0, 6);
  buffer.writeBigUInt64LE(16n, 8);
  buffer.writeBigUInt64LE(1n, 16);
  buffer.writeUInt16LE(305, 24); buffer.writeUInt16LE(2, 26); buffer.writeBigUInt64LE(BigInt(shared.length), 28); buffer.writeBigUInt64LE(BigInt(sharedOffset), 36);
  buffer.writeBigUInt64LE(BigInt(secondIfd), 44);
  buffer.writeBigUInt64LE(2n, secondIfd);
  let entry = secondIfd + 8;
  buffer.writeUInt16LE(273, entry); buffer.writeUInt16LE(16, entry + 2); buffer.writeBigUInt64LE(1n, entry + 4); buffer.writeBigUInt64LE(BigInt(sharedOffset), entry + 12); entry += 20;
  buffer.writeUInt16LE(279, entry); buffer.writeUInt16LE(16, entry + 2); buffer.writeBigUInt64LE(1n, entry + 4); buffer.writeBigUInt64LE(BigInt(shared.length), entry + 12);
  shared.copy(buffer, sharedOffset);
  return buffer;
}

function pointerIntoIfdTiffFixture() {
  const buffer = Buffer.alloc(26);
  buffer.write('II', 0, 2, 'ascii');
  buffer.writeUInt16LE(42, 2);
  buffer.writeUInt32LE(8, 4);
  buffer.writeUInt16LE(1, 8);
  buffer.writeUInt16LE(305, 10);
  buffer.writeUInt16LE(2, 12);
  buffer.writeUInt32LE(8, 14);
  buffer.writeUInt32LE(8, 18);
  return buffer;
}

function tiffWithUnrelatedDoubleFixture(big = false) {
  if (!big) {
    const software = Buffer.from('AI tool\0');
    const valueOffset = 38;
    const softwareOffset = valueOffset + 8;
    const buffer = Buffer.alloc(softwareOffset + software.length);
    buffer.write('II', 0, 2, 'ascii');
    buffer.writeUInt16LE(42, 2);
    buffer.writeUInt32LE(8, 4);
    buffer.writeUInt16LE(2, 8);
    buffer.writeUInt16LE(65000, 10); buffer.writeUInt16LE(12, 12); buffer.writeUInt32LE(1, 14); buffer.writeUInt32LE(valueOffset, 18);
    buffer.writeUInt16LE(305, 22); buffer.writeUInt16LE(2, 24); buffer.writeUInt32LE(software.length, 26); buffer.writeUInt32LE(softwareOffset, 30);
    buffer.writeDoubleLE(1.25, valueOffset);
    software.copy(buffer, softwareOffset);
    return buffer;
  }
  const software = Buffer.from('AI tool!\0');
  const softwareOffset = 72;
  const buffer = Buffer.alloc(softwareOffset + software.length);
  buffer.write('II', 0, 2, 'ascii');
  buffer.writeUInt16LE(43, 2);
  buffer.writeUInt16LE(8, 4);
  buffer.writeUInt16LE(0, 6);
  buffer.writeBigUInt64LE(16n, 8);
  buffer.writeBigUInt64LE(2n, 16);
  buffer.writeUInt16LE(65000, 24); buffer.writeUInt16LE(12, 26); buffer.writeBigUInt64LE(1n, 28); buffer.writeDoubleLE(1.25, 36);
  buffer.writeUInt16LE(305, 44); buffer.writeUInt16LE(2, 46); buffer.writeBigUInt64LE(BigInt(software.length), 48); buffer.writeBigUInt64LE(BigInt(softwareOffset), 56);
  software.copy(buffer, softwareOffset);
  return buffer;
}

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

describe('P-MUST-08, P-MUST-09, and P-MUST-13: reversible output gates', () => {
  it('keeps dry-run read-only, writes adjacent copies on apply, and refuses collisions', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-copy-'));
    try {
      const source = path.join(root, 'draft.md');
      fs.writeFileSync(source, 'A\u200bB');
      const before = hash(fs.readFileSync(source));
      const dryRun = await cleanTargets([source]);
      assert.equal(dryRun.schemaVersion, CLEAN_SCHEMA_VERSION);
      assert.equal(dryRun.operation, 'clean');
      assert.equal(dryRun.execution.mode, 'dry-run');
      assert.equal(dryRun.outputs.length, 0);
      assert.ok(dryRun.capabilities.some((item) => item.tool === 'local-cleaner' && item.status === 'available'));
      assert.equal(dryRun.actions[0].channel, 'unicode');
      assert.match(dryRun.actions[0].protected, /visible prose|script joiners/i);
      assert.equal(dryRun.actions[0].verificationLane, 'normalized local re-audit');
      const dryRunMarkdown = serializeReport(dryRun, 'markdown');
      assert.match(dryRunMarkdown, /^# Provenance Clean/m);
      assert.match(dryRunMarkdown, /## Actions/);
      assert.match(dryRunMarkdown, /draft\.cleaned\.md/);
      assert.equal(fs.existsSync(cleanedCopyPath(source)), false);
      assert.equal(hash(fs.readFileSync(source)), before);

      const applied = await cleanTargets([source], { apply: true });
      const output = cleanedCopyPath(source);
      assert.equal(applied.recommendedExitCode, EXIT_CODES.CLEAR);
      assert.equal(fs.readFileSync(output, 'utf8'), 'AB');
      assert.equal(hash(fs.readFileSync(source)), before);

      const outputBefore = hash(fs.readFileSync(output));
      const collision = await cleanTargets([source], { apply: true });
      assert.equal(collision.recommendedExitCode, EXIT_CODES.INVALID);
      assert.match(collision.errors[0].message, /exists|overwrite/i);
      assert.equal(hash(fs.readFileSync(output)), outputBefore);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('requires explicit in-place confirmation, writes a backup, and preserves the backup', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-in-place-'));
    try {
      const source = path.join(root, 'draft.txt');
      fs.writeFileSync(source, 'A\u2060B');
      fs.chmodSync(source, 0o600);
      const refused = await cleanTargets([source], { apply: true, inPlace: true });
      assert.equal(refused.recommendedExitCode, EXIT_CODES.INVALID);
      assert.equal(fs.readFileSync(source, 'utf8'), 'A\u2060B');

      const applied = await cleanTargets([source], {
        apply: true,
        inPlace: true,
        confirmInPlace: true,
        now: () => new Date('2026-08-17T12:34:56.000Z'),
      });
      assert.equal(fs.readFileSync(source, 'utf8'), 'AB');
      assert.equal(fs.statSync(source).mode & 0o777, 0o600);
      assert.equal(applied.outputs.length, 1);
      assert.match(applied.outputs[0].backup, /20260817T123456000Z\.bak$/);
      assert.equal(fs.readFileSync(applied.outputs[0].backup, 'utf8'), 'A\u2060B');
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('publishes nothing when verification fails', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-verify-'));
    try {
      const source = path.join(root, 'draft.txt');
      fs.writeFileSync(source, 'A\u200bB');
      const before = hash(fs.readFileSync(source));
      const result = await cleanTargets([source], {
        apply: true,
        auditFn: async () => ({ status: 'unsafe', recommendedExitCode: EXIT_CODES.INVALID, findings: [], errors: [] }),
      });
      assert.equal(result.recommendedExitCode, EXIT_CODES.INVALID);
      assert.equal(fs.existsSync(cleanedCopyPath(source)), false);
      assert.equal(hash(fs.readFileSync(source)), before);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('refuses publication when the source changes during cleaning', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-source-race-'));
    try {
      const source = path.join(root, 'draft.txt');
      fs.writeFileSync(source, 'A\u200bB');
      const report = await cleanTargets([source], {
        apply: true,
        auditFn: async () => {
          fs.writeFileSync(source, 'writer changed this');
          return { status: 'clear', recommendedExitCode: EXIT_CODES.CLEAR, findings: [], errors: [] };
        },
      });
      assert.equal(report.recommendedExitCode, EXIT_CODES.INVALID);
      assert.equal(fs.readFileSync(source, 'utf8'), 'writer changed this');
      assert.equal(fs.existsSync(cleanedCopyPath(source)), false);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('rejects a cleaned output boundary that is itself a symlink', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-boundary-link-'));
    try {
      const sourceRoot = path.join(root, 'source');
      const outside = path.join(root, 'outside');
      const boundary = path.join(root, 'cleaned');
      fs.mkdirSync(sourceRoot);
      fs.mkdirSync(outside);
      fs.writeFileSync(path.join(sourceRoot, 'draft.txt'), 'A\u200bB');
      fs.symlinkSync(outside, boundary);
      const report = await cleanTargets([sourceRoot], { apply: true, outputDirectory: boundary });
      assert.equal(report.recommendedExitCode, EXIT_CODES.INVALID);
      assert.equal(fs.existsSync(path.join(outside, 'draft.txt')), false);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('detects same-byte inode replacement before publication', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-source-inode-'));
    try {
      const source = path.join(root, 'draft.txt');
      const displaced = path.join(root, 'displaced.txt');
      fs.writeFileSync(source, 'A\u200bB');
      const report = await cleanTargets([source], {
        apply: true,
        auditFn: async (targets, options) => {
          fs.renameSync(source, displaced);
          fs.writeFileSync(source, 'A\u200bB');
          return auditTargets(targets, options);
        },
      });
      assert.equal(report.recommendedExitCode, EXIT_CODES.INVALID);
      assert.equal(fs.existsSync(cleanedCopyPath(source)), false);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('uses no-clobber publication when an output appears during verification', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-output-race-'));
    try {
      const source = path.join(root, 'draft.txt');
      const output = cleanedCopyPath(source);
      fs.writeFileSync(source, 'A\u200bB');
      const report = await cleanTargets([source], {
        apply: true,
        auditFn: async (targets, options) => {
          fs.writeFileSync(output, 'attacker output', { flag: 'wx' });
          return auditTargets(targets, options);
        },
      });
      assert.equal(report.recommendedExitCode, EXIT_CODES.INVALID);
      assert.equal(fs.readFileSync(output, 'utf8'), 'attacker output');
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('stages the whole batch and rolls back when a later output collides', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-batch-transaction-'));
    try {
      const first = path.join(root, 'first.txt');
      const second = path.join(root, 'second.txt');
      const firstOutput = cleanedCopyPath(first);
      const secondOutput = cleanedCopyPath(second);
      fs.writeFileSync(first, 'A\u200bB');
      fs.writeFileSync(second, 'C\u200bD');
      let verifications = 0;
      const report = await cleanTargets([first, second], {
        apply: true,
        jobs: 1,
        auditFn: async (targets, options) => {
          verifications++;
          if (verifications === 2) fs.writeFileSync(secondOutput, 'later collision', { flag: 'wx' });
          return auditTargets(targets, options);
        },
      });
      assert.equal(report.recommendedExitCode, EXIT_CODES.INVALID);
      assert.equal(fs.existsSync(firstOutput), false);
      assert.equal(fs.readFileSync(secondOutput, 'utf8'), 'later collision');
      assert.ok(report.actions.every((action) => action.status === 'not removed'));
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('retains recovery backups and reports exact paths when commit and rollback both fail', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-rollback-failure-'));
    const first = path.join(root, 'first.txt');
    const second = path.join(root, 'second.txt');
    const timestamp = '20260817T123456000Z';
    const firstBackup = `${first}.${timestamp}.bak`;
    const secondBackup = `${second}.${timestamp}.bak`;
    fs.writeFileSync(first, 'A\u200bB');
    fs.writeFileSync(second, 'C\u200bD');
    const originalRename = fs.renameSync;
    let firstTargetRenames = 0;
    fs.renameSync = (source, target) => {
      if (target === first) {
        firstTargetRenames++;
        if (firstTargetRenames === 2) throw new Error('injected restore rename failure');
      }
      if (target === second) throw new Error('injected second commit failure');
      return originalRename(source, target);
    };
    try {
      const report = await cleanTargets([first, second], {
        apply: true,
        inPlace: true,
        confirmInPlace: true,
        jobs: 1,
        now: () => new Date('2026-08-17T12:34:56.000Z'),
      });
      assert.equal(report.recommendedExitCode, EXIT_CODES.INTERNAL);
      assert.ok(report.errors.some((error) => /injected second commit failure/.test(error.message)));
      assert.ok(report.errors.some((error) => error.code === 'rollback_failed' && /injected restore rename failure/.test(error.message)));
      assert.deepStrictEqual(report.recoveryPaths, [
        { target: first, backup: firstBackup },
        { target: second, backup: secondBackup },
      ]);
      assert.equal(fs.existsSync(firstBackup), true);
      assert.equal(fs.existsSync(secondBackup), true);
      assert.equal(fs.readFileSync(firstBackup, 'utf8'), 'A\u200bB');
      assert.equal(fs.readFileSync(secondBackup, 'utf8'), 'C\u200bD');
      const markdown = serializeReport(report, 'markdown');
      assert.match(markdown, /Recovery Paths/);
      assert.ok(markdown.includes(firstBackup));
      assert.ok(markdown.includes(secondBackup));
      const sarif = JSON.parse(serializeReport(report, 'sarif'));
      assert.deepStrictEqual(sarif.runs[0].invocations[0].properties.recoveryPaths, report.recoveryPaths);
    } finally {
      fs.renameSync = originalRename;
      fs.rmSync(root, { recursive: true });
    }
  });

  it('confirms successful rollback by restored bytes before deleting temporary backups', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-rollback-success-'));
    const first = path.join(root, 'first.txt');
    const second = path.join(root, 'second.txt');
    const timestamp = '20260817T123456000Z';
    fs.writeFileSync(first, 'A\u200bB');
    fs.writeFileSync(second, 'C\u200bD');
    const originalRename = fs.renameSync;
    fs.renameSync = (source, target) => {
      if (target === second) throw new Error('injected second commit failure');
      return originalRename(source, target);
    };
    try {
      const report = await cleanTargets([first, second], {
        apply: true,
        inPlace: true,
        confirmInPlace: true,
        jobs: 1,
        now: () => new Date('2026-08-17T12:34:56.000Z'),
      });
      assert.equal(report.recommendedExitCode, EXIT_CODES.INTERNAL);
      assert.ok(report.errors.some((error) => /injected second commit failure/.test(error.message)));
      assert.equal(report.errors.some((error) => error.code === 'rollback_failed'), false);
      assert.deepStrictEqual(report.recoveryPaths, []);
      assert.equal(fs.readFileSync(first, 'utf8'), 'A\u200bB');
      assert.equal(fs.readFileSync(second, 'utf8'), 'C\u200bD');
      assert.equal(fs.existsSync(`${first}.${timestamp}.bak`), false);
      assert.equal(fs.existsSync(`${second}.${timestamp}.bak`), false);
    } finally {
      fs.renameSync = originalRename;
      fs.rmSync(root, { recursive: true });
    }
  });

  it('fails closed for hardlinked in-place sources', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-inplace-hardlink-'));
    try {
      const source = path.join(root, 'draft.txt');
      const alias = path.join(root, 'alias.txt');
      fs.writeFileSync(source, 'A\u200bB');
      fs.linkSync(source, alias);
      const report = await cleanTargets([source], {
        apply: true, inPlace: true, confirmInPlace: true,
        now: () => new Date('2026-08-17T12:34:56.000Z'),
      });
      assert.equal(report.recommendedExitCode, EXIT_CODES.INVALID);
      assert.equal(fs.readFileSync(source, 'utf8'), 'A\u200bB');
      assert.equal(fs.readFileSync(alias, 'utf8'), 'A\u200bB');
      assert.equal(fs.existsSync(`${source}.20260817T123456000Z.bak`), false);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('reports actionable post-clean findings instead of claiming verified removal', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-residual-'));
    try {
      const source = path.join(root, 'draft.txt');
      fs.writeFileSync(source, 'A\u200bB');
      const report = await cleanTargets([source], {
        apply: true,
        auditFn: async (targets) => ({
          status: 'findings',
          recommendedExitCode: EXIT_CODES.FINDINGS,
          findings: [{
            ruleId: 'unicode.zero_width', confidence: 'confirmed', channel: 'unicode',
            target: targets[0], message: 'still present',
          }],
          errors: [],
        }),
      });
      assert.equal(report.recommendedExitCode, EXIT_CODES.FINDINGS);
      assert.equal(report.findings.length, 1);
      assert.equal(report.findings[0].target, cleanedCopyPath(source));
      assert.equal(report.actions[0].status, 'not removed');
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('reports normalized before and after audits with a finding comparison for every target', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-audit-pair-'));
    try {
      const source = path.join(root, 'draft.txt');
      fs.writeFileSync(source, 'A\u200bB');
      const report = await cleanTargets([source], { apply: true });
      assert.equal(report.targets.length, 1);
      assert.equal(report.targets[0].preAudit.operation, 'audit');
      assert.equal(report.targets[0].postAudit.operation, 'audit');
      assert.equal(report.targets[0].findingComparison.beforeCount, 1);
      assert.equal(report.targets[0].findingComparison.afterCount, 0);
      assert.ok(report.targets[0].findingComparison.removed.some((item) => item.ruleId === 'unicode.zero_width'));
      const markdown = serializeReport(report, 'markdown');
      assert.match(markdown, /Target Audit Comparison/);
      assert.match(markdown, /pre-audit.*1.*post-audit.*0/is);
      const sarif = JSON.parse(serializeReport(report, 'sarif'));
      assert.equal(sarif.runs[0].properties.cleanTargetAudits[0].findingComparison.beforeCount, 1);
      assert.equal(sarif.runs[0].properties.cleanTargetAudits[0].findingComparison.afterCount, 0);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('audits an applied Markdown stage under its logical final path and retains author metadata', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-markdown-post-audit-'));
    try {
      const source = path.join(root, 'draft.md');
      const output = cleanedCopyPath(source);
      fs.writeFileSync(source, '---\nauthor: Example Author\n---\n\nA\u200bB\n');
      const report = await cleanTargets([source], { apply: true });
      const target = report.targets[0];
      assert.equal(target.preAudit.targets[0].path, source);
      assert.equal(target.preAudit.targets[0].format, 'markdown');
      assert.equal(target.postAudit.targets[0].path, output);
      assert.equal(target.postAudit.targets[0].format, 'markdown');
      assert.ok(target.findingComparison.remaining.some((finding) => finding.ruleId === 'metadata.generator'));
      assert.ok(target.findingComparison.removed.some((finding) => finding.codePoint === 'U+200B'));
      assert.match(fs.readFileSync(output, 'utf8'), /author: Example Author/);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('pairs shifted finding locations by stable occurrence identity and serializes audit details', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-shifted-findings-'));
    try {
      const source = path.join(root, 'draft.txt');
      fs.writeFileSync(source, 'A\u200bB\u200bC\u200bD\u200bE');
      const report = await cleanTargets([source], {
        apply: true,
        cleanFn: async (buffer) => ({
          buffer: Buffer.from(buffer.toString('utf8').replace('\u200b', '')),
          changed: true,
          counts: { removed: 1, replaced: 0, byCodePoint: { 'U+200B': { removed: 1, replaced: 0 } } },
          actions: [{
            type: 'remove confirmed Layer A carriers', channel: 'unicode', status: 'planned',
            codePointCounts: { 'U+200B': { removed: 1, replaced: 0 } },
          }],
          residualRisks: [],
        }),
      });
      const comparison = report.targets[0].findingComparison;
      assert.equal(comparison.beforeCount, 4);
      assert.equal(comparison.afterCount, 3);
      assert.equal(comparison.removedCount, 1);
      assert.equal(comparison.remainingCount, 3);
      assert.equal(comparison.addedCount, 0);
      const markdown = serializeReport(report, 'markdown');
      assert.match(markdown, /Pre-audit schema: scriveno\.provenance\.audit\/v1; status: findings/i);
      assert.match(markdown, /Post-audit schema: scriveno\.provenance\.audit\/v1; status: findings/i);
      assert.match(markdown, /Removed finding.*unicode\.zero_width.*U\+200B.*count 1/is);
      assert.match(markdown, /Remaining finding.*unicode\.zero_width.*U\+200B.*count 3/is);
      assert.match(markdown, /Added findings?: none/i);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('context-escapes every external Markdown report field', () => {
    const hostile = 'external\n# heading | [link](https://example.invalid)\u0001';
    const report = {
      schemaVersion: CLEAN_SCHEMA_VERSION,
      operation: 'clean',
      provider: 'local',
      targets: [{
        path: hostile, format: hostile, lane: hostile, status: 'degraded', bytes: 1,
        preAudit: { schemaVersion: hostile, status: hostile },
        postAudit: { schemaVersion: hostile, status: hostile },
        findingComparison: {
          beforeCount: hostile, afterCount: hostile, removedCount: hostile, remainingCount: hostile, addedCount: hostile,
          removed: [], remaining: [{ ruleId: hostile, channel: hostile, confidence: hostile, member: hostile, count: 1 }], added: [],
        },
      }],
      capabilities: [{ tool: hostile, status: hostile, effect: hostile }],
      findings: [{
        ruleId: hostile, confidence: hostile, channel: hostile, target: hostile,
        message: hostile, evidence: hostile, suggestedAction: hostile, location: { member: hostile },
      }],
      actions: [{ target: hostile, type: hostile, status: hostile, output: hostile, codePointCounts: { [hostile]: { removed: hostile, replaced: hostile } } }],
      outputs: [{ path: hostile, backup: hostile }],
      errors: [{ code: hostile, message: hostile }],
      providerAttempts: [{ provider: hostile, operation: hostile, status: hostile, reason: hostile }],
      residualRisks: [hostile],
      status: 'degraded', recommendedExitCode: EXIT_CODES.DEGRADED,
    };
    const markdown = serializeReport(report, 'markdown');
    assert.ok(!markdown.includes('\n# heading'));
    assert.ok(!markdown.includes('[link](https://example.invalid)'));
    assert.ok(!markdown.includes('\u0001'));
    assert.match(markdown, /\\\|/);
    assert.match(markdown, /\\\[link\\\]\(https:\/\/example\.invalid\)/);
  });

  it('propagates degraded pre-audit coverage to the target and top-level exit', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-degraded-pre-'));
    try {
      const source = path.join(root, 'ordinary.txt');
      fs.writeFileSync(source, 'Ordinary prose.');
      const report = await cleanTargets([source], {
        preAuditFn: async (targets) => ({
          schemaVersion: 'scriveno.provenance.audit/v1', operation: 'audit', provider: 'local',
          targets: [{ path: targets[0], format: 'text', lane: 'text-unicode', status: 'degraded', bytes: 15 }],
          capabilities: [], findings: [], actions: [], outputs: [],
          residualRisks: ['Injected pre-audit lane is degraded.'], errors: [],
          status: 'degraded', recommendedExitCode: EXIT_CODES.DEGRADED,
          execution: { jobs: 1, peakWorkers: 1, fileCount: 1, inputBytes: 15 },
        }),
      });
      assert.equal(report.targets[0].preAudit.status, 'degraded');
      assert.equal(report.targets[0].postAudit.status, 'clear');
      assert.equal(report.targets[0].status, 'degraded');
      assert.equal(report.status, 'degraded');
      assert.equal(report.recommendedExitCode, EXIT_CODES.DEGRADED);
      assert.match(report.residualRisks.join('\n'), /pre-clean.*degraded|pre-audit.*degraded/i);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('keeps an ordinary no-change dry-run clear and makes its note non-actionable', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-no-change-'));
    try {
      const source = path.join(root, 'draft.txt');
      fs.writeFileSync(source, 'Ordinary prose.');
      const report = await cleanTargets([source]);
      assert.equal(report.status, 'clear');
      assert.equal(report.recommendedExitCode, EXIT_CODES.CLEAR);
      assert.ok(report.actions.every((item) => item.actionable === false));
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('bounds concurrent cleaning by jobs and reports the observed peak', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-jobs-'));
    try {
      const sources = Array.from({ length: 5 }, (_, index) => {
        const source = path.join(root, `${index}.txt`);
        fs.writeFileSync(source, `A\u200b${index}`);
        return source;
      });
      let active = 0;
      let peak = 0;
      const report = await cleanTargets(sources, {
        jobs: 2,
        cleanFn: async (...args) => {
          active++;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 15));
          const result = await cleanBuffer(...args);
          active--;
          return result;
        },
      });
      assert.equal(report.execution.jobs, 2);
      assert.equal(report.execution.peakWorkers, 2);
      assert.equal(peak, 2);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });
});

describe('P-MUST-03 and P-MUST-12: deterministic local media cleaning', () => {
  it('keeps the expanded local cleaning coverage fixture explicit', () => {
    assert.deepStrictEqual(CASES.cleaningFormats, [
      'webp', 'avif', 'heic', 'bmp', 'gif', 'tiff', 'bigtiff', 'xlsx', 'pptx',
      'docx', 'odt', 'epub',
    ]);
  });

  it('removes an exact PNG generator field but preserves mixed WebP metadata byte-for-byte', async () => {
    const png = pngFixture();
    const pngResult = await cleanBuffer(png, 'image.png', classifyBuffer(png, 'image.png'));
    assert.ok(pngResult.changed);
    assert.doesNotMatch(pngResult.buffer.toString('latin1'), /AI-generated tool/);
    assert.ok(pngResult.buffer.includes(Buffer.from('color-profile')));
    assert.ok(pngResult.buffer.includes(Buffer.from('pixel-stream')));

    const webp = webpMixedMetadataFixture();
    const webpResult = await cleanBuffer(webp, 'animation.webp', classifyBuffer(webp, 'animation.webp'));
    assert.deepStrictEqual(webpResult.buffer, webp);
    assert.match(webpResult.residualRisks.join('\n'), /WebP.*XMP|WebP.*EXIF|mixed.*metadata/i);
  });

  it('removes ordinary PNG and JPEG generator fields while preserving ICC and image data', async () => {
    const png = pngFixture('Photoshop 2026');
    const pngResult = await cleanBuffer(png, 'image.png', classifyBuffer(png, 'image.png'));
    assert.ok(!pngResult.buffer.includes(Buffer.from('Photoshop 2026')));
    assert.ok(pngResult.buffer.includes(Buffer.from('color-profile')));
    assert.ok(pngResult.buffer.includes(Buffer.from('pixel-stream')));

    const jpeg = jpegSafeGeneratorFixture();
    const jpegResult = await cleanBuffer(jpeg, 'image.jpg', classifyBuffer(jpeg, 'image.jpg'));
    assert.ok(!jpegResult.buffer.includes(Buffer.from('Photoshop 2026')));
    assert.ok(jpegResult.buffer.includes(Buffer.from('ICC_PROFILE\0color-profile')));
    assert.ok(jpegResult.buffer.includes(Buffer.from('visible-scan-data')));
  });

  it('preserves an entire unproven Exif segment including Orientation and reports its generator field as residual', async () => {
    const jpeg = jpegFixture(6);
    const result = await cleanBuffer(jpeg, 'orientation.jpg', classifyBuffer(jpeg, 'orientation.jpg'));
    assert.deepStrictEqual(result.buffer, jpeg);
    assert.ok(result.buffer.includes(Buffer.from('Orientation=6')));
    assert.ok(result.buffer.includes(Buffer.from('Software=Photoshop 2026')));
    assert.match(result.residualRisks.join('\n'), /Exif.*generator|field-level.*Exif|safe.*Exif/i);
  });

  it('preserves non-generator and mixed JPEG XMP fields and reports mixed generator XMP as residual', async () => {
    for (const generator of [false, true]) {
      const jpeg = jpegXmpFixture({ generator });
      const result = await cleanBuffer(jpeg, 'protected-xmp.jpg', classifyBuffer(jpeg, 'protected-xmp.jpg'));
      assert.deepStrictEqual(result.buffer, jpeg);
      assert.ok(result.buffer.includes(Buffer.from('Original alt text')));
      assert.ok(result.buffer.includes(Buffer.from('Copyright 2026 Example Author')));
      assert.ok(result.buffer.includes(Buffer.from('<pdfuaid:part>1</pdfuaid:part>')));
      if (generator) {
        assert.ok(result.buffer.includes(Buffer.from('Photoshop 2026')));
        assert.match(result.residualRisks.join('\n'), /XMP.*generator|field-level.*XMP|protected XMP/i);
      }
    }
  });

  it('preserves mixed PNG eXIf/text and JPEG APP13/COM structures byte-for-byte', async () => {
    for (const [name, input, residualPattern] of [
      ['mixed.png', pngMixedMetadataFixture(), /PNG.*eXIf|mixed.*PNG/i],
      ['mixed.jpg', jpegMixedAppFixture(), /APP13|mixed.*COM|JPEG.*metadata/i],
    ]) {
      const result = await cleanBuffer(input, name, classifyBuffer(input, name));
      assert.deepStrictEqual(result.buffer, input, name);
      assert.match(result.residualRisks.join('\n'), residualPattern, name);
    }
  });

  it('preserves partial PNG software keys and protected PNG or JPEG generator values', async () => {
    const protectedPng = Buffer.concat([
      Buffer.from('89504e470d0a1a0a', 'hex'),
      chunk('IHDR', Buffer.from('00000001000000010802000000', 'hex')),
      chunk('tEXt', Buffer.from('CopyrightSoftwareNotice\0Photoshop 2026')),
      chunk('tEXt', Buffer.from('Software\0Photoshop 2026; Copyright=Example Author')),
      chunk('IDAT', Buffer.from('pixel-stream')),
      chunk('IEND', Buffer.alloc(0)),
    ]);
    const pngResult = await cleanBuffer(protectedPng, 'protected.png', classifyBuffer(protectedPng, 'protected.png'));
    assert.deepStrictEqual(pngResult.buffer, protectedPng);
    assert.match(pngResult.residualRisks.join('\n'), /PNG.*protected|mixed.*PNG|unchanged/i);

    for (const [label, value] of [
      ['semicolon', 'Software=Photoshop 2026; Copyright=Example Author'],
      ['comma', 'Software=Photoshop 2026, Copyright 2026 Alice'],
      ['pipe', 'Software=Photoshop 2026 | Copyright 2026 Alice'],
      ['slash', 'Software=Photoshop 2026 / Copyright 2026 Alice'],
      ['space', 'Software=Photoshop 2026 Copyright 2026 Alice'],
    ]) {
      const mixedComment = Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        jpegSegment(0xfe, Buffer.from(value)),
        Buffer.from([0xff, 0xd9]),
      ]);
      const jpegResult = await cleanBuffer(mixedComment, `${label}.jpg`, classifyBuffer(mixedComment, `${label}.jpg`));
      assert.deepStrictEqual(jpegResult.buffer, mixedComment, label);
      assert.match(jpegResult.residualRisks.join('\n'), /mixed.*COM|field-level/i, label);
    }
  });

  it('preserves AVIF and HEIC Exif and XML metadata when field-level removal is unproven', async () => {
    for (const brand of ['avif', 'heic']) {
      const input = mixedIsoFixture(brand);
      const result = await cleanBuffer(input, `image.${brand}`, classifyBuffer(input, `image.${brand}`));
      assert.deepStrictEqual(result.buffer, input);
      assert.match(result.residualRisks.join('\n'), /Exif|XML|field-level|mixed/i);
      assert.equal(classifyBuffer(result.buffer, `image.${brand}`).format, brand);
    }
  });

  it('reports nested AVIF and HEIC metadata as a degraded residual without rewriting the container', async () => {
    for (const brand of ['avif', 'heic']) {
      const input = nestedIsoFixture(brand);
      const result = await cleanBuffer(input, `nested.${brand}`, classifyBuffer(input, `nested.${brand}`));
      assert.deepStrictEqual(result.buffer, input);
      assert.equal(result.changed, false);
      assert.match(result.residualRisks.join('\n'), /nested.*metadata|safe rewrite/i);
    }
  });

  it('preserves ISO BMFF metadata when iloc offsets could be invalidated', async () => {
    for (const brand of ['avif', 'heic']) {
      const input = offsetBearingIsoFixture(brand);
      const result = await cleanBuffer(input, `offsets.${brand}`, classifyBuffer(input, `offsets.${brand}`));
      assert.deepStrictEqual(result.buffer, input);
      assert.match(result.residualRisks.join('\n'), /ISO BMFF.*unchanged|offset.*rewrite|c2pa.*remain/i);
      assert.ok(result.buffer.includes(Buffer.from('content credentials manifest')));
      assert.ok(result.buffer.includes(Buffer.from('pixel-item-data')));
    }
  });

  it('preserves bytes after GIF trailer and JPEG EOI markers', async () => {
    const gif = Buffer.concat([gifFixture(), Buffer.from('protected-gif-trailer')]);
    const gifResult = await cleanBuffer(gif, 'trailer.gif', classifyBuffer(gif, 'trailer.gif'));
    assert.deepStrictEqual(gifResult.buffer, gif);

    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      jpegSegment(0xfe, Buffer.from('Software=Photoshop 2026')),
      Buffer.from([0xff, 0xd9]),
      Buffer.from('protected-jpeg-trailer'),
    ]);
    const jpegResult = await cleanBuffer(jpeg, 'trailer.jpg', classifyBuffer(jpeg, 'trailer.jpg'));
    assert.ok(!jpegResult.buffer.includes(Buffer.from('Software=Photoshop 2026')));
    assert.ok(jpegResult.buffer.subarray(-'protected-jpeg-trailer'.length).equals(Buffer.from('protected-jpeg-trailer')));
  });

  it('preserves GIF animation data and BMP, TIFF, and BigTIFF pixel bytes', async () => {
    const gif = gifFixture();
    const gifResult = await cleanBuffer(gif, 'image.gif', classifyBuffer(gif, 'image.gif'));
    assert.deepStrictEqual(gifResult.buffer, gif);
    assert.ok(gifResult.buffer.includes(Buffer.from('NETSCAPE2.0')));
    assert.ok(gifResult.buffer.includes(Buffer.from('2c00000000010001000002024401003b', 'hex')));
    assert.ok(gifResult.buffer.includes(Buffer.from('AI-generated tool')));
    assert.match(gifResult.residualRisks.join('\n'), /GIF.*comment|field-level/i);

    const bmp = bmpFixture();
    const bmpPixels = bmp.subarray(54, 58);
    const bmpResult = await cleanBuffer(bmp, 'image.bmp', classifyBuffer(bmp, 'image.bmp'));
    assert.deepStrictEqual(bmpResult.buffer.subarray(54, 58), bmpPixels);
    assert.deepStrictEqual(bmpResult.buffer, bmp);
    assert.match(bmpResult.residualRisks.join('\n'), /BMP.*metadata|safe rewrite/i);

    const bmpV5 = bmpV5Fixture();
    const bmpV5Result = await cleanBuffer(bmpV5.buffer, 'profile.bmp', classifyBuffer(bmpV5.buffer, 'profile.bmp'));
    assert.deepStrictEqual(bmpV5Result.buffer, bmpV5.buffer);
    assert.ok(bmpV5Result.buffer.includes(bmpV5.pixels));
    assert.ok(bmpV5Result.buffer.includes(bmpV5.profile));
    assert.match(bmpV5Result.residualRisks.join('\n'), /BMP.*metadata|safe rewrite/i);

    const tiff = tiffFixture();
    const tiffPixels = tiff.subarray(tiff.length - 4);
    const tiffResult = await cleanBuffer(tiff, 'image.tiff', classifyBuffer(tiff, 'image.tiff'));
    assert.deepStrictEqual(tiffResult.buffer, tiff);
    assert.ok(tiffResult.buffer.includes(tiffPixels));
    assert.match(tiffResult.residualRisks.join('\n'), /TIFF.*unchanged|safe.*TIFF/i);

    const bigTiff = bigTiffFixture();
    const bigTiffPixels = bigTiff.subarray(bigTiff.length - 4);
    const bigTiffResult = await cleanBuffer(bigTiff, 'image.bigtiff', classifyBuffer(bigTiff, 'image.bigtiff'));
    assert.deepStrictEqual(bigTiffResult.buffer, bigTiff);
    assert.ok(bigTiffResult.buffer.includes(bigTiffPixels));
    assert.match(bigTiffResult.residualRisks.join('\n'), /BigTIFF.*unchanged|safe.*BigTIFF/i);
  });

  it('never clears TIFF or BigTIFF metadata values that share a strip or tile byte range', async () => {
    for (const [name, input] of [
      ['shared.tiff', sharedRangeTiffFixture(false)],
      ['shared.bigtiff', sharedRangeTiffFixture(true)],
    ]) {
      const result = await cleanBuffer(input, name, classifyBuffer(input, name));
      assert.deepStrictEqual(result.buffer, input, name);
      assert.match(result.residualRisks.join('\n'), /overlap.*pixel|strip.*range|tile.*range/i, name);
    }
  });

  it('collects later-IFD strip ranges before changing TIFF or BigTIFF metadata', async () => {
    for (const [name, input] of [
      ['two-page.tiff', laterIfdSharedRangeTiffFixture(false)],
      ['two-page.bigtiff', laterIfdSharedRangeTiffFixture(true)],
    ]) {
      const result = await cleanBuffer(input, name, classifyBuffer(input, name));
      assert.deepStrictEqual(result.buffer, input, name);
      assert.match(result.residualRisks.join('\n'), /overlap.*strip|strip.*overlap|pixel.*overlap/i, name);
    }
  });

  it('refuses TIFF metadata pointers into protected IFD structures', async () => {
    const input = pointerIntoIfdTiffFixture();
    const result = await cleanBuffer(input, 'pointer-into-ifd.tiff', classifyBuffer(input, 'pointer-into-ifd.tiff'));
    assert.deepStrictEqual(result.buffer, input);
    assert.match(result.residualRisks.join('\n'), /IFD|protected.*structure|unchanged/i);
  });

  it('applies configured TIFF and BigTIFF structure-count limits', async () => {
    for (const [name, input] of [
      ['limited.tiff', tiffFixture()],
      ['limited.bigtiff', bigTiffFixture()],
    ]) {
      await assert.rejects(
        () => cleanBuffer(input, name, classifyBuffer(input, name), {
          limits: { maxArchiveEntries: 2 },
        }),
        /entry.*count|count.*entry|safe.*count/i,
        name
      );
    }
  });

  it('parses unrelated TIFF value types before conservatively preserving metadata', async () => {
    for (const [name, input] of [
      ['unrelated-double.tiff', tiffWithUnrelatedDoubleFixture()],
      ['unrelated-double.bigtiff', tiffWithUnrelatedDoubleFixture(true)],
    ]) {
      const result = await cleanBuffer(input, name, classifyBuffer(input, name));
      assert.deepStrictEqual(result.buffer, input, name);
      assert.match(result.residualRisks.join('\n'), /metadata.*unchanged|mutation.*unproven/i, name);
    }
  });

  it('cleans Office package metadata while preserving visible structure, styles, media, order, and compression', async () => {
    for (const fixture of [
      {
        name: 'book.xlsx', marker: 'xl/workbook.xml', entries: [
          { name: '[Content_Types].xml', data: '<Types/>', method: 0 },
          { name: 'docProps/core.xml', data: '<creator>AI-generated tool</creator>', method: 8 },
          { name: 'xl/workbook.xml', data: '<workbook><sheet name="Visible"/></workbook>', method: 8 },
          { name: 'xl/styles.xml', data: '<styles>style-data</styles>', method: 0 },
          { name: 'xl/media/image.png', data: Buffer.from('media-data'), method: 0 },
        ],
      },
      {
        name: 'slides.pptx', marker: 'ppt/presentation.xml', entries: [
          { name: '[Content_Types].xml', data: '<Types/>', method: 0 },
          { name: 'docProps/app.xml', data: '<Application>AI-generated tool</Application>', method: 8 },
          { name: 'ppt/presentation.xml', data: '<presentation/>', method: 8 },
          { name: 'ppt/slides/slide1.xml', data: '<t>Visible slide</t>', method: 8 },
          { name: 'ppt/media/image.png', data: Buffer.from('media-data'), method: 0 },
        ],
      },
    ]) {
      const input = makeZip(fixture.entries);
      assert.equal(classifyBuffer(input, fixture.name).format, path.extname(fixture.name).slice(1));
      const result = await cleanBuffer(input, fixture.name, classifyBuffer(input, fixture.name));
      const before = zipEntries(input);
      const after = zipEntries(result.buffer);
      assert.deepStrictEqual(after.map((entry) => entry.name), before.map((entry) => entry.name));
      assert.deepStrictEqual(after.map((entry) => entry.method), before.map((entry) => entry.method));
      for (const name of before.map((entry) => entry.name).filter((entry) => !entry.startsWith('docProps/'))) {
        assert.deepStrictEqual(after.find((entry) => entry.name === name).data, before.find((entry) => entry.name === name).data, `${fixture.name}: ${name}`);
      }
      assert.ok(!after.find((entry) => entry.name.startsWith('docProps/')).data.includes(Buffer.from('AI-generated')));
    }
  });
});

describe('P-MUST-02 and P-MUST-04: body resources and embedded media', () => {
  it('preserves ideographic variation selectors and Mongolian orthographic controls and counts confirmed removals by code point', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-unicode-'));
    try {
      const ideograph = `${String.fromCodePoint(0x908a)}${String.fromCodePoint(0xe0100)}`;
      const mongolian = `${String.fromCodePoint(0x1820)}${String.fromCodePoint(0x180e)}${String.fromCodePoint(0x1821)}`;
      const source = path.join(root, 'orthography.txt');
      fs.writeFileSync(source, `${ideograph} ${mongolian} A\u200bB`);
      const report = await cleanTargets([source], { apply: true });
      const output = fs.readFileSync(cleanedCopyPath(source), 'utf8');
      assert.ok(output.includes(ideograph));
      assert.ok(output.includes(mongolian));
      assert.ok(output.includes('AB'));
      assert.deepStrictEqual(report.actions[0].codePointCounts, {
        'U+200B': { removed: 1, replaced: 0 },
      });
      assert.match(serializeReport(report, 'markdown'), /U\+200B: removed 1, replaced 0/);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('cleans visible HTML text without rewriting script or style payloads', async () => {
    const carrier = '\u200b';
    const input = Buffer.from(`<html><body><p>A${carrier}B</p><script>const key = "A${carrier}B";</script><style>.x::after{content:"A${carrier}B"}</style></body></html>`);
    const result = await cleanBuffer(input, 'page.html', classifyBuffer(input, 'page.html'));
    const output = result.buffer.toString('utf8');
    assert.match(output, /<p>AB<\/p>/);
    assert.ok(output.includes(`<script>const key = "A${carrier}B";</script>`));
    assert.ok(output.includes(`<style>.x::after{content:"A${carrier}B"}</style>`));
  });

  it('cleans Layer A carriers only in declared document body resources', async () => {
    const family = String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);
    const arabic = `\u0644\u200d\u0627`;
    const carrier = '\u200b';
    const cases = [
      {
        name: 'book.docx', body: 'word/document.xml', entries: [
          { name: '[Content_Types].xml', data: '<Types/>', method: 0 },
          { name: 'word/document.xml', data: `<w:document><w:t>A${carrier}B ${arabic} ${family}</w:t></w:document>`, method: 8 },
          { name: 'word/styles.xml', data: '<styles>unchanged</styles>', method: 8 },
          { name: 'word/_rels/document.xml.rels', data: '<Relationships>unchanged</Relationships>', method: 8 },
          { name: 'word/media/image.bin', data: Buffer.from('media'), method: 0 },
        ],
      },
      {
        name: 'book.odt', body: 'content.xml', entries: [
          { name: 'mimetype', data: 'application/vnd.oasis.opendocument.text', method: 0 },
          { name: 'content.xml', data: `<text:p>A${carrier}B ${arabic} ${family}</text:p>`, method: 8 },
          { name: 'styles.xml', data: '<styles>unchanged</styles>', method: 8 },
          { name: 'META-INF/manifest.xml', data: '<manifest>unchanged</manifest>', method: 8 },
        ],
      },
      {
        name: 'book.epub', body: 'OEBPS/chapter.xhtml', entries: [
          { name: 'mimetype', data: 'application/epub+zip', method: 0 },
          { name: 'META-INF/container.xml', data: '<container><rootfile full-path="OEBPS/content.opf"/></container>', method: 8 },
          { name: 'OEBPS/content.opf', data: '<package><manifest><item id="c" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="n" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest></package>', method: 8 },
          { name: 'OEBPS/chapter.xhtml', data: `<html><body><p>A${carrier}B ${arabic} ${family}</p></body></html>`, method: 8 },
          { name: 'OEBPS/nav.xhtml', data: `<nav aria-label="Contents">A${carrier}B</nav>`, method: 8 },
          { name: 'OEBPS/undeclared.xhtml', data: `<p>A${carrier}B</p>`, method: 8 },
          { name: 'OEBPS/image.bin', data: Buffer.from('media'), method: 0 },
        ],
      },
    ];
    for (const fixture of cases) {
      const input = makeZip(fixture.entries);
      const result = await cleanBuffer(input, fixture.name, classifyBuffer(input, fixture.name));
      const before = zipEntries(input);
      const after = zipEntries(result.buffer);
      const body = after.find((entry) => entry.name === fixture.body).data.toString('utf8');
      assert.ok(body.includes('AB'));
      assert.ok(body.includes(arabic));
      assert.ok(body.includes(family));
      for (const entry of before) {
        if (entry.name === fixture.body) continue;
        assert.deepStrictEqual(after.find((item) => item.name === entry.name).data, entry.data, `${fixture.name}: ${entry.name}`);
      }
    }
  });

  it('preserves unsupported UTF-16 archive XML with a degraded residual', async () => {
    const utf16 = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from('<Application>AI-generated tool</Application>', 'utf16le'),
    ]);
    const input = makeZip([
      { name: '[Content_Types].xml', data: '<Types/>', method: 0 },
      { name: 'word/document.xml', data: '<w:document><w:t>Visible</w:t></w:document>', method: 8 },
      { name: 'docProps/app.xml', data: utf16, method: 8 },
    ]);
    const result = await cleanBuffer(input, 'utf16.docx', classifyBuffer(input, 'utf16.docx'));
    assert.deepStrictEqual(result.buffer, input);
    assert.match(result.residualRisks.join('\n'), /UTF-16.*unchanged|unsupported.*encoding/i);
  });

  it('preserves non-UTF-8 archive XML byte-for-byte with a degraded residual', async () => {
    const latin1 = Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><Application>Cr\xe9ateur AI-generated tool</Application>', 'latin1');
    const input = makeZip([
      { name: '[Content_Types].xml', data: '<Types/>', method: 0 },
      { name: 'word/document.xml', data: '<w:document><w:t>Visible</w:t></w:document>', method: 8 },
      { name: 'docProps/app.xml', data: latin1, method: 8 },
    ]);
    const result = await cleanBuffer(input, 'latin1.docx', classifyBuffer(input, 'latin1.docx'));
    assert.deepStrictEqual(result.buffer, input);
    assert.deepStrictEqual(zipEntries(result.buffer).find((entry) => entry.name === 'docProps/app.xml').data, latin1);
    assert.match(result.residualRisks.join('\n'), /unsupported.*encoding|invalid.*UTF-8/i);
  });

  it('uses protected markup cleaning for EPUB bodies and keeps scripts and styles byte-identical', async () => {
    const carrier = '\u200b';
    const body = `<html><body><p>A${carrier}B</p><script>const token="A${carrier}B";</script><style>.x{content:"A${carrier}B"}</style></body></html>`;
    const input = makeZip([
      { name: 'mimetype', data: 'application/epub+zip', method: 0 },
      { name: 'META-INF/container.xml', data: '<container><rootfile full-path="OEBPS/content.opf"/></container>', method: 8 },
      { name: 'OEBPS/content.opf', data: '<package><manifest><item id="c" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest></package>', method: 8 },
      { name: 'OEBPS/chapter.xhtml', data: body, method: 8 },
    ]);
    const result = await cleanBuffer(input, 'protected.epub', classifyBuffer(input, 'protected.epub'));
    const output = zipEntries(result.buffer).find((entry) => entry.name === 'OEBPS/chapter.xhtml').data.toString('utf8');
    assert.match(output, /<p>AB<\/p>/);
    assert.ok(output.includes(`<script>const token="A${carrier}B";</script>`));
    assert.ok(output.includes(`<style>.x{content:"A${carrier}B"}</style>`));
  });

  it('returns the original archive bytes when no member changes', async () => {
    const input = makeZip([
      { name: '[Content_Types].xml', data: '<Types/>', method: 0 },
      { name: 'word/document.xml', data: '<w:document><w:t>Visible</w:t></w:document>', method: 8 },
    ]);
    input.writeUInt16LE(0x1234, 10);
    const end = input.lastIndexOf(Buffer.from('504b0506', 'hex'));
    const central = input.readUInt32LE(end + 16);
    input.writeUInt16LE(0x1234, central + 12);
    const result = await cleanBuffer(input, 'unchanged.docx', classifyBuffer(input, 'unchanged.docx'));
    assert.deepStrictEqual(result.buffer, input);
  });

  it('cleans bounded embedded media after MIME and signature validation', async () => {
    const png = pngFixture();
    const html = Buffer.from(`<img alt="cover" src="data:image/png;base64,${png.toString('base64')}">`);
    const result = await cleanBuffer(html, 'page.html', classifyBuffer(html, 'page.html'));
    const encoded = result.buffer.toString('utf8').match(/base64,([A-Za-z0-9+/=]+)/)[1];
    const cleanedPng = Buffer.from(encoded, 'base64');
    assert.ok(!cleanedPng.includes(Buffer.from('AI-generated tool')));
    assert.ok(cleanedPng.includes(Buffer.from('pixel-stream')));
    assert.ok(cleanedPng.includes(Buffer.from('color-profile')));

    const mismatch = Buffer.from(`<img src="data:image/jpeg;base64,${png.toString('base64')}">`);
    await assert.rejects(
      () => cleanBuffer(mismatch, 'page.html', classifyBuffer(mismatch, 'page.html')),
      /signature|declares/i
    );

    const corrupt = Buffer.from(png);
    corrupt[corrupt.length - 1] ^= 0xff;
    const corruptDataUri = Buffer.from(`<img src="data:image/png;base64,${corrupt.toString('base64')}">`);
    await assert.rejects(
      () => cleanBuffer(corruptDataUri, 'page.html', classifyBuffer(corruptDataUri, 'page.html')),
      /checksum/i
    );
  });

  it('caps aggregate embedded data URI bytes and match count', async () => {
    const png = pngFixture();
    const uri = `data:image/png;base64,${png.toString('base64')}`;
    const html = Buffer.from(`<img src="${uri}"><img src="${uri}">`);
    await assert.rejects(
      () => cleanBuffer(html, 'aggregate.html', classifyBuffer(html, 'aggregate.html'), {
        limits: { maxDataUriBytes: png.length + 1, maxDataUriTotalBytes: png.length + 1 },
      }),
      /aggregate|total.*data URI/i
    );
    await assert.rejects(
      () => cleanBuffer(html, 'matches.html', classifyBuffer(html, 'matches.html'), {
        limits: { maxDataUriBytes: png.length + 1, maxDataUriMatches: 1 },
      }),
      /match|count.*data URI/i
    );
  });
});

describe('P-MUST-10, P-MUST-11, P-MUST-14, and P-MUST-15: provider and unsafe input handling', () => {
  it('uses provider-clean output when selected and writes no output when the required provider fails', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-provider-'));
    try {
      const source = path.join(root, 'draft.txt');
      fs.writeFileSync(source, 'A\u200bB');
      let calls = 0;
      const providerConnect = async () => ({
        serviceVersion: '0.5.0', contractVersion: '0.5.0',
        cleanFile: async () => {
          calls++;
          return { cleaned: Buffer.from('AB'), changes: { actions: ['strip Layer A'] }, residual: { c2pa: false, aiMetadata: false, findings: [] }, ignoredEvidence: [] };
        },
      });
      const success = await cleanTargets([source], {
        apply: true, provider: 'watermarks-remover', providerConnect, providerEnv: { SCRIVENO_WATERMARKS_SERVICE_URL: 'http://127.0.0.1:1' },
      });
      assert.equal(calls, 1);
      assert.equal(success.provider, 'watermarks-remover');
      assert.equal(fs.readFileSync(cleanedCopyPath(source), 'utf8'), 'AB');

      fs.rmSync(cleanedCopyPath(source));
      const failure = await cleanTargets([source], {
        apply: true, provider: 'watermarks-remover', requireProvider: true,
        providerConnect: async () => { throw new Error('provider failed'); },
      });
      assert.equal(failure.recommendedExitCode, EXIT_CODES.INTERNAL);
      assert.equal(fs.existsSync(cleanedCopyPath(source)), false);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('rejects provider output that rewrites protected visible prose and publishes nothing', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-provider-invariant-'));
    try {
      const source = path.join(root, 'draft.txt');
      fs.writeFileSync(source, 'Original prose\u200b');
      const report = await cleanTargets([source], {
        apply: true,
        provider: 'watermarks-remover',
        providerEnv: { SCRIVENO_WATERMARKS_SERVICE_URL: 'http://127.0.0.1:1' },
        providerConnect: async () => ({
          serviceVersion: '0.5.0', contractVersion: '0.5.0',
          cleanFile: async () => ({
            cleaned: Buffer.from('Rewritten prose'),
            changes: { actions: ['strip Layer A'] },
            residual: { findings: [] },
          }),
        }),
      });
      assert.equal(report.recommendedExitCode, EXIT_CODES.INTERNAL);
      assert.ok(report.errors.some((item) => item.code === 'provider_invariant'));
      assert.equal(fs.existsSync(cleanedCopyPath(source)), false);
      assert.equal(fs.readFileSync(source, 'utf8'), 'Original prose\u200b');
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('rejects provider mutations to pixels, frames, ICC, Exif Orientation, TIFF strips, and archive structure', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-provider-protected-media-'));
    try {
      const mutatedWebp = Buffer.from(webpFixture());
      mutatedWebp[mutatedWebp.indexOf(Buffer.from('frame-data'))] = 'F'.charCodeAt(0);
      const mutatedGif = Buffer.from(gifFixture());
      mutatedGif[mutatedGif.indexOf(Buffer.from('2c00000000010001000002024401003b', 'hex')) + 12] ^= 1;
      const mutatedBmp = Buffer.from(bmpFixture());
      mutatedBmp[54] ^= 1;
      const mutatedTiff = Buffer.from(tiffFixture());
      mutatedTiff[mutatedTiff.length - 1] ^= 1;
      const mutatedBigTiff = Buffer.from(bigTiffFixture());
      mutatedBigTiff[mutatedBigTiff.length - 1] ^= 1;
      const docxEntries = [
        { name: '[Content_Types].xml', data: '<Types/>', method: 0 },
        { name: 'word/document.xml', data: '<w:document><w:t>Visible</w:t></w:document>', method: 8 },
        { name: 'word/_rels/document.xml.rels', data: '<Relationships>original</Relationships>', method: 8 },
        { name: 'docProps/app.xml', data: '<Application>Photoshop 2026</Application>', method: 8 },
      ];
      const protectedCases = [
        ['pixel.png', pngFixture(), pngFixture('AI-generated tool', 'Pixel-stream')],
        ['frame.webp', webpFixture(), mutatedWebp],
        ['animation.gif', gifFixture(), mutatedGif],
        ['pixels.bmp', bmpFixture(), mutatedBmp],
        ['strip.tiff', tiffFixture(), mutatedTiff],
        ['strip.bigtiff', bigTiffFixture(), mutatedBigTiff],
        ['orientation.jpg', jpegFixture(6), jpegFixture(1)],
        ['relationships.docx', makeZip(docxEntries), makeZip(docxEntries.map((entry) => entry.name.includes('_rels/')
          ? { ...entry, data: '<Relationships>changed!</Relationships>' }
          : entry))],
      ];
      for (const [name, original, candidate] of protectedCases) {
        const source = path.join(root, name);
        fs.writeFileSync(source, original);
        const report = await cleanTargets([source], {
          apply: true,
          provider: 'watermarks-remover',
          providerEnv: { SCRIVENO_WATERMARKS_SERVICE_URL: 'http://127.0.0.1:1' },
          providerConnect: async () => ({
            serviceVersion: '0.5.0', contractVersion: '0.5.0',
            cleanFile: async () => ({
              cleaned: candidate,
              changes: { actions: ['remove metadata'] },
              residual: { findings: [] },
            }),
          }),
        });
        assert.equal(report.recommendedExitCode, EXIT_CODES.INTERNAL, name);
        assert.ok(report.errors.some((item) => item.code === 'provider_invariant'), name);
        assert.equal(fs.existsSync(cleanedCopyPath(source)), false, name);
        assert.deepStrictEqual(fs.readFileSync(source), original, name);
      }
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('rejects provider mutations to protected JPEG XMP alt text and publishes nothing', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-provider-xmp-'));
    try {
      const source = path.join(root, 'alt-text.jpg');
      const original = jpegXmpFixture({ description: 'Original alt text' });
      fs.writeFileSync(source, original);
      const report = await cleanTargets([source], {
        apply: true,
        provider: 'watermarks-remover',
        providerEnv: { SCRIVENO_WATERMARKS_SERVICE_URL: 'http://127.0.0.1:1' },
        providerConnect: async () => ({
          serviceVersion: '0.5.0', contractVersion: '0.5.0',
          cleanFile: async () => ({
            cleaned: jpegXmpFixture({ description: 'Mutated alt text' }),
            changes: { actions: ['remove metadata'] },
            residual: { findings: [] },
          }),
        }),
      });
      assert.equal(report.recommendedExitCode, EXIT_CODES.INTERNAL);
      assert.ok(report.errors.some((item) => item.code === 'provider_invariant'));
      assert.equal(fs.existsSync(cleanedCopyPath(source)), false);
      assert.deepStrictEqual(fs.readFileSync(source), original);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('rejects provider-added findings and protected WebP XMP mutations before publication', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-provider-direct-'));
    try {
      const cases = [
        ['added.txt', Buffer.from('Ordinary prose.'), Buffer.from('Ordinary\u200b prose.')],
        ['mixed.webp', webpMixedMetadataFixture('Original alt text'), webpMixedMetadataFixture('Mutated alt text')],
      ];
      for (const [name, original, candidate] of cases) {
        const source = path.join(root, name);
        fs.writeFileSync(source, original);
        const report = await cleanTargets([source], {
          apply: true,
          provider: 'watermarks-remover',
          providerEnv: { SCRIVENO_WATERMARKS_SERVICE_URL: 'http://127.0.0.1:1' },
          providerConnect: async () => ({
            serviceVersion: '0.5.0', contractVersion: '0.5.0',
            cleanFile: async () => ({
              cleaned: candidate,
              changes: { actions: ['remove metadata'] },
              residual: { findings: [] },
            }),
          }),
        });
        assert.equal(report.recommendedExitCode, EXIT_CODES.INTERNAL, name);
        assert.ok(report.errors.some((item) => item.code === 'provider_invariant'), name);
        assert.equal(fs.existsSync(cleanedCopyPath(source)), false, name);
        assert.deepStrictEqual(fs.readFileSync(source), original, name);
      }
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('publishes no partial batch when a required provider fails after an earlier item', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-provider-batch-'));
    try {
      const first = path.join(root, 'a.txt');
      const second = path.join(root, 'b.txt');
      fs.writeFileSync(first, 'A\u200bB');
      fs.writeFileSync(second, 'C\u200bD');
      let calls = 0;
      const report = await cleanTargets([first, second], {
        apply: true,
        provider: 'watermarks-remover',
        requireProvider: true,
        providerEnv: { SCRIVENO_WATERMARKS_SERVICE_URL: 'http://127.0.0.1:1' },
        providerConnect: async () => ({
          serviceVersion: '0.5.0', contractVersion: '0.5.0',
          cleanFile: async () => {
            calls++;
            if (calls === 2) throw new Error('second item failed');
            return { cleaned: Buffer.from('AB'), changes: { actions: ['strip Layer A'] }, residual: { findings: [] } };
          },
        }),
      });
      assert.equal(report.recommendedExitCode, EXIT_CODES.INTERNAL);
      assert.equal(fs.existsSync(cleanedCopyPath(first)), false);
      assert.equal(fs.existsSync(cleanedCopyPath(second)), false);
      assert.equal(report.outputs.length, 0);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('falls back locally with a visible degraded provider attempt', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-fallback-'));
    try {
      const source = path.join(root, 'draft.txt');
      fs.writeFileSync(source, 'A\u200bB');
      const report = await cleanTargets([source], {
        apply: true, provider: 'watermarks-remover',
        providerConnect: async () => { throw new Error('offline'); },
      });
      assert.equal(fs.readFileSync(cleanedCopyPath(source), 'utf8'), 'AB');
      assert.equal(report.provider, 'local');
      assert.equal(report.recommendedExitCode, EXIT_CODES.DEGRADED);
      assert.equal(report.providerAttempts[0].status, 'failed');
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('rejects unsafe archives, binary misroutes, symlinks, and output-boundary escapes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-unsafe-'));
    const outside = path.join(os.tmpdir(), `scriveno-clean-outside-${process.pid}.txt`);
    try {
      const cases = [
        ['traversal.docx', [{ name: '../outside.xml', data: 'bad' }]],
        ['encrypted.docx', [{ name: 'word/document.xml', data: 'bad', flags: 1 }]],
        ['duplicate.docx', [{ name: 'word/document.xml', data: 'a' }, { name: 'word/document.xml', data: 'b' }]],
        ['identical-duplicate.docx', [{ name: 'word/document.xml', data: 'same' }, { name: 'word/document.xml', data: 'same' }]],
        ['symlink.docx', [{ name: 'word/document.xml', data: 'target', externalAttributes: (0o120777 << 16) >>> 0 }]],
      ];
      for (const [name, entries] of cases) {
        const target = path.join(root, name);
        fs.writeFileSync(target, makeZip(entries));
        const report = await cleanTargets([target], { apply: true });
        assert.equal(report.recommendedExitCode, EXIT_CODES.INVALID, name);
        assert.equal(fs.existsSync(cleanedCopyPath(target)), false, name);
      }

      const binaryText = path.join(root, 'binary.md');
      fs.writeFileSync(binaryText, pngFixture());
      const binaryReport = await cleanTargets([binaryText], { apply: true });
      assert.equal(binaryReport.recommendedExitCode, EXIT_CODES.INVALID);

      fs.writeFileSync(outside, 'A\u200bB');
      const link = path.join(root, 'link.txt');
      fs.symlinkSync(outside, link);
      const linkReport = await cleanTargets([link], { apply: true });
      assert.equal(linkReport.recommendedExitCode, EXIT_CODES.INVALID);

      const source = path.join(root, 'safe.txt');
      fs.writeFileSync(source, 'A\u200bB');
      const boundary = await cleanTargets([source], { apply: true, output: outside });
      assert.equal(boundary.recommendedExitCode, EXIT_CODES.INVALID);
      assert.equal(fs.readFileSync(outside, 'utf8'), 'A\u200bB');
    } finally {
      fs.rmSync(root, { recursive: true });
      if (fs.existsSync(outside)) fs.rmSync(outside);
    }
  });

  it('bounds directory traversal depth and directory count', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-directory-bounds-'));
    try {
      const deep = path.join(root, 'one', 'two');
      fs.mkdirSync(deep, { recursive: true });
      fs.writeFileSync(path.join(deep, 'draft.txt'), 'A\u200bB');
      const depth = await cleanTargets([root], { limits: { maxDirectoryDepth: 1 } });
      assert.equal(depth.recommendedExitCode, EXIT_CODES.INVALID);
      assert.match(depth.errors[0].message, /depth/i);

      const count = await cleanTargets([root], { limits: { maxDirectories: 1 } });
      assert.equal(count.recommendedExitCode, EXIT_CODES.INVALID);
      assert.match(count.errors[0].message, /director.*count|count.*director/i);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('refuses expansion, compression-ratio, and unsupported-compression archives without output', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-archive-limits-'));
    try {
      const cases = [
        {
          name: 'expansion.docx',
          entries: [{ name: 'word/document.xml', data: '0123456789', method: 0 }],
          limits: { maxArchiveExpandedBytes: 4 },
          exit: EXIT_CODES.INVALID,
        },
        {
          name: 'ratio.docx',
          entries: [{ name: 'word/document.xml', data: 'A'.repeat(4096), method: 8 }],
          limits: { maxCompressionRatio: 2 },
          exit: EXIT_CODES.INVALID,
        },
        {
          name: 'compression.docx',
          entries: [{ name: 'word/document.xml', data: '<w:document/>', method: 99 }],
          limits: {},
          exit: EXIT_CODES.DEGRADED,
        },
      ];
      for (const fixture of cases) {
        const source = path.join(root, fixture.name);
        fs.writeFileSync(source, makeZip(fixture.entries));
        const report = await cleanTargets([source], { apply: true, limits: fixture.limits });
        assert.equal(report.recommendedExitCode, fixture.exit, fixture.name);
        assert.equal(fs.existsSync(cleanedCopyPath(source)), false, fixture.name);
      }
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('rejects conflicting ZIP local headers, data descriptors, ranges, and normalized aliases', () => {
    const base = makeZip([{ name: 'word/document.xml', data: 'same', method: 0 }]);
    const nameMismatch = Buffer.from(base);
    nameMismatch[30] ^= 1;
    assert.throws(() => parseZipContainer(nameMismatch), /local.*name|name.*conflict/i);

    const methodMismatch = Buffer.from(base);
    methodMismatch.writeUInt16LE(8, 8);
    assert.throws(() => parseZipContainer(methodMismatch), /local.*method|method.*conflict/i);

    const unsupportedDescriptor = makeZip([{ name: 'word/document.xml', data: 'same', method: 0, flags: 0x0008 }]);
    assert.throws(() => parseZipContainer(unsupportedDescriptor), /descriptor/i);

    const overlap = makeZip([
      { name: 'word/a.xml', data: 'same', method: 0 },
      { name: 'word/b.xml', data: 'same', method: 0 },
    ]);
    const end = overlap.lastIndexOf(Buffer.from('504b0506', 'hex'));
    const central = overlap.readUInt32LE(end + 16);
    const secondCentral = central + 46 + Buffer.byteLength('word/a.xml');
    const firstDataStart = 30 + Buffer.byteLength('word/a.xml');
    const secondLocal = overlap.readUInt32LE(secondCentral + 42);
    const secondDataStart = secondLocal + 30 + Buffer.byteLength('word/b.xml');
    const secondDataEnd = secondDataStart + overlap.readUInt32LE(secondCentral + 20);
    const overlappingData = overlap.subarray(firstDataStart, secondDataEnd);
    const overlappingChecksum = crc32(overlappingData);
    overlap.writeUInt32LE(overlappingChecksum, 14);
    overlap.writeUInt32LE(overlappingData.length, 18);
    overlap.writeUInt32LE(overlappingData.length, 22);
    overlap.writeUInt32LE(overlappingChecksum, central + 16);
    overlap.writeUInt32LE(overlappingData.length, central + 20);
    overlap.writeUInt32LE(overlappingData.length, central + 24);
    assert.throws(() => parseZipContainer(overlap), /overlap|local.*range|offset/i);

    const aliases = makeZip([
      { name: 'word/./document.xml', data: 'same', method: 0 },
      { name: 'word/document.xml', data: 'same', method: 0 },
    ]);
    assert.throws(() => parseZipContainer(aliases), /alias|duplicate|normalized/i);
  });
});

describe('P-MUST-18: provenance-clean CLI contract', () => {
  it('parses dry-run, apply, in-place, provider, format, output, and concurrency options', () => {
    const parsed = parseArgs([
      'provenance-clean', 'draft.md', '--apply', '--in-place', '--confirm-in-place',
      '--provider', 'watermarks-remover', '--require-provider', '--jobs', '2',
      '--format', 'json', '--output', 'report.json',
    ]);
    assert.equal(parsed.command, 'provenance-clean');
    assert.equal(parsed.provenanceApply, true);
    assert.equal(parsed.provenanceInPlace, true);
    assert.equal(parsed.provenanceConfirmInPlace, true);
    assert.equal(parsed.provenanceProvider, 'watermarks-remover');
    assert.equal(parsed.provenanceRequireProvider, true);
    assert.equal(parsed.provenanceJobs, 2);
    assert.equal(parsed.provenanceFormat, 'json');
    assert.equal(parsed.provenanceOutput, 'report.json');
    assert.throws(() => parseArgs(['provenance-clean', 'draft.md', '--in-place']), /requires.*apply/i);
    assert.throws(() => parseArgs(['provenance-clean', 'draft.md', '--apply', '--in-place']), /confirm/i);
  });

  it('validates report output before applying and never mutates when the report path is unsafe', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-cli-'));
    try {
      const source = path.join(root, 'draft.txt');
      fs.writeFileSync(source, 'A\u200bB');
      const result = spawnSync(process.execPath, [
        path.join(ROOT, 'bin', 'install.js'), 'provenance-clean', source,
        '--apply', '--output', source, '--format', 'json',
      ], { encoding: 'utf8' });
      assert.equal(result.status, EXIT_CODES.INVALID);
      assert.equal(fs.readFileSync(source, 'utf8'), 'A\u200bB');
      assert.equal(fs.existsSync(cleanedCopyPath(source)), false);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('rejects a report path that aliases a planned cleaned artifact', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-cli-artifact-alias-'));
    try {
      const source = path.join(root, 'draft.txt');
      const output = cleanedCopyPath(source);
      fs.writeFileSync(source, 'A\u200bB');
      const result = spawnSync(process.execPath, [
        path.join(ROOT, 'bin', 'install.js'), 'provenance-clean', source,
        '--apply', '--output', output, '--format', 'json',
      ], { encoding: 'utf8' });
      assert.equal(result.status, EXIT_CODES.INVALID);
      assert.equal(fs.readFileSync(source, 'utf8'), 'A\u200bB');
      assert.equal(fs.existsSync(output), false);
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it('precomputes the report destination with the artifact transaction', async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-cli-report-plan-')));
    const original = provenanceCleanModule.cleanTargets;
    const previousExitCode = process.exitCode;
    try {
      const source = path.join(root, 'draft.txt');
      const reportPath = path.join(root, 'report.json');
      fs.writeFileSync(source, 'Ordinary prose.');
      let received;
      provenanceCleanModule.cleanTargets = async (targets, options) => {
        received = { targets, options };
        return {
          schemaVersion: CLEAN_SCHEMA_VERSION, operation: 'clean', provider: 'local',
          targets: [], capabilities: [], findings: [], actions: [], outputs: [],
          residualRisks: [], errors: [], providerAttempts: [], status: 'clear',
          recommendedExitCode: EXIT_CODES.CLEAR, execution: { apply: false },
        };
      };
      await runProvenanceClean(parseArgs([
        'provenance-clean', source, '--output', reportPath, '--format', 'json',
      ]));
      assert.equal(received.options.reportOutput, reportPath);
      assert.equal(typeof received.options.beforeCommit, 'function');
    } finally {
      provenanceCleanModule.cleanTargets = original;
      process.exitCode = previousExitCode;
      fs.rmSync(root, { recursive: true });
    }
  });

  it('keeps an existing report destination bound to its original identity', async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-cli-existing-report-')));
    const original = provenanceCleanModule.cleanTargets;
    const previousExitCode = process.exitCode;
    try {
      const source = path.join(root, 'draft.txt');
      const reportPath = path.join(root, 'report.json');
      fs.writeFileSync(source, 'Ordinary prose.');
      fs.writeFileSync(reportPath, 'old report');
      provenanceCleanModule.cleanTargets = async () => ({
        schemaVersion: CLEAN_SCHEMA_VERSION, operation: 'clean', provider: 'local',
        targets: [], capabilities: [], findings: [], actions: [], outputs: [],
        residualRisks: [], errors: [], providerAttempts: [], status: 'clear',
        recommendedExitCode: EXIT_CODES.CLEAR, execution: { apply: false },
      });
      await runProvenanceClean(parseArgs([
        'provenance-clean', source, '--output', reportPath, '--format', 'json',
      ]));
      assert.equal(JSON.parse(fs.readFileSync(reportPath, 'utf8')).status, 'clear');
    } finally {
      provenanceCleanModule.cleanTargets = original;
      process.exitCode = previousExitCode;
      fs.rmSync(root, { recursive: true });
    }
  });

  it('revalidates report boundary identity before artifact publication', async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scriveno-clean-cli-report-boundary-')));
    const original = provenanceCleanModule.cleanTargets;
    const previousExitCode = process.exitCode;
    try {
      const source = path.join(root, 'draft.txt');
      const reports = path.join(root, 'reports');
      const displaced = path.join(root, 'displaced');
      const outside = path.join(root, 'outside');
      const reportPath = path.join(reports, 'report.json');
      fs.mkdirSync(reports);
      fs.mkdirSync(outside);
      fs.writeFileSync(source, 'Ordinary prose.');
      provenanceCleanModule.cleanTargets = async (targets, options) => {
        fs.renameSync(reports, displaced);
        fs.symlinkSync(outside, reports);
        await options.beforeCommit();
        throw new Error('unreachable');
      };
      await assert.rejects(
        () => runProvenanceClean(parseArgs([
          'provenance-clean', source, '--apply', '--output', reportPath, '--format', 'json',
        ])),
        /boundary|identity|symlink/i
      );
      assert.equal(fs.existsSync(path.join(outside, 'report.json')), false);
      assert.equal(fs.existsSync(cleanedCopyPath(source)), false);
    } finally {
      provenanceCleanModule.cleanTargets = original;
      process.exitCode = previousExitCode;
      fs.rmSync(root, { recursive: true });
    }
  });
});
