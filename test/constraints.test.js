const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const constraintsPath = path.join(ROOT, 'data', 'CONSTRAINTS.json');
const pkgPath = path.join(ROOT, 'package.json');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('CONSTRAINTS.json schema integrity', () => {
  let constraints;
  let pkg;

  it('parses as valid JSON', () => {
    const raw = fs.readFileSync(constraintsPath, 'utf8');
    constraints = JSON.parse(raw);
    assert.equal(typeof constraints, 'object');
    assert.ok(constraints !== null);
  });

  it('has version matching package.json', () => {
    constraints = JSON.parse(fs.readFileSync(constraintsPath, 'utf8'));
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.equal(constraints.version, pkg.version);
  });

  it('aligns every 3.8.0 release surface and preserves the Node 20 floor', () => {
    const packageMetadata = JSON.parse(read('package.json'));
    const lock = JSON.parse(read('package-lock.json'));
    const template = JSON.parse(read('templates/config.json'));
    const constraintsMetadata = JSON.parse(read('data/CONSTRAINTS.json'));

    assert.equal(packageMetadata.version, '3.8.0');
    assert.equal(packageMetadata.engines.node, '>=20.0.0');
    assert.equal(packageMetadata.dependencies, undefined);
    assert.equal(lock.version, '3.8.0');
    assert.equal(lock.packages[''].version, '3.8.0');
    assert.equal(template.scriveno_version, '3.8.0');
    assert.equal(constraintsMetadata.version, '3.8.0');
    assert.match(read('commands/scr/new-work.md'), /"scriveno_version": "3\.8\.0"/);
    assert.match(read('docs/configuration.md'), /"scriveno_version": "3\.8\.0"/);
    assert.match(read('README.md'), /Version:\*\* 3\.8\.0/);
    assert.match(read('CHANGELOG.md'), /^## 3\.8\.0 - 2026-08-17/m);
    assert.match(read('docs/release-notes.md'), /^## 3\.8\.0 - 2026-08-17/m);
  });

  it('has required top-level keys', () => {
    constraints = JSON.parse(fs.readFileSync(constraintsPath, 'utf8'));
    assert.ok('work_type_groups' in constraints, 'missing work_type_groups');
    assert.ok('work_types' in constraints, 'missing work_types');
    assert.ok('commands' in constraints, 'missing commands');
  });

  it('every work_type references a valid group', () => {
    constraints = JSON.parse(fs.readFileSync(constraintsPath, 'utf8'));
    const groupKeys = Object.keys(constraints.work_type_groups);
    for (const [typeName, typeObj] of Object.entries(constraints.work_types)) {
      assert.ok(
        groupKeys.includes(typeObj.group),
        `work_type "${typeName}" references unknown group "${typeObj.group}"`
      );
    }
  });

  it('every group member exists in work_types', () => {
    constraints = JSON.parse(fs.readFileSync(constraintsPath, 'utf8'));
    const typeKeys = Object.keys(constraints.work_types);
    for (const [groupName, groupObj] of Object.entries(constraints.work_type_groups)) {
      for (const member of groupObj.members) {
        assert.ok(
          typeKeys.includes(member),
          `group "${groupName}" references unknown work_type "${member}"`
        );
      }
    }
  });

  it('every command references valid availability groups', () => {
    constraints = JSON.parse(fs.readFileSync(constraintsPath, 'utf8'));
    const groupKeys = Object.keys(constraints.work_type_groups);
    for (const [cmdName, cmdObj] of Object.entries(constraints.commands)) {
      if (!cmdObj.available) continue;
      for (const avail of cmdObj.available) {
        assert.ok(
          avail === 'all' || groupKeys.includes(avail),
          `command "${cmdName}" references unknown availability "${avail}"`
        );
      }
    }
  });

  it('every command entry is a command object with a category', () => {
    constraints = JSON.parse(fs.readFileSync(constraintsPath, 'utf8'));
    for (const [cmdName, cmdObj] of Object.entries(constraints.commands)) {
      assert.equal(
        typeof cmdObj,
        'object',
        `command "${cmdName}" must be an object, not ${typeof cmdObj}`
      );
      assert.ok(cmdObj !== null, `command "${cmdName}" must not be null`);
      assert.equal(
        typeof cmdObj.category,
        'string',
        `command "${cmdName}" must declare a category`
      );
      assert.ok(cmdObj.category.length > 0, `command "${cmdName}" category must not be empty`);
    }
  });

  it('every command file on disk is referenced in CONSTRAINTS.json', () => {
    constraints = JSON.parse(fs.readFileSync(constraintsPath, 'utf8'));
    const commandKeys = Object.keys(constraints.commands);
    const commandsDir = path.join(ROOT, 'commands', 'scr');

    // Check top-level .md files
    const topFiles = fs.readdirSync(commandsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''));

    // Check sacred/ subdirectory. Nested commands run as /scr:sacred:<name>
    // and are keyed in CONSTRAINTS.json as "sacred:<name>" so /scr:help can
    // emit the runnable slash-command path directly.
    const sacredDir = path.join(commandsDir, 'sacred');
    const sacredFiles = fs.existsSync(sacredDir)
      ? fs.readdirSync(sacredDir)
          .filter(f => f.endsWith('.md'))
          .map(f => `sacred:${f.replace('.md', '')}`)
      : [];

    const allFiles = [...topFiles, ...sacredFiles];
    for (const file of allFiles) {
      assert.ok(
        commandKeys.includes(file),
        `command file "${file}.md" has no entry in CONSTRAINTS.json`
      );
    }
  });
});
