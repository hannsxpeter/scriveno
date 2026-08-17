// Implements: P-MUST-01, P-MUST-04, P-MUST-05, P-MUST-07, P-MUST-08, P-MUST-10, P-MUST-11, P-MUST-12, P-MUST-13, P-MUST-14, P-MUST-15, P-MUST-17, P-MUST-18
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
    assert.match(clean, /--confirm-in-place/);
    assert.match(clean, /WebP.*AVIF.*HEIC.*BMP.*GIF.*TIFF.*BigTIFF.*XLSX.*PPTX/s);
    assert.match(clean, /declared.*HTML.*XHTML/is);
    assert.match(clean, /temporary sibling.*re-audit/is);
    assert.match(clean, /compression semantics/i);
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
    assert.match(clean, /ideographic variation selector|U\+E0100/i);
    assert.match(clean, /Mongolian vowel separator|U\+180E/i);
    assert.match(clean, /confirmed.*pre-audit/is);
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

  it('documents the opt-in provider contract, safe fallback, and upstream proof', () => {
    const guide = read('docs/provenance-hygiene.md');
    const proof = read('data/proof/provenance/README.md');
    const combinedCommands = audit + clean;

    for (const mode of ['--provider local', '--provider auto', '--provider watermarks-remover', '--require-provider']) {
      assert.ok(combinedCommands.includes(mode), `${mode} is not documented`);
    }
    for (const variable of ['SCRIVENO_WATERMARKS_SERVICE_URL', 'SCRIVENO_WATERMARKS_SERVICE_TOKEN']) {
      assert.ok((guide + combinedCommands).includes(variable), `${variable} is not documented`);
    }
    assert.match(guide + proof, /c2ac8eeef3ff1a17aaab0cdb86889c7ad21675a7/);
    assert.match(guide + proof, /v?0\.5\.0/);
    assert.match(guide, /health.*capabilit.*before.*upload/is);
    assert.match(guide, /redirects?.*refus/is);
    assert.match(guide, /loopback.*HTTP.*HTTPS/is);
    assert.match(guide, /private.*link-local.*multicast.*metadata/is);
    assert.match(guide + proof, /global-unicast/i);
    assert.match(guide + proof, /DNS.*continuously streaming HTTP.*directly tested/is);
    assert.match(guide + proof, /absolute request deadline.*connect.*TLS/is);
    assert.match(guide + proof, /stable.*handle.*digest/is);
    assert.match(guide + proof, /bounded iterative.*complexity/is);
    assert.match(guide + proof, /separate.*report.*clean.*response.*cap/is);
    assert.match(guide + proof, /strict.*kind-specific.*schema/is);
    assert.match(guide + proof, /every.*provider attempt/is);
    assert.match(proof, /protocol.*unchanged.*public textual evidence.*redact/is);
    assert.match(proof, /AI phrase marker.*AI cadence phrase.*uniform sentence cadence/is);
    assert.match(proof, /formulaic transition density.*n-gram density.*burstiness.*lexical diversity/is);
    assert.match(proof, /authoritative deterministic fields/i);
    assert.match(guide + proof, /untyped.*report\.findings.*post_findings.*ignored/is);
    assert.match(guide + proof, /summary booleans.*normalized summary findings/is);
    assert.match(guide, /stylometry.*ignored.*authoritative/is);
    assert.match(guide + combinedCommands, /fallback.*local/is);
    assert.match(guide + combinedCommands, /provider.*protected-content invariant/is);
    assert.match(guide + combinedCommands, /visible prose.*pixels.*frames.*loop.*ICC/is);
    assert.match(clean, /never.*pixel removal/is);
    assert.match(clean, /keep_non_ai_metadata.*true/is);
    assert.match(clean, /also_layer_a_text.*true/is);
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
    assert.match(guide, /scriveno provenance-clean/);
    assert.match(guide, /--confirm-in-place/);
    assert.match(guide, /declared.*HTML.*XHTML/is);
    assert.match(guide, /pixels.*frames.*loop.*ICC/is);
    assert.match(guide, /relationships.*styles.*media.*navigation.*accessibility/is);
    assert.match(guide, /MIME.*signature/is);
    assert.match(guide, /fresh.*archive/is);
    assert.match(guide, /duplicate.*name.*reject/is);
    assert.match(guide, /preAudit.*postAudit.*findingComparison/is);
    assert.match(guide, /code point.*remov.*replacement.*count/is);
    assert.match(guide, /BMP V5.*ICC/is);
    assert.match(guide, /nested.*AVIF.*HEIC.*residual/is);
    assert.match(guide, /peakWorkers|peak worker/i);
    assert.match(guide, /no_safe_change.*non-actionable/is);
    assert.match(guide + clean, /Exif.*Orientation.*preserv/is);
    assert.match(guide + clean, /JPEG XMP.*preserv.*alt text.*rights.*copyright.*accessibility/is);
    assert.match(guide + clean, /generator XMP.*residual.*field-level/is);
    assert.match(guide + clean, /COM.*exact.*remov/is);
    assert.match(guide + clean, /TIFF.*BigTIFF.*every.*IFD.*cycle.*count.*bounds/is);
    assert.match(guide + clean, /strip.*tile.*overlap.*residual/is);
    assert.match(guide, /findingComparison.*absolute location.*semantic identity/is);
    assert.match(guide, /occurrence-aware multiset/i);
    assert.match(guide, /Markdown.*preAudit.*postAudit.*schema.*status.*removed.*remaining.*added/is);
    assert.match(guide, /degraded pre-audit.*exit.*2/is);
    assert.match(guide, /does not.*humanizer/is);
    assert.match(authenticity, /\/scr:provenance-check/);
    assert.match(authenticity, /\/scr:provenance-clean/);
    assert.match(authenticity, /detector scores?.*context, not proof/is);
    assert.match(readme, /Provenance hygiene/i);
    assert.match(readme, /All 127 commands/);
    assert.match(changelog, /provenance-check/);
    assert.match(changelog, /provenance-clean/);
  });

  it('keeps repair safety fixtures explicit', () => {
    const fixtures = JSON.parse(read('test/fixtures/provenance/cases.json'));
    assert.deepStrictEqual(fixtures.protectedUnicodeCodePoints, ['U+180E', 'U+E0100']);
    assert.deepStrictEqual(fixtures.cleanReportFields, ['preAudit', 'postAudit', 'findingComparison']);
    assert.ok(fixtures.archiveApplyRefusals.includes('identical-duplicate'));
    assert.ok(fixtures.archiveApplyRefusals.includes('expansion'));
    assert.ok(fixtures.archiveApplyRefusals.includes('compression-ratio'));
    assert.ok(fixtures.archiveApplyRefusals.includes('unsupported-compression'));
  });

  it('documents conservative Stage 2 publication and parser boundaries', () => {
    const guide = read('docs/provenance-hygiene.md');
    const clean = read('commands/scr/provenance-clean.md');
    const combined = `${guide}\n${clean}`;

    assert.match(combined, /provider.*exact.*locally proven safe.*result/is);
    assert.match(combined, /PNG eXIf.*WebP XMP.*EXIF.*AVIF.*HEIC.*Exif.*XML.*GIF comment.*APP13.*mixed COM/is);
    assert.match(combined, /byte-for-byte.*residual/is);
    assert.match(combined, /local header.*central.*flags.*method.*CRC.*sizes.*offset.*data descriptor.*overlap.*normalized alias/is);
    assert.match(combined, /UTF-16.*BOM.*unchanged.*degraded/is);
    assert.match(combined, /script.*style.*byte-identical/is);
    assert.match(combined, /stable.*source.*device.*inode.*size.*hash/is);
    assert.match(combined, /whole batch.*rollback.*no partial outputs/is);
    assert.match(combined, /no-clobber.*report.*boundary.*revalidat/is);
    assert.match(combined, /data URI.*aggregate decoded bytes.*match count/is);
    assert.match(combined, /directory depth.*directory count/is);
    assert.match(combined, /Markdown.*escape.*external field/is);
    assert.match(combined, /rollback fail.*retain.*backup.*recovery path/is);
    assert.match(combined, /ISO BMFF.*c2pa.*jumb.*iloc.*unchanged/is);
    assert.match(combined, /fatal UTF-8.*ISO-8859-1.*unchanged.*degraded/is);
    assert.match(combined, /temporary.*final extension.*logical final path/is);
    assert.match(combined, /PNG.*exact whole-key.*protected.*residual/is);
    assert.match(combined, /GIF.*trailer.*JPEG.*EOI.*preserv/is);
  });
});
