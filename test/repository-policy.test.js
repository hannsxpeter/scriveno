const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SCAN_ROOTS = [
  'AGENTS.md',
  'CLAUDE.md',
  'CHANGELOG.md',
  'README.md',
  'agents',
  'bin',
  'commands',
  'data',
  'docs',
  'lib',
  'templates',
  'test',
  'package.json',
];

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.json',
  '.latex',
  '.md',
  '.opf',
  '.typst',
  '.yaml',
]);

function collectTextFiles(target, out = []) {
  const abs = path.join(ROOT, target);
  if (!fs.existsSync(abs)) return out;

  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(abs)) {
      collectTextFiles(path.join(target, entry), out);
    }
    return out;
  }

  if (TEXT_EXTENSIONS.has(path.extname(abs)) || path.basename(abs) === 'package.json') {
    out.push(target);
  }
  return out;
}

describe('repository writing policy', () => {
  const files = SCAN_ROOTS.flatMap((target) => collectTextFiles(target));

  it('does not contain em dashes or en dashes', () => {
    const offenders = [];
    for (const file of files) {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
      if (/[\u2013\u2014]/.test(content)) offenders.push(file);
    }

    assert.deepEqual(offenders, []);
  });

  it('does not contain emoji-style decorative markers', () => {
    const offenders = [];
    const markerPattern = /[\u2600-\u27BF]|[\u{1F300}-\u{1FAFF}]/u;

    for (const file of files) {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
      if (markerPattern.test(content)) offenders.push(file);
    }

    assert.deepEqual(offenders, []);
  });

  it('does not use deck shorthand for repo-wide docs', () => {
    const offenders = [];
    const forbidden = new RegExp(['documentation', 'deck'].join(' '), 'i');

    for (const file of files) {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
      if (forbidden.test(content)) offenders.push(file);
    }

    assert.deepEqual(offenders, []);
  });
});
