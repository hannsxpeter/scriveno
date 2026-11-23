# Runtime Parity Evidence

This bundle records what Scriveno can prove about runtime support today and what still requires host-runtime testing.

## Verified In The Repo

- The installer has named targets for Claude Code, Cursor, Gemini CLI, Codex, OpenCode, GitHub Copilot, Windsurf, Antigravity, Manus Desktop, Perplexity Desktop, and the generic skill fallback.
- `scriveno smoke --json` checks installed command counts, agent prompt availability, Codex metadata, guided Perplexity assets, and shared engine availability.
- `scriveno agents --json` distinguishes prompt fallback readiness, Codex metadata readiness, guided setup, and bundled skill prompts.
- `scriveno routes --json` verifies route lanes and command graph shape from the live constraints file.
- Regression tests cover install surface shape, Codex metadata, Claude flat command mapping, skill bundles, and public audit commands.

## Runtime Surface Expectations

| Runtime | What is verified locally | Native host behavior claim |
|---------|--------------------------|----------------------------|
| Claude Code | Flat `/scr-*` commands plus agent prompts install | Host-supported when Claude Code exposes agents |
| Codex | `$scr-*` skills, mirrored commands, prompts, and `.toml` metadata install | Host-supported when Codex exposes agent roles |
| Cursor | Nested `/scr:*` commands plus agent prompts install | Host-supported when Cursor exposes agents |
| Gemini CLI | Nested `/scr:*` commands plus agent prompts install | Host-supported when Gemini CLI exposes agents |
| OpenCode | Nested `/scr:*` commands plus agent prompts install | Host-supported when OpenCode exposes agents |
| GitHub Copilot | Nested `/scr:*` commands plus agent prompts install | Host-supported when Copilot exposes agents |
| Windsurf | Nested `/scr:*` commands plus agent prompts install | Host-supported when Windsurf exposes agents |
| Antigravity | Nested `/scr:*` commands plus agent prompts install | Host-supported when Antigravity exposes agents |
| Manus Desktop | Skill bundle with commands and agent prompts installs | Host-supported when Manus exposes skill agents |
| Perplexity Desktop | Guided local-MCP setup assets install | Native command and agent spawning not assumed |
| Generic | SKILL.md bundle with commands and agent prompts installs | Native spawning not assumed |

## Remaining Host-In-The-Loop Gap

Scriveno still does not claim full host-runtime parity. The missing proof is a recorded run inside each actual host UI or agent process showing that the host invokes the installed command and agent surfaces exactly as expected.

That gap is now narrower: install surfaces, metadata, command counts, agent prompts, shared audit commands, and proof artifacts are all checked. This document separates install-surface proof and host-runtime parity proof so Scriveno can be precise about what is verified. The remaining work is external host execution evidence, not package-surface wiring.

## Suggested Host Parity Script

Use [HOST-CAPTURE-PROTOCOL.md](HOST-CAPTURE-PROTOCOL.md) as the canonical capture protocol. The short version:

For each host that supports local commands:

```text
1. Install @hxp-tools/scriveno@latest.
2. Run the host-native first-run command.
3. Run the host-native demo command.
4. Run the host-native next command inside scriveno-demo.
5. Confirm the host can route to draft unit 5.
6. Run review and save for unit 5.
7. Save a short transcript or screenshot under data/proof/runtime-parity/<runtime>/.
```

Use the command shape from [docs/runtime-support.md](../../../docs/runtime-support.md).

## Capture Status

The first queued captures are listed in [capture-status.json](capture-status.json): Claude Code, Codex, then one standard command-directory runtime. Each target has a reserved directory with the expected command shape.

No host capture folder is marked verified until its transcript or screenshot artifact is committed under `data/proof/runtime-parity/<runtime>/`. Until then, Scriveno's verified claim remains install-surface proof plus capture-ready protocol.
