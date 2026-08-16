---
description: Run a final editorial go/no-go review before export or publishing.
argument-hint: "[--preset <preset>] [--strict]"
---

# /scr:prepublish-review -- Final Editorial Gate

Run a final manuscript-level editorial review before export, submission, or retail packaging. This is the human-facing editorial gate. It does not build files, draft front matter, draft back matter, or run publishing packages.

Use this command after the draft is complete and before `/scr:publish --preflight`, `/scr:publish`, `/scr:export`, `/scr:build-ebook`, or `/scr:build-print`.

## Usage

```
/scr:prepublish-review [--preset <preset>] [--strict]
```

- `--preset <preset>` tunes the review against the intended path, such as `kdp-ebook`, `kdp-paperback`, `ebook-wide`, `query-submission`, `submission-package`, `academic-submission`, `thesis-defense`, or `screenplay-query`.
- `--strict` treats unresolved high-severity editorial, voice, continuity, scaffold, or missing-matter issues as a stop recommendation instead of a warning.

## Instruction

You are the final editor before publishing. Your job is to give the writer a clear editorial go/no-go report, not to package the manuscript.

### STEP 0: BOOTSTRAP

Read `.manuscript/CONTEXT.md` first if it exists. If its `Updated` timestamp is newer than `.manuscript/STATE.md` and newer than the newest file in `.manuscript/drafts/body/`, use it for project title, work type, phase, current unit, recent activity, and open items. Still load the files named below when their exact content is needed for the review.

If CONTEXT.md is missing, stale, or contradicts STATE.md, fall back to direct file reads. See `docs/context-protocol.md` for the contract.

### STEP 1: LOAD CONTEXT

Load:

- `.manuscript/config.json` for `work_type`, `command_unit`, title, language, and platform settings
- Scriveno's installed/shared `CONSTRAINTS.json` to check work-type adaptations and publishing availability
- `.manuscript/STATE.md`
- `.manuscript/WORK.md`
- `.manuscript/OUTLINE.md`
- `.manuscript/STYLE-GUIDE.md` if it exists
- `.manuscript/RECORD.md` if it exists
- Drafted prose from `.manuscript/drafts/body/`
- Review reports from `.manuscript/reviews/`
- `.manuscript/reviews/PROVENANCE-AUDIT.md` when present, as optional artifact-hygiene evidence
- Voice, continuity, beta-reader, originality, sensitivity, line-edit, copy-edit, and polish reports when present, including legacy root-level originality or sensitivity reports from older projects
- `.manuscript/front-matter/` and `.manuscript/back-matter/` inventories
- `.manuscript/output/`, `.manuscript/build/`, and `.manuscript/marketing/` inventories for blurb, synopsis, query letter, cover assets, and prior exports

If no complete draft is recorded in STATE.md and the outline still has missing body drafts, stop and suggest `/scr:complete-draft`, `/scr:draft`, or `/scr:next` depending on what is missing.

### STEP 2: RESOLVE TARGET

If `--preset <preset>` is provided, tune the review to that destination:

- Retail ebook or wide ebook: reader experience, front/back matter, blurb, ebook cover, metadata, EPUB readiness
- Print: reader experience, front/back matter, print-cover handoff, trim/page-count expectations, interior review
- Query or submission: opening pages, synopsis, query letter, sample selection, standard manuscript format
- Academic or thesis: argument, evidence, citations, abstract, references, platform wrapper
- Screenplay query: screenplay completeness, Fountain/FDX readiness, synopsis, query material

If no preset is provided, run a destination-neutral review and include a "best next destination" recommendation.

### STEP 3: EDITORIAL READINESS CHECK

Review the whole manuscript at manuscript scale, not as isolated units:

1. **Structure and completion**: Confirm beginning, middle, ending, unit coverage, and whether any planned unit is missing or visibly scaffolded.
2. **Reader experience**: Identify pacing drops, weak openings, weak endings, unclear stakes, emotional flatness, repetition, or confusion points.
3. **Voice fidelity**: Compare the manuscript against STYLE-GUIDE.md. If STYLE-GUIDE.md is missing, warn that voice confidence is lower and suggest `/scr:profile-writer`.
4. **Continuity and record**: Check contradictions against RECORD.md, prior reviews, PLACES.md, GEOGRAPHY.md, character or adapted cast surfaces, and relevant world/subject surfaces.
5. **Line and copy readiness**: Look for repeated prose tics, typo clusters, punctuation problems, inconsistent names, and unresolved copy-edit findings.
6. **Publication matter**: Inventory front matter, back matter, blurb, synopsis, query letter, cover handoff assets, and prior export files. Report missing matter as a publishing-readiness issue, not as work this command will generate. For retail destinations, also check whether `.manuscript/reviews/PLATFORM-COMPLIANCE.md` exists and is current; if not, report the platform-policy gate as unchecked and route it to `/scr:compliance-check` rather than running policy checks here.
7. **Provenance hygiene**: Inventory `.manuscript/reviews/PROVENANCE-AUDIT.md`. If it is missing or older than the files it covered, report an optional hygiene gap and suggest `/scr:provenance-check`. A missing or stale provenance audit is not a compliance violation and must not change the editorial verdict by itself. If the audit names safe cleanup opportunities, suggest `/scr:provenance-clean` without running it.
8. **Open reports**: Scan prior review and diagnostic reports for unresolved high-severity items.

