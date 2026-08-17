# Runtime Support

Scriveno's runtime claims should be grounded in what the repo can actually prove. This document is the canonical source of truth for Scriveno's installer compatibility floor, runtime evidence levels, support levels, and verification status.

## Node.js Baseline

Scriveno's installer compatibility floor is `Node.js >=20.0.0`. For new installs, prefer a currently supported LTS release such as Node.js 24. Node.js 20 reached end of life on 2026-04-30, so it remains a compatibility floor, not the recommended fresh-install target.

Node is required for:

- running `npx scriveno@latest`
- executing `bin/install.js`
- running `npx scriveno@latest status --project .`
- running `npx scriveno@latest status --project . --apply-safe`
- running `npx scriveno@latest sync --check`, `npx scriveno@latest smoke`, `npx scriveno@latest agents`, and `npx scriveno@latest routes`
- executing the shared auto-invoke status engine at `lib/auto-invoke-engine.js`
- running the repo's JavaScript test suite

Release checks run on Node 20 and Node 24 in CI. They cover the dependency-free test suite, policy scan, installed-package provenance consumer, deterministic two-pack comparison, and package contents. This is release check evidence for the supported Node floor and recommended LTS, not host-runtime parity evidence.

Node is not a runtime dependency for Scriveno's markdown command system itself. Once installed, Scriveno's command files, agent prompts, templates, constraints, and shared auto-invoke engine are read by the host AI coding agent. Runtimes that can run local shell commands can call the engine directly; runtimes that cannot should use the same command text as a fallback contract.

## Evidence Levels

- **Installer registry**: the runtime appears in `bin/install.js` with a label, install type, detection rule, and install path shapes.
- **Registry-tested**: `test/installer.test.js` asserts the runtime key exists and that its install properties match the expected `commands` or `skills` strategy.
- **Guided setup assets**: the installer writes setup files or connector recipes for a documented runtime surface instead of copying slash-command files.
- **Repo-documented**: the install strategy and detection behavior are described in project docs such as [Architecture](architecture.md).
- **Host-runtime parity**: end-to-end proof that the installed command surface behaves equivalently inside the host agent. Scriveno does not currently ship this proof for any runtime in the repo.
- **Host-capture-ready**: a target runtime has a reserved capture directory, expected command shape, and required artifacts listed in `data/proof/runtime-parity/capture-status.json`.

## Support Levels

- **Primary reference runtime**: the runtime used as Scriveno's primary example when docs need one concrete reference environment.
- **Standard installer target**: the installer ships a first-class command-directory target for this runtime, with registry and path-shape evidence in the repo.
- **Skills installer target**: the installer ships a manifest-based target for runtimes that do not use command directories.
- **Guided desktop MCP target**: the installer ships setup assets and connector recipes for a documented desktop local-MCP surface rather than a writable command directory.
- **Generic skills fallback**: a catch-all manifest target for platforms without a dedicated runtime adapter.

## Verification Status

- **Registry-tested**: installer registry shape is covered by automated tests.
- **Repo-documented**: detection and install strategy are documented in the repo.
- **Install-surface tested**: automated tests run the installer logic for representative targets and assert command files, agent prompts, and runtime-specific metadata or manifests are written in the expected place.
- **No host-runtime parity verification yet**: Scriveno does not currently ship an end-to-end verification artifact for behavior inside the host runtime.

## Runtime Compatibility Matrix

