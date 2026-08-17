# Changelog

All notable package-level changes to `scriveno` are documented here.

## 3.8.0 - 2026-08-17

Executable provenance auditing, optional provider integration, verified cleaning, and reproducible package proof.

- Added the dependency-free `scriveno provenance-check` CLI for bounded batch audits across text, web, raster, PDF, Office, ODT, and EPUB formats, with one normalized schema rendered as Markdown, JSON, or SARIF 2.1.0.
- Added explicit opt-in support for the watermarks-remover `v0.5.0` service contract. Local processing remains the default, provider upload has strict privacy and network boundaries, and optional failures fall back locally with visible degraded status.
- Added dry-run-first `scriveno provenance-clean` behavior for verified cleaned copies, with protected-content checks, archive safety, output collision guards, and explicit confirmation plus backup for in-place work.
- Preserved Voice DNA, visible prose, script joiners, emoji sequences, pixels, frames, loop data, ICC data, navigation, accessibility data, and disclosure history. Layer B stylometry and pixel removal remain unsupported as authoritative or mutation channels.
- Added an installed-package consumer test that packs with lifecycle scripts disabled, installs offline into an empty temporary project, and exercises provider success, provider failure, fallback, dry-run, copy output, invalid input, JSON, SARIF, and exit codes `0`, `1`, `2`, `64`, and `70`.
- Added a deterministic two-pack release gate that compares SHA-256 tarball digests and normalized path, size, and mode manifests without network access.
- Updated package, template, constraint, configuration, README, testing, shipped-assets, runtime, and release metadata to `3.8.0` while keeping the dependency-free `Node.js >=20.0.0` compatibility floor.

## 3.7.0 - 2026-08-15

Provenance hygiene for text, documents, archives, and publishing assets.

- Added `/scr:provenance-check`, a read-only audit for invisible Unicode markers, document metadata, C2PA manifests, archive entries, and supported image metadata.
- Added `/scr:provenance-clean`, a dry-run-first cleanup workflow that defaults to verified cleaned copies and requires confirmation plus backup for in-place changes.
- Added optional capability lanes for `c2patool`, ExifTool, `qpdf`, and archive tools without adding npm dependencies or installing tools automatically.
- Kept artifact cleanup separate from Voice DNA, detector scores, authorship claims, and platform disclosure duties. Command count 125 -> 127.
- Hardened installer and package agent discovery so project Pillar context files cannot be installed or published as executable Scriveno agents.
- Updated package, template, constraint, configuration, proof, and release metadata to `3.7.0`.

## 3.6.0 - 2026-06-26

Multi-book identity, slug-based naming, and a first-class series store.

- Added `docs/naming-conventions.md` as the canonical contract for book identity, the slug algorithm, the series store, and the deliverable filename grammar `{slug}[-{lang}][-{platform}][-v{n}].{ext}`. Every export, cover, and series command now cites it instead of hardcoding its own scheme.
- Added `lib/slug.js`: a dependency-free, generic slug helper (`sanitizeSlug`, `buildDeliverableName`, plus a CLI) that re-exports the injection-safe algorithm previously scoped to `/scr:track`. The series directory and book identity now derive from it, closing a path-traversal and collision hazard.
- Added optional book identity to `config.json` (`title`, `subtitle`, `author`, `slug`, `series`, `book_number`), written by `/scr:new-work` and `/scr:import`, with a documented WORK.md fallback so existing projects keep working unchanged.
- Export and cover commands now keep their canonical literal output as the default and additionally write a self-describing `{slug}-...` copy when a book identity exists, so a multi-book writer's deliverables no longer collide on shared upload folders.
- `/scr:build-ebook` now platform-encodes its EPUB output (`ebook-{platform}.epub`) to match `/scr:build-print`'s `print-{platform}.pdf`, so per-platform store builds no longer overwrite one another.
- `/scr:series-bible` now stores the series under a sanitized `~/.scriveno/series/{series_slug}/` path with a legacy-path migration shim, a derived `books.json` index (`slug`, `book_number`, `title`, `path`), and optional series-tier shared surfaces (`STYLE-GUIDE.md`, `ART-DIRECTION.md`, `GLOSSARY.md`, `covers/`).
- Series-tier consistency now propagates with project-local fallback: the drafter loads the series voice baseline, `/scr:cover-art --series` reads the series art direction, and the translator reads the series glossary.
- `/scr:manager --switch` is now honest about Scriveno operating on the current working directory: it prints the exact `cd` to run instead of implying a persistent switch it never had.
- Added per-language and per-edition cover slots (`build/{lang}/...`, `build/editions/{edition}/...`) and orphaned illustration/header-prompt hygiene to `/scr:reorder-units`.

## 3.5.0 - 2026-06-22

Per-unit cycle command and opt-in autosave.

- Added `/scr:cycle N`: runs one unit through the full pipeline (discuss, plan, draft, editor-review, line-edit, submit, save), guided by default with `--silent` and `--from <stage>`. The single-unit counterpart to `/scr:autopilot`, and the only pipeline command that ends with a save. Command count 124 -> 125.
- Added an `autosave` config block (`enabled`, `after`: `unit` or `stage`), off by default and toggled via `/scr:settings`. When on, `/scr:cycle`, `/scr:autopilot`, `/scr:draft`, `/scr:editor-review`, `/scr:line-edit`, and `/scr:submit` auto-invoke the deterministic `/scr:save` at the chosen checkpoint. Portable across runtimes; the one opt-in exception to the manual-save gate.
- Retired the dead `git.auto_commit` config stub, folding its meaning into `autosave`.
- Refreshed the command reference, README count, configuration and auto-invoke-policy docs, and added regression coverage.

## 3.4.0 - 2026-06-22

Transition craft: seam diagnostics, series recap, scene-break conventions, and the bridge command.

- Added `/scr:bridge`: diagnoses a weak seam between two units and offers transition fixes (hard cut, time-marker, short bridge, or upstream fix) in the writer's voice. Diagnose-first; bridge prose is generated only on request. Command count 123 -> 124.
- Added `--seams` to `/scr:pacing-analysis`: maps the joints between units (closing-into-opening energy, seam types, device monotony, weak-side runs, momentum flatlines) across the whole arc, not just per chapter.
- Added a per-unit seam follow-up to `/scr:editor-review` so weak boundaries surface during editorial review and route to `/scr:bridge` and `/scr:pacing-analysis --seams`.
- Added a series recap front-matter element: `/scr:front-matter --element recap` drafts a "Previously in [Series]" page from the series bible and the prior book's record, in the writer's voice.
- Added scene-break and time-jump marker fields to the Voice DNA style guide (`SCENE_BREAK_MARKER`, `TIME_JUMP_MARKER`) and a `/scr:profile-writer` question to populate them.
- Refreshed the command reference, README count, and constraints around the new transition surface.

## 3.3.0 - 2026-06-11

Review PDF export and publishing share flow.

- Added `/scr:export --format pdf --review`, a printable prepublication PDF meant for beta readers, editors, collaborators, and paper read-throughs before publishing.
- Kept review PDFs separate from ebook styling, paperback trim, hardcover assumptions, KDP packages, and IngramSpark packages, with ordinary letter output by default and optional A4 via `review_paper_size`.
- Moved the review PDF option ahead of EPUB in the interactive export picker so writers see the print-and-share path before ebook export.
- Updated `/scr:publish` share presets so `share-pdf` and `share-bundle` use the review PDF path instead of the generic manuscript PDF.
- Refreshed the export constraints, command reference, publishing guide, README count, and regression tests around the new review-copy surface.

