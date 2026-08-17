# Testing

Scriveno uses Node’s built-in test runner to lock the shipped command, docs, installer, and package surfaces against regression.

## Test runner

The root `package.json` defines:

```json
"scripts": {
  "test": "node --test test/*.test.js",
  "pack:check": "npm pack --dry-run",
  "pack:repro": "node scripts/check-pack-reproducibility.js",
  "policy:check": "node scripts/check-writing-policy.js",
  "release:check": "npm test && npm run policy:check && npm run pack:repro && npm run pack:check",
  "prepublishOnly": "npm run release:check"
}
```

That means:

- `npm test` runs the whole test suite
- `npm run pack:check` verifies the package contents that would ship
- `npm run pack:repro` packs twice with lifecycle scripts disabled and network access blocked, then compares exact digests and normalized manifests
- `npm run policy:check` scans tracked text files for the repo writing policy
- `npm run release:check` runs tests, policy checks, and package checks
- publishing is guarded by `release:check` through `prepublishOnly`

## Run the suite

Full run:

```bash
npm test
```

Direct Node invocation:

```bash
node --test test/*.test.js
```

Target one or two files while iterating:

```bash
node --test test/package.test.js test/constraints.test.js
```

## What is covered

The `test/` directory currently includes coverage for:

- package metadata and npm packaging behavior
- command inventory and constraints integrity
- installer behavior and runtime-target setup
- demo and baseline product surfaces
- milestone-specific trust, publishing, translation, illustration, and collaboration regressions
- installed-package provenance audit, provider fallback, cleaning, serialization, and exit behavior in `test/provenance-consumer.test.js`

Representative files:

- `test/package.test.js`
- `test/constraints.test.js`
- `test/installer.test.js`
- `test/commands.test.js`
- `test/phase13-launch-surface-integrity.test.js`
- `test/phase14-runtime-credibility.test.js`
- `test/phase18-technical-writing-domain-modeling.test.js`
- `test/phase19-verification-trust-surface-updates.test.js`
- `test/provenance-consumer.test.js`

## High-signal test categories

### Package and release safety

Use these when changing package metadata, release docs, or shipped-file expectations:

- `test/package.test.js`
- `test/provenance-consumer.test.js`
- `node scripts/check-pack-reproducibility.js`
- `npm run release:check`

These catch drift around Node baseline, packed files, and release-facing package claims.

### Constraints and command inventory

Use these when changing command registration, work-type counts, or adaptive terminology:

- `test/constraints.test.js`
- `test/commands.test.js`

### Installer and runtime support

Use these when touching `bin/install.js`, runtime docs, or installer target messaging:

- `test/installer.test.js`
- `test/phase14-runtime-credibility.test.js`
- `test/phase16-trust-regression.test.js`

### Documentation and trust surfaces

Use these when changing README, docs, shipped-assets claims, or milestone trust wording:

- `test/phase13-launch-surface-integrity.test.js`
- `test/phase15-proof-artifacts-positioning.test.js`
- `test/first-run-proof-surface.test.js`
- `test/phase19-verification-trust-surface-updates.test.js`
- `test/repository-policy.test.js`
- `npm run policy:check`

### Feature-family regression tests

Use these when changing milestone-specific capabilities:

- `test/phase5-export-publishing.test.js`
- `test/phase6-illustration.test.js`
- `test/phase7-translation-localization.test.js`
- `test/phase8-collaboration-platform-sacred.test.js`
- `test/phase18-technical-writing-domain-modeling.test.js`

### Workflow smoke matrix

Use these when changing context surfaces, work-type adaptation, `/scr:new-work`, `/scr:health --repair`, `/scr:save`, or `/scr:scan`:

