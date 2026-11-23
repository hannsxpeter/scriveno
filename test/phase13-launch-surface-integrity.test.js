const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function collectMarkdownFiles(relativeDir) {
  const absoluteDir = path.join(ROOT, relativeDir);
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(path.relative(ROOT, absolutePath));
      }
    }
  }

  walk(absoluteDir);
  return files;
}

describe('phase 13 shipped-asset truth', () => {
  const shippedAssets = read('docs/shipped-assets.md');

  it('keeps the canonical shipped-template inventory aligned to disk', () => {
    const shippedTemplates = [
      'data/export-templates/scriveno-book.typst',
      'data/export-templates/scriveno-epub.css',
      'data/export-templates/scriveno-academic.latex',
    ];
    const absentTemplates = [
      'data/export-templates/scriveno-manuscript.docx',
      'data/export-templates/scriveno-formatted.docx',
      'data/export-templates/scriveno-kdp-cover.typst',
      'data/export-templates/scriveno-ingram-cover.typst',
    ];

    for (const relativePath of shippedTemplates) {
      assert.ok(
        shippedAssets.includes(path.basename(relativePath)),
        `docs/shipped-assets.md should list ${path.basename(relativePath)}`
      );
      assert.ok(exists(relativePath), `Expected shipped template to exist: ${relativePath}`);
    }

    for (const relativePath of absentTemplates) {
      assert.ok(
        shippedAssets.includes(path.basename(relativePath)),
        `docs/shipped-assets.md should mention ${path.basename(relativePath)}`
      );
      assert.ok(!exists(relativePath), `Expected template to remain absent: ${relativePath}`);
    }
  });

  it('keeps the phase 13 trust-critical files inventoried', () => {
    const trustCriticalFiles = [
      'README.md',
      'commands/scr/export.md',
      'docs/publishing.md',
      'docs/contributing.md',
      'AGENTS.md',
      'CLAUDE.md',
    ];

    for (const relativePath of trustCriticalFiles) {
      assert.ok(
        shippedAssets.includes(`\`${relativePath}\``),
        `docs/shipped-assets.md should inventory ${relativePath}`
      );
      assert.ok(exists(relativePath), `Trust-critical file is missing: ${relativePath}`);
    }
  });
});

