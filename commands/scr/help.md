---
description: Show Scriveno commands grouped by workflow stage, filtered to what's relevant for your current work type and progress.
argument-hint: "[category or search term, optional]"
---

# Scriveno help

You are helping the user navigate Scriveno commands. Load Scriveno's installed/shared `CONSTRAINTS.json` (global `~/.scriveno/data/CONSTRAINTS.json` or project `.scriveno/data/CONSTRAINTS.json`) to see every command and its availability.

## What to do

1. **Check for a `.manuscript/` directory in the current project.**
   - If it exists, read `.manuscript/config.json` to get the work type and developer_mode setting
   - If it doesn't exist, show the "getting started" view

2. **Load CONSTRAINTS.json** and filter commands by the current work type's group plus any command-level constraints.
   - A command is only menu-eligible when its `available` list includes the current group (or `"all"`) **and** any narrower gate passes.
   - Apply explicit constraints such as `nonfiction_only` and `comic_only` before you show the command.
   - If a group has a dedicated replacement command family (for example sacred chronology and doctrinal checks), prefer that real surface over any conceptual adapted label on a hidden base command.

3. **Load `command_intents` from CONSTRAINTS.json.** Treat these intents as the main front door: start, draft, revise, world, navigate, publish, translate, collaborate, repair. If the field is missing in an older install, fall back to the stage groups below.

4. **Load `command_families` from CONSTRAINTS.json.** Treat these as secondary hub groups for specialist workflows: structure, art, review, automation, session, sacred, submission, publishing, world, collaboration, and surface. They do not replace `command_intents`; they help you show one hub first and keep specialist leaves nearby.

5. **Infer the likely intent before showing commands.**
   - No `.manuscript/` directory -> start
   - `.manuscript/` exists but no drafted units -> draft
   - Drafted units exist but review is incomplete -> revise
   - The writer asks for world, places, geography, characters, peoples, relationships, or research -> world
   - Draft is complete and export files are missing -> publish
   - Translation folders or language config exist -> translate
   - Revision-track metadata exists -> collaborate
   - State drift, failed command, missing required file, or validation concern -> repair
   - Otherwise -> navigate

6. **If the user passed an argument**, treat it as an intent, command family, category filter, or search term. Otherwise show the inferred intent first, then compact alternatives.

## The "getting started" view (no project yet)

Ask the user what they want to do. Don't list all 127 commands -- show them this:

```
Scriveno -- ready to start.

What do you want to do?
  /scr:first-run       Run the guided first-run proof path
  /scr:new-work        Start a new project (novel, runbook, screenplay, paper, etc.)
  /scr:demo            Explore a pre-built sample project first
  /scr:import <file>   Bring in an existing manuscript
  /scr:profile-writer  Set up your writer profile

Already have a project? Just cd into it and run /scr:next.
```

## The "active project" view

Show commands relevant to the current stage. Use `.manuscript/STATE.md` to figure out where the user is.

Lead with a compact intent view, not the full command catalog:

```markdown
Likely next area: Draft

Most useful now:
- `/scr:next`: Inspect the project state and choose the next step.
- `/scr:discuss 4`: Shape the next unit before planning.
- `/scr:plan 4`: Turn the discussion into a draftable plan.

Other useful areas:
- Revise: `/scr:editor-review`, `/scr:voice-check`, `/scr:continuity-check`
- Navigate: `/scr:progress`, `/scr:manuscript-stats`, `/scr:pause-work`
```

Keep the primary list to 3-6 commands. Put additional commands under "More for this intent" only when the user asked for detail, used `/scr:help all`, or passed a specific intent/category. This is the thin front door: the full command surface remains available, but the default view should never feel like a catalog dump.

Use `command_intents` to choose candidates, then apply availability and command-level constraints. For example, `publish` intent can include `build-print`, but a fresh project should not show publishing as the likely next area; `translate` can include `translate`, but it should not appear as a primary path until drafted work exists or translation configuration exists; `repair` should move to the top when scan/health conditions are present.

### Hub-first families

When the writer asks for a specialist area, show the family hub first, then 2-5 leaves. Use `command_families` as the source of truth:

