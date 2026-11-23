# Host Runtime Capture Protocol

This protocol turns the remaining host-runtime parity gap into a repeatable evidence capture. It does not claim a runtime is verified until a transcript or screenshot artifact is committed for that runtime.

## Purpose

Scriveno already proves install-surface shape in the repo. Host-runtime parity requires evidence from the actual host process or UI. This protocol defines the minimum capture needed for each host.

## Required Capture

For each runtime, create a directory under `data/proof/runtime-parity/<runtime>/` with:

- `README.md`: runtime, date, Scriveno version, host version if visible, tester, and result.
- `TRANSCRIPT.md`: copied terminal or host transcript.
- Optional screenshot files when the host UI is visual.

## Standard Scenario

1. Install `@hxp-tools/scriveno@latest`.
2. Run the host-native first-run command.
3. Run the host-native demo command.
4. Enter the generated demo project.
5. Run the host-native next command.
6. Route to draft unit 5.
7. Run the host-native editor review command for unit 5.
8. Run the host-native save command.
9. Record whether native agent spawning happened, prompt-run fallback happened, or no worker ran.
10. Run `scriveno smoke --json` and include the relevant summary.

## Runtime Command Shapes

Claude Code:

```text
/scr-first-run
/scr-demo
/scr-next
/scr-draft 5
/scr-editor-review 5
/scr-save
```

Standard command-directory runtimes:

```text
/scr:first-run
/scr:demo
/scr:next
/scr:draft 5
/scr:editor-review 5
/scr:save
```

Codex:

```text
$scr-first-run
$scr-demo
$scr-next
$scr-draft 5
$scr-editor-review 5
$scr-save
```

Generic skill hosts:

```text
Open SKILL.md.
Run the matching command file from commands/scr/.
Record whether the host used prompt fallback or native worker behavior.
```

Perplexity Desktop:

```text
Follow the generated local-MCP setup guide.
Ask Perplexity to inspect the Scriveno project files.
Record whether it can read the proof bundle and recommend the same next command.
```

## Pass Criteria

A runtime capture passes when:

- the host recognizes the installed command or skill shape
- the first-run and demo route can be invoked
- the next command matches project state
- draft and review route to the expected unit
- save produces a durable checkpoint or explains why the host cannot run local save
- the transcript reports agent status honestly
- no command claims host behavior that did not happen

## Failure Criteria

A runtime capture fails when:

- the host cannot see the installed command surface
- the command shape differs from the documented runtime shape
- the host cannot reach the demo path
- the host routes to a nonexistent command
- the host hides whether native worker spawning or prompt fallback happened

## Current Evidence Status

Until per-runtime capture folders are committed, Scriveno remains at install-surface proof plus capture-ready protocol for host parity. That boundary is deliberate and should stay visible in release notes, runtime support docs, and launch copy.