## 3.2.4 - 2026-06-08

Replayable proof, host-capture readiness, and release hardening.

- Proof replay: added golden workflow fixtures for the flagship novel, technical runbook, and publishing-package paths, backed by a regression test that replays expected route decisions and next commands from saved project states.
- Voice DNA evaluation: added a deterministic paired-sample harness with expected voice markers and forbidden generic patterns so the core authenticity promise has a repeatable regression layer.
- Host parity: added capture-ready artifact directories and queue metadata for Claude Code, Codex, and a standard command runtime without overstating them as verified captures.
- Installer maintainability: extracted runtime/profile metadata from the installer and added generated fallback handling for the `Next commands:` contract across installed command surfaces.
- First journey: narrowed the recommended entry path to first-run, demo, next, draft, review, and save so new writers prove the loop before exploring the full command catalog.
- Proof documentation: added evidence-level badges and updated the README, proof artifacts, runtime support, testing, shipped-assets, and workflow-optimization audit docs around replayability and proof status.

## 3.2.3 - 2026-06-08

Hub-first workflow consolidation and release packaging.

- Command families: added `command_families` to the runtime constraints so specialist surfaces stay discoverable through hubs without bloating the main intent spine.
- Route graph: `scriveno routes` now reports 9 command families, family hubs, node family membership, and family-member edges alongside automation lanes.
- Front doors: `/scr:help`, `/scr:next`, and `/scr:do` now route specialist requests through hubs such as `/scr:outline`, `/scr:art-direction`, `/scr:save`, `/scr:sacred:source-tracking`, `/scr:publish`, `/scr:build-world`, `/scr:track`, and `/scr:surface`.
- Install UX: interactive installs now ask which command profile to install while keeping `full` as the default and preserving scripted install behavior.
- Publishing clarity: `/scr:publish`, `/scr:export`, and build commands now state their boundaries, with front matter, back matter, and prepublish review kept as distinct publishing steps.
- Release docs: updated README, Starter Sets, command reference, publishing docs, route graph docs, architecture, auto-invoke policy, and the workflow optimization audit.

## 3.2.2 - 2026-06-08

Workflow audit and release hardening across the full command surface.

- Workflow reachability: added a workflow-reference integrity test that scans current docs and commands for non-runnable `/scr:*` references, and expanded the same guard to require every writer-facing command to keep the final `Next commands:` closeout contract with Claude `/scr-*` and Codex `$scr-*` invocation guidance.
- Navigation repair: added a `world` intent to `command_intents`, surfaced it in `/scr:help`, `/scr:next`, Starter Sets, Getting Started, and README, and wired world/place/geography/research paths into the route graph so `/scr:research` is discoverable without being unique to geography.
- Publishing UX repair: kept front matter and back matter in dedicated commands, surfaced them before packaging, added prepublish review to the publishing journey, and kept export positioned as assembly and conversion rather than matter drafting.
- Runtime and model readiness: refreshed the shared workflow docs around model adaptation, subagent spawning, and runtime sync, and prepared the release path for installed-surface smoke verification.
- Documentation drift fixes: aligned sacred work-type command counts, creative-context routing scope, starter journeys, and release metadata for `3.2.2`.

## 3.2.1 - 2026-06-06

Completes the Peoples integration and hardens the connectivity guarantee.

- Connectivity: the regression test now auto-detects ANY island command (reachable via an inbound suggestion, `command_intents`, or `core_chain`, or in an explicit `selfServe` allowlist), so a new command can no longer be silently orphaned. Wired the workflow gaps this surfaced: `/scr:outline` (from `/scr:plan`) and the structure-edit family (insert/remove/reorder/split/merge-units, from `/scr:outline`).
- Peoples awareness: `/scr:autopilot`, `/scr:pause-work`, and `/scr:resume-work` regenerate the derived maps (RELATIONSHIPS, CONFLICTS, PEOPLE-DYNAMICS), not just PROGRESS/CONTEXT; `/scr:next` surfaces `/scr:new-people` and `/scr:relationship-map --peoples`; `/scr:new-character` adds the character to its people's Members list (bidirectional membership); new scan CHECK 17 flags out-of-sync character-people membership.

## 3.2.0 - 2026-06-06

Feature release: the Peoples layer. Scriveno now tracks peoples (races, factions, cultures, nations) as collective entities, the tier above individual characters.

- Added `templates/PEOPLES.md` and `/scr:new-people`: profile a people as a collective (kind, origin, values, speech markers, social position, collective want/fear/self-image, members, relations with other peoples). Gated by `surface_applicability` (optional for narrative work, not-applicable for academic/technical/poetry/speech). Command count 116 -> 117.
- Added `PEOPLE-DYNAMICS.md`, a derived map of how every people stands with every other (alliance, rivalry, oppression, trade, kinship, war), with `no dealings` recorded explicitly. Regenerated by save / new-people / scan --fix (CHECK 16); viewed via `/scr:relationship-map --peoples`. With `docs/people-dynamics-protocol.md`.
- A character now links to its people (`Belongs to:` in CHARACTERS.md) and inherits its traits; the drafter loads the character's people for collective voice and worldview; WORLD Culture points at the roster; `/scr:new-character`, `/scr:cast-list`, and `/scr:build-world` route to `/scr:new-people`, locked by the connectivity test.

## 3.1.1 - 2026-06-06

Fix: point the prerequisite references in `relationship-map.md` and `character-voice-sample.md` at `dependencies.feature_prerequisites`, the canonical registry that holds both. The 2.9.0 changelog claimed it fixed a "stale `feature_prerequisites` reference"; that section actually exists (nested under `dependencies`), and the earlier change had mis-pointed `character-voice-sample` at a non-existent `commands.character-voice-sample.requires`. Now corrected and consistent with the convention in `subplot-map.md`.

## 3.1.0 - 2026-06-06

Connectivity release: the craft layer is now wired into the workflow, and a regression test keeps it that way.

- Routed the orphan craft surfaces in: `/scr:plot-graph`, `/scr:outline`, `/scr:plan`, `/scr:pacing-analysis`, and `/scr:editor-review` now suggest `/scr:climax`; `/scr:new-character`, `/scr:character-touch`, and `/scr:cast-list` suggest `/scr:relationship-map`; `/scr:outline` offers `--snowflake` and suggests `/scr:subplot-map` and `/scr:theme-tracker`. Added these to `command_intents`.
- Added `/scr:relationship-map --conflicts` as the viewer for the derived `CONFLICTS.md` (no new command).
- Closed producer-consumer loops: `/scr:discuss` reads `SEEDS.md`; `/scr:plan` loads `CONFLICTS.md` and checks planted-device payoff windows; `/scr:draft` receives the plan's `Causal Anchor`.
- Fixed stale-after-change regeneration: `/scr:climax` regenerates `CONFLICTS.md`; the structure-management commands regenerate `PROGRESS.md`; `/scr:import` generates the derived maps; `/scr:new-revision` refreshes `PROGRESS.md` and `CONTEXT.md`; the prose-quality passes and `/scr:continuity-check` nudge `/scr:character-touch` on relationship or conflict drift; `/scr:next` routes an older project to `/scr:health --repair`.
- Added `test/connectivity.test.js`: builds the command suggestion graph and fails if any craft command becomes an orphan, so the workflow stays connected as it grows.