| Runtime | Install Type | Install Path Shape | Repo Evidence | Support Level | Verification Status |
|---------|--------------|--------------------|---------------|---------------|---------------------|
| Claude Code | commands | `~/.claude/commands/scr-*.md` + `~/.claude/agents` or `.claude/commands/scr-*.md` + `.claude/agents` | Installer registry, registry-tested, install-surface tested, repo-documented | Primary reference runtime | Registry-tested; install-surface tested; repo-documented; no host-runtime parity verification yet |
| Cursor | commands | `~/.cursor/commands/scr` + `~/.cursor/agents` or `.cursor/commands/scr` + `.cursor/agents` | Installer registry, registry-tested, install-surface tested, repo-documented | Standard installer target | Registry-tested; install-surface tested; repo-documented; no host-runtime parity verification yet |
| Gemini CLI | commands | `~/.gemini/commands/scr` + `~/.gemini/agents` or `.gemini/commands/scr` + `.gemini/agents` | Installer registry, registry-tested, install-surface tested, repo-documented | Standard installer target | Registry-tested; install-surface tested; repo-documented; no host-runtime parity verification yet |
| Codex | skills | `~/.codex/skills/scr-*` or `.codex/skills/scr-*` (with mirrored command files in `~/.codex/commands/scr` or `.codex/commands/scr`, plus agent prompts and `.toml` metadata in `~/.codex/agents` or `.codex/agents`) | Installer registry, registry-tested, install-surface tested, repo-documented | Skills installer target | Registry-tested; install-surface tested; repo-documented; no host-runtime parity verification yet |
| OpenCode | commands | `~/.config/opencode/commands/scr` + `~/.config/opencode/agents` or `.config/opencode/commands/scr` + `.config/opencode/agents` | Installer registry, registry-tested, install-surface tested, repo-documented | Standard installer target | Registry-tested; install-surface tested; repo-documented; no host-runtime parity verification yet |
| GitHub Copilot | commands | `~/.github/commands/scr` + `~/.github/agents` or `.github/commands/scr` + `.github/agents` | Installer registry, registry-tested, install-surface tested, repo-documented | Standard installer target | Registry-tested; install-surface tested; repo-documented; no host-runtime parity verification yet |
| Windsurf | commands | `~/.windsurf/commands/scr` + `~/.windsurf/agents` or `.windsurf/commands/scr` + `.windsurf/agents` | Installer registry, registry-tested, install-surface tested, repo-documented | Standard installer target | Registry-tested; install-surface tested; repo-documented; no host-runtime parity verification yet |
| Antigravity | commands | `~/.gemini/antigravity/commands/scr` + `~/.gemini/antigravity/agents` or `.gemini/antigravity/commands/scr` + `.gemini/antigravity/agents` | Installer registry, registry-tested, install-surface tested, repo-documented | Standard installer target | Registry-tested; install-surface tested; repo-documented; no host-runtime parity verification yet |
| Manus Desktop | skills | `~/.manus/skills/scriveno/SKILL.md` or `.manus/skills/scriveno/SKILL.md`, with mirrored `commands/scr/` and `agents/` inside the skill bundle | Installer registry, registry-tested, install-surface tested, repo-documented | Skills installer target | Registry-tested; install-surface tested; repo-documented; no host-runtime parity verification yet |
| Perplexity Desktop | guided-mcp | `~/.scriveno/perplexity/SETUP.md` or `.scriveno/perplexity/SETUP.md` plus Perplexity Desktop Connectors setup | Installer registry, registry-tested, guided setup assets, repo-documented | Guided desktop MCP target | Registry-tested; repo-documented; no host-runtime parity verification yet |
| Generic (SKILL.md) | skills | `~/.scriveno/skills/SKILL.md` or `.scriveno/skills/SKILL.md`, with mirrored `commands/scr/` and `agents/` inside the skill bundle | Installer registry, registry-tested, install-surface tested | Generic skills fallback | Registry-tested; install-surface tested; no host-runtime parity verification yet |

## Agent Surface By Runtime

- Claude Code installs flat command files such as `scr-sync.md` plus agent prompts in its `agents` directory. It does not receive Codex `.toml` metadata.
- Cursor, Gemini CLI, OpenCode, GitHub Copilot, Windsurf, and Antigravity install nested command directories plus agent prompts in their runtime-specific `agents` directory. They do not receive Codex `.toml` metadata.
- Codex installs per-command skills, mirrored command files, agent prompts, and `.toml` metadata because Codex uses that metadata to expose agents.
- Manus Desktop and the generic skills fallback install a manifest `SKILL.md`, mirrored command files, and agent prompts inside the skill bundle.
- Perplexity Desktop receives setup assets for a local-MCP connector. It does not receive writable command or agent prompt directories from the installer.

The spawning contract is shared, but the underlying model is not controlled by Scriveno. Codex, Claude Code, Cursor, Gemini CLI, and other hosts may run different models and expose different native worker APIs. Kimi or any other unlisted host should use the generic `SKILL.md` fallback unless Scriveno later adds a dedicated installer adapter. In every case, commands must report whether native workers spawned, prompt-run fallback was used, or no agent ran.

Use [Model Adaptation](model-adaptation.md) for the codebase-level contract that maps the latest research, deep scan, planning preflight, editor diagnostic, and autopilot lookahead adaptations onto each runtime family and model tier.

## First-Run Command Shapes

Scriveno docs use `/scr:*` as the shared command id format unless a host-specific example is needed. Installed command surfaces differ by runtime:

- Claude Code: `/scr-first-run`, `/scr-demo`, `/scr-new-work`, `/scr-next`
- Standard command-directory runtimes: `/scr:first-run`, `/scr:demo`, `/scr:new-work`, `/scr:next`
- Codex: `$scr-first-run`, `$scr-demo`, `$scr-new-work`, `$scr-next`
- Generic skills: read `SKILL.md`, then run the matching file from `commands/scr/`
- Guided targets: follow the generated setup instructions and connector recipe

Use [Quick Proof](quick-proof.md) for the 10-minute proof route and [Starter Sets](starter-sets.md) for goal-based command paths.
Use [Runtime Parity Evidence](../data/proof/runtime-parity/README.md) for the committed boundary between install-surface proof and host-runtime parity proof. Use [Host Runtime Capture Protocol](../data/proof/runtime-parity/HOST-CAPTURE-PROTOCOL.md) when recording actual host transcripts or screenshots.
Use [Proof Badges](proof-badges.md) for the evidence-level vocabulary behind these claims.

## Shared Auto-Invoke Engine

Every install target receives the same read-only status engine through Scriveno's shared asset directory:

- global installs: `~/.scriveno/lib/auto-invoke-engine.js`
- project installs: `.scriveno/lib/auto-invoke-engine.js`
- source checkouts: `lib/auto-invoke-engine.js`