- Structure: `/scr:outline` first, then `/scr:add-unit`, `/scr:insert-unit`, `/scr:remove-unit`, `/scr:split-unit`, `/scr:merge-units`, or `/scr:reorder-units`.
- Art: `/scr:art-direction` first, then `/scr:cover-art`, `/scr:illustrate-scene`, `/scr:character-ref`, `/scr:map-illustration`, `/scr:storyboard`, `/scr:panel-layout`, or `/scr:spread-layout`.
- Review: `/scr:editor-review` first, then `/scr:voice-check`, `/scr:continuity-check`, `/scr:originality-check`, `/scr:sensitivity-review`, `/scr:pacing-analysis`, `/scr:dialogue-audit`, or `/scr:proof-unit`.
- Automation: `/scr:do` first for natural-language routing, then `/scr:fast`, `/scr:autopilot`, `/scr:proof-unit`, or `/scr:next` when the writer asks for automatic help.
- Session: `/scr:save` first, then `/scr:history`, `/scr:versions`, `/scr:compare`, `/scr:pause-work`, `/scr:resume-work`, or `/scr:session-report`.
- Sacred: `/scr:sacred:source-tracking` first, then the dedicated sacred commands that apply to the active tradition and work type.
- Submission: `/scr:publish` first, then `/scr:synopsis`, `/scr:query-letter`, `/scr:book-proposal`, `/scr:discussion-questions`, `/scr:prepublish-review`, or `/scr:export --format submission-package`.
- Publishing: `/scr:publish` first, `/scr:export` for one-off output, `/scr:provenance-check` and `/scr:provenance-clean` for delivery-file hygiene, and `/scr:build-ebook`, `/scr:build-print`, `/scr:build-smashwords`, or `/scr:build-poetry-submission` for final packages.
- World: `/scr:build-world` first, then `/scr:new-place`, `/scr:place-touch`, `/scr:geography-map`, `/scr:new-character`, `/scr:new-people`, `/scr:relationship-map`, or `/scr:research`.
- Collaboration: `/scr:track` first, then its subcommands plus `/scr:editor-review`, `/scr:compare`, `/scr:history`, `/scr:versions`, and `/scr:save`.
- Command surface: `/scr:surface` first, especially `/scr:surface status` and `/scr:surface profile writing --dry-run`.

Keep this compact. Do not display every leaf unless the writer asks for "all", "catalog", "everything", or a family-specific deep list.

### Publishing mental model

Use this wording wherever publishing choices appear:

- `/scr:publish`: destination wizard and sequencing.
- `/scr:export`: one-off format output.
- `/scr:build-ebook`, `/scr:build-print`, `/scr:build-smashwords`, and `/scr:build-poetry-submission`: final package builders for a specific channel or format.
- `/scr:front-matter` and `/scr:back-matter`: content creation before packaging.
- `/scr:prepublish-review`: final editorial gate.
- `/scr:compliance-check`: platform-policy, copyright, and AI-disclosure gate.
- `/scr:provenance-check`: read-only Unicode, metadata, and hard-bound provenance audit.
- `/scr:provenance-clean`: dry-run-first cleaned-copy transform for confirmed findings.

Group by stage:
- **Create** -- new-work, profile-writer, series-bible
- **Write** -- discuss, plan, draft, climax, quick-write, autopilot, plant-seed, plus any profile-building commands actually available for the current work type
- **Revise** -- editor-review, subject-touch, line-edit, copy-edit, continuity-check, beta-reader, voice-check, originality-check, sensitivity-review, pacing-analysis, dialogue-audit, proof-unit
- **Character & World** -- build-world, new-character, new-people, new-place, place-touch, geography-map, relationship-map, cast-list, research
- **Publish** -- front-matter, back-matter, blurb, cover-art, prepublish-review, compliance-check, provenance-check, provenance-clean, publish, export
- **Collaborate** -- track
  Present `/scr:track` as the entrypoint for revision-track workflows, and describe its subcommands in prose: create, list, switch, compare, merge, propose.
- **Versions** -- save, history, versions, compare, undo
- **Navigate** -- next, do, fast, progress, add-note, pause-work, resume-work, thread

Revision tracks are a writer-facing workflow, not a developer-only one. Always surface `/scr:track` when it is otherwise available for the current project, and explain that comparison and merge actions live under its subcommands. Do not invent top-level commands like `/scr:merge` for collaboration, and do not confuse `/scr:compare` (save-to-save history comparison) with `/scr:track compare` (revision-track comparison). `developer_mode` only changes whether you expose extra technical detail such as hashes, branch names, or raw git output -- it does not hide the collaboration workflow itself.

When useful, describe Scriveno's creative-context model in one sentence: Scriveno tracks what moves, including characters, ideas, reader understanding, objects, places, procedures, doctrines, evidence, and themes. Keep this as orientation, not a lecture.

Only show commands where `available` includes the current work type's group, OR where it's `"all"`, **and** any narrower command-level constraints still pass for the specific work type. For example, `book-proposal` is still hidden for fiction prose because `nonfiction_only` narrows the broad prose/sacred availability, and `panel-layout` is hidden for non-comic visual projects because `comic_only` narrows the visual group. Show canonical runnable command names, and use adapted labels as descriptive text only when the base command is actually available -- sacred review surfaces may show `/scr:editor-review` as scholarly review, and technical docs may show `/scr:plot-graph` as procedure map, but hidden commands stay hidden even if CONSTRAINTS.json stores an adapted label.

### Surfaces for this work type

When showing an active project, always include one compact line naming which context surfaces apply to the work type, resolved from `surface_applicability` in CONSTRAINTS.json (`by_group[<group>]` patched by any `work_type_overrides[<work_type>]`): the `required` surfaces are the spine, `optional` ones are available if useful, and `not_applicable` ones are intentionally absent (an article has no world to build, a poem has no plot to map). One line, not a lecture.

## The filtered view

If the argument matches an intent or category name (e.g., "revise", "publish"), show that view first. If it's a free-text search, match against command names and descriptions. If the writer asks for "all", "catalog", or "everything", show the grouped stage view after the compact intent view.

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

## Tone

Scannable. No narration, no memory-system lectures. A writer checking help wants a menu, not an essay.

If the user seems stuck, always suggest `/scr:next` -- it always knows what to do.
