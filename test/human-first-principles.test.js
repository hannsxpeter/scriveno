const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('human-first prose principles', () => {
  it('WRITING-RULES preserves human-first text and factual integrity', () => {
    const rules = read('templates/WRITING-RULES.md');

    assert.match(rules, /### Human-first restraint/);
    assert.match(rules, /Do not over-correct prose that already sounds like the writer/);
    assert.match(rules, /Isolated signals are not enough/);
    assert.match(rules, /### Detector-aware authenticity/);
    assert.match(rules, /External AI-detector scores are context, not a target/);
    assert.match(rules, /False positives can cluster around clean, formal, constrained, translated, or non-native English prose/);
    assert.match(rules, /Preserve process evidence/);
    assert.match(rules, /### Factual integrity and content preservation/);
    assert.match(rules, /Do not invent facts, names, numbers, sources, quotes, dates, prices, examples, locations, or claims/);
    assert.match(rules, /Do not truncate, skip paragraphs, compress away obligations, or replace concrete content with a prettier generalization/);
  });

  it('WRITING-RULES covers register restraint, artifact cleanup, and durable docs', () => {
    const rules = read('templates/WRITING-RULES.md');

    assert.match(rules, /### Register-aware restraint/);
    assert.match(rules, /Academic, technical, legal, sacred, journalistic, and quoted material should not be casualized/);
    assert.match(rules, /### Chat artifacts and placeholder contamination/);
    assert.match(rules, /Remove chatbot wrapper text/);
    assert.match(rules, /### Diff-anchored explanation/);
    assert.match(rules, /describe what is true now, not what changed from an older version/);
  });

  it('WRITING-RULES captures humanizer variance and stance principles', () => {
    const rules = read('templates/WRITING-RULES.md');

    assert.match(rules, /### Variance over substitution/);
    assert.match(rules, /Do not fix AI-sounding prose by swapping one suspect word for another everywhere/);
    assert.match(rules, /Do not install a new humanizer signature/);
    assert.match(rules, /Audit soft inference as carefully as hard facts/);
    assert.match(rules, /### Stance discipline/);
    assert.match(rules, /Stance may react to content already present/);
    assert.match(rules, /name one to three things deliberately left alone/);
  });

  it('drafter refuses unsupported detail and required-content loss', () => {
    const drafter = read('agents/drafter.md');

    assert.match(drafter, /\*\*Factual integrity\.\*\*/);
    assert.match(drafter, /Do not add facts, names, dates, numbers, citations, prices, historical details, technical behavior, doctrinal claims, or examples/);
    assert.match(drafter, /Did you preserve every required beat from the plan without truncating, skipping, or replacing concrete content/);
    assert.match(drafter, /\*\*Stance stays sourced\.\*\*/);
    assert.match(drafter, /\*\*Variance over substitution\.\*\*/);
    assert.match(drafter, /\*\*Detector-aware authenticity\.\*\*/);
    assert.match(drafter, /\*\*Preserve earned roughness\.\*\*/);
    assert.match(drafter, /Did you avoid adding soft inferences/);
    assert.match(drafter, /If an external detector score was mentioned, did you treat it as context only/);
    assert.match(drafter, /\*\*Never invent support\.\*\*/);
    assert.match(drafter, /\*\*Never truncate the required content\.\*\*/);
  });

  it('voice checker distinguishes clustered AI tells from human markers', () => {
    const checker = read('agents/voice-checker.md');

    assert.match(checker, /Use density, not isolated tells/);
    assert.match(checker, /If the passage contains strong human markers/);
    assert.match(checker, /humanizer signature/);
    assert.match(checker, /### Content integrity/);
    assert.match(checker, /\*\*No invented support\.\*\*/);
    assert.match(checker, /\*\*No soft-inference drift\.\*\*/);
    assert.match(checker, /\*\*No truncation\.\*\*/);
    assert.match(checker, /\*\*Register restraint\.\*\*/);
    assert.match(checker, /\*\*Stance discipline\.\*\*/);
    assert.match(checker, /\*\*External detector context\.\*\*/);
    assert.match(checker, /PROCESS EVIDENCE/);
  });

  it('line-edit uses edit pressure before rewriting', () => {
    const lineEdit = read('commands/scr/line-edit.md');

    assert.match(lineEdit, /### STEP 2: CHOOSE EDIT PRESSURE/);
    assert.match(lineEdit, /\*\*Light:\*\* The prose already sounds like the writer/);
    assert.match(lineEdit, /\*\*Mixed:\*\*/);
    assert.match(lineEdit, /\*\*Full:\*\*/);
    assert.match(lineEdit, /Do not over-correct fragments, mixed feelings, self-corrections, uneven rhythm, or writer-specific tics/);
    assert.match(lineEdit, /deliberately left alone/);
    assert.match(lineEdit, /Verify that suggestions preserve all meaning in the original passage/);
    assert.match(lineEdit, /Check soft inference/);
    assert.match(lineEdit, /humanized.*cadence/);
    assert.match(lineEdit, /external detector score/i);
    assert.match(lineEdit, /Do not optimize for external detector scores/);
  });

  it('polish reports restraint and meaning checks', () => {
    const polish = read('commands/scr/polish.md');

    assert.match(polish, /choose polish pressure: light, mixed, or full/);
    assert.match(polish, /name what you deliberately left alone/);
    assert.match(polish, /Flag humanizer signatures/);
    assert.match(polish, /\*\*Deliberately Left Alone\*\*/);
    assert.match(polish, /\*\*Meaning Check\*\*/);
    assert.match(polish, /\*\*External Detector Context\*\*/);
    assert.match(polish, /\*\*Process Evidence\*\*/);
    assert.match(polish, /soft-inference drift/);
  });

  it('copy-edit enforces Scriveno dash policy instead of normalizing em dashes', () => {
    const copyEdit = read('commands/scr/copy-edit.md');

    assert.match(copyEdit, /\*\*Dash policy\*\*/);
    assert.match(copyEdit, /Flag em dashes and en dashes as prohibited by Scriveno writing policy/);
    assert.doesNotMatch(copyEdit, /Check consistency of em-dash style/);
  });

  it('detector guidance documents research stance and workflow boundaries', () => {
    const doc = read('docs/authenticity-and-detectors.md');

    assert.match(doc, /OpenAI discontinued its own AI text classifier/);
    assert.match(doc, /Turnitin's current guide/);
    assert.match(doc, /Stanford HAI/);
    assert.match(doc, /NBER's 2025 work/);
    assert.match(doc, /NIST's GenAI pilot/);
    assert.match(doc, /external_detector_scores/);
    assert.match(doc, /detector_optimization/);
    assert.match(doc, /process evidence/i);
    assert.match(doc, /Do not ask Scriveno to "beat" a detector/);
  });

  it('workflow optimization audit includes the detector-aware authenticity follow-up', () => {
    const audit = read('docs/workflow-optimization-audit.md');
    const releaseNotes = read('docs/release-notes.md');
    const readme = read('README.md');

    assert.match(audit, /### 6\. Detector-Aware Authenticity Flow/);
    assert.match(audit, /outside AI-detector reports become context, process evidence, and craft review/);
    assert.match(audit, /\[Authenticity And AI Detectors\]\(authenticity-and-detectors\.md\)/);
    assert.match(audit, /without turning Scriveno into a detector-gaming tool/);
    assert.match(releaseNotes, /Detector anxiety stays inside the authenticity workflow/);
    assert.match(readme, /Consolidation, redundancy, authenticity, and journey-surface findings/);
  });
});

describe('authenticity-check diagnostic discipline', () => {
  it('WRITING-RULES carries a diagnostic-discipline section', () => {
    const rules = read('templates/WRITING-RULES.md');

    assert.match(rules, /## Diagnostic discipline \(honest read\)/);
    assert.match(rules, /\*\*Diagnose, do not rewrite\.\*\*/);
    assert.match(rules, /\*\*Uniformity is the signal\.\*\*/);
    assert.match(rules, /\*\*Restraint over reach\.\*\*/);
    assert.match(rules, /Over-flagging genuine human prose is the worst error a diagnostic can make/);
    assert.match(rules, /\*\*No diagnostic signature\.\*\*/);
    assert.match(rules, /not tuned to defeat any plagiarism or AI-detection system and names none/);
    assert.match(rules, /External detector scores may be recorded as context only/);
    assert.match(rules, /never carry a target score into the rewrite/);
  });

  it('voice-checker runs the diagnostic discipline and reports a band', () => {
    const checker = read('agents/voice-checker.md');

    assert.match(checker, /## Diagnostic discipline/);
    assert.match(checker, /You diagnose\. You do not rewrite\./);
    assert.match(checker, /\*\*Uniformity is the signal\.\*\*/);
    assert.match(checker, /\*\*Scrutiny pre-check\.\*\*/);
    assert.match(checker, /\*\*False-positive audit has veto power\.\*\*/);
    assert.match(checker, /\*\*Internal-consistency check\.\*\*/);
    assert.match(checker, /\*\*Anti-signature in your own diagnosis\.\*\*/);
    assert.match(checker, /Authenticity: Reads human/);
    assert.match(checker, /READS AS HUMAN \(deliberately not flagged\)/);
    assert.match(checker, /EXTERNAL DETECTOR CONTEXT/);
    assert.match(checker, /PROCESS EVIDENCE/);
    assert.match(checker, /CAVEAT/);
    assert.match(checker, /Start from a neutral ~70/);
  });

  it('originality-check is diagnose-only with a band, passes, and required sections', () => {
    const orig = read('commands/scr/originality-check.md');

    assert.match(orig, /### SCRUTINY PRE-CHECK \(do this first, every run\)/);
    assert.match(orig, /### PASS 2: False-positive audit \(has veto power over Pass 1\)/);
    assert.match(orig, /### PASS 3: Internal-consistency \(read-only, no lookups\)/);
    assert.match(orig, /Authenticity: Reads human \| Mixed signals \| Reads AI-generated/);
    assert.match(orig, /## Reads as human \(deliberately not flagged\)/);
    assert.match(orig, /## External detector context/);
    assert.match(orig, /## Process evidence/);
    assert.match(orig, /## Caveats/);
    assert.match(orig, /diagnose -> decide -> transform -> re-verify/);
    assert.match(orig, /not tuned to defeat any plagiarism or AI-detection system and names none/);
    assert.doesNotMatch(orig, /Suggested revision/);
  });

  it('voice-check aligns to the authenticity bands and stays diagnose-only', () => {
    const vc = read('commands/scr/voice-check.md');

    assert.match(vc, /90-100 -- Reads human/);
    assert.match(vc, /75-89 -- Mixed signals/);
    assert.match(vc, /this is voice-deviation framing/);
    assert.match(vc, /Reads as human \(deliberately not flagged\)/);
    assert.match(vc, /\*\*External detector context\*\*/);
    assert.match(vc, /\*\*Process evidence\*\*/);
    assert.match(vc, /\*\*Caveat\*\*/);
    assert.match(vc, /Recommendations are handoffs, not rewrites/);
    assert.match(vc, /names none/);
  });

  it('drafter self-check is not a score-then-rewrite loop', () => {
    const drafter = read('agents/drafter.md');

    assert.match(drafter, /This self-check is a write-to-the-voice judgement, not a score-then-rewrite optimization loop/);
    assert.match(drafter, /never to move an AI-slop score or an external detector score/);
  });

  it('release metadata is aligned on 3.7.0', () => {
    const pkg = JSON.parse(read('package.json'));
    const cfg = JSON.parse(read('templates/config.json'));
    const constraints = JSON.parse(read('data/CONSTRAINTS.json'));

    assert.equal(pkg.version, '3.7.0');
    assert.equal(cfg.scriveno_version, '3.7.0');
    assert.equal(constraints.version, '3.7.0');
    assert.match(read('CHANGELOG.md'), /## 3\.2\.3 - /);
    assert.match(read('docs/release-notes.md'), /## 3\.2\.3 - /);
  });
});
