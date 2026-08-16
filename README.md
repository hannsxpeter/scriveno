# Scriveno

[![CI](https://github.com/hannsxpeter/scriveno/actions/workflows/ci.yml/badge.svg)](https://github.com/hannsxpeter/scriveno/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-3.7.0-blue)](CHANGELOG.md)
[![npm](https://img.shields.io/npm/v/scriveno.svg)](https://www.npmjs.com/package/scriveno)
[![Downloads](https://img.shields.io/npm/dm/scriveno.svg)](https://www.npmjs.com/package/scriveno)
[![Status CLI](https://img.shields.io/badge/status%20CLI-scriveno%20status-blue)](docs/runtime-support.md#shared-auto-invoke-engine)
[![Route Intelligence](https://img.shields.io/badge/route%20intelligence-agent%20lanes-blue)](docs/auto-invoke-policy.md)
[![Runtime Smoke](https://img.shields.io/badge/runtime%20smoke-install%20checks-blue)](docs/runtime-support.md#runtime-smoke-and-agent-checks)
[![Safe Apply](https://img.shields.io/badge/safe%20apply-visible%20gates-blue)](docs/auto-invoke-policy.md#safe-apply-and-audit-commands)
[![First Run](https://img.shields.io/badge/first%20run-executable%20proof-blue)](docs/quick-proof.md)
[![Quick Proof](https://img.shields.io/badge/quick%20proof-10%20minute%20path-blue)](docs/quick-proof.md)
[![Starter Sets](https://img.shields.io/badge/starter%20sets-goal%20paths-blue)](docs/starter-sets.md)

**[scriveno on npm](https://www.npmjs.com/package/scriveno)**

**Spec-driven writing, publishing, and translation for AI coding agents.**

*I don't outline -- Claude does. I don't edit -- Claude does. I don't format -- Claude does. I just write.*

Scriveno brings spec-driven workflows to longform writing. It runs inside your AI coding agent (Claude Code, Cursor, Gemini CLI, and more) and also ships a guided Perplexity Desktop setup path for file-aware support without overstating parity.

Scriveno is best understood as **AI-native longform writing software built around voice preservation**. Its core promise is narrow and high-stakes: drafted prose should sound like the writer, not like AI. The first path is intentionally small: first-run, demo, next, draft, review, save. The range comes after trust is earned: the same engine adapts to technical, sacred, visual, translation, and publishing workflows without forcing them into a novel-shaped template. If you want evidence before features, start with the [Quick Proof](docs/quick-proof.md), then inspect the [Proof Artifacts](docs/proof-artifacts.md), [Proof Badges](docs/proof-badges.md), and [Versatility Paths](docs/versatility-paths.md).

```bash
npx scriveno@latest

# Optional zero-install project status checks
npx scriveno@latest status --project .
npx scriveno@latest sync --check
```

The bare `scriveno ...` CLI exists after a global npm install or while developing from a local checkout. If you only ran `npx scriveno@latest`, keep using `npx scriveno@latest <command>` for terminal checks.

---

## What is this

Scriveno is a command system that turns your AI coding agent into a voice-preserving writing studio. Lead with one path: a writer can start a manuscript, calibrate voice, draft unit by unit, review, save, and publish without learning the full catalog. Then show the versatility: Scriveno supports 50 work types -- novels, screenplays, research papers, technical guides, runbooks, scripture commentaries, comics, memoirs -- each with its own adaptive vocabulary and toolset.

The wedge comes first: Scriveno profiles the writer, loads that voice into every drafting step, and keeps each unit on fresh context so the prose stays specific to the project. From there, it expands into 127 writing commands covering the rest of the pipeline:

- **Create** -- Set up a project with tailored context files. Progressive onboarding, never overwhelming.
- **Write** -- Discuss, plan, draft, and revise one unit at a time. The drafter agent loads your Voice DNA and writes in *your* voice, not generic AI prose. Run `/scr:progress` any time to open a per-unit ledger (`.manuscript/PROGRESS.md`) showing what is done, in progress, and untouched.
- **World and research** -- Build characters, peoples, places, geography, relationship maps, and neutral research notes that stay advisory until the writer accepts them.
- **Polish** -- Editor review, line edit, copy edit, continuity check, voice check, beta reader simulation, sensitivity review.
- **Publish** -- Prepublish review, provenance audits and cleaning, front/back matter, cover art, blurbs, query letters, KDP packages, IngramSpark packages, EPUB, PDF, Fountain, Final Draft, LaTeX.
- **Translate** -- Deep translation with glossary management, cultural adaptation, back-translation verification, multi-language simultaneous publishing.
- **Collaborate** -- Parallel revision tracks, co-writing workflows, continuity merge checking.

Everything adapts to your work type. A novel uses `/scr:draft` for chapters. A screenplay uses `/scr:draft` for acts. A Quran commentary uses `/scr:draft` for surahs. Same command, tradition-native vocabulary.

---

## Quick start

```bash
# Install
npx scriveno@latest

# In Claude Code, use the narrow proof path first:
/scr-first-run
/scr-demo
/scr-next
/scr-draft 5
/scr-editor-review 5
/scr-save

# Then start a real project:
/scr-new-work

# Other slash-command runtimes currently keep /scr:*:
/scr:first-run
/scr:demo
/scr:next
/scr:draft 5
/scr:editor-review 5
/scr:save

# In Codex, use the generated $scr-* skills:
$scr-first-run
$scr-demo
$scr-next
$scr-draft 5
$scr-editor-review 5
$scr-save
```

If you only ever type `/scr-next` in Claude Code, you can complete an entire novel. It always knows what's next.

If you want the shortest proof-first route, read [Quick Proof](docs/quick-proof.md) before exploring the rest of the docs. If you want a small command path for your goal, use [Starter Sets](docs/starter-sets.md). If you want to showcase the range without overwhelming a new writer, use [Versatility Paths](docs/versatility-paths.md).

---

## Proactive status

Scriveno ships a shared read-only status engine for every installer target. The public CLI is:

```bash
npx scriveno@latest status --project .
npx scriveno@latest status . --json
npx scriveno@latest status --project . --apply-safe
npx scriveno@latest sync --check
npx scriveno@latest smoke --json
npx scriveno@latest agents --json
npx scriveno@latest routes --json
```

After `npm i -g scriveno`, you may use the shorter `scriveno status --project .` form.

It inspects disk evidence such as `.manuscript/`, `STATE.md`, `CONTEXT.md`, plan files, drafts, review coverage, notes, revision proposals, translation work, publishing prerequisites, exports, and history, then recommends the safest next command. The engine does not mutate files and does not spawn agents by itself. Command surfaces such as `/scr-next`, `/scr:next`, `/scr:progress`, `/scr:session-report`, and `/scr:sync` call it when local command execution is available, then fall back to embedded markdown logic when a host cannot run Node. See [Auto-Invoke Policy](docs/auto-invoke-policy.md), [Runtime Support](docs/runtime-support.md#shared-auto-invoke-engine), and [Model Adaptation](docs/model-adaptation.md).

The status report separates `Candidate agents`, `Candidate local helpers`, and `Manual gates`. That means Scriveno can say when a route is ready for a drafter, voice-checker, translator, continuity-checker, or review worker, when a deterministic helper such as save or scan is enough, and when writer approval is required for publishing, export overwrites, track merges, or undo.

`--apply-safe` runs only read-only checks and reports write-gated helpers instead of touching manuscript files. `sync --check`, `smoke`, `agents`, and `routes` expose the same cross-runtime audit layer for Claude Code, Codex, Cursor, Gemini CLI, OpenCode, GitHub Copilot, Windsurf, Antigravity, Manus, Perplexity Desktop, and Kimi-compatible generic skill fallback. `smoke` also verifies the shared model adaptation docs copied into `.scriveno/docs/`.

---

## The Voice DNA system

Scriveno's core insight: drafted prose should sound like *you*, not like an AI. Before drafting begins, `/scr:profile-writer` builds a detailed voice profile across 15+ dimensions:

- Narrative perspective, tense, narrator stance
- Sentence architecture, paragraph rhythm
- Vocabulary register, figurative density, recurring image systems
- Dialogue style, character voice differentiation
- Pacing, transitions, emotional range
- Do/don't/consider rules specific to the writer

This profile is saved as `STYLE-GUIDE.md` and loaded into every drafter agent invocation. The drafter writes one atomic unit per fresh context -- a scene, a subsection, a passage -- with the style guide as its primary reference. Voice stays consistent across hundreds of scenes.

The drafter is also backed by two additional rule layers that scaffold weaker models without overriding the writer's voice: a universal `WRITING-RULES.md` (human-first restraint, factual integrity, AI-tell don'ts, register awareness, detector-aware authenticity, and artifact cleanup loaded into every drafter, voice-checker, and originality-check pass) and per-work-type pitfall packs at `templates/pitfalls/<work_type>.md` (filter words for prose, unfilmable description for screenplays, missing-precondition checks for runbooks, anachronism for sacred commentary, and so on). Conflict resolution is top-down: STYLE-GUIDE.md > WRITING-RULES.md > pitfall pack. See [docs/drafter-quality.md](docs/drafter-quality.md) for the full system, including `draft.rigor` and `draft.context_profile` settings for matching the drafter to the model tier you're routing to, and [Authenticity And AI Detectors](docs/authenticity-and-detectors.md) for the external-detector policy.

Every project also gets `RECORD.md`, a neutral established-content store. `STATE.md` tracks workflow position, `OUTLINE.md` tracks structure, and `RECORD.md` tracks what the work has established: open threads, reader promises, payoffs, continuity facts, and movement that future units must honor.

For sacred and historical texts, Voice DNA is supplemented by 10 sacred voice registers (prophetic, wisdom, legal, liturgical, narrative-historical, apocalyptic, epistolary, psalmic, parabolic, didactic).

---

## Work types supported

**Prose:** novel, novella, short story, flash fiction, memoir, creative nonfiction, biography, essay, essay collection

**Script:** screenplay, stage play, TV pilot, TV series bible, audio drama, libretto/musical

**Academic:** research paper, thesis/dissertation, journal article, white paper, literature review, monograph

**Technical writing:** technical guide/user guide, runbook/SOP, API or CLI reference, design spec/architecture doc

**Visual:** comic, graphic novel, children's book, picture book

**Poetry:** poetry collection, single poem, song/lyric

**Interactive:** interactive fiction, game narrative

**Speech:** speech

**Sacred & historical:** scripture (Biblical, Quranic, Torah, Vedic, Buddhist, generic), commentary/exegesis, devotional, liturgical text, historical chronicle, historical account, mythological collection, religious epic, sermon, homiletic collection

Each work type has its own structural hierarchy and **industry-standard word count and page range guidance** -- a novel targets 70,000-100,000 words across 20-35 chapters, a screenplay targets 90-120 pages across 3-5 acts. These ranges guide outlining, progress tracking, and drafter pacing. The runnable command ids stay stable, while Scriveno adapts the wording around them -- a Torah commentary still runs `/scr:plan 3`, but frames that work as planning Parashah 3.

---

## Autopilot mode

Run the full pipeline autonomously. Three profiles:

- **Guided** -- Pause after each unit for review
- **Supervised** -- Batch through several units, pause for review
- **Full-auto** -- Run until complete; only pause on critical failures

```bash
# Claude Code
/scr-autopilot --profile supervised

# Other slash-command runtimes
/scr:autopilot --profile supervised
```

Plus:
- `/scr:autopilot --matter balanced` -- Completes the draft and prepares missing front/back matter through the dedicated matter commands
- `/scr:autopilot-publish` -- Runs quality checks and export packaging unattended. Existing front/back matter is included, while new front/back matter stays in `/scr:front-matter` and `/scr:back-matter`.
- `/scr:autopilot-translate french german spanish` -- Simultaneous multi-language editions

---

## Writer mode vs. developer mode

Scriveno detects non-technical writers and hides git terminology. Instead of `commit`, `branch`, `merge`, `diff` -- you see `save`, `version`, `compare`, `accept changes`. All the power, none of the coding jargon.

Technical writers can enable developer mode in settings for full git access and verbose output.

---

## Philosophy

Scriveno is built on five principles:

1. **The writer's voice is sacred.** The drafter never imposes generic AI style. Every drafted sentence passes through the Voice DNA gate.

2. **Fresh context per atomic unit.** Each scene, subsection, or passage is drafted in a clean context. This prevents voice drift, context bloat, and keeps each unit at its best.

3. **Progressive disclosure.** Onboarding asks 3 questions, not 30. Depth is optional and always additive.

4. **Tradition-native vocabulary.** A Quran commentary uses surahs and ayahs. A Bible study uses books and verses. A screenplay uses acts and scenes. The tool adapts to the tradition -- the writer never adapts to the tool.

5. **`/scr-next` always works in Claude Code.** The universal interface. A writer who only ever types `/scr-next` can complete an entire novel, from blank page to KDP package.

---

## Documentation

- [Proof Artifacts](docs/proof-artifacts.md) -- Canonical proof hub for the watchmaker sample flow and Voice DNA before/after bundle
- [Proof Badges](docs/proof-badges.md) -- Evidence levels for major product claims
- [Quick Proof](docs/quick-proof.md) -- 10-minute proof-first route through install checks, the demo, next, draft, review, and save
- [Starter Sets](docs/starter-sets.md) -- Small command paths for drafting, world and research, polishing, publishing, translation, sacred commentary, and repair
- [Versatility Paths](docs/versatility-paths.md) -- Curated showcase paths for technical, sacred, visual, translation, and publishing workflows
- [Workflow Optimization Audit](docs/workflow-optimization-audit.md) -- Consolidation, redundancy, authenticity, and journey-surface findings
- [Getting Started](docs/getting-started.md) -- Install to first draft in 10 minutes
- [Command Reference](docs/command-reference.md) -- All 127 commands with usage, flags, and examples
- [Work Types Guide](docs/work-types.md) -- How 50 work types adapt Scriveno's vocabulary
- [Voice DNA Guide](docs/voice-dna.md) -- The 15+ dimension voice profiling system
- [Authenticity And AI Detectors](docs/authenticity-and-detectors.md) -- How Scriveno handles outside detector scores, process evidence, and authenticity diagnostics
- [Provenance Hygiene](docs/provenance-hygiene.md) -- Read-only watermark and metadata audits with dry-run cleanup and safe cleaned copies
- [Creative Context](docs/creative-context.md) -- Writer-native context routing, craft notes, and core-loop memory
- [Publishing Guide](docs/publishing.md) -- 14 export formats, KDP, IngramSpark, submission packages
- [Sacred Text Guide](docs/sacred-texts.md) -- 15 sacred work types, voice registers, tradition-native features
- [Translation Guide](docs/translation.md) -- Multi-language pipeline with glossary and cultural adaptation
- [Contributing](docs/contributing.md) -- How to add commands, agents, work types, and templates
- [Architecture](docs/architecture.md) -- How Scriveno works under the hood
- [Configuration](docs/configuration.md) -- Package, installer, constraints, and `.manuscript/config.json` surfaces
- [Auto-Invoke Policy](docs/auto-invoke-policy.md) -- Shared status engine, route intelligence lanes, visible automation status, and agent-spawn boundaries
- [Model Adaptation](docs/model-adaptation.md) -- How Codex, Claude Code, generic/Kimi-compatible hosts, and weaker model tiers consume the same prompts and protocols
- [Route Graph Audit](docs/route-graph.md) -- Generated route graph, automation lanes, and priority fixtures
- [Development](docs/development.md) -- Contributor workflow for changing commands, templates, installer logic, and docs
- [Testing](docs/testing.md) -- What the test suite covers and which checks to run before shipping
- [Release Checklist](docs/release-checklist.md) -- Local, npm, GitHub, and fresh-install release verification
- [Release Notes](docs/release-notes.md) -- Public summary of what changed between package releases
- [Shipped Assets](docs/shipped-assets.md) -- Canonical inventory of bundled export templates and launch-critical files
- [Runtime Support](docs/runtime-support.md) -- Canonical runtime matrix, Node baseline, and verification-status framing

---

## Installer Targets

Scriveno currently ships installer targets for these AI tooling environments:

- **Claude Code** (primary reference runtime)
- **Cursor**
- **Gemini CLI**
- **Codex**
- **OpenCode**
- **GitHub Copilot**
- **Windsurf**
- **Antigravity**
- **Manus Desktop**
- **Perplexity Desktop** (guided local-MCP setup)
- **Generic (SKILL.md)** fallback

**Installer baseline:** `Node.js >=20.0.0` for `npx scriveno@latest`, `bin/install.js`, `npx scriveno@latest status --project .`, and the proactive audit commands. For new installs, use a currently supported LTS such as Node.js 24; Node.js 20 is now a compatibility floor, not the recommended fresh-install target.

**Support note:** Claude Code is the primary reference runtime and now installs a flat `/scr-*` command surface. The environments listed above are installer targets, not a claim that every host runtime has verified parity today. Codex currently installs a skill-native `$scr-*` surface with `.toml` agent metadata, Perplexity Desktop is a guided local-MCP target rather than a writable command runtime, and Kimi-compatible or other unlisted hosts should use the generic `SKILL.md` fallback until Scriveno ships a dedicated adapter. See the [runtime compatibility matrix](docs/runtime-support.md) and [model adaptation guide](docs/model-adaptation.md) for install type, support level, verification status, and model-owned spawning boundaries.

---

## Status

**Version:** 3.7.0

Scriveno's core command surface is stable across 127 commands, 50 work types, and 11 installer targets. The current repo baseline includes shipped planning milestones through `v2.0 Publishing Cover Packaging`, plus the creative-context, record-store, neutral research layer, world/place/geography layers, prepublish editorial review, branching-next, runtime-sync, adaptive concierge, human-first writing-safeguard, authenticity-diagnostic, provenance hygiene, domain-grilling, installer-marker cleanup, cross-runtime agent metadata, bounded subagent spawning protocol, model adaptation guide, visible automation status, the shared `npx scriveno@latest status --project .` auto-invoke engine, route-intelligence lanes, safe apply reporting, runtime smoke checks, agent availability checks, route graph audits, workflow-reference guards, the full audit repair pass through `2.0.11`, the first-run proof surface in `2.5.0`, the executable `/scr:first-run` path, command profiles, context-health checks, `/scr:proof-unit`, hub-first command families, and interactive install profile selection. See [Quick Proof](docs/quick-proof.md) for the fastest proof path, [Shipped Assets](docs/shipped-assets.md) for the canonical asset inventory, and [Runtime Support](docs/runtime-support.md) for the runtime compatibility matrix.

Version `3.7.0` publishes Scriveno under the package name `scriveno`, so the current install command is `npx scriveno@latest`. The older `scriveno-cli` package name is historical and was unpublished during the rename, so npm cannot attach a deprecation notice to it while it has no active registry record. The older `scriven-cli` package remains on npm only as a deprecated legacy name that points users to `scriveno`. Do not treat either legacy package name as active unless a deliberate compatibility shim is republished. See [CHANGELOG](CHANGELOG.md) for the full list and [docs/release-notes.md](docs/release-notes.md) for the public-facing summary.

Package history is tracked in [CHANGELOG.md](CHANGELOG.md), and the public-facing summary for this release is in [docs/release-notes.md](docs/release-notes.md).

---

## License

MIT. See [LICENSE](./LICENSE).

## Contributing

Scriveno is an open project. Contributions welcome -- especially new work types, additional runtime adapters, and voice register definitions for languages and traditions we haven't covered yet.