| Scenario | Representative work type | Expected surface behavior | Primary tests |
|----------|--------------------------|---------------------------|---------------|
| Prose narrative | `novel` | Scaffold BRIEF, CHARACTERS, WORLD, PLOT-GRAPH, THEMES, PEOPLES, and PLACES; regenerate RELATIONSHIPS, CONFLICTS, PEOPLE-DYNAMICS, and GEOGRAPHY later; create neutral RESEARCH only by command | `test/surface-resolution-workflows.test.js`, `test/craft-surface-applicability.test.js`, `test/craft-world-layers.test.js` |
| Sacred commentary | `commentary` | Use FRAMEWORK, FIGURES, COSMOLOGY, THEOLOGICAL-ARC, DOCTRINES, PEOPLES, and PLACES; regenerate LINEAGES and sacred-aware derived maps | `test/surface-resolution-workflows.test.js`, `test/phase8-collaboration-platform-sacred.test.js`, `test/craft-world-layers.test.js` |
| Technical documentation | `runbook` | Use DOC-BRIEF, AUDIENCE, SYSTEM, PROCEDURES, REFERENCES, and PLACES; skip PEOPLES; regenerate DEPENDENCIES and GEOGRAPHY when enough source entries exist | `test/surface-resolution-workflows.test.js`, `test/phase18-technical-writing-domain-modeling.test.js`, `test/craft-world-layers.test.js` |
| Academic argument | `research_paper` | Use PROPOSAL, CONCEPTS, CONTEXT, ARGUMENT-MAP, QUESTIONS, and PLACES; skip RELATIONSHIPS and PEOPLES; keep RESEARCH as a neutral advisory surface | `test/surface-resolution-workflows.test.js`, `test/phase35-academic-latex-wrappers.test.js`, `test/craft-world-layers.test.js` |
| Short lyric work | `single_poem` | Scaffold BRIEF and THEMES only; skip cast, relationship, world, plot, and peoples surfaces | `test/surface-resolution-workflows.test.js`, `test/craft-surface-applicability.test.js` |
| Speech or song | `speech` | Scaffold BRIEF and THEMES only; skip narrative and collective-world surfaces | `test/surface-resolution-workflows.test.js`, `test/craft-surface-applicability.test.js` |

The shared resolver lives in `test/helpers/surface-resolution.js`. Use it instead of reimplementing the `surface_applicability` merge algorithm in individual tests.

## When to add tests

Add or extend tests when a change affects:

- visible command counts or work-type counts
- docs that make trust-sensitive claims
- installer targets or setup instructions
- package contents
- adaptation logic in `data/CONSTRAINTS.json`
- new milestone surfaces that should stay locked after shipping

If a user-facing claim can silently drift, it probably deserves a test.

## Package checks outside the test runner

Some important release checks are shell commands rather than Node tests:

```bash
npm pack --dry-run
npm publish --dry-run
```

For the standard release gate, prefer:

```bash
npm run release:check
```

For docs, prompt, command markdown, and release-note changes, run:

```bash
npm run policy:check
```

When changing proactive routing, runtime install paths, or agent surfaces, also run:

```bash
scriveno status --project . --apply-safe
scriveno sync --check
scriveno smoke --json
scriveno agents --json
scriveno routes --json
```

Use those for release prep so you can inspect what would ship without mutating the registry.

When changing proof claims, Voice DNA samples, or first-run routing, also run:

```bash
node --test test/proof-replay.test.js
```

That test replays the flagship novel, technical runbook, and publishing-package fixtures from `data/proof/replay/golden-workflows.json`, checks the Voice DNA paired samples through `lib/voice-dna-eval.js`, and verifies the host-capture queue stays honest.

For the full publish path, including clearing local installs, packing, publishing, pushing, creating the GitHub release, and verifying `scriveno@latest`, use [Release Checklist](release-checklist.md).

## Practical workflow

For most changes:

1. run the targeted test files first
2. make the fix
3. rerun the targeted files
4. run `npm test`
5. if docs, prompts, commands, or release notes changed, run `npm run policy:check`
6. if packaging or release docs changed, run `npm run release:check`

## Related docs

- [Development](development.md)
- [Configuration](configuration.md)
- [Contributing](contributing.md)
- [Authenticity And AI Detectors](authenticity-and-detectors.md)
- [Quick Proof](quick-proof.md)
- [Proof Badges](proof-badges.md)
- [Versatility Paths](versatility-paths.md)
- [Release Checklist](release-checklist.md)
- [Release Notes](release-notes.md)