## 3.0.0 - 2026-06-06

Major release capping the craft layer: climax generation.

- Added `/scr:climax`, a dedicated command that converges the craft layer to devise and pressure-test the story's climax. It loads the central conflict (`CONFLICTS.md`), the crisis beat (`OUTLINE.md`), each character's want-versus-need (`CHARACTERS.md`), and the still-planted devices (`RECORD.md`), proposes two or three climax options, and rejects any that win by deus ex machina or plot armor (a climax must be earned by setup and protagonist agency). On selection it writes the `Climax` arc position and hands off to `/scr:plan`.
- Available for narrative work (prose, script, visual, interactive, sacred); hidden for poetry, speech, academic, and technical. The command count is now 116.

## 2.9.0 - 2026-06-06

Feature release: the craft layer. Story-craft tracking becomes first-class and auto-populated, gated by a work-type applicability decision tree.

- Added `surface_applicability` to CONSTRAINTS.json: a required / optional / not-applicable decision tree per work type (a poem carries only a brief and themes; an article needs no world), driving `/scr:new-work` scaffolding and surfaced by `/scr:help`.
- `RELATIONSHIPS.md` is now a derived, always-complete pairwise matrix regenerated from `CHARACTERS.md` (no relation recorded as `none`, undefined pairs surfaced), with `docs/relationships-protocol.md`.
- Added a derived conflict map (`CONFLICTS.md`, with `docs/conflict-protocol.md`): central conflict plus a complete pairwise matrix (`no conflict` recorded explicitly) and per-unit scene conflict; a Crisis beat distinct from Climax in OUTLINE.md; a conflict-type taxonomy in WORK.md.
- Plot causality: every unit plan requires a `## Causal Anchor` (`because`, not `and then`); scene goal/obstacle/outcome captured per unit.
- Plot-device lifecycle in RECORD.md (Chekhov's gun, red herring, MacGuffin: `planted` to `paid_off` / `subverted` / `abandoned`); `/scr:editor-review` flags deus ex machina and plot armor.
- Worldbuilding depth in WORLD.md (atmosphere and time, setting-as-antagonist, world-consistency rules); `/scr:scan` CHECK 15 propagates place and faction mentions.
- `/scr:outline --snowflake` builds the outline progressively (Ingermanson's method).
- `/scr:health --repair` upgrades projects created with older Scriveno versions to the current surfaces, non-destructively.
- Fixed a stale `feature_prerequisites` reference in `relationship-map.md` and `character-voice-sample.md`.

## 2.8.0 - 2026-05-30

Feature release focused on command-surface control, one-unit proofing, context-health visibility, and safer release gates.

**Command surface profiles**

- Added installer profiles (`core`, `writing`, `publishing`, `translation`, `specialist`, `full`) so writers can install a focused command set instead of the whole surface.
- Added `scriveno surface list`, `scriveno surface status`, and `scriveno surface profile <name>` with `--dry-run` support.
- Added `/scr:surface`, a writer-facing command for inspecting and changing the installed profile without touching manuscript content.
- Hardened command-runtime installs so Scriveno-owned mirrors are cleaned while unrelated user files are preserved.

**Proof and context health**

- Added `/scr:proof-unit`, a one-unit vertical proof path through voice, plan, draft, review, context health, and optional export-tool checks.
- Added context-health estimation to the shared auto-invoke engine and `/scr:health --context`, with watch, tight, and critical thresholds.
- The proactive status report now includes a `Context health:` line so long sessions show context pressure before another large operation.

**Release and publishing gates**

- Added `/scr:export --check` for format availability and external tool readiness without assembling or writing export files.
- Added `/scr:publish --preflight` so publishing presets can validate manuscript readiness and required tools before generating deliverables.
- Refreshed command inventory counts to 115 and added regression coverage for profiles, dry-run plans, context-health pressure, proof-unit, and preflight docs.

## 2.7.2 - 2026-05-30

Correctness follow-up to the 2.7.x progress ledger release.

- Fixed `computeProgressLedger` so reviewed units with open editor notes stay in progress instead of being counted as done. Submitted units still count as done, and clean reviews count as done for workflows that stop at review.
- Updated `/scr:scan` instructions to count canonical `.manuscript/plans/*-PLAN.md` and `.manuscript/reviews/*-REVIEW.md` files, while keeping legacy root-level plan and editor-note files as fallbacks.
- Aligned 2.7.1 release text with the actual `scriveno status` output, which prints the progress bar and done / in progress / untouched counts.

## 2.7.1 - 2026-05-30

Polish and documentation-integrity follow-up to 2.7.0.

- `scriveno status` now renders the progress ledger live: `analyzeProject` returns a `progress` object and the report prints a `Progress:` line with the bar and done / in progress / untouched counts. Previously `computeProgressLedger` was only available to runtimes that loaded the module directly.
- Documentation drift audit across the Markdown suite: corrected the context-integrity layer description in `docs/history-protocol.md` (five files, not three), added `PROGRESS.md` to the `/scr:scan` trust-file enumerations, listed the derived `CONTEXT.md` and `PROGRESS.md` scaffolds in the `docs/architecture.md` template tree, refreshed the `docs/route-graph.md` version stamp, dropped stale "trust trio" wording, and fixed a stale command count in `.planning/PROJECT.md`.

## 2.7.0 - 2026-05-30

Adds a per-unit progress ledger so writers can see, at a glance, what is done, in progress, and untouched across their manuscript.

**Progress ledger**

- New `.manuscript/PROGRESS.md`: an openable, auto-derived ledger showing every unit as done / in progress / untouched, with a deliverable progress bar and pipeline position. It is regenerated by the status-changing commands and by `/scr:save`, `/scr:pause-work`, `/scr:resume-work`, and `/scr:scan --fix`, following the `CONTEXT.md` derived-file precedent.
- New `docs/progress-protocol.md` defines the canonical unit-status derivation, the three buckets, pipeline position, the progress bar, and the regeneration points.
- `lib/auto-invoke-engine.js` now exposes `computeProgressLedger(manuscriptDir)`, which derives the bar, percent, and bucket counts from disk so the ledger is deterministic across runtimes.

**Command surface**

- `/scr:progress` leads with the progress bar, the done / in progress / untouched breakdown, pipeline position, and a pointer to the ledger, and stays read-only.
- `/scr:draft` and `/scr:autopilot` narrate progress against the whole manuscript (unit N of total, percent).
- `/scr:outline` and `/scr:manuscript-stats` derive per-unit status from disk per the progress protocol; `/scr:scan` gained a ledger-staleness check.

**Release alignment**

- Aligned package metadata, generated config metadata, constraints metadata, configuration docs, README badge, changelog, release notes, and release-alignment tests on `2.7.0`.

## 2.6.0 - 2026-05-29

Review-remediation and documentation-integrity release. Fixes a real export bug, makes the voice-drift gate functional, expands RTL support, and corrects documentation drift across the suite.

**Export and RTL**

- Fixed a Pandoc-variable mismatch that left RTL, CJK, and non-Latin fonts dead on the print and PDF path. The Typst templates and the build, export, and multi-publish commands now agree on the canonical `dir`, `lang`, and `mainfont` variables.
- Added RTL support to the picturebook and stageplay interior templates; the stageplay template flips its binding margin and page number for right-to-left scripts. All four interior templates were verified by compiling with `dir=rtl`.
- `/scr:multi-publish` now loads the book interior template for translated PDFs, and `/scr:translate` points at the real translated-export path.

**Voice fidelity**

- Defined the voice-drift mapping once in `agents/voice-checker.md` (`drift = (100 - score) / 100`) and wired it through `/scr:draft`, autopilot, and the docs, so the default `voice.drift_threshold` of 0.3 is computable: a re-draft is offered below a voice score of 70.
- `/scr:autopilot-publish` stays advisory and unattended. It never blocks or stops; a severe voice failure (below 60) is surfaced loudly with a report and a re-draft recommendation rather than halting the run.
- `/scr:quick-write` no longer claims a voice guarantee it does not enforce; it documents the fresh-context tradeoff and points voice-critical work at `/scr:draft`.

**Honesty and documentation**

- Marked the translation and illustration API tables as not-yet-wired in CLAUDE.md, AGENTS.md, and the translation guide. Scriveno ships an in-context translator agent and copy-paste illustration prompts, not API calls.
- Reframed `/scr:beta-reader` from "cross-AI peer review" to honest reader-perspective review.
- Audited every doc against the code and CONSTRAINTS.json and corrected 18 command-reference Usage lines, the configuration baseline, the architecture file-structure tree, voice-dna part numbering, the missing speech work type in README, and stale counts.

**Tooling and tests**

- Added `lib/track-safety.js`, the canonical slug helper for `/scr:track`, with behavioral adversarial tests that replace the previous prose-only safety test.
- Added `argument-hint` frontmatter to 17 commands that accept arguments.
- Aligned package metadata, lockfile, constraints metadata, generated config metadata, README badge and status copy, route graph docs, configuration docs, changelog, release notes, and release-alignment tests on `2.6.0`.

## 2.5.0 - 2026-05-16

Major release focused on making the first 10 minutes executable and proving the installed runtime surface across the supported host targets.

**Executable first-run path**

- Added `/scr:first-run`, a guided route through install checks, demo proof, starter choices, and next commands.
- Added `scriveno first-run --project .` so the same proof path is available from the public CLI.
- Wired first-run guidance into `/scr:help`, `/scr:demo`, Quick Proof, Starter Sets, Runtime Support, Shipped Assets, Command Reference, and README launch copy.

**Runtime parity proof**

- Added committed first-run and runtime-parity proof bundles under `data/proof/`.
- Refreshed runtime smoke expectations for the 115-command surface across Claude Code, Codex, Cursor, Gemini CLI, OpenCode, GitHub Copilot, Windsurf, Antigravity, Manus, Perplexity Desktop, and the generic fallback.
- Kept Codex skill metadata, Claude Code command surfaces, guided local-MCP targets, and generic skill bundles aligned through the shared installer path.

**Release alignment**

- Updated package metadata, lockfile metadata, constraints metadata, generated config metadata, README badge/status copy, architecture docs, route graph docs, configuration docs, changelog, release notes, and release-alignment tests to `2.5.0`.
- Verified the package with the full release gate before publishing.

## 2.0.12 - 2026-05-16

Patch release focused on turning the strongest proof and release-verification paths into first-class shipped surfaces.

**First-run proof surface**

- Added [Quick Proof](docs/quick-proof.md), a 10-minute proof-first route through install checks, runtime command shapes, the watchmaker demo, Voice DNA samples, and the next draft command.
- Added [Starter Sets](docs/starter-sets.md), small command paths for drafting, polishing, publishing, translation, sacred commentary, and repair.
- Added README badges and documentation links for the proof-first route and starter sets.

**Release verification**

- Added [Release Checklist](docs/release-checklist.md), covering clean baseline checks, local gates, stale install cleanup, package packing, npm publish, GitHub release creation, and fresh install verification from `scriveno@latest`.
- Added `npm run policy:check` and `scripts/check-writing-policy.js` so release checks include the repository writing policy before package dry-run.
- Updated release and testing docs so maintainers have one documented path from local validation to published npm verification.

**Documentation and release alignment**

- Updated Getting Started, Proof Artifacts, Runtime Support, Development, Contributing, Testing, Shipped Assets, README status, route graph docs, configuration docs, package metadata, constraints metadata, generated config metadata, and release-alignment tests to `2.0.12`.

## 2.0.11 - 2026-05-16

Patch release focused on a full repository audit and repair pass before publishing the repaired runtime surfaces.

**Repository audit repairs**

- Corrected the public `/scr:sacred-numbering-format` command identity in command and sacred-text documentation, with regression coverage to prevent the old `/scr:sacred-verse-numbering` reference from returning.
- Updated sacred templates so doctrine and lineage checks point to `/scr:sacred:doctrinal-check`, matching the shipped namespaced command.
- Updated the demo manuscript plan to use `/scr:draft 5` instead of the stale `/scr:draft-scene 5` instruction.
- Refreshed current planning state for the v2.0.11 baseline and normalized old archived test-output markers to plain text.

**Release and install verification**

- Re-ran full release validation, route graph auditing, agent availability checks, sync checks, smoke checks, npm audit, package dry-run, and repository policy scans.
- Cleared and refreshed installed Scriveno runtime surfaces for Claude Code, Codex, Cursor, Gemini CLI, OpenCode, GitHub Copilot, Windsurf, Antigravity, Manus, Perplexity Desktop, and the generic skill fallback.
- Verified installed Claude, Codex, generic, shared template, and demo-plan copies after reinstall.

**Documentation and release alignment**

- Updated README badge/status, route graph docs, configuration docs, release notes, changelog, package metadata, constraints metadata, generated config metadata, and release-alignment tests to `2.0.11`.

## 2.0.10 - 2026-05-16

Patch release focused on making proactive automation executable across runtime surfaces, not only described in policy docs.

**Executable automation checks**

- Added `scriveno status --project . --apply-safe` so the shared engine runs read-only checks, lists safe helpers, shows agent candidates, and marks write-gated actions as skipped.
- Added `scriveno sync --check` to combine project status, safe apply, agent availability, and runtime smoke into one read-only sync transcript.
- Added `scriveno smoke`, `scriveno agents`, and `scriveno routes` for installed-surface checks, agent prompt and metadata readiness, and generated route graph auditing.

**Cross-runtime support**

- Runtime smoke now checks Claude Code, Codex, Cursor, Gemini CLI, OpenCode, GitHub Copilot, Windsurf, Antigravity, Manus, Perplexity Desktop, and the generic skill fallback through one shared engine path.
- Agent availability now distinguishes prompt fallback readiness from Codex metadata readiness and guided Perplexity setup.
- Route graph auditing derives nodes and edges from `data/CONSTRAINTS.json`, command intents, dependency chains, and automation lanes.

**Documentation and release alignment**

- Updated README badges, proactive status docs, runtime support, architecture, getting started, testing docs, sync command docs, route graph docs, release notes, changelog, package metadata, constraints, and generated config metadata.
- Bumped package, lockfile, constraints, generated config, README badge/status, and documentation references to `2.0.10`.

## 2.0.9 - 2026-05-16

Patch release focused on turning proactive status into route intelligence that connects side flows, agent routes, local helpers, and manual gates.

**Route intelligence**

- Expanded `lib/auto-invoke-engine.js` so `scriveno status --project .` detects plan files without drafts, drafts without review coverage, unresolved notes, revision proposals, translation follow-ups, publishing prerequisite gaps, stale exports, stale context, and save needs.
- Status output now separates `Candidate agents`, `Candidate local helpers`, and `Manual gates` so users can see what could spawn, what could run locally, and what needs explicit writer approval.
- Added route policies for drafter, voice-checker, continuity-checker, translator, plan-checker, beta-reader, import-analysis, save, scan, sync, validation, notes, publishing, export, track merge, and undo paths.

**Cross-runtime command contracts**

- Updated `/scr:next`, `/scr:progress`, `/scr:session-report`, `/scr:save`, `/scr:scan`, and `/scr:health` fallback status blocks to show candidate agents, candidate local helpers, and manual gates even when a host cannot execute the shared Node engine.
- Added `getCommandAutomationPolicy()` so every command registry route is classified into an automation lane.
- Covered the registry-level policy with tests so newly added commands cannot sit outside the proactive automation map by accident.

**Documentation and release alignment**

- Updated README badges, proactive status docs, public status text, Architecture, Auto-Invoke Policy, Configuration, release notes, changelog, package metadata, constraints, templates, and generated project examples.
- Bumped package, lockfile, constraints, generated config, README badge/status, and documentation references to `2.0.9`.

## 2.0.8 - 2026-05-16

Patch release focused on turning proactive status from command guidance into a package-level, cross-runtime CLI surface.

**Status CLI and shared engine**

- Added `scriveno status --project .` and `scriveno status . --json` as first-class CLI entrypoints.
- Added `lib/auto-invoke-engine.js`, a shared read-only status engine that inspects `.manuscript/`, project state, context freshness, unresolved review files, translation work, exports, history, and save signals before recommending the next command.
- The installer now copies `lib/` into `.scriveno/lib` or `~/.scriveno/lib` so installed runtimes can use the same status engine without depending on source-checkout paths.

**Runtime command integration**

- `/scr:next`, `/scr:progress`, `/scr:session-report`, and `/scr:sync` now try the public `scriveno status --project "$PWD"` CLI before falling back to source, global, or project engine paths.
- Claude Code, Codex, Cursor, Gemini CLI, OpenCode, GitHub Copilot, Windsurf, Antigravity, Manus, Perplexity Desktop, and the generic skill fallback now share the same status contract.
- Codex keeps `.toml` agent metadata; non-Codex runtimes keep their own command, skill, guide, and prompt-agent surfaces.

**Documentation and packaging**

- Added a README status CLI badge, quick-start status command, and proactive status section.
- Updated Runtime Support, Auto-Invoke Policy, Getting Started, Architecture, Configuration, release notes, README status, and package metadata.
- Added regression tests for the public CLI, JSON output, shared install assets, README badge, status docs, package inclusion, and argument parsing.

**Release alignment**

- Bumped package, lockfile, constraints, generated config, README badge/status, changelog, release notes, and documentation references to `2.0.8`.

## 2.0.7 - 2026-05-16

Patch release focused on making Scriveno's agent and automation behavior visible across installed runtimes.

**Cross-runtime agent support**

- Codex installs now generate `.toml` metadata beside every Scriveno agent prompt so native agent roles can be exposed when the host supports them.
- Claude Code, Cursor, Gemini CLI, OpenCode, GitHub Copilot, Windsurf, Antigravity, Manus, and generic skill installs keep their runtime-specific command, skill, guide, and agent surfaces without receiving Codex-only metadata.
- Runtime support docs now distinguish native host spawning from prompt-run fallback behavior.

**Proactive auto-invoke policy**

- Added a shared auto-invoke policy that classifies read-only suggestions, deterministic local helpers, scoped agent spawns, and manual-only writer-owned actions.
- `/scr:next` and `/scr:progress` now perform read-only proactive sweeps for state drift, stale context, unresolved review artifacts, translation followups, stale exports, and unsaved manuscript changes.
- `/scr:save`, `/scr:scan`, `/scr:health`, and `/scr:session-report` now report local helper activity clearly instead of implying a hidden background worker.

**Agent and sync visibility**

- Drafting, planning, review, translation, mapping, beta-reader, autopilot, revision-track, and sync commands now include explicit agent or automation status blocks.
- `/scr:sync` now shows whether a sync used an agent, local installer operations, or no background process at all.

**Regression coverage**

- Added agent and automation status tests for native spawning, prompt fallback, deterministic local helpers, read-only proactive commands, and sync visibility.
- Extended installer tests to cover Codex metadata, Claude Code surfaces, skill runtimes, command-directory runtimes, and non-Codex metadata boundaries.

**Release alignment**

- Bumped package, constraints, generated config, README badge/status, and documentation references to `2.0.7`.

## 2.0.6 - 2026-05-15

Patch release focused on finishing the package rename cleanup in newly installed runtime metadata.

**Installer metadata**

- New installed command files now use the `scriveno-installed-command` ownership marker instead of the legacy `scriveno-cli-installed-command` marker.
- New `.scriveno-installed.json` manifests now record `installer: "scriveno"`.
- Cleanup and sync detection still recognize older `scriveno-cli-installed-command` markers as legacy input, so existing installs remain removable and refreshable.
- `/scr:sync` now documents the new marker while explicitly naming the old marker as compatibility-only input.

**Regression coverage**

- Updated installer tests to assert that new installs no longer emit the legacy marker.
- Added documentation guardrails so legacy package names only appear in historical or compatibility contexts, never as active install guidance.

**Release alignment**

- Bumped package, constraints, generated config, README badge/status, and documentation references to `2.0.6`.

## 2.0.5 - 2026-05-15

Patch release focused on moving the public npm package name from `scriveno-cli` to `scriveno`.

**Package rename**

- Changed the package name in `package.json` to `scriveno`, while keeping the executable bin as `scriveno`.
- Updated install documentation to use `npx scriveno@latest`.
- Updated package badges, README status, runtime docs, configuration examples, generated project metadata, and release metadata to `2.0.5`.
- Updated `/scr:sync` source-root detection so it accepts both the new package name `scriveno` and the legacy package name `scriveno-cli`.
- Recorded that `scriveno-cli` was unpublished during the rename, which prevents npm deprecation notices until an active registry record exists again.
- Updated the older `scriven-cli` npm package deprecation notice to point users to `npx scriveno@latest`.

**Compatibility**

- Kept the existing installed-command marker name stable for older installed runtime surfaces.
- Historical references to `scriveno-cli` remain in older changelog entries where they describe past package releases.
- Legacy package state: `scriveno-cli` is not active on npm after the rename. A compatibility shim would need a new publish under that name before it can be deprecated or redirect users.
- Legacy package state: `scriven-cli` remains on npm only as a deprecated historical package name pointing to `scriveno`.

**Release alignment**

- Bumped package, constraints, generated config, README badge/status, and documentation references to `2.0.5`.

## 2.0.4 - 2026-05-15

Patch release focused on integrating Domain Grilling principles into Scriveno's Creative Context loop.

**Domain Grilling**

- Added a Domain Grilling contract to Creative Context: check project files first, challenge conflicting terms immediately, sharpen fuzzy language, test one concrete boundary scenario, and ask one question at a time with a recommended answer.
- Updated `/scr:discuss` so fuzzy terms, overloaded labels, and claims about how the project works are checked against RECORD.md, STYLE-GUIDE.md, WORLD.md or SYSTEM.md, PLOT-GRAPH.md or PROCEDURES.md, subject files, cast files, and prior drafts before the writer is asked.
- Updated `/scr:plan` to load canonical terminology and source-of-truth notes from adapted source files, write `## Domain Model Notes` when needed, and turn unresolved contradictions into blocking questions before drafting.
- Extended the plan-checker agent with domain model and terminology validation, including technical checks against REFERENCES.md for command names, file paths, version boundaries, prerequisites, recovery steps, and procedure behavior.
- Expanded the technical REFERENCES.md template with canonical terminology, boundary examples, source-of-truth columns, and review checks for term and boundary drift.

**Docs and tests**

- Updated README and release notes to describe the Domain Grilling release.
- Added regression coverage for the Creative Context contract, discuss and plan behavior, plan-checker terminology checks, and technical REFERENCES.md boundary scaffolding.

**Release alignment**

- Bumped package, constraints, generated config, README badge/status, and documentation references to `2.0.4`.

## 2.0.3 - 2026-05-15

Patch release focused on integrating `authenticity-check` principles into Scriveno's Voice DNA diagnostic layer. This is the evaluative counterpart to the [`humanizer`](https://github.com/hannsxpeter/humanizer) transform principles added in `2.0.2`: it diagnoses how authentically prose reads as the writer's own work and never rewrites.

**Authenticity-check principle integration**

- Added a scrutiny pre-check to the voice-checker agent so scrutiny matches evidence density; low density biases hard toward a high score because over-flagging genuine human prose is the worst error a diagnostic can make.
- Added a mandatory false-positive audit with veto power: lone weak signals are dropped and must not lower the score, while strong false positives are reclassified as score-raising human markers.
- Added an internal-consistency check that flags unearned register or sophistication seams against the document's own baseline, reported as its own flag.
- Added an authenticity band (Reads human / Mixed signals / Reads AI-generated) reported before the 0-100 score, plus required "Reads as human (deliberately not flagged)" and caveat sections, to `/scr:voice-check` and `/scr:originality-check`.
- Removed the rewrite suggestion from `/scr:originality-check`; the diagnostic is now strictly diagnose, decide, transform, re-verify, with the rewrite handed to `/scr:line-edit` or `/scr:polish` and no target score carried into it.
- Added a "Diagnostic discipline (honest read)" section to `WRITING-RULES.md` and a diagnostic-only guard to the drafter self-check, plus a scope guarantee that the diagnostic names no detector.

**Docs and tests**

- Updated Voice DNA, drafter-quality, release-notes, and shipped-assets docs to describe the diagnostic layer and the diagnose-decide-transform-re-verify pairing.
- Expanded regression coverage for the scrutiny pre-check, false-positive veto, authenticity bands, required Reads-as-human and caveat sections, removal of the rewrite suggestion, and the diagnostic-discipline rule section.

**Release alignment**

- Bumped package, constraints, generated config, README badge/status, and documentation references to `2.0.3`.

## 2.0.2 - 2026-05-15

Patch release focused on integrating `humanizer` principles into Scriveno's Voice DNA quality layer.

**Humanizer principle integration**

- Added variance-over-substitution guidance to `WRITING-RULES.md`: fix the underlying thought and rhythm, not just suspicious words.
- Added anti-signature editing guidance so line-edit, polish, drafter, and voice-checker do not replace generic AI cadence with a new repetitive "humanized" cadence.
- Added sourced stance discipline: edge, warmth, irony, devotion, skepticism, or opinion must come from `STYLE-GUIDE.md`, the plan, or supplied material.
- Added soft-inference checks for cause, timing, priority, quantity, and motive claims that are implied or invented rather than supplied.
- Added deliberate-restraint reporting to line-edit and polish so reports name authentic writer or register markers that were intentionally left alone.

**Docs and tests**

- Updated Voice DNA, drafter-quality, and shipped-assets docs to describe the expanded human-first rule layer.
- Expanded regression coverage for variance over substitution, sourced stance, soft-inference checks, humanizer-signature detection, and polish meaning checks.

**Release alignment**

- Bumped package, constraints, generated config, README badge/status, and documentation references to `2.0.2`.

## 2.0.1 - 2026-05-14

Patch release focused on adaptive command guidance and human-first Voice DNA scaffolding.

**Adaptive command guidance**

- Added `command_intents` to `CONSTRAINTS.json` so `/scr:help` and `/scr:next` can group commands by writer intent instead of presenting a flat catalog.
- Updated `/scr:help` to infer the likely project state and show a compact front door: start commands for new projects, drafting commands before publish/translate, review commands after drafts, repair commands when state drift or validation issues appear, and collaboration or translation commands only when their project signals are present.
- Updated `/scr:next` to act as an adaptive concierge: one recommended command, a short reason, and two or three useful alternatives instead of a broad command list.

**Human-first writing safeguards**

- Strengthened `WRITING-RULES.md` with human-first restraint, factual integrity, register-aware restraint, artifact cleanup, and durable-doc wording guidance.
- Updated the drafter, voice-checker, line-edit, and copy-edit contracts so edits preserve the writer's voice, avoid invented support, preserve required beats, keep formal registers intact, and remove copied chat artifacts or placeholders.
- Kept the hierarchy explicit: `STYLE-GUIDE.md` remains sovereign, `WRITING-RULES.md` is a restraint layer under Voice DNA, and pitfall packs remain type-specific refinements.

**Release alignment**

- Bumped package, constraints, generated config, README badge/status, and documentation references to `2.0.1`.
- Added regression coverage for adaptive command intent routing and human-first writing principles.

## 2.0.0 - 2026-05-14

Major release focused on creative-context intelligence and installed-runtime trust.

**Creative context**

- Added `RECORD.md`, a neutral established-content store for what the work has put on page: open threads, reader promises, payoffs, continuity facts, movement, and next-unit obligations.
- Wired Record Notes through `/scr:discuss`, `/scr:plan`, `/scr:draft`, `/scr:editor-review`, `/scr:next`, `/scr:progress`, `/scr:continuity-check`, `/scr:scan`, `/scr:save`, the drafter agent, and the plan-checker agent.
- Added non-character subject tracking so nonfiction, poetry, sacred commentary, technical work, and other non-character forms can track concepts, procedures, doctrines, objects, images, and reader-state movement without forcing a character model.
- Expanded character work with relationship and interaction paths while still letting character projects reuse the non-character subject approach when that is the better fit.

**Workflow guidance**

- Added the branching next-command response contract across the command surface: every writer-facing response now ends with one to four practical next paths, each with a short explanation.
- Updated `/scr:next` to support non-linear suggestions instead of forcing one linear path when several useful next moves exist.
- Updated progress and scan surfaces to show record threads and context drift more clearly.

**Runtime sync**

- Added `/scr:sync` to compare and refresh installed Scriveno runtime commands, Codex skills, command mirrors, and agent prompts from the current source tree.
- Kept `/scr:sync` distinct from future package upgrades: sync repairs local runtime drift; update remains reserved for fetching a newer released package.

**Release alignment**

- Bumped package, constraints, generated config, and documentation references to `2.0.0`.
- Updated docs for the 112-command surface, `RECORD.md`, creative context, runtime sync, and release-facing behavior.
- Added regression coverage for the record store, creative-context pilot, sync command, and updated command-surface contracts.

## 1.7.1 - 2026-05-11

This release packages the audit-hardening pass on top of `1.7.0`.

- fixed the generated command-name collision between `/scr:sacred-verse-numbering` and `/scr:sacred:verse-numbering` by giving the legacy top-level command a distinct installed name
- aligned sacred project config on top-level profile keys while preserving legacy nested `sacred` fallbacks in commands that read existing projects
- tightened sacred tradition validation to the 10 shipped tradition profile slugs and updated tradition-aware commands and docs to match
- made `/scr:build-ebook --platform` real by validating platform slugs, loading `templates/platforms/{platform}/manifest.yaml`, checking EPUB support, and carrying platform metadata into build output
- corrected the core workflow dependency chain to point at canonical `.manuscript/plans/`, `.manuscript/drafts/body/`, and `.manuscript/reviews/` paths
- updated the repository documentation surface, shipped-profile READMEs, package scripts, and regression tests so release checks cover npm packaging and repository writing policy

## 1.7.0 - 2026-05-10

Substantial minor release focused on character continuity and context integrity.

**Character continuity**

- Drafter now loads the full `CHARACTERS.md` / `FIGURES.md` by default at the `standard` context profile. Previously the drafter received "relevant figures only" -- determined by who appeared in the unit's plan -- which silently dropped characters added late in the project (their entries were not in older plans, so the drafter never saw them). The relevance filter is now opt-in via `draft.context_profile: minimal` only, and that profile carries an explicit warning that newly added characters get dropped.
- Added `/scr:character-touch <name>`: updates a character's evolving state (emotional position, knowledge, possessions, relationships) after a unit lands. Voice anchor and physical description stay untouched -- those are identity, not state. The command reads the most recent draft (or `--from <unit>`), proposes a delta across the four dimensions, asks for a yes/no/edit confirmation, applies the changes, stamps a "Last touched" line, and appends a HISTORY.log entry.
- Drafter agent now emits one-line `CHARACTER STATE NUDGE` suggestions to the orchestrator when a unit clearly shifts a character's state. Up to three nudges per unit; silence is the default. The drafter does NOT modify CHARACTERS.md itself -- the writer is always in the loop on character state.
- Wired the previously-orphan `agents/plan-checker.md` into `/scr:plan` (gates the draft suggestion if the plan flags NEEDS REVISION) and `agents/continuity-checker.md` into `/scr:continuity-check`.

**Context integrity layer**

- Added `/scr:scan`: 10 checks against `STATE.md`, `OUTLINE.md`, drafts, `STYLE-GUIDE.md` mtime vs. last drafter run, scaffold elements still pending, stale exports, sacred config vs. shipped templates, CHARACTERS.md orphans. `--fix` mode for auto-correctable findings; `--quiet` for use as a pre-export gate.
- Added auto-regenerated `.manuscript/CONTEXT.md` one-page bootstrap. Written by `/scr:save`, `/scr:pause-work`, `/scr:resume-work`. Read first by `/scr:next` and `/scr:resume-work`, with stale-detection + STATE.md fallback. Template at `templates/CONTEXT.md`.
- Added append-only `.manuscript/HISTORY.log` audit trail (pipe-delimited, UTC ISO timestamps, committed to git). Wired into `/scr:save`, `/scr:draft`, `/scr:plan`, `/scr:export`, `/scr:publish`, `/scr:front-matter`, `/scr:back-matter`, `/scr:pause-work`, `/scr:resume-work`, `/scr:scan --fix`. Distinct from `/scr:history` (writer-friendly git saves).
- Two new spec docs: `docs/context-protocol.md` and `docs/history-protocol.md`.
- 12 high-impact commands now read CONTEXT.md first when fresh and skip the redundant raw-file orientation loads (`autopilot`, `autopilot-publish`, `autopilot-translate`, `publish`, `multi-publish`, `export`, `front-matter`, `back-matter`, `discuss`, `plan`, `complete-draft`, `new-revision`).

**Export polish**

- Added five destination-neutral presets to `/scr:publish`: `share-pdf`, `share-docx`, `share-epub`, `share-bundle`, `all-formats`. Writers can hand someone a single file without thinking about KDP.
- `/scr:publish` wizard reorganized as a two-level decision tree (Share / Publish / Submit / Academic / Screenplay / Everything / Custom).
- `/scr:export` (no args) now shows an interactive picker grouped into Single file / Print and store packaging / Submission packages, filtered by work type.
- Added `--level minimum|balanced|maximum` flag to `/scr:front-matter` and `/scr:back-matter` plus a skip prompt. `/scr:publish` asks once per matter type before chaining.
- Fixed: the Typst book interior template (`data/export-templates/scriveno-book.typst`) now updates the running head per chapter on recto pages. Previously verso pages always showed the book title and recto pages were empty -- across a full book that read as "the same chapter title repeating on every spread." Suppressed on chapter-opener pages.

**Installer hardening**

- Renamed `commands/scr/sacred-verse-numbering.md` -> `commands/scr/sacred-numbering-format.md` to resolve a flat/nested skill-name collision with `commands/scr/sacred/verse-numbering.md` (both flattened to `scr-sacred-verse-numbering` and one was silently overwritten on every install).
- New `assertNoSkillNameCollisions` guard runs at command-entry collection time and aborts the install with a clear error before any runtime starts writing. Future regressions fail loudly instead of dropping a command.
- New `test/runtime-parity.test.js` (6 tests) pins that Claude flat filenames and Codex skill names map 1:1 across the source tree.
- Sacred subcommand keys in `CONSTRAINTS.json` now use the `sacred:<name>` form so `/scr:help` can render the runnable slash-command path directly.

**Backward compatibility**

- All existing scripted callers of `/scr:front-matter` and `/scr:back-matter` continue to work; the level prompt only fires when neither `--level` nor `--element` is provided.
- Existing projects keep working without modification. STATE.md-based commands continue to function when CONTEXT.md is absent or stale; the protocol explicitly preserves correctness on a CONTEXT.md miss.

**Tests**

1629 tests pass (1617 in 1.6.1 + 12 net new across runtime-parity, scan coverage, and constraint integrity).

## 1.6.1 - 2026-05-07

This release is a documentation-only patch follow-up to `1.6.0`.

- brought the post-`1.6.0` repository documentation refresh into the published tarball: `docs/shipped-assets.md` now lists `WRITING-RULES.md` and the 8 pitfall packs, `docs/voice-dna.md` documents the three rule layers and `draft` config knobs, `docs/configuration.md` documents the optional `draft` block defaults, `docs/command-reference.md` exposes the new `/scr:settings` knobs, `docs/architecture.md` extends "What the drafter receives" from 6 to 8 items with the override hierarchy
- aligned the reference documentation set on canonical `/scr:` command notation; runtime-specific shapes still appear in onboarding (`docs/getting-started.md`), README cross-runtime examples, and historical 1.5.1 release-notes prose
- no code, agent, command, or template changes; behavior identical to `1.6.0`

## 1.6.0 - 2026-05-05

Draft-quality-aware drafter: layered rule scaffolding to keep weaker models from drifting into generic AI prose.

- added `templates/WRITING-RULES.md`: a one-screen canonical list of universal AI-tell don'ts (hedging, throat-clearing, balanced-both-sides, generic metaphors, symmetrical rhythm, moralizing closings, essay transitions, abstract vagueness, emotional telling, AI tics in dialogue, show-don't-tell triggers). Loaded by drafter, voice-checker, and originality-check after `STYLE-GUIDE.md`.
- added per-work-type pitfall packs under `templates/pitfalls/<work_type>.md`. Initial coverage: novel, memoir, screenplay, runbook, research_paper, poetry_collection, comic, commentary. Drop-in extension supported via `listPitfallPacks()`.
- added `draft` block in `templates/config.json` with three knobs: `rigor` (standard|strict), `context_profile` (minimal|standard|full), `pitfalls_enabled` (true|false). All optional; absent block falls back to current behavior.
- exposed the new knobs in `/scr:settings` display and change flow.
- replaced the 3-genre hardcode in `commands/scr/line-edit.md` (romance/thriller/fantasy) with pack-aware lookup. Falls back gracefully when no pack exists.
- added `lib/architectural-profiles.js#listPitfallPacks` and `getPitfallPackPath`, re-exported from `bin/install.js`.
- added `docs/drafter-quality.md` documenting the three rule layers, settings, and model-tier recommendations.
- added 23 new tests in `test/drafter-quality-aware.test.js` covering pack registration, drop-in extensibility, config schema, and drafter contract.

Conflict resolution is top-down: `STYLE-GUIDE.md` beats `WRITING-RULES.md` beats the pitfall pack. The writer's voice is sovereign; the rule layers are scaffolding, not constraints.

Backward compatible: existing projects keep working without modification. Every layer is optional and falls back to prior behavior when absent.

## 1.5.3 - 2026-04-18

This release packages the hardening work that landed after `1.5.2`.

- aligned the published package version, constraints metadata, generated project config, and release-facing docs on `1.5.3`
- packaged the writer-facing workflow-contract fixes around save history, compare, undo, session boundaries, revision tracks, and help/router guidance
- kept the zero-dependency installer architecture intact while shipping the hardened post-`1.5.2` command/doc/test baseline

## 1.5.1 - 2026-04-09

This release is a Claude command-surface follow-up to `1.5.0`.

- switched Claude Code installs from nested `/scr:*` command-directory files to flat `/scr-*` command files at `.claude/commands/`
- rewrote installed Claude command references so help text and cross-command suggestions use the same `/scr-*` surface writers invoke
- added safe Claude command cleanup so Scriveno removes only its own stale `scr-*.md` files and legacy `scr/` installs without touching unrelated user commands
- updated installer regression coverage and Claude-facing docs to lock the new command contract in place

## 1.5.0 - 2026-04-09

This release packages the shipped `v1.5 Runtime Install Reliability` milestone.

- added explicit non-interactive installer flags for runtime selection, scope, mode, help, and version output
- added one-run multi-runtime installs for Codex and Claude Code with shared `.scriveno` output written once per run
- generated native Codex `$scr-*` skills backed by mirrored installed command markdown under `.codex/commands/scr`
- tightened reinstall cleanup so Scriveno removes stale generated Codex skill wrappers and other Scriveno-owned runtime assets without wiping unrelated user files
- updated README and runtime-facing docs to describe the real Codex and Claude install surfaces truthfully
- expanded installer and trust-regression coverage so silent install parsing, Codex skill generation, and runtime-surface wording stay aligned

## 1.4.1 - 2026-04-09

This release is a packaging follow-up to `1.4.0`.

- normalized npm publish metadata to the form npm expects for the `scriveno` bin mapping and repository URL
- marked `bin/install.js` executable in the package so the shipped installer entrypoint is explicit on disk
- updated the package regression test to enforce the publish-safe bin path going forward

## 1.4.0 - 2026-04-09

This release packages the shipped `v1.4 Perplexity & Technical Writing` milestone.

- added guided Perplexity Desktop support as a documented local-MCP runtime target with explicit trust framing
- added four technical-writing work types: technical guide, runbook, API reference, and design spec
- added technical-native scaffolding and config defaults for audience, environment, procedures, and references
- expanded trust-surface regression coverage so the new runtime and work-type claims stay aligned with the package and docs

## 1.3.4 - 2026-04-09

This release rolls up the hardening work that landed after `1.3.3`.

- fixed review-driven issues across export, runtime, publishing, and historical command/doc paths
- added explicit validation artifacts for phases 13-16 and retroactive security artifacts for phases 13-16
- expanded regression coverage with new phase-level Nyquist tests for phases 13-15 and stronger package/runtime trust checks for phase 16
- reconciled planning-health drift and finalized the archived `v1.3 Trust & Proof` milestone state
- prepared and published `scriveno-cli@1.3.4` from that hardened baseline

## 1.3.3 - 2026-04-08

- restored public npm publishing for `scriveno-cli`
- shipped the `v1.3 Trust & Proof` product surface before the post-release hardening pass

## [0.3.0] -- 2026-04-06

### Added
- 13 sacred/historical work types (Biblical, Quranic, Torah, Vedic, Buddhist scripture; commentary, devotional, liturgical, historical chronicle, mythological collection, religious epic, sermon, homiletic collection)
- 8 sacred-exclusive commands (concordance, cross-reference, genealogy, chronology, annotation-layer, verse-numbering, source-tracking, doctrinal-check)
- 10 sacred voice registers (prophetic, wisdom, legal, liturgical, narrative-historical, apocalyptic, epistolary, psalmic, parabolic, didactic)
- Sacred file adaptations: FIGURES.md, LINEAGES.md, COSMOLOGY.md, THEOLOGICAL-ARC.md, DOCTRINES.md, FRAMEWORK.md
- `/scr:next` universal interface -- one command that always knows what to do next
- `/scr:do` natural language router -- free-text to command mapping
- `/scr:demo` sandbox mode -- explore a pre-built sample project
- `/scr:voice-test` voice calibration gate before first draft
- `/scr:import` existing manuscript ingestion
- `/scr:publish` interactive wizard with presets (kdp-paperback, query-submission, ebook-wide)
- Series bible with cross-book continuity enforcement
- Progressive disclosure onboarding (3 questions max)
- Drop-off risk mitigations for onboarding, first draft, non-technical friction, and publishing overwhelm
- 6 user personas including sacred/historical writer
- `CONSTRAINTS.json` -- runtime constraint system governing command availability, work-type adaptation, and dependency gating

### Changed
- Command list expanded to ~170 commands across 15 categories
- Work type count expanded from 35 to 50+
- Constraint matrices now include sacred/historical column
- Voice DNA section expanded with sacred register system (section 6.3)
- Translation section expanded with sacred text translation (section 9.4, formal vs dynamic equivalence, canonical alignment, liturgical preservation)
- Discuss phase categories expanded with 10 sacred categories (section 12.3)
- Build phases expanded to 10 (sacred/historical as dedicated phase)
- Config schema expanded with sacred config block (tradition, verse numbering, calendar, translation philosophy, canonical alignment)

### Fixed
- Section numbering drift after insertions
- 16 adapted sacred command names now in command list
- Sermon/Homily duplication resolved (moved to sacred group)
- `/scr:publish` vs `/scr:export` relationship clarified

## [0.1.0] -- Initial

- Initial project structure
- Spec-driven command system
- Core workflow (new-work, discuss, plan, draft, editor-review, submit)
- 35 initial work types
- Writer mode / developer mode toggle