When issues are bounded by type, follow `docs/subagent-spawning-protocol.md` and spawn focused diagnostic workers only for the issue groups that need them:

- voice-diagnostic
- continuity-diagnostic
- structure-diagnostic
- copy-diagnostic
- publishing-readiness-diagnostic

If native worker spawning is unavailable, run the selected diagnostics in isolated fresh contexts sequentially and report `prompt-run fallback used`.

### STEP 4: CLASSIFY FINDINGS

Classify each finding:

- `BLOCKER`: Publishing or submission should stop until fixed.
- `MAJOR`: Strongly fix before publication, but writer may choose to proceed.
- `MINOR`: Optional polish or presentation issue.
- `READY`: No action needed.

In `--strict` mode, unresolved `MAJOR` findings in voice, continuity, scaffold cleanup, or destination-critical matter become a stop recommendation.

Do not rewrite the manuscript in this command. Give precise next commands and file targets instead.

### STEP 5: WRITE REPORT

Write `.manuscript/reviews/PREPUBLISH-REVIEW.md`.

Use this structure:

```markdown
# Prepublish Review

## Verdict

GO / GO WITH FIXES / STOP

## Target

Preset or destination reviewed.

## Editorial Readiness

Summary of structure, reader experience, voice, continuity, and prose readiness.

## Publishing Readiness

Matter, marketing, cover, export, and package readiness.

## Findings

| Severity | Area | Finding | Recommended command |
|---|---|---|---|

## Required Before Publishing

Concrete blocking fixes, or `(none)`.

## Recommended Before Publishing

High-value fixes that are not blockers.

## Suggested Next Route

The next one to four runnable Scriveno commands.
```

### STEP 6: FINAL RESPONSE

Show a compact summary:

- Verdict: `GO`, `GO WITH FIXES`, or `STOP`
- Report path: `.manuscript/reviews/PREPUBLISH-REVIEW.md`
- Top blockers or `(none)`
- Top recommended fixes or `(none)`
- Whether `/scr:publish --preflight` is the right next technical gate

## Automation Status

Every response must include a compact status block:

```text
Automation status:
Trigger: /scr:prepublish-review {scope}
Auto-invoked commands:
- none
Spawned agents:
- diagnostic workers: {count, none, or prompt-run fallback used}
Local operations:
- manuscript read-through: yes/no
- report written: yes/no
- export package files written: none
Manual gates:
- publishing decision: writer-owned
Why: prepublish-review is an editorial go/no-go gate; it does not package or overwrite deliverables
```

## Response Contract

Every writer-facing response must end with one to four next-command suggestions. Each suggestion must include a short explanation of what that path will do.

The final visible section of every writer-facing response must be the `Next commands:` block. This applies to successful completion, partial completion, blocked, stopped, validation-failed, and prerequisite-missing responses. Do not end with only a summary, report, checklist, external action, upload instruction, or prose-only options.

Use the invocation style for the active runtime when writing command suggestions. Source command IDs use `/scr:*`; Claude Code installed commands use `/scr-*`; Codex installed skills use `$scr-*`. Suggest only runnable Scriveno commands that exist in the installed command surface. Do not invent adjacent workflow names.

Use this format:

```markdown
Next commands:
- `/scr:...`: One short sentence explaining what this path will do.
- `/scr:...`: One short sentence explaining what this alternate path will do.
```

If exactly one path is clearly best, provide one suggestion. If two, three, or four useful paths exist, show them as alternatives. Do not force a linear path when the writer has a real choice.

If the writer seems unsure or no specific next command is obvious, include this default option:

```markdown
Next commands:
- `/scr:next`: Inspect the project state and choose the right next step.
```

If the command stops because a prerequisite is missing, suggest the command that fixes the prerequisite. Keep every explanation practical and writer-facing.
