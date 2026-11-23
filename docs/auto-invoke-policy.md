# Auto-Invoke Policy

Scriveno can be proactive, but it must be proactive from disk evidence. Commands should inspect `.manuscript/`, reports, timestamps, config, and installed runtime surfaces before choosing an automatic helper.

The executable policy lives in `lib/auto-invoke-engine.js` and is exposed through `npx @hxp-tools/scriveno@latest status --project .` or the shorter `scriveno status --project .` form after a global install. The installer copies it to `.scriveno/lib/auto-invoke-engine.js` for project installs and `~/.scriveno/lib/auto-invoke-engine.js` for global installs, so every runtime can use the same read-only status logic.

The engine reports candidates instead of silently acting. It can identify planned-but-undrafted work, drafts without review coverage, unresolved note files, revision proposals, translation follow-ups, publishing prerequisite gaps, stale exports, and stale session context. It then separates what could spawn an agent, what could run as a local helper, and what must stay behind a manual gate.

The same file exports `getCommandAutomationPolicy()`, which classifies every command registry route into an automation lane. Tests assert that every command category is covered, so newly added routes cannot sit outside the proactive policy by accident.

## Safe Apply and Audit Commands

Scriveno now exposes the proactive layer as executable checks instead of documentation-only guidance:

```bash
npx @hxp-tools/scriveno@latest status --project . --apply-safe
npx @hxp-tools/scriveno@latest sync --check
npx @hxp-tools/scriveno@latest smoke --json
npx @hxp-tools/scriveno@latest agents --json
npx @hxp-tools/scriveno@latest routes --json
```

`--apply-safe` runs the read-only status sweep, reports safe local helpers that are ready, lists agent candidates, and marks writer-owned or write-gated helpers as skipped instead of mutating files. It is intentionally conservative: `/scr:save`, `/scr:scan`, `/scr:sync --apply`, publish packaging, export overwrites, track merges, and undo remain explicit actions.

`sync --check` combines four reports: project status, safe apply, agent availability, and runtime smoke. `smoke` checks installed commands, skills, prompts, Codex metadata, and the shared engine path. `agents` checks prompt fallback readiness and Codex metadata readiness. `routes` builds a route graph from `data/CONSTRAINTS.json`, `command_intents`, `command_families`, dependencies, and the automation policy so disconnected command flows are visible in one audit.

## Cross-Platform Agent Rules

Scriveno agent prompts live in `agents/*.md`. Each host runtime exposes them differently:

- Claude Code installs command files in `~/.claude/commands/` and agent prompts in `~/.claude/agents/`.
- Codex installs `$scr-*` skills, mirrored command files, agent prompts, and `.toml` metadata so Codex can expose agent types.
- Cursor, Gemini CLI, OpenCode, Copilot, Windsurf, and Antigravity install nested command directories and agent prompts in their runtime-specific agent directories.
- Manus and the generic skill runtime bundle `SKILL.md`, commands, and agents inside the skill directory.
- All runtimes share the same installed auto-invoke engine under the Scriveno shared asset directory.

When a host supports native fresh-context spawning, use the native agent or subagent mechanism. When it does not, load the installed agent prompt from the active runtime and run it in an isolated fresh context. When the action is only a file operation, report `Agent: none`.

The spawning contract is portable, but the model is host-owned. Codex, Claude Code, Cursor, Gemini CLI, Kimi-compatible generic skill hosts, and other runtimes may use different underlying models or worker APIs. Scriveno only requires the same prompt contract, bounded context, fallback behavior, merge rules, and visible status reporting. See `docs/subagent-spawning-protocol.md`.

Every automatic path must make the distinction visible.

```text
Agent status:
Trigger: <command or state condition>
Spawned agents:
- <agent-name>: <count, none, or prompt-run fallback used>
Candidate agents:
- <command>: <agent names or none>
Local operations:
- <operation>: <result>
Candidate local helpers:
- <command>: <reason or none>
Manual gates:
- <command>: <reason or none>
Auto-invoked:
- <command or helper>: yes/no
Why: <one sentence tied to disk state>
```

Use `Automation status:` for command chains and `Sync status:` for runtime install or sync checks.

## Levels

| Level | Behavior | Default | Examples |
|-------|----------|---------|----------|
| 1 | Read-only suggestion | Run by default | `/scr:next` route, progress sweep, review queue surfacing |
| 2 | Safe local helper | Run when directly triggered | `CONTEXT.md` regeneration, `PROGRESS.md` ledger regeneration, `HISTORY.log` append, scan report, stats count |
| 3 | Scoped agent | Spawn when the command implies it or evidence is bounded | drafter, plan-checker, voice-checker, continuity-checker, translator, beta-reader |
| 4 | Writer-owned action | Require confirmation | publishing, destructive edits, merge decisions, accepting review findings |

## Level 1: Auto-Suggest

