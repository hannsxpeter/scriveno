// Implements: P-MUST-01, P-MUST-02, P-MUST-03, P-MUST-04, P-MUST-05, P-MUST-06, P-MUST-07, P-MUST-12, P-MUST-14, P-MUST-15, P-MUST-18
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('provenance hygiene command surface', () => {
  const audit = read('commands/scr/provenance-check.md');
  const clean = read('commands/scr/provenance-clean.md');
  const constraints = JSON.parse(read('data/CONSTRAINTS.json'));
  const reference = read('docs/command-reference.md');
  const help = read('commands/scr/help.md');

  it('ships separate read-only audit and dry-run cleaning commands', () => {
    assert.match(audit, /read-only/i);
    assert.match(audit, /must not modify/i);
    assert.match(audit, /PROVENANCE-AUDIT\.md/);
    assert.match(clean, /dry-run by default/i);
    assert.match(clean, /--apply/);
    assert.match(clean, /--in-place/);
    assert.match(clean, /\*\.cleaned\.\*/);
    assert.match(clean, /recoverable backup/i);
    assert.match(clean, /post-clean/i);
  });

  it('documents supported evidence classes and degraded capability lanes', () => {
    for (const token of ['confirmed', 'probable', 'informational', 'likely_false_positive']) {
      assert.match(audit, new RegExp(token));
    }
    for (const tool of ['c2patool', 'exiftool', 'qpdf']) {
      assert.match(audit + clean, new RegExp(tool));
    }
    assert.match(audit, /Markdown.*HTML.*SVG.*PNG.*JPEG.*PDF.*DOCX.*ODT.*EPUB/s);
    assert.match(audit, /degraded/i);
    assert.match(audit, /soft binding/i);
    assert.match(audit, /pixel-domain/i);
    assert.match(audit, /HTTP.*HTTPS.*read-only/s);
    assert.match(audit, /WebP.*AVIF.*HEIC.*BMP.*GIF.*TIFF.*BigTIFF.*XLSX.*PPTX/s);
    assert.match(audit, /--format <markdown\|json\|sarif>/);
    assert.match(audit, /--jobs/);
    assert.match(audit, /--output/);
    assert.match(audit, /--provider local/);
    assert.match(audit, /exit.*0.*1.*2.*64.*70/is);
  });

  it('protects binary files, canonical drafts, valid Unicode, and output paths', () => {
    assert.match(audit, /magic bytes/i);
    assert.match(audit, /must never.*binary.*text/is);
    assert.match(audit + clean, /script joiners/i);
    assert.match(audit + clean, /emoji/i);
    assert.match(clean, /symlink/i);
    assert.match(clean, /canonical.*draft/is);
    assert.match(clean, /ICC color profile/i);
  });

  it('preserves Voice DNA and rejects detector optimization', () => {
    assert.match(audit + clean, /STYLE-GUIDE\.md/);
    assert.match(audit + clean, /detector scores?.*context only/is);
    assert.match(audit + clean, /must not.*paraphrase/is);
    assert.match(audit + clean, /\/scr:line-edit/);
    assert.match(audit + clean, /\/scr:polish/);
    assert.match(audit + clean, /disclosure/i);
    assert.match(audit + clean, /must not.*human-written/is);
  });

  it('registers both commands for discovery and runtime installation', () => {
    for (const name of ['provenance-check', 'provenance-clean']) {
      assert.ok(constraints.commands[name], `${name} missing from command registry`);
      assert.deepStrictEqual(constraints.commands[name].available, ['all']);
      assert.ok(constraints.command_intents.publish.includes(name));
      assert.ok(constraints.command_intents.repair.includes(name));
      assert.ok(constraints.command_families.publishing.commands.includes(name));
      assert.ok(reference.includes(`### \`/scr:${name}\``));
      assert.match(help, new RegExp(`/scr:${name}`));
    }
    assert.match(reference, /Scriveno has \*\*127 commands\*\*/);
  });

  it('keeps the package dependency-free', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.equal(pkg.dependencies, undefined);
    assert.equal(pkg.engines.node, '>=20.0.0');
  });

  it('integrates optional provenance evidence without turning it into a publishing blocker', () => {
    const publish = read('commands/scr/publish.md');
    const prepublish = read('commands/scr/prepublish-review.md');

    assert.match(publish, /PROVENANCE-AUDIT\.md/);
    assert.match(publish, /optional hygiene evidence/i);
    assert.match(publish, /missing.*must not block/is);
    assert.match(publish, /\/scr:provenance-check/);
    assert.match(publish, /\/scr:provenance-clean/);
    assert.match(prepublish, /PROVENANCE-AUDIT\.md/);
    assert.match(prepublish, /optional hygiene gap/i);
    assert.match(prepublish, /not.*compliance violation/is);
  });

  it('keeps metadata hygiene separate from creation history and disclosure duties', () => {
    const compliance = read('commands/scr/compliance-check.md');
    const publishing = read('docs/publishing.md');

    assert.match(compliance, /PROVENANCE-AUDIT\.md/);
    assert.match(compliance, /metadata.*does not change.*creation history/is);
    assert.match(compliance, /evidence only/i);
    assert.match(publishing, /\/scr:provenance-check/);
    assert.match(publishing, /\/scr:provenance-clean/);
    assert.match(publishing, /does not change.*disclosure/is);
  });

  it('documents provenance hygiene and preserves the detector policy', () => {
    const guide = read('docs/provenance-hygiene.md');
    const authenticity = read('docs/authenticity-and-detectors.md');
    const readme = read('README.md');
    const changelog = read('CHANGELOG.md');

    assert.match(guide, /github\.com\/guillaumemeyer\/watermarks-remover/);
    assert.match(guide, /Markdown.*HTML.*SVG.*PNG.*JPEG.*PDF.*DOCX.*ODT.*EPUB/s);
    assert.match(guide, /WebP.*AVIF.*HEIC.*BMP.*GIF.*TIFF.*BigTIFF.*XLSX.*PPTX/s);
    assert.match(guide, /SARIF 2\.1\.0/);
    assert.match(guide, /compression ratio/i);
    assert.match(guide, /c2patool.*ExifTool.*qpdf/is);
    assert.match(guide, /residual risk/i);
    assert.match(guide, /cleaned cop(?:y|ies)/i);
    assert.match(guide, /does not.*humanizer/is);
    assert.match(authenticity, /\/scr:provenance-check/);
    assert.match(authenticity, /\/scr:provenance-clean/);
    assert.match(authenticity, /detector scores?.*context, not proof/is);
    assert.match(readme, /Provenance hygiene/i);
    assert.match(readme, /All 127 commands/);
    assert.match(changelog, /provenance-check/);
    assert.match(changelog, /provenance-clean/);
  });
});
