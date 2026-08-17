const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

describe('package.json fields', () => {
  it('has correct name', () => {
    assert.equal(pkg.name, 'scriveno');
    assert.equal(pkg.version, '3.8.0');
  });

  it('has bin entry pointing to install.js', () => {
    assert.equal(pkg.bin.scriveno, 'bin/install.js');
  });

  it('has engines field', () => {
    assert.ok(pkg.engines.node, 'engines.node should be defined');
    assert.equal(pkg.engines.node, '>=20.0.0');
  });

  it('has publishConfig with public access', () => {
    assert.equal(pkg.publishConfig.access, 'public');
  });

  it('has files array', () => {
    assert.ok(Array.isArray(pkg.files), 'files should be an array');
    assert.ok(
      pkg.files.includes('data/'),
      'files should include "data/"'
    );
  });

  it('has test script', () => {
    assert.ok(
      pkg.scripts.test.includes('node --test'),
      'test script should use node --test'
    );
  });

  it('has prepublishOnly script', () => {
    assert.equal(pkg.scripts.prepublishOnly, 'npm run release:check');
    assert.equal(pkg.scripts['release:check'], 'npm test && npm run policy:check && npm run pack:repro && npm run pack:check');
    assert.equal(pkg.scripts['policy:check'], 'node scripts/check-writing-policy.js');
    assert.equal(pkg.scripts['pack:repro'], 'node scripts/check-pack-reproducibility.js');
    assert.equal(pkg.scripts['pack:check'], 'npm pack --dry-run');
  });
});

describe('bin/install.js', () => {
  it('has shebang line', () => {
    const installPath = path.join(__dirname, '..', 'bin', 'install.js');
    const firstLine = fs.readFileSync(installPath, 'utf-8').split('\n')[0];
    assert.equal(firstLine, '#!/usr/bin/env node');
  });
});

describe('npm pack dry-run', () => {
  let packFiles;

  // Run npm pack once and reuse the file list
  before(() => {
    const packOutput = execSync('npm pack --dry-run --json', {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..'),
    });
    const [{ files }] = JSON.parse(packOutput);
    packFiles = new Set(files.map((file) => file.path));
  });

  it('includes all critical directories', () => {
    const expectedEntries = [
      'bin/install.js',
      'lib/auto-invoke-engine.js',
      'lib/provenance-audit.js',
      'lib/provenance-provider.js',
      'lib/provenance-clean.js',
      'data/CONSTRAINTS.json',
      'data/proof/provenance/provider-fixture.js',
      'data/proof/provenance/README.md',
      'scripts/check-writing-policy.js',
      'scripts/check-pack-reproducibility.js',
      'commands/scr/demo.md',
      'commands/scr/provenance-check.md',
      'commands/scr/provenance-clean.md',
      'docs/provenance-hygiene.md',
      'templates/STYLE-GUIDE.md',
      'templates/technical/DOC-BRIEF.md',
    ];
    for (const entry of expectedEntries) {
      assert.ok(
        packFiles.has(entry),
        `npm pack output should include "${entry}"`
      );
    }

    assert.ok(
      Array.from(packFiles).some((entry) => entry.startsWith('agents/')),
      'npm pack output should include files from "agents/"'
    );
  });

  it('packages executable agents without project context pillars', () => {
    for (const name of ['continuity-checker', 'drafter', 'plan-checker', 'researcher', 'translator', 'voice-checker']) {
      assert.ok(packFiles.has(`agents/${name}.md`), `npm pack should include agents/${name}.md`);
    }
    for (const name of ['api', 'arch', 'auth', 'context', 'data', 'deploy', 'development', 'observe', 'quality', 'release', 'repo', 'stack', 'ui']) {
      assert.ok(!packFiles.has(`agents/${name}.md`), `npm pack should exclude project pillar agents/${name}.md`);
    }
    assert.ok(!packFiles.has('agents/catalog.yaml'), 'npm pack should exclude the project pillar catalog');
  });

  it('includes demo manuscript files', () => {
    assert.ok(
      packFiles.has('data/demo/.manuscript/STYLE-GUIDE.md'),
      'npm pack should include dotfile directory data/demo/.manuscript/'
    );
  });

  it('includes proof artifact bundles', () => {
    const expectedEntries = [
      'data/proof/watchmaker-flow/README.md',
      'data/proof/first-run/README.md',
      'data/proof/runtime-parity/README.md',
      'data/proof/voice-dna/README.md',
      'data/proof/voice-dna/STYLE-GUIDE-EXCERPT.md',
      'data/proof/voice-dna/UNGUIDED-SAMPLE.md',
      'data/proof/voice-dna/GUIDED-SAMPLE.md',
    ];

    for (const entry of expectedEntries) {
      assert.ok(
        packFiles.has(entry),
        `npm pack output should include "${entry}"`
      );
    }
  });

  it('includes currently shipped export templates', () => {
    const expectedEntries = [
      'data/export-templates/scriveno-book.typst',
      'data/export-templates/scriveno-epub.css',
      'data/export-templates/scriveno-academic.latex',
    ];

    for (const entry of expectedEntries) {
      assert.ok(
        packFiles.has(entry),
        `npm pack output should include "${entry}"`
      );
    }
  });
});
