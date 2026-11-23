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

function commandIds() {
  const flatCommands = fs.readdirSync(path.join(ROOT, 'commands', 'scr'))
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''));
  const sacredCommands = fs.readdirSync(path.join(ROOT, 'commands', 'scr', 'sacred'))
    .filter((file) => file.endsWith('.md'))
    .map((file) => `sacred:${file.replace(/\.md$/, '')}`);
  return new Set([...flatCommands, ...sacredCommands]);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectionBody(markdown, heading) {
  const start = markdown.indexOf(heading);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const rest = markdown.slice(start + heading.length);
  const next = rest.search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('first-run proof surface', () => {
  const readme = read('README.md');
  const quickProof = read('docs/quick-proof.md');
  const starterSets = read('docs/starter-sets.md');
  const versatilityPaths = read('docs/versatility-paths.md');
  const releaseChecklist = read('docs/release-checklist.md');
  const firstRunProof = read('data/proof/first-run/README.md');
  const runtimeParity = read('data/proof/runtime-parity/README.md');

  it('keeps the first-run documents linked from README', () => {
    assert.match(readme, /\[Quick Proof\]\(docs\/quick-proof\.md\)/);
    assert.match(readme, /\[Proof Badges\]\(docs\/proof-badges\.md\)/);
    assert.match(readme, /\[Starter Sets\]\(docs\/starter-sets\.md\)/);
    assert.match(readme, /\[Versatility Paths\]\(docs\/versatility-paths\.md\)/);
    assert.match(readme, /\[Release Checklist\]\(docs\/release-checklist\.md\)/);
  });

  it('keeps quick proof anchored to real shipped artifacts and runtime shapes', () => {
    const requiredFiles = [
      'data/demo/.manuscript/STYLE-GUIDE.md',
      'data/demo/.manuscript/plans/5-the-reunion-PLAN.md',
      'data/proof/watchmaker-flow/README.md',
      'data/proof/voice-dna/README.md',
      'data/proof/first-run/README.md',
      'data/proof/runtime-parity/README.md',
      'data/proof/voice-dna/UNGUIDED-SAMPLE.md',
      'data/proof/voice-dna/GUIDED-SAMPLE.md',
    ];

    for (const relativePath of requiredFiles) {
      assert.ok(
        quickProof.includes(relativePath) || quickProof.includes(`../${relativePath}`),
        `docs/quick-proof.md should mention ${relativePath}`
      );
      assert.ok(exists(relativePath), `quick proof artifact should exist: ${relativePath}`);
    }

    assert.match(quickProof, /\/scr-draft 5/);
    assert.match(quickProof, /\/scr:first-run/);
    assert.match(quickProof, /\/scr:draft 5/);
    assert.match(quickProof, /\/scr:save/);
    assert.match(quickProof, /\$scr-draft 5/);
    assert.match(quickProof, /\$scr-save/);
    assert.match(quickProof, /npx @hxp-tools\/scriveno@latest first-run --project \./);
    assert.match(quickProof, /npx @hxp-tools\/scriveno@latest smoke --json/);
    assert.match(quickProof, /Claude Code is the primary reference runtime/);
    assert.match(quickProof, /host-runtime parity proof/);
    assert.match(quickProof, /\[Versatility Paths\]\(versatility-paths\.md\)/);
  });

  it('keeps versatility framed as curated showcase paths, not feature reduction', () => {
    assert.match(versatilityPaths, /^# Versatility Paths$/m);
    assert.match(versatilityPaths, /flagship path is still simple/i);
    assert.match(versatilityPaths, /technical, sacred, visual, translation, and publishing/i);
    assert.match(versatilityPaths, /Do not lead with every work type at once/i);
    assert.match(versatilityPaths, /Do not hide the range\. Curate it\./i);

    assert.match(starterSets, /## Showcase The Versatility/);
    assert.match(starterSets, /\[Versatility Paths\]\(versatility-paths\.md\)/);
  });

  it('keeps first-run proof and runtime parity evidence concrete', () => {
    assert.match(firstRunProof, /npx @hxp-tools\/scriveno@latest first-run --project \./);
    assert.match(firstRunProof, /npx @hxp-tools\/scriveno@latest smoke --json/);
    assert.match(firstRunProof, /\/scr:draft 5/);
    assert.match(firstRunProof, /\/scr:save/);
    assert.match(firstRunProof, new RegExp(`"expectedCommands": ${commandIds().size}`));
    assert.match(runtimeParity, /Claude Code/);
    assert.match(runtimeParity, /Codex/);
    assert.match(runtimeParity, /Remaining Host-In-The-Loop Gap/);
    assert.match(runtimeParity, /install-surface proof and host-runtime parity proof/);
  });

  it('keeps starter set command references mapped to real commands', () => {
    const ids = commandIds();
    const commandRefs = Array.from(starterSets.matchAll(/`\/scr:([a-z0-9-:]+)`/g))
      .map((match) => match[1]);

    assert.ok(commandRefs.length >= 30, 'starter sets should expose a meaningful command sample');
    for (const id of commandRefs) {
      assert.ok(ids.has(id), `starter set command should exist: ${id}`);
    }

    const expectedSections = [
      '## First 10 Minutes',
      '## Draft A Book',
      '## Polish A Manuscript',
      '## Build A World And Research',
      '## Publish An Ebook',
      '## Translate A Work',
      '## Build Sacred Commentary',
      '## Repair And Resume',
    ];

    for (const section of expectedSections) {
      assert.match(starterSets, new RegExp(escapeRegExp(section)));
    }
  });

  it('keeps publishing starter paths honest about dedicated matter commands', () => {
    const publishingGuide = read('docs/publishing.md');
    const publishSection = sectionBody(starterSets, '## Publish An Ebook');

    assert.doesNotMatch(readme, /autopilot-publish.*generates front matter, back matter/i);
    assert.doesNotMatch(publishingGuide, /offers to generate anything missing/i);

    assert.match(publishSection, /\/scr:front-matter/);
    assert.match(publishSection, /\/scr:back-matter/);
    assert.match(publishSection, /\/scr:publish/);
    assert.match(publishSection, /current work type/i);
    assert.match(publishSection, /without drafting it/i);
    assert.match(publishSection, /stays in dedicated commands/i);

    assert.ok(
      publishSection.indexOf('/scr:front-matter') < publishSection.indexOf('/scr:publish'),
      'front matter should be suggested before publish packaging'
    );
    assert.ok(
      publishSection.indexOf('/scr:back-matter') < publishSection.indexOf('/scr:publish'),
      'back matter should be suggested before publish packaging'
    );
  });

  it('keeps the release checklist tied to local, npm, and GitHub verification', () => {
    assert.match(releaseChecklist, /npm run release:check/);
    assert.match(releaseChecklist, /npm publish --access public/);
    assert.match(releaseChecklist, /npm install -g @hxp-tools\/scriveno@latest/);
    assert.match(releaseChecklist, /scriveno smoke --json/);
    assert.match(releaseChecklist, /gh release create/);
    assert.match(releaseChecklist, /npm cache clean --force/);
  });
});
