const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('Phase 47: runtime sync command', () => {
  it('ships /scr:sync as a utility command', () => {
    const command = read('commands/scr/sync.md');
    const constraints = JSON.parse(read('data/CONSTRAINTS.json'));

    assert.match(command, /^# Sync/m);
    assert.equal(constraints.commands.sync.category, 'utility');
    assert.deepEqual(constraints.commands.sync.available, ['all']);
    assert.match(constraints.commands.sync.description, /Synchronize installed Scriveno runtime commands/);
  });

  it('keeps sync distinct from update or package upgrade behavior', () => {
    const command = read('commands/scr/sync.md');

    assert.match(command, /This is not a package upgrade command/);
    assert.match(command, /Do not fetch a newer Scriveno release/);
    assert.match(command, /npx @hxp-tools\/scriveno@latest --detected --global --writer --silent/);
    assert.doesNotMatch(command, /\/scr:update/);
    assert.match(command, /do not modify manuscript content/i);
  });

  it('uses the existing installer as the sync engine', () => {
    const command = read('commands/scr/sync.md');
    const installer = read('bin/install.js');

    assert.match(command, /node bin\/install\.js --runtime <key> --global --writer --silent/);
    assert.match(command, /Use `--detected` instead of `--runtime <key>`/);
    assert.match(installer, /--runtime <key>/);
    assert.match(installer, /--detected/);
    assert.match(installer, /--silent/);
  });

  it('verifies Codex command mirrors and generated skills', () => {
    const command = read('commands/scr/sync.md');

    assert.match(command, /~\/\.codex\/commands\/scr\/sync\.md/);
    assert.match(command, /~\/\.codex\/skills\/scr-sync\/SKILL\.md/);
    assert.match(command, /generated Codex `SKILL\.md` wrappers/);
    assert.match(command, /Codex agent metadata/);
  });

  it('verifies non-Codex runtime command, skill, guide, and agent surfaces', () => {
    const command = read('commands/scr/sync.md');

    assert.match(command, /Claude Code flat commands/);
    assert.match(command, /standard command-directory runtimes/);
    assert.match(command, /skills runtimes/);
    assert.match(command, /guided setup assets/);
    assert.match(command, /agent prompts are present/);
    assert.match(command, /Perplexity Desktop/);
    assert.match(command, /Generic skills fallback/);
  });

  it('documents dry-run and apply modes with runtime targeting', () => {
    const command = read('commands/scr/sync.md');

    assert.match(command, /\/scr:sync --check/);
    assert.match(command, /\/scr:sync --apply --runtime codex --global --developer/);
    assert.match(command, /\/scr:sync --apply --detected --global --writer/);
    assert.match(command, /`--check`: report only/);
    assert.match(command, /`--apply`: run the installer/);
  });

  it('requires a visible sync status trail instead of implying a background agent', () => {
    const command = read('commands/scr/sync.md');

    assert.match(command, /Sync status:/);
    assert.match(command, /Agent: none/);
    assert.match(command, /runtime sync is installer-driven/);
    assert.match(command, /Engine: bin\/install\.js/);
    assert.match(command, /Updated: none/);
  });
});
