# Configuration

This guide covers the configuration surfaces Scriveno actually ships today: package-level installer metadata, shared constraint data, runtime install targets, and per-project `.manuscript/config.json`.

## What is configurable

Scriveno is intentionally narrow in where configuration lives:

- `package.json` defines the npm package metadata, installer entrypoint, and supported Node baseline
- `data/CONSTRAINTS.json` is the central registry for work types, command availability, adaptive terminology, and export rules
- `bin/install.js` defines installer targets and where Scriveno writes commands, skills, agents, or guided setup assets
- `.manuscript/config.json` stores project-specific writing settings after `/scr:new-work`

There is no compiled app config, no environment-variable matrix for the core workflow, and no runtime dependency graph beyond Node.js for the installer.

## Installer baseline

The installer compatibility floor is:

```json
"engines": {
  "node": ">=20.0.0"
}
```

That same `>=20.0.0` floor is enforced in:

- `package.json`
- `bin/install.js`
- `docs/runtime-support.md`

For new installs, use a currently supported LTS release such as Node.js 24. Node.js 20 reached end of life on 2026-04-30, so it remains a compatibility floor, not the recommended fresh-install target.

For runtime support details, use [Runtime Support](runtime-support.md). That document is the canonical compatibility matrix.

## Shared Scriveno data

Scriveno commands are designed to load the shared constraints file from an installed Scriveno location first:

- global install: `~/.scriveno/data/CONSTRAINTS.json`
- project install: `.scriveno/data/CONSTRAINTS.json`

The repo-local copy at `data/CONSTRAINTS.json` is the authoring source of truth. The installer copies that data into the runtime-facing install location.

`CONSTRAINTS.json` controls:

- all 50 work types and 9 work-type groups
- all shipped command registrations
- adaptive renames and group-specific command behavior
- export availability and prerequisite rules

If a command or doc claim conflicts with `CONSTRAINTS.json`, fix the command or doc to match the constraints file.

## Project config

When a writer runs `/scr:new-work`, Scriveno creates `.manuscript/config.json`. The command file in [new-work.md](../commands/scr/new-work.md) defines the baseline shape:

```json
{
  "scriveno_version": "3.8.0",
  "work_type": "<chosen>",
  "group": "<group>",
  "command_unit": "<unit>",
  "developer_mode": false,
  "created_at": "<ISO timestamp>",
  "updated_at": "<ISO timestamp>",
  "autopilot": {
    "enabled": false,
    "profile": "guided",
    "include_matter": true,
    "matter_level": "balanced",
    "custom_checkpoints": []
  },
  "voice": {
    "calibrated": false,
    "last_calibration": null,
    "drift_threshold": 0.3
  },
  "authenticity": {
    "external_detector_scores": "context_only",
    "preserve_process_evidence": true,
    "detector_optimization": "never"
  },
  "draft": {
    "rigor": "standard",
    "context_profile": "standard",
    "pitfalls_enabled": true
  },
  "export": {
    "default_format": "docx_manuscript",
    "include_front_matter": true,
    "include_back_matter": true
  },
  "translation": {
    "source_language": "en",
    "target_languages": []
  },
  "collaboration": {
    "tracks_enabled": false,
    "default_track": "canon"
  }
}
```

That `scriveno_version` value should track the current package release and the live `/scr:new-work` contract, not an older milestone snapshot.

Every project gets those core keys and shared blocks (`autopilot`, `voice`, `authenticity`, `draft`, `export`, `translation`, `collaboration`, `autosave`). The `autosave` block (`enabled`, `after`) is off by default; when enabled, the pipeline auto-runs the deterministic `/scr:save` after each `unit` or each `stage` (see `/scr:cycle`, `/scr:autopilot`, and the autosave note in [Auto-Invoke Policy](auto-invoke-policy.md)). It replaces the retired `git.auto_commit` stub. The `autopilot.include_matter` and `autopilot.matter_level` settings control whether a full `/scr:autopilot` run prepares missing front and back matter through the dedicated matter commands after every unit is submitted. They do not make `/scr:export` or `/scr:autopilot-publish` draft matter. The `voice.drift_threshold` default of 0.3 is the voice-drift gate: drift is `(100 - score) / 100`, so 0.3 offers a re-draft when the voice score falls below 70 (see [Drafter Quality](drafter-quality.md) and `agents/voice-checker.md`). The `authenticity` block makes detector policy explicit: outside detector scores are context only, process evidence stays preserved, and Scriveno never optimizes prose to hit a detector target. Additional blocks are added only when the work type requires them: a `technical` block for technical writing, top-level sacred profile keys for sacred work types, and `platform` for work types with an inferred publishing target.

### Technical writing projects

Technical writing work types add a `technical` block seeded from `config_defaults` in `data/CONSTRAINTS.json`. That block is used to capture things like:

- audience level
- prerequisite knowledge
- supported environment
- supported versions
- source-of-truth references
- review mode

Technical projects also swap in the specialized templates under `templates/technical/`.

### Sacred and historical projects

Sacred work types add top-level sacred profile keys seeded from `config_defaults` and `architectural_profiles.defaults_by_work_type.tradition`. New projects should not nest these values under a `sacred` object.

The supported tradition profile slugs are:

- `catholic`
- `orthodox`
- `tewahedo`
- `protestant`
- `jewish`
- `islamic-hafs`
- `islamic-warsh`
- `pali`
- `tibetan`
- `sanskrit`

Sacred project config can include:

