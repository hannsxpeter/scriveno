# Authenticity And AI Detectors

Scriveno treats external AI-detector scores as context, not proof. A detector report can help point attention at a passage, but it cannot prove authorship and it must not become the target of a rewrite.

The product goal stays the same: drafted prose should sound like the writer, preserve the writer's process, and keep all claims grounded in accepted project context.

## Research Stance

Current public evidence supports a cautious stance:

- OpenAI discontinued its own AI text classifier and noted that neural classifiers can be poorly calibrated outside their training data. See [OpenAI's classifier note](https://openai.com/blog/new-ai-classifier-for-indicating-ai-written-text?o=8874%2Fembed).
- Turnitin's current guide says scores below its 20 percent display threshold are not surfaced to avoid potential false positives. See [Turnitin's AI writing report guide](https://guides.turnitin.com/hc/en-us/articles/22774058814093-Using-the-AI-Writing-Report).
- Stanford HAI summarizes research finding that GPT detectors can misclassify non-native English writing at much higher rates than native English samples. See [Stanford HAI on detector bias](https://hai.stanford.edu/news/ai-detectors-biased-against-non-native-english-writers?sf178182184=1) and the [Patterns paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC10382961/).
- NBER's 2025 work on automated detection frames practical detector use around false positives and false negatives, not single-score certainty. See [Artificial Writing and Automated Detection](https://www.nber.org/papers/w34223).
- NIST's GenAI pilot work treats detector evaluation as an evolving benchmark problem, with task, model, and evaluation-method differences still mattering. See [NIST GenAI text-to-text evaluation](https://www.nist.gov/publications/2024-nist-genai-pilot-study-text-text-evaluation-overview-and-results).

That does not mean every detector is useless. It means Scriveno should never promise a detector result, chase a threshold, or read a score as a verdict.

## What A High Detector Score Can Mean

A high external score may point to real craft problems:

- uniform sentence lengths or paragraph shapes
- generic transitions and tidy closing moves
- polished but unsupported generality
- too many balanced-both-sides constructions
- a register shift that does not match STYLE-GUIDE.md
- a pasted or over-smoothed section that breaks the manuscript's own baseline

It may also be a false positive. Formal, technical, academic, translated, constrained, sacred, or non-native English prose can be clean and predictable for valid reasons. A correct register is not a flaw.

## Scriveno Policy

The project config records this policy:

```json
"authenticity": {
  "external_detector_scores": "context_only",
  "preserve_process_evidence": true,
  "detector_optimization": "never"
}
```

This means:

- External detector scores may be recorded in reports, but they do not set Scriveno's score.
- Diagnostics inspect the prose itself, with STYLE-GUIDE.md as the voice authority.
- Rewrite commands fix visible craft problems only.
- Process artifacts matter: STYLE-GUIDE.md, plans, drafts, reviews, HISTORY.log, saves, and accepted revisions are authorship evidence.
- Scriveno does not launder prose through a humanizer and does not optimize for detector thresholds.

## Recommended Workflow

When a manuscript or chapter receives a high external detector score:

1. Record the detector context: detector name, score, date, text scope, and highlighted spans if available.
2. Run `/scr:voice-check [N]` to compare the passage against STYLE-GUIDE.md.
3. Run `/scr:originality-check [N]` to inspect AI-pattern clusters, internal seams, and familiar published-work echoes.
4. If findings are real, use `/scr:line-edit [N]` or `/scr:polish [N]` with light or mixed pressure. Fix only clustered uniformity, unsupported smoothness, generic transitions, or off-voice seams.
5. Re-run the diagnostic as a fresh read.
6. Preserve process evidence instead of chasing a vendor score.

For invisible markers or file metadata, use `/scr:provenance-check` for a read-only audit and `/scr:provenance-clean` for a dry-run cleanup plan. These commands operate on artifact hygiene, not prose style. They do not improve or validate detector scores, which remain context, not proof.

If a detector report flags the whole manuscript, do not rewrite the whole manuscript by default. Scope the review by chapter or by highlighted span. Whole-manuscript rewrites are where a new, mechanical humanizer signature is most likely to appear.

## What Not To Do

- Do not ask Scriveno to "beat" a detector.
- Do not rewrite clean formal prose into casual prose if the work type requires precision.
- Do not add typos, filler, fake personal asides, contractions, slang, or random fragments to seem human.
- Do not replace one machine cadence with a humanizer cadence.
- Do not remove a writer's authentic habits because a generic catalog says they are suspicious.
- Do not use a detector score as an accusation.

## What To Preserve

Good authorship evidence is boring and durable:

- style calibration
- dated plans
- incremental drafts
- review reports
- line-edit and polish reports
- save history
- accepted revision notes
- research notes and source boundaries

That evidence does not guarantee how an external tool will score the text. It does show the work was made through a real writing process.

## See Also

- [Drafter Quality](drafter-quality.md)
- [Voice DNA](voice-dna.md)
- [Proof Artifacts](proof-artifacts.md)
- [Runtime Support](runtime-support.md)
- [Provenance Hygiene](provenance-hygiene.md)