The same shared asset directory receives `templates/`, `data/`, `lib/`, and `docs/`, including `docs/model-adaptation.md`, `docs/subagent-spawning-protocol.md`, and `docs/drafter-quality.md`. Runtime-specific command surfaces can therefore point to one installed adaptation contract instead of duplicating model guidance in every command.
The runtime smoke check verifies the shared model adaptation docs under `.scriveno/docs/` for the active install scope.

The engine computes proactive state from disk evidence: missing or stale context, plan and draft coverage, unresolved review files, unresolved notes, revision proposals, translation work, publishing prerequisites, stale exports, missing history, and the recommended next command. It does not mutate manuscript files and does not spawn agents. Host commands such as `/scr:next`, `/scr:progress`, `/scr:session-report`, and `/scr:sync` should call it first when local command execution is available, then fall back to their embedded markdown logic when the host cannot run Node.

The public CLI entrypoint is:

```bash
npx scriveno@latest status --project .
npx scriveno@latest status . --json
npx scriveno@latest status --project . --apply-safe
```

After `npm i -g scriveno`, you may use the shorter `scriveno status --project .` form. If you only ran `npx scriveno@latest`, keep using `npx scriveno@latest <command>` for terminal checks.

The JSON form is intended for CI, host adapters, and future runtime smoke tests.

Status output uses the same route-intelligence shape across runtimes: `Candidate agents`, `Candidate local helpers`, and `Manual gates`. That keeps Claude Code, Codex, Cursor, Gemini CLI, OpenCode, GitHub Copilot, Windsurf, Antigravity, Manus, Perplexity Desktop, Kimi-compatible generic skill hosts, and generic skill installs aligned even when their native spawning mechanisms differ.

## Runtime Smoke and Agent Checks

The package now exposes cross-runtime checks through the public CLI:

```bash
npx scriveno@latest sync --check
npx scriveno@latest smoke --json
npx scriveno@latest agents --json
npx scriveno@latest routes --json
```

`npx scriveno@latest smoke` checks the runtimes recorded in the active installer settings (`.scriveno/settings.json` for project installs or `~/.scriveno/settings.json` for global installs). It checks installed command surfaces, Codex skill directories, bundled skill manifests, agent prompt counts, Codex `.toml` metadata, guided Perplexity setup assets, the active shared engine path, and the shared model adaptation docs. It does not grade every supported runtime unless those runtimes were actually installed or explicitly requested by test options.

`npx scriveno@latest agents` checks whether each installed runtime has the expected Scriveno agent prompts and reports the correct fallback: prompt-run fallback for Claude Code and standard command runtimes, metadata-ready for Codex when `.toml` files are present, guided setup for Perplexity Desktop, and bundled skill prompts for Manus or generic skill installs. The report also includes the shared model policy: host-owned model, Scriveno-owned prompts, context boundaries, fallback behavior, and merge rules.

`npx scriveno@latest routes` audits the command graph and automation lanes from `data/CONSTRAINTS.json`. It is useful when adding commands because it surfaces whether a route is read-only, local-helper, agent-ready, agent-or-local, mixed, or manual-gated.

## What Scriveno Proves Today

Scriveno currently proves all of the following in-repo:

- a named installer target exists for each runtime listed above
- each target has a declared install strategy (`commands`, `skills`, or `guided-mcp`)
- each target has expected install-path properties in the installer registry
- the runtime registry shape is covered by automated installer tests
- representative install surfaces are covered for Claude Code, standard command-directory runtimes, Codex, Manus Desktop, and the generic skills fallback
- the high-level install strategies and detection rules are documented in [Architecture](architecture.md)

Scriveno does not currently prove:

- end-to-end host-runtime parity across every listed runtime
- that every runtime behaves identically once commands are installed
- dedicated smoke-test artifacts for each runtime environment

That distinction is intentional. Installer-path coverage and guided setup assets are valuable, but they are not the same thing as verified runtime parity.

## Host Capture Queue

The first host-capture targets are queued in [capture-status.json](../data/proof/runtime-parity/capture-status.json):

1. Claude Code, because it is the primary reference runtime.
2. Codex, because it uses the generated `$scr-*` skills and agent metadata path.
3. One standard command-directory runtime, because Cursor, Gemini CLI, OpenCode, GitHub Copilot, Windsurf, and Antigravity share the `/scr:*` command shape.

Those targets are `host-capture-ready`, not `host-captured`. They become host-captured only when a real transcript or screenshot artifact is committed under the matching runtime directory.

## See Also

- [Getting Started](getting-started.md) -- install flow and first-run expectations
- [Quick Proof](quick-proof.md) -- first-run proof path and runtime command shapes
- [Proof Badges](proof-badges.md) -- evidence levels for major claims
- [Starter Sets](starter-sets.md) -- small command sets by writing goal
- [Model Adaptation](model-adaptation.md) -- model-owned behavior, host-specific surfaces, and shared adaptation rules
- [Shipped Assets](shipped-assets.md) -- trust-critical files that ship with the package
- [Release Notes](release-notes.md) -- latest package-level summary
