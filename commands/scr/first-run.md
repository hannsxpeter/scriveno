---
description: Run the guided first-run path through install checks, demo proof, starter choices, and next commands.
argument-hint: "[--proof] [--runtime <runtime>]"
---

# First Run

You are guiding a writer through Scriveno's first 10 minutes. This command is the executable version of Quick Proof: it should orient the writer, check what can be checked, point at the demo, and keep the next choice small.

Use the shared CLI guide first when local command execution is available:

```bash
npx @hxp-tools/scriveno@latest first-run --project "$PWD"
node bin/install.js first-run --project "$PWD"
```

If the CLI is unavailable, follow the same steps manually from this command file.

## What to do

1. **Run the first-run guide.** Prefer `npx @hxp-tools/scriveno@latest first-run --project "$PWD"` unless a global `scriveno` binary is installed. It reports project status, runtime command shapes, demo steps, proof artifacts, and installed-surface checks.
2. **Show the runtime-specific command shape.**
   - Claude Code: `/scr-first-run`, `/scr-demo`, `/scr-next`
   - Standard slash-command runtimes: `/scr:first-run`, `/scr:demo`, `/scr:next`
   - Codex: `$scr-first-run`, `$scr-demo`, `$scr-next`
   - Guided targets: use the generated local-MCP setup notes
3. **If no project exists, recommend the demo first.** The safest first action is `/scr:demo`, because it creates `./scriveno-demo/` instead of touching the writer's actual project.
4. **Point at proof artifacts.** Name these files:
   - `docs/quick-proof.md`
   - `docs/starter-sets.md`
   - `data/proof/first-run/README.md`
   - `data/proof/runtime-parity/README.md`
   - `data/proof/watchmaker-flow/README.md`
   - `data/proof/voice-dna/README.md`
5. **If the installed surface feels large, offer a non-destructive surface preview.** Suggest `/scr:surface profile writing --dry-run` as an optional way to preview fewer visible commands without removing features or project data.
6. **Keep the first action small.** Do not list the full command catalog. Offer one recommended command and at most three alternatives.

## Recommended first-run path

Use this sequence when the writer wants to try Scriveno immediately:

```text
/scr:demo
cd scriveno-demo
/scr:next
/scr:draft 5
/scr:editor-review 5
/scr:save
```

Translate those command shapes for the active host when needed:

- Claude Code: `/scr-demo`, `/scr-next`, `/scr-draft 5`, `/scr-editor-review 5`, `/scr-save`
- Codex: `$scr-demo`, `$scr-next`, `$scr-draft 5`, `$scr-editor-review 5`, `$scr-save`

## Output shape

Use this structure:

```markdown
First-run path:
1. Check the installed surface.
2. Open the demo.
3. Inspect the proof bundle.
4. Draft the planned fifth unit.
5. Review the result.
6. Save the checkpoint.

Recommended now:
- `/scr:demo`: Create the isolated watchmaker demo project.

Proof artifacts:
- `data/proof/first-run/README.md`
- `data/proof/runtime-parity/README.md`
- `data/proof/voice-dna/README.md`

Next commands:
- `/scr:demo`: Create the isolated demo project.
- `/scr:next`: Let Scriveno inspect the current project state.
- `/scr:new-work`: Start a real project instead of using the demo.
- `/scr:surface profile writing --dry-run`: Preview a smaller drafting-focused command surface.
```

## Agent and automation status

`/scr:first-run` is read-only unless the writer explicitly chooses a follow-up command such as `/scr:demo`.

```text
Automation status:
Trigger: /scr:first-run
Spawned agents:
- none
Candidate agents:
- drafter after /scr:draft 5 in the demo
- voice-checker after drafting
Local operations:
- first-run guide: read-only
- status sweep: read-only when the CLI is available
Candidate local helpers:
- npx @hxp-tools/scriveno@latest smoke --json
- npx @hxp-tools/scriveno@latest routes --json
- npx @hxp-tools/scriveno@latest surface status
Manual gates:
- writer chooses whether to create the demo or start a real project
- writer confirmation before changing the installed command profile
Auto-invoked:
- none
Why: first-run orients and recommends; it does not mutate files until the writer picks a follow-up command
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

## Tone

Calm, direct, and proof-first. The writer is trying to decide whether Scriveno is worth trusting, so show concrete paths and files instead of broad claims.