Run these read-only checks in `/scr:next`, `/scr:progress`, and closeouts for major commands:

- If `STATE.md`, `CONTEXT.md`, `HISTORY.log`, or draft mtimes disagree, suggest `/scr:scan`.
- If voice or continuity reports have unresolved issues, suggest `/scr:voice-check`, `/scr:continuity-check`, or `/scr:editor-review`.
- If plan files exist with no corresponding drafts, suggest `/scr:draft` before reopening planning.
- If drafts exist without review coverage, suggest `/scr:editor-review` before export.
- If editor notes or track proposals exist, suggest `/scr:editor-review --notes`, `/scr:editor-review --respond`, or `/scr:track`.
- If note files contain unresolved items, suggest `/scr:check-notes`.
- If translation folders exist or config lists target languages, suggest translation follow-ups.
- If front matter, back matter, blurb, or cover handoff assets are missing, surface the specific publishing prerequisite before packaging. Front matter and back matter should route to `/scr:front-matter` and `/scr:back-matter`, not be described as export work.
- If publishing prerequisites look present but `.manuscript/reviews/PREPUBLISH-REVIEW.md` is missing, suggest `/scr:prepublish-review` before technical packaging.
- If export outputs are older than source files, suggest `/scr:export` or `/scr:publish`.
- If no save exists after recent manuscript changes, suggest `/scr:save`.
- If the writer asks for a specialist surface, route to the matching `command_families` hub first: `/scr:outline`, `/scr:art-direction`, `/scr:save`, `/scr:sacred:source-tracking`, `/scr:publish`, `/scr:build-world`, `/scr:track`, or `/scr:surface`.
- Surface deliverable progress (units done / in progress / untouched) and point at the per-unit ledger `.manuscript/PROGRESS.md`; if it is stale, suggest `/scr:save` to refresh it.

These checks must not mutate files.

## Level 2: Auto-Run Local Helpers

Run these only when the current command directly owns the file operation:

- `/scr:save` regenerates `.manuscript/CONTEXT.md` and `.manuscript/PROGRESS.md` (the per-unit ledger), appends `HISTORY.log`, and commits `.manuscript/`.
- `/scr:scan --fix` applies deterministic state repairs after confirmation and appends `HISTORY.log`.
- `/scr:resume-work` may regenerate `CONTEXT.md` from disk state.
- `/scr:progress` may count drafts, submitted units, open record threads, and stale reports and render the per-unit ledger live, but does not write. The saved `.manuscript/PROGRESS.md` is refreshed by `/scr:save`, `/scr:draft`, `/scr:autopilot`, and `/scr:scan --fix`.
- Runtime `/scr:sync --apply` runs the installer and verifies installed command, skill, and agent surfaces.

Report these as local operations, not spawned agents.

**Autosave (opt-in).** `/scr:save` normally stays behind a manual gate. When `config.autosave.enabled` is `true`, the pipeline commands `/scr:cycle`, `/scr:autopilot`, `/scr:draft`, `/scr:editor-review`, `/scr:line-edit`, and `/scr:submit` auto-invoke `/scr:save` at the configured checkpoint (`after: "unit"` or `after: "stage"`). This is the one writer-approved exception to the manual-save gate: it is off by default, opt-in through `/scr:settings`, and uses the same deterministic local-helper save (no agent, no model choice). `/scr:cycle` additionally always runs a terminal save as its defined final stage.

## Level 3: Auto-Spawn Scoped Agents

Spawn or prompt-run fallback is appropriate when the command already implies a specialist role:

- `/scr:plan` invokes `plan-checker` per plan.
- `/scr:draft` invokes `drafter` per atomic unit and a voice diagnostic pass when a draft was produced.
- `/scr:research` invokes `researcher`, with fan-out by topic angle when the question spans multiple domains.
- `/scr:voice-check` invokes `voice-checker`.
- `/scr:continuity-check` invokes `continuity-checker`.
- `/scr:translate` invokes `translator` per unit.
- `/scr:beta-reader` invokes a beta reader persona.
- `/scr:map-manuscript` invokes analysis workers, or isolated sequential analysis if parallel workers are unavailable.
- `/scr:editor-review` invokes revision diagnostics only for flagged issue groups.
- `/scr:scan --deep` may invoke read-only audit workers after deterministic scan checks. Default `/scr:scan` remains local and deterministic.

Do not pretend command-local analysis workers are installed agent files unless they actually are.

## Level 4: Manual Only

Never auto-run these without explicit writer confirmation:

- deleting or removing units
- accepting, rejecting, or applying editor decisions
- merging revision tracks
- clearing review findings
- final publish or submission packaging
- overwriting generated export packages
- destructive repair, reset, revert, or cleanup
- broad translation or cultural adaptation chains outside autopilot

## Required Closeout

Every proactive command should end with:

- one recommended next command
- a short reason tied to disk state
- status showing whether agents spawned, local operations ran, or manual boundaries stopped automation