- `tradition`
- `verse_numbering_system`
- `calendar_system`
- `translation_philosophy`
- `canonical_alignment`
- `annotation_traditions`
- `doctrinal_framework`
- `preserve_source_terms`
- `transliteration_style`

Sacred projects also load the template variants under `templates/sacred/`. Older projects with a nested `sacred` object are accepted as legacy input by commands that read these keys, but new projects should use the top-level shape.

### Platform defaults

Some work types can also set a top-level `platform`, seeded from `architectural_profiles.defaults_by_work_type.platform`. Ebook and print builders use this value when the writer does not pass `--platform`.

The shipped ebook platform profile slugs are:

- `kdp`
- `ingram`
- `apple`
- `bn`
- `d2d`
- `kobo`
- `google`
- `smashwords`

`/scr:build-ebook` validates the selected platform, loads `templates/platforms/{platform}/manifest.yaml`, checks that the manifest accepts EPUB, and carries the platform label plus `epub_variant` into the output metadata.

### Drafter quality settings

Starting in `1.6.0`, projects can include an optional `draft` block to tune how the drafter loads context and applies rule scaffolding. The block is optional; absent block falls back to the documented defaults.

```json
"draft": {
  "rigor": "standard",
  "context_profile": "standard",
  "pitfalls_enabled": true
}
```

- `draft.rigor`: `standard` (default) or `strict`. Strict prepends a per-sentence rules check, useful when routing to weaker models that need scaffolding to stay on-voice.
- `draft.context_profile`: `minimal`, `standard` (default), or `full`. Controls how much context the drafter loads per atomic unit. Minimal trims THEMES, WORK, and off-stage CHARACTERS for short scenes; full loads cross-document references for sacred-work continuity.
- `draft.pitfalls_enabled`: `true` (default) or `false`. When `false`, skip loading the per-work-type pitfall pack from `templates/pitfalls/<work_type>.md`. WRITING-RULES.md still loads. Use when the writer's voice deliberately leans into a trap (parody, pastiche, period voice).

`/scr:settings` exposes all three knobs in its display and change flow. See [Drafter Quality](drafter-quality.md) for the full system, including model-tier recommendations and the override hierarchy (STYLE-GUIDE.md beats WRITING-RULES.md beats the pitfall pack).

### Authenticity and detector policy

Current projects include an `authenticity` block:

```json
"authenticity": {
  "external_detector_scores": "context_only",
  "preserve_process_evidence": true,
  "detector_optimization": "never"
}
```

- `authenticity.external_detector_scores`: fixed at `context_only`. A writer may bring a detector score or highlighted report into `/scr:voice-check`, `/scr:originality-check`, `/scr:line-edit`, or `/scr:polish`, but it is triage context, not a target.
- `authenticity.preserve_process_evidence`: `true` by default. Scriveno treats STYLE-GUIDE.md, plans, drafts, review reports, HISTORY.log, saves, and accepted revisions as the honest response to authorship questions.
- `authenticity.detector_optimization`: fixed at `never`. Scriveno may repair prose that is too uniform, unsupported, generic, or off-voice, but it does not launder text to satisfy an external detector.

See [Authenticity And AI Detectors](authenticity-and-detectors.md) for the research stance and operational workflow.

## Developer mode

Scriveno defaults projects to:

```json
"developer_mode": false
```

That setting exists so non-technical writers can stay in writer-first language. In writer mode, Scriveno prefers terms like `save`, `version`, and `compare` instead of raw git terminology.

The broader product behavior is described in [Getting Started](getting-started.md) and [README.md](../README.md). The repo does not currently ship a separate standalone developer-mode settings reference beyond the project config itself.

## Installer targets

`bin/install.js` currently defines 11 installer targets:

- 8 command-directory runtimes
- 2 skills or manifest-style runtimes
- 1 guided local-MCP target for Perplexity Desktop

The installer also decides whether the install is global or project-local and writes files into the matching runtime-specific directories. The target matrix and support framing live in [Runtime Support](runtime-support.md).

Use `/scr:sync` when the source tree has changed and an installed runtime surface needs to be refreshed from that local source. Sync is intentionally narrower than update: it re-runs the installer for selected or detected runtimes and does not fetch a newer package release.

## Export prerequisites

Scriveno keeps export tools out of `package.json`. They are external prerequisites the agent invokes through the shell when needed.

Current documented prerequisites include:

- Pandoc
- Typst
- Ghostscript
- ImageMagick
- Afterwriting
- Screenplain

The authoritative guidance for those tools is split across:

- [Publishing](publishing.md)
- [Shipped Assets](shipped-assets.md)
- [Runtime Support](runtime-support.md)

## Changing configuration safely

Use this rule of thumb:

- change `data/CONSTRAINTS.json` for command availability, work-type structure, adaptive terminology, or export rules
- change `bin/install.js` for runtime targets or install paths
- change command files for workflow behavior
- change `.manuscript/config.json` only as project state, not as product schema authoring

After changing configuration surfaces, run:

```bash
npm test
```

And for release-facing changes, also run:

```bash
npm run release:check
```

When configuration changes touch runtime paths, route logic, agent prompts, sync behavior, or installed audit surfaces, also run:

```bash
scriveno sync --check
scriveno smoke --json
scriveno agents --json
scriveno routes --json
```

## Related docs

- [Getting Started](getting-started.md)
- [Architecture](architecture.md)
- [Contributing](contributing.md)
- [Drafter Quality](drafter-quality.md)
- [Voice DNA](voice-dna.md)
- [Runtime Support](runtime-support.md)
- [Publishing](publishing.md)
