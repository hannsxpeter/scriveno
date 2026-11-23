const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const constraints = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'CONSTRAINTS.json'), 'utf8'));
const liveWorkTypeCount = Object.keys(constraints.work_types).length;
const liveWorkTypeGroupCount = Object.keys(constraints.work_type_groups).length;
const liveCommandCount = Object.keys(constraints.commands).length;

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('phase 19 technical-writing trust surfaces', () => {
  const readme = read('README.md');
  const gettingStarted = read('docs/getting-started.md');
  const workTypes = read('docs/work-types.md');
  const architecture = read('docs/architecture.md');
  const agentsDoc = read('AGENTS.md');
  const claudeRaw = read('CLAUDE.md');
  // CLAUDE.md may be the single-line include `@AGENTS.md`; resolve it to AGENTS.md content so coverage is kept.
  const claudeDoc = claudeRaw.trim() === '@AGENTS.md' ? agentsDoc : claudeRaw;

  it('keeps root and onboarding docs aligned on the expanded work-type count', () => {
    for (const [name, doc] of [
      ['README.md', readme],
      ['docs/getting-started.md', gettingStarted],
      ['docs/work-types.md', workTypes],
      ['docs/architecture.md', architecture],
      ['AGENTS.md', agentsDoc],
      ['CLAUDE.md', claudeDoc],
    ]) {
      assert.match(
        doc,
        new RegExp(`${liveWorkTypeCount} work types`),
        `${name} should keep the live work-type count`
      );
    }

    assert.match(workTypes, new RegExp(`${liveWorkTypeGroupCount} groups`));
    assert.match(architecture, new RegExp(`${liveWorkTypeGroupCount} groups`));
  });

  it('keeps secondary trust docs aligned on the live command inventory count', () => {
    assert.match(architecture, new RegExp(`consistency across ${liveCommandCount} commands`, 'i'));
    assert.doesNotMatch(architecture, /consistency across 101 commands/i);
  });

  it('keeps the README status and release docs aligned to the shipped release state', () => {
    const pkg = JSON.parse(read('package.json'));
    for (const [name, doc] of [['docs/release-notes.md', read('docs/release-notes.md')], ['CHANGELOG.md', read('CHANGELOG.md')]]) {
      const firstRelease = doc.match(/^## (\d+\.\d+\.\d+) - /m);
      assert.ok(firstRelease, `${name} should open with a release section`);
      assert.equal(firstRelease[1], pkg.version, `${name} latest release should match package.json`);
    }
    assert.doesNotMatch(readme, /v1\.5 .* in progress/i);
  });

  it('makes the technical-writing family visible without overstating later-scope features', () => {
    assert.match(readme, /Technical writing:/);
    assert.match(gettingStarted, /runbook\? Procedures and system maps/);
    assert.match(workTypes, /Technical Guide \/ User Guide/);
    assert.match(workTypes, /Runbook \/ SOP/);
    assert.match(workTypes, /API or CLI Reference/);
    assert.match(workTypes, /Design Spec \/ Architecture Doc/);

    for (const doc of [readme, workTypes]) {
      assert.doesNotMatch(doc, /docs-site/i);
      assert.doesNotMatch(doc, /portal-oriented/i);
    }
  });
});