describe('phase 13 export guidance', () => {
  const exportDoc = read('commands/scr/export.md');
  const publishingDoc = read('docs/publishing.md');

  it('describes DOCX export as shipped-default plus optional custom reference docs', () => {
    assert.match(exportDoc, /Pandoc's default DOCX styling/);
    assert.match(exportDoc, /optional `--reference-doc`/);
    assert.match(exportDoc, /default DOCX output/);
    assert.doesNotMatch(exportDoc, /scriveno-manuscript\.docx/);
    assert.doesNotMatch(exportDoc, /scriveno-formatted\.docx/);

    assert.match(publishingDoc, /Pandoc's default DOCX styling/);
    assert.match(publishingDoc, /default DOCX output/);
    assert.match(publishingDoc, /provide your own Pandoc reference document/);
    assert.doesNotMatch(publishingDoc, /bundled DOCX reference document/i);
  });
});

describe('phase 13 contributor and root-doc alignment', () => {
  const contributingDoc = read('docs/contributing.md');
  const readme = read('README.md');
  const agentsDoc = read('AGENTS.md');
  const claudeRaw = read('CLAUDE.md');
  // CLAUDE.md may be the single-line include `@AGENTS.md`; resolve it to AGENTS.md content so coverage is kept.
  const claudeDoc = claudeRaw.trim() === '@AGENTS.md' ? agentsDoc : claudeRaw;

  it('keeps contributor guidance pointed at the canonical inventory', () => {
    assert.match(contributingDoc, /docs\/shipped-assets\.md/);
    assert.match(contributingDoc, /scriveno-book\.typst/);
    assert.match(contributingDoc, /scriveno-epub\.css/);
    assert.match(contributingDoc, /scriveno-academic\.latex/);
    assert.doesNotMatch(contributingDoc, /scriveno-manuscript\.docx/);
    assert.doesNotMatch(contributingDoc, /scriveno-formatted\.docx/);
  });

  it('keeps README aligned to the canonical shipped surface', () => {
    assert.match(readme, /50 work types/);
    assert.match(readme, /\[Shipped Assets\]\(docs\/shipped-assets\.md\)/);
    assert.doesNotMatch(readme, /\bAll features shipped\b/i);
    assert.doesNotMatch(readme, /\bfull support\b/i);
  });

  it('keeps CLAUDE.md either a full instruction doc or exactly the @AGENTS.md include', () => {
    if (claudeRaw.length < 200) {
      assert.equal(claudeRaw.trim(), '@AGENTS.md', 'a short CLAUDE.md must be exactly the @AGENTS.md include');
    }
  });

  it('keeps AGENTS.md and CLAUDE.md aligned on shipped-versus-planned templates', () => {
    for (const [name, doc] of [['AGENTS.md', agentsDoc], ['CLAUDE.md', claudeDoc]]) {
      assert.match(doc, /50 work types/, `${name} should keep the 50 work-type count`);
      assert.match(doc, /## Currently Shipped Export Templates/, `${name} should list shipped templates`);
      assert.match(doc, /## Planned Export Templates/, `${name} should list planned templates separately`);
      assert.doesNotMatch(doc, /Template Files Scriveno Should Ship/, `${name} should not use the retired heading`);
    }
  });

  it('keeps root instruction docs aligned to the active npm package and publish model', () => {
    for (const [name, doc] of [['AGENTS.md', agentsDoc], ['CLAUDE.md', claudeDoc]]) {
      assert.match(doc, /npx @hxp-tools\/scriveno@latest/, `${name} should use the active npm package name`);
      assert.match(doc, /CI runs release checks, but publishing is still manual/, `${name} should describe the current publish model`);
      assert.match(doc, /Node 20 is a compatibility floor/, `${name} should not present Node 20 as the fresh-install target`);
      assert.doesNotMatch(doc, /npx scriveno-cli@latest/, `${name} should not use the unpublished legacy package`);
      assert.doesNotMatch(doc, /until Scriveno has CI\/CD/, `${name} should not claim CI is absent`);
      assert.doesNotMatch(doc, /Node 20 LTS until April 2026/, `${name} should not carry stale Node lifecycle wording`);
      assert.doesNotMatch(doc, /Revoked Feb 2026/, `${name} should not carry stale npm-token lifecycle wording`);
      assert.doesNotMatch(doc, /Sunset May 2026/, `${name} should not carry stale image API sunset wording`);
      assert.doesNotMatch(doc, /\$0\.02-0\.08 per image/, `${name} should avoid stale hard-coded image pricing`);
      assert.doesNotMatch(doc, /\$0\.005\/image/, `${name} should avoid stale hard-coded image pricing`);
    }
  });

  it('keeps legacy package names limited to historical and compatibility contexts', () => {
    const docsToScan = [
      'README.md',
      'AGENTS.md',
      'CLAUDE.md',
      ...collectMarkdownFiles('docs'),
      ...collectMarkdownFiles('commands'),
    ];
    const allowedLegacyContext = /\b(older|old|legacy|historical|unpublished|deprecated|compatibility|accepted as legacy input|version `2\.0\.5`|running `npx scriveno-cli@[0-9])/i;

    for (const relativePath of docsToScan) {
      const lines = read(relativePath).split('\n');
      lines.forEach((line, index) => {
        if (!/\bscriveno-cli\b|\bscriven-cli\b/.test(line)) return;
        assert.match(
          line,
          allowedLegacyContext,
          `${relativePath}:${index + 1} should explain legacy package names as historical or compatibility-only`
        );
        assert.doesNotMatch(
          line,
          /npx scriveno-cli@latest|npx scriven-cli@latest/,
          `${relativePath}:${index + 1} should not publish a legacy latest install command`
        );
      });
    }
  });
});
