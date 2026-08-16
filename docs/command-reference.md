# Command Reference

Scriveno has **127 commands** organized into **14 categories**. Commands adapt automatically to your work type -- for example, `/scr:draft` talks about drafting a surah for Quranic commentary, an act for screenplays, and a section for research papers.

Commands marked with **adaptive terminology** change how Scriveno talks about your work type's `command_unit` in `.manuscript/config.json`, while keeping the runnable command id stable. Commands marked with **group adaptation** have different labels for specific work type groups (academic, sacred, etc.).

This page covers writer-facing `/scr:*` commands. Package-level audit commands live in the `scriveno` CLI: `scriveno status --project . --apply-safe`, `scriveno sync --check`, `scriveno smoke`, `scriveno agents`, and `scriveno routes`. See [Auto-Invoke Policy](auto-invoke-policy.md), [Runtime Support](runtime-support.md), and [Route Graph Audit](route-graph.md) for those surfaces.

## Table of Contents

1. [Core](#core) -- The main workflow: create, discuss, plan, draft, review, submit
2. [Navigation](#navigation) -- Find your way: next step, help, progress, import
3. [Session](#session) -- Save, compare, undo, pause and resume your work
4. [Structure](#structure) -- Plot graphs, climax, timelines, themes, outlines
5. [Structure Management](#structure-management) -- Add, insert, remove, split, merge, reorder units
6. [Character & World](#character--world) -- Characters, relationships, world-building
7. [Quality](#quality) -- Voice calibration, line editing, copy editing, polish
8. [Review](#review) -- Continuity, voice, sensitivity, pacing, dialogue, beta readers
9. [Publishing](#publishing) -- Front/back matter, blurbs, synopses, export, publish
10. [Illustration](#illustration) -- Cover art, scene illustrations, character refs, maps
11. [Translation](#translation) -- Translate, glossary, memory, cultural adaptation
12. [Collaboration](#collaboration) -- Revision tracks and their collaboration subcommands
13. [Utility](#utility) -- Manager, health checks, quick edits, notes, settings
14. [Sacred Exclusive](#sacred-exclusive) -- Concordance, cross-reference, genealogy, and more

---

## Core

The main workflow commands. Every writing project follows this chain: new-work, discuss, plan, draft, editor-review, submit, complete-draft.

### `/scr:new-work`

**Description:** Start a new creative work. Adaptive onboarding detects work type and generates tailored context files.

**Usage:** `/scr:new-work [--quick] [--type <work_type>]`

**Prerequisites:** None

**Flags:**
- `--quick` -- Skip questions 2-3, use defaults
- `--type <work_type>` -- Skip the "what are you writing?" question

**Example:**
```
/scr:new-work --type novel
```
Start a novel project. Scriveno asks your premise and whether you have existing material, then generates all context files.

---

### `/scr:discuss`

**Description:** Shape the next unit before planning. Discuss the approach, voice, themes, open questions.

**Usage:** `/scr:discuss [unit number, optional]`

**Prerequisites:** OUTLINE.md must exist

**Adaptive terminology:** Scriveno keeps the runnable command as `/scr:discuss` and frames the unit appropriately -- chapter (novel), act (screenplay), surah (Quranic), section (research paper)

**Example:**
```
/scr:discuss 3
```
Talk through Chapter 3 before planning it -- themes to explore, character arcs to advance, tone shifts to consider.

---

### `/scr:plan`

**Description:** Research and plan the next unit. Produces a structured plan file the drafter agent uses.

**Usage:** `/scr:plan [unit number, optional]`

**Prerequisites:** Discussed unit context (`{N}-CONTEXT.md`)

**Adaptive terminology:** Same pattern as discuss -- `/scr:plan` stays stable while Scriveno speaks in chapters, acts, surahs, and other unit labels

**Example:**
```
/scr:plan 5
```
Research and plan Chapter 5, producing plan files for each scene the drafter agent will use.

---

### `/scr:draft`

**Description:** Draft the planned unit. Invokes the drafter agent in fresh context per atomic unit.

**Usage:** `/scr:draft [unit number, optional]`

**Prerequisites:** Plan files must exist in `.manuscript/plans/` (`{N}-*-PLAN.md`). Legacy root-level plan files are still accepted for older projects.

**Adaptive terminology:** `/scr:draft` stays stable while Scriveno frames the work as drafting a chapter, act, surah, section, and so on

**Example:**
```
/scr:draft 5
```
Draft all scenes in Chapter 5. Each scene gets fresh context with STYLE-GUIDE.md loaded first to maintain your voice.

---

### `/scr:editor-review`

**Description:** Walk the writer through editorial review, manage editor-writer collaboration workflow with proposal reviews, notes, and decision tracking.

**Usage:** `/scr:editor-review [N] [--proposal <name> | --notes | --respond <name>]`

**Prerequisites:** Draft files must exist in `.manuscript/drafts/body/` (`{N}-*-DRAFT.md`)

**Flags:**
- `--proposal <name>` -- Review a specific editorial proposal
- `--notes` -- View editor notes
- `--respond <name>` -- Respond to an editor proposal

**Group adaptation:**
- Academic label: `peer-review`
- Sacred label: `scholarly-review`

**Example:**
```
/scr:editor-review 3
```
Review the draft of unit 3 with your editor hat on. Scriveno highlights issues, suggests improvements, and tracks your decisions.

---

### `/scr:submit`

**Description:** Package and finalize a unit after editor review.

**Usage:** `/scr:submit [unit number]`

**Prerequisites:** Review report must exist in `.manuscript/reviews/` (`{N}-REVIEW.md`). Legacy root-level `{N}-EDITOR-NOTES.md` is still accepted for older projects.

**Adaptive terminology:** `/scr:submit` stays stable while Scriveno describes the current chapter, act, surah, or other unit being finalized

**Example:**
```
/scr:submit 3
```
Finalize Chapter 3 after editor review. Marks it as complete in the workflow.

---

### `/scr:proof-unit`

**Description:** Run one manuscript unit through a proof path from voice profile to export readiness.

**Usage:** `/scr:proof-unit [unit] [--demo] [--export-check]`

**Prerequisites:** STYLE-GUIDE.md should be populated. If it is missing or still a template, run `/scr:profile-writer` first, then `/scr:voice-test`.

**Flags:**
- `--demo` -- Use the demo proof path when available
- `--export-check` -- Run `/scr:export --check` after review to verify external tools

**Example:**
```
/scr:proof-unit 3 --export-check
```
Prove one chapter through discuss, plan, draft, review, context health, and export-tool readiness without silently running a full publishing pipeline.

---

### `/scr:complete-draft`

**Description:** Mark the entire manuscript draft as complete.

**Usage:** `/scr:complete-draft`

**Prerequisites:** All units must be submitted

**Example:**
```
/scr:complete-draft
```
After all chapters are submitted, mark the full draft as complete. Unlocks publishing, export, and translation commands.

---

### `/scr:new-revision`

**Description:** Start a new revision of the manuscript. Archives the current draft and begins a fresh pass.

**Usage:** `/scr:new-revision`

**Prerequisites:** Archived draft must exist

**Example:**
```
/scr:new-revision
```
Archive the current draft and start revision 2. All drafts are preserved in the archive.

---

### `/scr:autopilot`

**Description:** Run the full drafting pipeline autonomously. Choose guided, supervised, or full-auto profiles.

**Usage:** `/scr:autopilot [--profile guided|supervised|full-auto] [--from <stage>] [--to <stage>] [--unit N] [--resume] [--matter <minimum|balanced|maximum|skip>]`

**Prerequisites:** None (recommended: run `/scr:profile-writer` first)

**Flags:**
- `--profile` -- Control level: `guided` (pauses for approval), `supervised` (pauses at milestones), `full-auto` (runs everything)
- `--from` / `--to` -- Limit the pipeline stages
- `--unit N` -- Start from a specific unit
- `--resume` -- Continue from where autopilot left off
- `--matter` -- After a full manuscript run, generate missing front and back matter through the dedicated matter commands. Defaults to `balanced`; use `skip` to opt out.

**Example:**
```
/scr:autopilot --profile supervised --from plan --to draft
```
Run planning and drafting for all units, pausing at milestones for your review.

When autopilot completes every unit through submit, it checks publication matter and invokes `/scr:front-matter --level <level>` and `/scr:back-matter --level <level>` for missing files. It does not run this phase for partial `--from` / `--to` runs and does not silently overwrite writer-authored matter.

---

### `/scr:cycle`

**Description:** Run one unit through the full pipeline -- discuss, plan, draft, editor-review, line-edit, submit, save. Guided by default.

**Usage:** `/scr:cycle [N] [--silent] [--from <stage>]`

**Prerequisites:** None (the unit must exist in your outline; the cycle runs each stage that is not yet done)

**Flags:**
- `--silent` -- Run all stages without pausing; the cycle still ends with a save.
- `--from <stage>` -- Resume the cycle at a named stage (`discuss`, `plan`, `draft`, `editor-review`, `line-edit`, `submit`, `save`).

**Example:**
```
/scr:cycle 2
/scr:cycle 2 --silent
/scr:cycle 2 --from draft
```
Take one unit all the way through discuss, plan, draft, editor-review, line-edit, submit, and save, pausing after each prose stage for approve/revise/stop. The single-unit, guided-by-default counterpart to `/scr:autopilot`, and the only pipeline command that ends with a save. Honors the `autosave` setting for extra checkpoints.

---

### `/scr:series-bible`

**Description:** Create, view, or check the series bible -- a persistent cross-book knowledge base for multi-volume works (novel series, TV seasons, comic runs, sequel trilogies, multi-book commentaries).

**Usage:** `/scr:series-bible [--init] [--import <work_path>] [--check] [--timeline] [--characters]`

**Prerequisites:** None

**Flags:**
- `--init` -- Create a new series bible
- `--import <work_path>` -- Import from an existing work
- `--check` -- Verify consistency across volumes
- `--timeline` -- Show series-wide timeline
- `--characters` -- Show character appearances across volumes

**Example:**
```
/scr:series-bible --init
```
Start a series bible for a trilogy. Track characters, world details, and timelines across all books.

---

## Navigation

Commands for finding your way through the workflow and understanding your manuscript.

### `/scr:first-run`

**Description:** Run the guided first-run path through install checks, demo proof, starter choices, and next commands.

**Usage:** `/scr:first-run [--proof] [--runtime <runtime>]`

**Prerequisites:** None

**Example:**
```
/scr:first-run
```
Show the proof-first path, runtime command shapes, demo sequence, proof artifacts, and the first safe command to try.

---

### `/scr:next`

**Description:** Auto-detect what to do next in your workflow and run it. The one command a writer can always use.

**Usage:** `/scr:next`

**Prerequisites:** None

**Example:**
```
/scr:next
```
Not sure what comes after planning? Just run `/scr:next` and Scriveno recommends one next command with a short reason and a few useful alternatives.

---

### `/scr:do`

**Description:** Natural language router. Type what you want in plain English, Scriveno figures out which command to run.

**Usage:** `/scr:do "<what you want to do>"`

**Prerequisites:** None

**Example:**
```
/scr:do "edit the scene where Maria meets the detective"
```
Scriveno maps your intent to the right command and runs it.

---

### `/scr:help`

**Description:** Show Scriveno commands grouped by workflow stage, filtered to what's relevant for your current work type and progress.

**Usage:** `/scr:help [category or search term, optional]`

**Prerequisites:** None

**Example:**
```
/scr:help publishing
```
Show publishing-related commands available for your work type. Without a category, `/scr:help` starts with a compact view based on project state: start, draft, revise, navigate, publish, translate, collaborate, or repair.

---

### `/scr:progress`

**Description:** Show project progress -- a unit progress bar, what is done / in progress / untouched, pipeline position, and a pointer to the per-unit ledger.

**Usage:** `/scr:progress`

**Prerequisites:** None

**Output includes:**
- A deliverable progress bar over units (done / in progress / untouched) with percent
- Pipeline position on the writing lifecycle (e.g., "Stage 6 of 10: Drafting")
- A pointer to `.manuscript/PROGRESS.md`, the openable per-unit ledger you can read any time

**Example:**
```
/scr:progress
```
See "████████░░ 4/12 chapters done (33%). Pipeline: Stage 6 of 10 (Drafting). Next: discuss chapter 5. Full ledger: .manuscript/PROGRESS.md."

---

### `/scr:demo`

**Description:** Launch or clear a pre-built sample project sandbox for exploring Scriveno without risk.

**Usage:** `/scr:demo [--clear] [--genre <genre>]`

**Prerequisites:** None

**Flags:**
- `--clear` -- Remove the demo project
- `--genre <genre>` -- Choose a demo genre

**Example:**
```
/scr:demo
```
Explore Scriveno with a pre-built watchmaker story -- 5 scenes, full context files, everything ready to try commands.

---

### `/scr:import`

**Description:** Import an existing manuscript (docx, markdown, txt, or directory) and structure it into a Scriveno .manuscript/ directory.

**Usage:** `/scr:import <file_or_directory_path> [--type <work_type>]`

**Prerequisites:** None

**Flags:**
- `--type <work_type>` -- Specify the work type if Scriveno can't auto-detect it

**Example:**
```
/scr:import ~/Documents/my-novel.docx --type novel
```
Import an existing Word document and split it into chapters, scenes, and context files.

---

### `/scr:map-manuscript`

**Description:** Spawn parallel analysis agents to understand an existing manuscript's voice, structure, characters, and themes.

**Usage:** `/scr:map-manuscript [area]`

**Prerequisites:** None

**Example:**
```
/scr:map-manuscript
```
Analyze a manuscript you imported. Scriveno reads the whole thing and extracts voice profile, character list, themes, and structure.

---

### `/scr:manuscript-stats`

**Description:** Show manuscript word count, chapter count, estimated page count, and reading time.

**Usage:** `/scr:manuscript-stats [--detail]`

**Prerequisites:** None

**Flags:**
- `--detail` -- Show per-unit breakdown

**Output includes:**
- Total words and pages vs. work type target range (e.g., 14,200 / 70,000-100,000 words)
- Units drafted vs. expected count (e.g., 4 / 20-35 chapters)
- Per-unit pacing check against unit word/page range
- Estimated reading time

Word and page ranges are sourced from `word_count_range`, `page_range`, `unit_count_range`, `unit_word_range`, and `unit_page_range` in CONSTRAINTS.json. Page counts use ~250 words/page (standard manuscript format).

**Example:**
```
/scr:manuscript-stats --detail
```
See word counts per chapter, total pages, progress against targets, and estimated reading time.

---

## Session

Writer-friendly git abstractions. Save your work, compare versions, and undo mistakes -- no git knowledge required.

### `/scr:save`

**Description:** Save your current work. Auto-generates a descriptive save message from context.

**Usage:** `/scr:save [optional message]`

**Prerequisites:** None

**Example:**
```
/scr:save "finished the rooftop confrontation"
```
Save your work with a note. If you skip the message, Scriveno writes one based on what changed.

---

### `/scr:history`

**Description:** See the timeline of your saves. Shows when you saved and what you were working on.

**Usage:** `/scr:history [--limit N]`

**Prerequisites:** None

**Flags:**
- `--limit N` -- Show only the last N saves

**Example:**
```
/scr:history --limit 5
```
See your last 5 saves with timestamps and descriptions.

---

### `/scr:compare`

**Description:** Compare your current work with a previous save. Shows changes in plain prose, not code diff.

**Usage:** `/scr:compare [save number or 'last']`

**Prerequisites:** None

**Example:**
```
/scr:compare last
```
See what changed since your last save, described in plain language.

---

### `/scr:versions`

**Description:** List your draft versions with readable labels.

**Usage:** `/scr:versions [--all]`

**Prerequisites:** None

**Flags:**
- `--all` -- Remove the default 10-version limit and show the complete save-version list

**Example:**
```
/scr:versions
```
See your recent save timeline with readable labels like "Current", "Yesterday", and "Apr 4".
Use `--all` when you want the complete save-version list without the default 10-version cap.

---

### `/scr:undo`

**Description:** Undo your last save and go back to the previous version.

**Usage:** `/scr:undo [--force] [--deeper]`

**Prerequisites:** None

**Flags:**
- `--force` -- Skip the unsaved-changes warning, but still require confirmation before undoing
- `--deeper` -- Skip an existing undo checkpoint and target the previous saved version instead

**Example:**
```
/scr:undo
```
Go back to the previous save. Scriveno shows what will be reverted, refuses to commit conflict markers, and still asks for confirmation, even with `--force`.

---

### `/scr:pause-work`

**Description:** Pause your work session. Captures where you are and what you were thinking so you can pick up later.

**Usage:** `/scr:pause-work`

**Prerequisites:** Populated `STYLE-GUIDE.md`. If the style guide is missing or still has placeholders, Scriveno routes you to `/scr:profile-writer` instead of generating a test passage.

**Example:**
```
/scr:pause-work
```
Capture your mental state before stepping away. Scriveno notes what you were working on, open threads, and next steps.

---

### `/scr:resume-work`

**Description:** Pick up where you left off. Reads your last session and tells you what's next.

**Usage:** `/scr:resume-work`

**Prerequisites:** None

**Example:**
```
/scr:resume-work
```
Get oriented after a break. Scriveno reminds you what you were doing and suggests what to tackle next.

---

### `/scr:session-report`

**Description:** See what you accomplished this session. Shows units drafted, words written, and time spent.

**Usage:** `/scr:session-report`

**Prerequisites:** None

**Example:**
```
/scr:session-report
```
End-of-session summary: "You drafted 3 chapters (8,400 words) over 2.5 hours. Voice consistency: 94%."

---

## Structure

Commands for visualizing and managing your narrative structure, themes, and timeline.

### `/scr:plot-graph`

**Description:** Visualize and manage the narrative arc structure of the story.

**Usage:** `/scr:plot-graph [--edit] [--type <arc_type>]`

**Prerequisites:** OUTLINE.md must exist

**Flags:**
- `--edit` -- Modify the arc structure
- `--type <arc_type>` -- Arc type: three-act, five-act, hero's journey, kishotenketsu, etc.

**Available for:** Prose, script, technical, visual, interactive

**Group adaptation:**
- Technical label: `procedure-map`

**Example:**
```
/scr:plot-graph --type hero's-journey
```
Visualize your novel's structure mapped to the hero's journey.

---

### `/scr:climax`

**Description:** Generate and pressure-test the story's climax where conflict, crisis, character arcs, and planted payoffs converge.

**Usage:** `/scr:climax [unit number, optional]`

**Prerequisites:** OUTLINE.md must exist

**Available for:** Prose, script, visual, interactive, sacred

**Example:**
```
/scr:climax
```
Devise and pressure-test the climax (which setups fire, whose arc resolves, what it costs), then hand off to `/scr:plan` for the scene.

---

### `/scr:timeline`

**Description:** Generate a chronological event timeline from the outline.

**Usage:** `/scr:timeline [--story-order] [--chronological]`

**Prerequisites:** OUTLINE.md must exist

**Available for:** Prose, script, academic, visual, interactive

**Sacred note:** Sacred projects use the dedicated `/scr:sacred:chronology` command instead of `/scr:timeline`.

**Example:**
```
/scr:timeline
```
See events in chronological order, even if your narrative is non-linear.

---

### `/scr:theme-tracker`

**Description:** Track thematic threads across the work with auto-detection suggestions.

**Usage:** `/scr:theme-tracker [--detect]`

**Prerequisites:** THEMES.md must exist

**Available for:** Prose, script, visual, poetry, interactive

**Example:**
```
/scr:theme-tracker
```
See where your themes appear across chapters and which ones need more development.

---

### `/scr:subject-touch`

**Description:** Update an evolving subject, idea, claim, procedure, doctrine, object, image pattern, or reader-state thread after a unit lands.

**Usage:** `/scr:subject-touch <subject> [--from <unit>]`

**Prerequisites:** Adapted subject file must exist, drafted prose must exist

**Available for:** All work types

**Group adaptation:**
- Academic label: `concept-touch`
- Technical label: `procedure-touch`
- Sacred label: `doctrine-touch`

**Example:**
```
/scr:subject-touch "forged letter" --from 4
```
Update how the forged letter is tracked after Chapter 4 changes its meaning from evidence to burden.

---

### `/scr:subplot-map`

**Description:** Visualize subplot threads and their intersections across the work.

**Usage:** `/scr:subplot-map`

**Prerequisites:** OUTLINE.md must exist, at least 2 threads

**Available for:** Prose, script, interactive

**Example:**
```
/scr:subplot-map
```
See how your subplots weave together and where they intersect with the main plot.

---

### `/scr:outline`

**Description:** Display or edit the structural outline of the work.

**Usage:** `/scr:outline [--edit] [--snowflake]`

**Prerequisites:** OUTLINE.md must exist

**Available for:** Prose, script, academic, technical, visual, interactive, sacred

**Flags:**
- `--edit` -- Modify the outline
- `--snowflake` -- Build the outline progressively with the snowflake method (logline -> paragraph -> character thumbnails -> plot summary -> scene list)

**Example:**
```
/scr:outline --edit
```
View and restructure your outline interactively.

---

## Structure Management

Commands for modifying the structural units in your outline -- adding, removing, splitting, merging, and reordering.

### `/scr:add-unit`

**Description:** Add a new unit to the end of the outline.

**Usage:** `/scr:add-unit [title]`

**Prerequisites:** OUTLINE.md must exist

**Available for:** Prose, script, academic, technical, visual, interactive, sacred

**Example:**
```
/scr:add-unit "The Aftermath"
```
Add a new chapter (or act, section, surah, etc.) at the end of the outline.

---

### `/scr:insert-unit`

**Description:** Insert a new unit at a specific position in the outline.

**Usage:** `/scr:insert-unit [position] [title]`

**Prerequisites:** OUTLINE.md must exist

**Available for:** Prose, script, academic, technical, visual, interactive, sacred

**Example:**
```
/scr:insert-unit 3 "The Reveal"
```
Insert a new chapter at position 3, shifting later chapters forward.

---

### `/scr:remove-unit`

**Description:** Remove a unit from the outline with draft safety checks.

**Usage:** `/scr:remove-unit [unit-id]`

**Prerequisites:** OUTLINE.md must exist

**Available for:** Prose, script, academic, technical, visual, interactive, sacred

**Example:**
```
/scr:remove-unit 7
```
Remove chapter 7. Scriveno warns if it has drafted content and asks for confirmation.

---

### `/scr:split-unit`

**Description:** Split one unit into two at a specified point.

**Usage:** `/scr:split-unit [unit-id] [split-point]`

**Prerequisites:** OUTLINE.md must exist

**Available for:** Prose, script, academic, technical, visual, interactive, sacred

**Example:**
```
/scr:split-unit 5 "after the trial scene"
```
Split Chapter 5 into two chapters at the specified point.

---

### `/scr:merge-units`

**Description:** Merge two adjacent units into one.

**Usage:** `/scr:merge-units [unit-id-1] [unit-id-2]`

**Prerequisites:** OUTLINE.md must exist

**Available for:** Prose, script, academic, technical, visual, interactive, sacred

**Example:**
```
/scr:merge-units 3 4
```
Merge chapters 3 and 4 into a single chapter.

---

### `/scr:reorder-units`

**Description:** Reorder units in the outline by moving a unit to a new position.

**Usage:** `/scr:reorder-units [unit-id] [new-position]`

**Prerequisites:** OUTLINE.md must exist

**Available for:** Prose, script, academic, technical, visual, interactive, sacred

**Example:**
```
/scr:reorder-units 8 3
```
Move chapter 8 to position 3, shifting other chapters accordingly.

---

## Character & World

Commands for creating and managing characters, relationships, and world-building. Hidden for poetry and speech work types.

### `/scr:new-people`

**Description:** Build a people (race, faction, culture, nation) as a collective entity through a guided interview.

**Usage:** `/scr:new-people <name>`

**Prerequisites:** WORK.md must exist

**Available for:** Prose, script, visual, interactive, sacred

**Example:**
```
/scr:new-people Aurelians
```
Profile a people as a collective: origin, values, speech, collective want and fear, members, and how they relate to other peoples. The tier above individual characters.

---

### `/scr:new-character`

**Description:** Build a complete character profile through guided interactive interview.

**Usage:** `/scr:new-character <name>`

**Prerequisites:** WORK.md must exist

**Available for:** Prose, script, technical, visual, interactive

**Example:**
```
/scr:new-character
```
Start building a character. Scriveno interviews you about appearance, personality, backstory, voice, and role in the story.

---

### `/scr:character-sheet`

**Description:** Display or edit a specific character's full profile.

**Usage:** `/scr:character-sheet [name] [--edit]`

**Prerequisites:** CHARACTERS.md must exist

**Available for:** Prose, script, technical, visual, interactive

**Flags:**
- `--edit` -- Modify the character profile

**Example:**
```
/scr:character-sheet Maria --edit
```
View Maria's full profile and make changes.

---

### `/scr:character-touch`

**Description:** Update a character's evolving state (emotional position, knowledge, possessions, relationships) after a unit lands.

**Usage:** `/scr:character-touch <name> [--from <unit>]`

**Prerequisites:** CHARACTERS.md must exist; at least one unit drafted

**Available for:** Prose, script, visual, interactive, sacred (renamed `figure-touch` for sacred)

**Flags:**
- `<name>` -- Character to update. Omit to list all characters and pick interactively.
- `--from <unit>` -- Base the update on a specific unit's drafted prose. If omitted, defaults to the most recently modified draft file.

**Example:**
```
/scr:character-touch Marcus --from 12
```
After drafting unit 12, propose updates to Marcus's emotional position, knowledge, possessions, and relationships based on what happened in that draft. Voice anchor and physical description stay untouched. The drafter agent emits a "CHARACTER STATE NUDGE" suggestion when it spots a visible state shift, pointing the writer here.

---

### `/scr:relationship-map`

**Description:** Generate an ASCII relationship graph between cast entries.

**Usage:** `/scr:relationship-map [--edit]`

**Prerequisites:** Adapted cast surface must exist with at least 2 entries

**Available for:** Prose, script, visual, interactive

**Flags:**
- `--edit` -- Modify relationships

**Example:**
```
/scr:relationship-map
```
See how all your characters relate to each other in an ASCII diagram.

---

### `/scr:build-world`

**Description:** Generate or refine the world document through progressive questioning.

**Usage:** `/scr:build-world [--area <area>]`

**Prerequisites:** None

**Available for:** Prose, script, technical, visual, interactive

**Group adaptation:**
- Technical label: `map-system`

**Flags:**
- `--area <area>` -- Focus on a specific area of the world

**Example:**
```
/scr:build-world --area "magic system"
```
Flesh out your magic system through guided world-building questions.

---

### `/scr:new-place`

**Description:** Create a confirmed place profile in PLACES.md through guided questions.

**Usage:** `/scr:new-place <name>`

**Prerequisites:** WORK.md must exist

**Available for:** Prose, script, academic, technical, visual, interactive, sacred

**Example:**
```
/scr:new-place "New York City"
```
Add a confirmed place profile without auto-promoting scan candidates into canon.

---

### `/scr:place-touch`

**Description:** Update a place's evolving geography, appearances, research status, or continuity rules.

**Usage:** `/scr:place-touch <name> [--from <unit>]`

**Prerequisites:** Adapted world surface must exist

**Available for:** Prose, script, academic, technical, visual, interactive, sacred

**Example:**
```
/scr:place-touch "New York City" --from 4
```
Update a confirmed place after drafting or research, then refresh the derived geography map.

---

### `/scr:geography-map`

**Description:** Render or regenerate the derived geography map from PLACES.md and the world surface.

**Usage:** `/scr:geography-map [--fix] [--region <name>]`

**Prerequisites:** Adapted world surface must exist

**Available for:** Prose, script, academic, technical, visual, interactive, sacred

**Flags:**
- `--fix` -- Write the derived `.manuscript/GEOGRAPHY.md`
- `--region <name>` -- Render one region and its neighboring places

**Example:**
```
/scr:geography-map --region "Lower Manhattan"
```
View confirmed place hierarchy, routes, distances, and undefined spatial questions.

---

### `/scr:cast-list`

**Description:** Display the roster of all cast entries with roles and brief descriptions.

**Usage:** `/scr:cast-list`

**Prerequisites:** None

**Available for:** Prose, script, visual, interactive

**Example:**
```
/scr:cast-list
```
Quick overview of all characters: name, role, one-line description.

---

### `/scr:character-arc`

**Description:** Visualize a character's emotional and growth arc across the story.

**Usage:** `/scr:character-arc [name]`

**Prerequisites:** CHARACTERS.md must exist

**Available for:** Prose, script, visual, interactive

**Example:**
```
/scr:character-arc Maria
```
See Maria's emotional journey mapped across chapters -- where she starts, key turning points, where she ends.

---

### `/scr:character-voice-sample`

**Description:** Generate a dialogue sample to preview a character's voice before drafting.

**Usage:** `/scr:character-voice-sample [name]`

**Prerequisites:** CHARACTERS.md and STYLE-GUIDE.md must exist

**Available for:** Prose, script, visual, interactive

**Example:**
```
/scr:character-voice-sample Detective Chen
```
Hear how Detective Chen sounds in dialogue before you start drafting scenes with them.

---

## Quality

Commands for calibrating voice and polishing prose.

### `/scr:voice-test`

**Description:** Voice calibration gate. Generates a work-type-aware sample in the writer's proposed voice and asks "does this sound like you?" before any real drafting begins.

**Usage:** `/scr:voice-test`

**Prerequisites:** None

**Available for:** All work types

**Example:**
```
/scr:voice-test
```
Scriveno drafts a work-type-aware sample using your voice profile. If it doesn't sound right, you refine together until it does.

---

### `/scr:line-edit`

**Description:** Perform a line-level prose quality pass with inline annotations.

**Usage:** `/scr:line-edit [N]`

**Prerequisites:** Draft must exist

**Output:** Writes `.manuscript/reviews/{scope}-SENSITIVITY-REVIEW.md`. Older root-level reports are still read for backward compatibility.

**Available for:** All work types

**Example:**
```
/scr:line-edit
```
Scriveno reads your prose line by line, flagging weak verbs, passive voice, redundancy, and awkward phrasing.

---

### `/scr:copy-edit`

**Description:** Perform a correctness pass for grammar, spelling, punctuation, and consistency.

**Usage:** `/scr:copy-edit [N]`

**Prerequisites:** Draft must exist

**Output:** Writes `.manuscript/reviews/{scope}-ORIGINALITY-REPORT.md`. Older root-level reports are still read for backward compatibility.

**Available for:** All work types

**Example:**
```
/scr:copy-edit
```
Catch typos, grammar issues, and consistency problems (character name spellings, timeline errors, style inconsistencies).

---

### `/scr:polish`

**Description:** Chain line-edit, copy-edit, and voice-check for comprehensive prose polish.

**Usage:** `/scr:polish [N]`

**Prerequisites:** Draft and STYLE-GUIDE.md must exist

**Available for:** All work types

**Example:**
```
/scr:polish
```
Run all three quality passes in sequence. The comprehensive final polish before publication.

---

### `/scr:quick-write`

**Description:** Write a scene, passage, or chapter outside the full planning workflow.

**Usage:** `/scr:quick-write [--discuss] [--research] [--full]`

**Prerequisites:** None

**Available for:** All work types

**Example:**
```
/scr:quick-write
```
Skip the plan-then-draft workflow and just write. Good for inspiration strikes or experimental scenes.

---

## Review

Commands for reviewing your manuscript from different angles -- continuity, voice, sensitivity, pacing, dialogue, and reader experience.

### `/scr:continuity-check`

**Description:** Automated continuity verification to scan for narrative contradictions across the manuscript.

**Usage:** `/scr:continuity-check [N]`

**Prerequisites:** Draft must exist

**Available for:** Prose, script, technical, visual, interactive

**Group adaptation:**
- Technical label: `consistency-check`

**Example:**
```
/scr:continuity-check
```
Find contradictions: "In Chapter 3 Maria has brown eyes, but in Chapter 7 they're green."

---

### `/scr:voice-check`

**Description:** Compare drafted prose against STYLE-GUIDE.md to detect voice drift.

**Usage:** `/scr:voice-check [N]`

**Prerequisites:** Draft and STYLE-GUIDE.md must exist

**Available for:** All work types

**Group adaptation:**
- Sacred label: `register-check` (voice register consistency)

**Example:**
```
/scr:voice-check
```
Detect where your drafted prose drifts from your established voice profile.

---

### `/scr:sensitivity-review`

**Description:** Flag potential sensitivity issues with context, suggest alternatives, and note intentional craft.

**Usage:** `/scr:sensitivity-review [N]`

**Prerequisites:** Draft must exist

**Available for:** All work types

**Group adaptation:**
- Academic label: `ethics-review`
- Sacred label: `interfaith-review` (sensitivity across traditions)

**Example:**
```
/scr:sensitivity-review
```
Flag content that could be unintentionally harmful, with context-aware suggestions that respect your creative intent.

---

### `/scr:pacing-analysis`

**Description:** Generate a structure-aware pacing report analyzing scene tempo and narrative flow.

**Usage:** `/scr:pacing-analysis [N] [--seams]`

**Prerequisites:** Draft must exist

**Available for:** Prose, script, academic, visual, interactive, sacred

**Flags:**
- `--seams` -- Focus the report on the joints between units: how each unit's closing energy hands off to the next unit's opening, momentum patterns across the whole arc, and the specific boundaries where the seam is abrupt or flat.

**Example:**
```
/scr:pacing-analysis
/scr:pacing-analysis --seams
```
See where your story drags or rushes. Scriveno maps scene length, tension, and tempo across the full manuscript, and `--seams` maps the transitions between chapters so you can spot flat or jarring boundaries and repeated closing devices.

---

### `/scr:bridge`

**Description:** Diagnose a weak seam between two units and offer transition fixes in the writer's voice.

**Usage:** `/scr:bridge [<boundary>] [--apply <option>]`

**Prerequisites:** Draft must exist for both units at the boundary

**Available for:** Prose, script, academic, visual, interactive, sacred

**Flags:**
- `--apply <option>` -- Apply a chosen fix without re-prompting: `hard-cut`, `time-marker`, `bridge`, or `upstream`.

**Example:**
```
/scr:bridge 8-9
/scr:bridge 9 --apply hard-cut
```
Find why the seam between two chapters does not knit together, then choose the fix your voice profile prefers. Bridge prose is generated only when you ask for it; the default is often a clean cut.

---

### `/scr:dialogue-audit`

**Description:** Audit dialogue for character voice differentiation, attribution clarity, and talking-head detection.

**Usage:** `/scr:dialogue-audit [N]`

**Prerequisites:** Draft must exist with dialogue

**Available for:** Prose, script, interactive

**Group adaptation:**
- Visual: adapted behavior for balloon text analysis

**Example:**
```
/scr:dialogue-audit
```
Check that each character sounds distinct, dialogue tags are clear, and scenes aren't just talking heads.

---

### `/scr:beta-reader`

**Description:** Simulate a beta reader's experience of the manuscript using a fresh-context reader persona.

**Usage:** `/scr:beta-reader [N] [--focus <area>]`

**Prerequisites:** Draft must exist

**Available for:** All work types

**Group adaptation:**
- Academic label: `reviewer-simulation`
- Sacred label: `theological-review` (doctrinal/pastoral review)

**Example:**
```
/scr:beta-reader
```
Get a simulated reader's reaction: what hooked them, where they got confused, what felt slow, what surprised them.

---

### `/scr:originality-check`

**Description:** Scan drafted prose for AI-generated patterns and unintentional similarity to published works.

**Usage:** `/scr:originality-check [N]`

**Prerequisites:** Draft must exist

**Available for:** All work types

**Example:**
```
/scr:originality-check
```
Flag passages that feel generic or accidentally echo published works.

---

## Publishing

Commands for preparing your manuscript for publication -- front/back matter, marketing copy, export formats, and publishing workflows.

### `/scr:front-matter`

**Description:** Generate publication-ready front matter elements in Chicago Manual of Style order.

**Usage:** `/scr:front-matter [--level <minimum|balanced|maximum>] [--element <name>]`

**Prerequisites:** Complete draft must exist

**Flags:**
- `--level <value>` -- How much to generate. `minimum` = title page, copyright, TOC. `balanced` = minimum + half-title, dedication, epigraph, acknowledgments. `maximum` = every applicable element (legacy "all 19" behavior). If omitted (and `--element` is also omitted), the command prompts: skip / minimum / balanced / maximum.
- `--element <name>` -- Generate only the named element. Bypasses the level filter. Series works also accept `--element recap` to generate a "Previously in [Series]" recap page from the series bible and the prior book's record.

**Available for:** Prose, script, academic, visual, sacred

**Group adaptation:**
- Academic: adapted behavior for academic front matter (abstract, acknowledgments, etc.)
- Sacred: adapted behavior for sacred front matter (imprimatur, dedication to deity, etc.)

**Example:**
```
/scr:front-matter                          # interactive prompt
/scr:front-matter --level balanced         # non-interactive, retail default
/scr:front-matter --element copyright      # one element, ignores level
```
Generate title page, copyright page, dedication, epigraph, table of contents, and more (level controls how much).

---

### `/scr:back-matter`

**Description:** Generate publication-ready back matter elements.

**Usage:** `/scr:back-matter [--level <minimum|balanced|maximum>] [--element <name>]`

**Prerequisites:** Complete draft must exist

**Flags:**
- `--level <value>` -- How much to generate. `minimum` = about-the-author (plus bibliography for academic and sacred). `balanced` = minimum + colophon, permissions when applicable. `maximum` = every applicable element (legacy "all 12" behavior). If omitted (and `--element` is also omitted), the command prompts: skip / minimum / balanced / maximum.
- `--element <name>` -- Generate only the named element. Bypasses the level filter.

**Available for:** Prose, script, academic, visual, sacred

**Group adaptation:**
- Academic: adapted behavior for academic back matter (bibliography, appendices, etc.)
- Sacred: adapted behavior for sacred back matter (glossary of terms, concordance index, etc.)

**Example:**
```
/scr:back-matter                           # interactive prompt
/scr:back-matter --level balanced          # non-interactive, retail default
/scr:back-matter --element about-author    # one element, ignores level
```
Generate acknowledgments, about the author, reading group guide, also by, and more (level controls how much).

---

### `/scr:blurb`

**Description:** Generate marketing blurb in three variations for back cover and retailer listings.

**Usage:** `/scr:blurb`

**Prerequisites:** Complete draft must exist

**Available for:** Prose, script, visual, poetry, interactive, sacred

**Example:**
```
/scr:blurb
```
Get three blurb variations: punchy (Amazon listing), standard (back cover), extended (Goodreads).

---

### `/scr:synopsis`

**Description:** Generate plot synopsis at specified length for query and submission packages.

**Usage:** `/scr:synopsis [--length <1p|2p|5p>]`

**Prerequisites:** Complete draft must exist

**Available for:** Prose, script, visual

**Example:**
```
/scr:synopsis
```
Generate a 1-page and 3-page synopsis for agent submissions.

---

### `/scr:query-letter`

**Description:** Generate agent query letter adapted to genre conventions.

**Usage:** `/scr:query-letter`

**Prerequisites:** Blurb and synopsis must exist

**Available for:** Prose, script, sacred

**Example:**
```
/scr:query-letter
```
Draft a query letter following genre conventions with hook, pitch, bio, and comp titles.

---

### `/scr:book-proposal`

**Description:** Generate nonfiction book proposal for agent or publisher submission.

**Usage:** `/scr:book-proposal`

**Prerequisites:** Synopsis must exist

**Available for:** Prose, sacred (nonfiction only)

**Example:**
```
/scr:book-proposal
```
Generate a full book proposal: overview, market analysis, chapter summaries, author platform, sample chapter.

---

### `/scr:discussion-questions`

**Description:** Generate reading group discussion questions exploring themes, characters, and craft.

**Usage:** `/scr:discussion-questions [--count <N>]`

**Prerequisites:** Complete draft must exist

**Available for:** Prose

**Example:**
```
/scr:discussion-questions
```
Generate 10-15 book club questions that spark real conversation about your themes.

---

### `/scr:publish`

**Description:** Publishing wizard or preset-driven pipeline. Chains export commands based on destination and enforces final compliance gates for retail, print, and distributor packages.

**Usage:** `/scr:publish [--preset <preset>] [--all] [--skip-validate] [--preflight]`

**Prerequisites:** Complete draft, current `/scr:prepublish-review`, and current `.manuscript/reviews/PLATFORM-COMPLIANCE.md` for retail, print, wide, or distributor presets.

**Flags:**
- `--preset <preset>` -- Run a named preset without questions. Presets group into four families:
  - **Share (single deliverable, no retailer packaging):** `share-pdf`, `share-docx`, `share-epub`, `share-bundle`
  - **Publish (retail / distribution):** `ebook-wide`, `kdp-ebook`, `kdp-paperback`, `ingram-paperback`
  - **Submit (agent / editor):** `query-submission`, `submission-package`, `screenplay-query`
  - **Academic / archival:** `academic-submission`, `thesis-defense`, `all-formats`
- `--all` -- Run all applicable presets
- `--skip-validate` -- Skip the scaffold-marker validation gate (not recommended)
- `--preflight` -- Check publishing readiness and external tools, then stop before writing deliverables
- No flags -- Run the interactive wizard, which asks the writer-facing question "What are you doing?" (Share / Publish / Submit / Academic / Screenplay / Everything / Custom) and drills into the matching branch.

**Compliance gate:** When a preset targets a publishing platform, `/scr:publish` runs or requires `/scr:compliance-check --platform <target>` before export packaging proceeds.

**Available for:** All work types

**Example:**
```
/scr:publish --preset kdp-paperback
```
Run the full KDP paperback publishing pipeline: prepare the interior package, generate the platform handoff brief, and use the finished print cover from `.manuscript/build/paperback-cover.pdf`.

---

### `/scr:prepublish-review`

**Description:** Run a final editorial go/no-go review before export or publishing.

**Usage:** `/scr:prepublish-review [--preset <preset>] [--strict]`

**Prerequisites:** Complete draft must exist

**Flags:**
- `--preset <preset>` -- Tune the editorial gate to a publishing, submission, academic, or screenplay destination
- `--strict` -- Treat unresolved major editorial, voice, continuity, scaffold, or missing-matter issues as a stop recommendation

**Available for:** All work types

**Example:**
```
/scr:prepublish-review --preset kdp-ebook
```
Run the final editor-style go/no-go pass and write `.manuscript/reviews/PREPUBLISH-REVIEW.md` before technical publish preflight.

---

### `/scr:compliance-check`

**Description:** Check the manuscript, metadata, and cover assets against platform publishing policies (KDP, IngramSpark, and other retailers), copyright diligence, and AI-disclosure duties.

**Usage:** `/scr:compliance-check [--platform <platform>] [--strict]`

**Prerequisites:** Complete draft must exist

**Flags:**
- `--platform <platform>` -- Check one destination only: `kdp-ebook`, `kdp-print`, `ingramspark`, `apple-books`, `kobo`, `google-play`, `draft2digital`, `smashwords`, or `all`
- `--strict` -- Treat unresolved publish-time action items as a stop recommendation

**Available for:** All work types

**Example:**
```
/scr:compliance-check --platform kdp-ebook
```
Fetch the current official platform policies, map them against the project (copyright inventory, public-domain rules, AI disclosure, metadata traps), and write `.manuscript/reviews/PLATFORM-COMPLIANCE.md` with per-platform verdicts and the exact upload-screen answers.

---

### `/scr:provenance-check`

**Description:** Inspect writer-owned text and publishing files for invisible Unicode, metadata, and hard-bound provenance signals without modifying them.

**Usage:** `/scr:provenance-check [target] [--scope <source|build|output|all>] [--strict]`

**Prerequisites:** None

**Flags:**
- `--scope <scope>` -- Inspect manuscript source, build assets, output files, or all three scopes
- `--strict` -- Treat degraded or unsupported inspection lanes as unresolved findings

**Available for:** All work types

**Example:**
```text
/scr:provenance-check --scope output
```
Inspect export files without changing them and write `.manuscript/reviews/PROVENANCE-AUDIT.md` with confidence labels, capability coverage, and residual risks.

---

### `/scr:provenance-clean`

**Description:** Create verified cleaned copies of writer-owned files by removing confirmed Unicode carriers and removable provenance metadata. Dry-run by default.

**Usage:** `/scr:provenance-clean [target] [--scope <source|build|output|all>] [--apply] [--in-place]`

**Prerequisites:** None

**Flags:**
- `--scope <scope>` -- Resolve manuscript source, build assets, output files, or all three scopes
- `--apply` -- Create cleaned copies and verify them
- `--in-place` -- Replace originals only after explicit confirmation and recoverable backups

**Available for:** All work types

**Example:**
```text
/scr:provenance-clean --scope output
/scr:provenance-clean --scope output --apply
```
Preview removable findings first, then create `*.cleaned.*` copies and compare before and after evidence when the writer applies the plan.

---

Publishing boundary:

- `/scr:publish`: destination wizard and sequencing.
- `/scr:export`: one-off format output.
- `/scr:build-ebook`, `/scr:build-print`, `/scr:build-smashwords`, and `/scr:build-poetry-submission`: final package builders for a specific channel or format.
- `/scr:front-matter` and `/scr:back-matter`: content creation before packaging.
- `/scr:prepublish-review`: final editorial gate.
- `/scr:compliance-check`: platform-policy, copyright, and AI-disclosure gate.
- `/scr:provenance-check`: read-only Unicode, metadata, and hard-bound provenance audit.
- `/scr:provenance-clean`: dry-run-first cleaned-copy transform for confirmed findings.

---

### `/scr:export`

**Description:** Compile and export manuscript to publication-ready and review formats.

**Usage:** `/scr:export [--format <format>] [--formatted] [--review] [--print-ready] [--skip-validate] [--check]`

**Prerequisites:** Complete draft must exist

**Flags:**
- `--format` -- Target format: markdown, docx, pdf, epub, fountain, fdx, latex, kdp-package, ingram-package, submission-package, query-package. Use `--review` with PDF for a printable prepublication copy. If omitted, the command shows an interactive picker grouped into Single file / Print and store packaging / Submission packages and respects per-work-type availability.
- `--formatted` -- Use designed/formatted template (vs. manuscript format)
- `--review` -- Generate a printable prepublication PDF for sharing with beta readers, editors, or collaborators
- `--print-ready` -- Generate the interior print PDF surface used by print-package flows
- `--skip-validate` -- Skip the scaffold-marker validation gate (not recommended)
- `--check` -- Verify format availability and required external tools without assembling or writing export files

**Available for:** All work types (format availability varies by work type)

**Example:**
```
/scr:export --format pdf --review
/scr:export --format epub
/scr:export                       # interactive picker, then runs the chosen format
```
Export your manuscript as a publication-ready EPUB or a printable prepublication review PDF. With no flags, the command asks which format to produce instead of failing on the missing argument.

---

### `/scr:build-ebook`

**Description:** Build a publication-ready EPUB from the manuscript for a target platform.

**Usage:** `/scr:build-ebook [--platform <platform>] [--fixed-layout] [--skip-validate]`

**Prerequisites:** Complete draft must exist

**Flags:**
- `--platform <platform>` -- Target retailer: kdp, ingram, apple, bn, d2d, kobo, google, smashwords
- `--fixed-layout` -- Produce fixed-layout EPUB output for picture books and illustrated books
- `--skip-validate` -- Skip scaffold-marker validation (not recommended)

**Available for:** Prose, visual, poetry, interactive, sacred

**Platform behavior:** If `--platform` is omitted, Scriveno uses top-level `platform` from `.manuscript/config.json`, then falls back to `kdp`. The command validates the selected slug, loads `templates/platforms/{platform}/manifest.yaml`, confirms the manifest accepts EPUB, and carries the platform label plus `epub_variant` into the EPUB metadata and final report.

**Example:**
```
/scr:build-ebook --platform kdp
```
Build a retailer-ready EPUB with metadata, accessibility checks, and platform-aware styling.

---

### `/scr:build-print`

**Description:** Build a print-ready PDF from the manuscript for a target publishing platform.

**Usage:** `/scr:build-print [--platform <platform>] [--trim <size>] [--strict] [--hardcover] [--skip-validate]`

**Prerequisites:** Complete draft must exist

**Flags:**
- `--platform <platform>` -- Target print or academic platform: kdp, ingram, ieee, acm, lncs, elsevier, apa7
- `--trim <size>` -- Trim size for print-book output: 5x8, 5.25x8, 5.5x8.5, 6x9, 7x10
- `--strict` -- Turn page-count warnings into hard failures
- `--hardcover` -- Apply hardcover page limit for KDP
- `--skip-validate` -- Skip scaffold-marker validation (not recommended)

**Available for:** Prose, script, visual, poetry, sacred, academic

**Platform behavior:** `kdp` and `ingram` use the shipped print platform manifests for trim and page-count guardrails. Academic wrapper platforms (`ieee`, `acm`, `lncs`, `elsevier`, `apa7`) route to the matching LaTeX template output. EPUB-only platform profiles should be used with `/scr:build-ebook`.

**Cover pairing:** Non-academic print packages expect a finished cover at `.manuscript/build/paperback-cover.pdf` or `.manuscript/build/hardcover-cover.pdf`. Exact wrap geometry must come from the current platform template generator, not hard-coded wrap geometry in Scriveno.

**Example:**
```
/scr:build-print --platform kdp --trim 6x9
```
Build a print-ready PDF with platform guardrails, or use an academic platform to emit `.tex` source instead.

---

### `/scr:build-smashwords`

**Description:** Build a Smashwords/D2D-compliant DOCX from the manuscript.

**Usage:** `/scr:build-smashwords [--skip-validate]`

**Prerequisites:** Complete draft must exist

**Flags:**
- `--skip-validate` -- Skip scaffold-marker validation (not recommended)

**Available for:** Prose, visual

**Example:**
```
/scr:build-smashwords
```
Build a distribution-ready DOCX using the Smashwords/D2D reference document and formatting rules.

---

### `/scr:build-poetry-submission`

**Description:** Build a poetry submission manuscript DOCX with one poem per page, title page, and TOC.

**Usage:** `/scr:build-poetry-submission [--skip-validate]`

**Prerequisites:** Complete draft must exist

**Flags:**
- `--skip-validate` -- Skip scaffold-marker validation (not recommended)

**Available for:** Poetry

**Example:**
```
/scr:build-poetry-submission
```
Build a poetry-submission DOCX for journal or contest submission using the poetry reference document.

---

### `/scr:autopilot-publish`

**Description:** Run full publishing pipeline unattended with quality gate (voice-check + continuity-check).

**Usage:** `/scr:autopilot-publish --preset <preset>`

**Prerequisites:** Complete draft must exist

**Flags:**
- `--preset <preset>` -- Publishing preset to run

**Available for:** All work types

**Example:**
```
/scr:autopilot-publish --preset kdp
```
Run quality checks and then generate KDP deliverables automatically. Existing front/back matter is included, but new front/back matter stays in `/scr:front-matter` and `/scr:back-matter`.

---

## Illustration

Commands for generating cover art, scene illustrations, character references, maps, and visual layouts.

### `/scr:cover-art`

**Description:** Generate structured cover art prompts and delivery briefs for ebook, paperback, and hardcover covers.

**Usage:** `/scr:cover-art [--trim <size>] [--kdp <trim_size>] [--series] [--prompt-only] [--element front|spine|back|full-wrap]`

**Prerequisites:** WORK.md must exist

**Available for:** Prose, visual, poetry, sacred

**Flags:**
- `--trim <size>` -- Preferred trim shorthand for prompt framing
- `--kdp <trim_size>` -- Legacy alias for `--trim`
- `--series` -- Generate series-consistent cover
- `--prompt-only` -- Generate prompts without packaging reminders
- `--element` -- Generate specific cover element

**Example:**
```
/scr:cover-art --trim 6x9 --element front
```
Generate a front-cover prompt and delivery brief while keeping the final packaged files under `.manuscript/build/`.

---

### `/scr:illustrate-scene`

**Description:** Generate a scene-specific illustration prompt with character visuals, setting, and mood.

**Usage:** `/scr:illustrate-scene <scene-ref> [--style <style>]`

**Prerequisites:** ART-DIRECTION.md and draft must exist

**Available for:** Prose, visual, interactive, sacred

**Flags:**
- `--style <style>` -- Art style override

**Example:**
```
/scr:illustrate-scene 3-2 --style watercolor
```
Generate an illustration prompt for Chapter 3, Scene 2 in watercolor style.

---

### `/scr:character-ref`

**Description:** Generate a character visual reference sheet prompt for illustration consistency.

**Usage:** `/scr:character-ref <name> [--style <style>]`

**Prerequisites:** CHARACTERS.md must exist

**Available for:** Prose, script, visual, interactive

**Flags:**
- `--style <style>` -- Art style for the reference sheet

**Example:**
```
/scr:character-ref Maria --style "realistic pencil"
```
Generate a character reference sheet for Maria to keep illustrations consistent.

---

### `/scr:art-direction`

**Description:** Generate or refine the visual style bible for illustrations and cover art.

**Usage:** `/scr:art-direction [--refine]`

**Prerequisites:** None

**Available for:** Prose, visual, interactive, sacred

**Flags:**
- `--refine` -- Refine existing art direction

**Example:**
```
/scr:art-direction
```
Create ART-DIRECTION.md with color palette, style references, mood, and visual motifs for your book.

---

### `/scr:chapter-header`

**Description:** Generate decorative chapter header/ornament design prompts.

**Usage:** `/scr:chapter-header [--style <style>] [--chapter <ref>]`

**Prerequisites:** None

**Available for:** Prose, sacred

**Flags:**
- `--style <style>` -- Ornament style
- `--chapter <ref>` -- Specific chapter

**Example:**
```
/scr:chapter-header --style "art nouveau floral"
```
Generate decorative header designs for each chapter in art nouveau style.

---

### `/scr:map-illustration`

**Description:** Generate world or regional map illustration prompts from WORLD.md geographic content.

**Usage:** `/scr:map-illustration [--region <area>] [--style <style>]`

**Prerequisites:** WORLD.md must exist

**Available for:** Prose, visual, interactive, sacred

**Flags:**
- `--region <area>` -- Focus on a specific region
- `--style <style>` -- Map style (fantasy, antique, satellite, etc.)

**Example:**
```
/scr:map-illustration --style "tolkien-style hand-drawn"
```
Generate a fantasy map prompt based on the geography in your world-building document.

---

### `/scr:spread-layout`

**Description:** Generate children's book page spread layouts with text and illustration zones.

**Usage:** `/scr:spread-layout <spread-number> [--text-ratio <percent>]`

**Prerequisites:** None

**Available for:** Visual (children's books, picture books)

**Flags:**
- `--text-ratio <percent>` -- Percentage of spread dedicated to text

**Example:**
```
/scr:spread-layout 4 --text-ratio 30
```
Design spread 4 with 30% text and 70% illustration area.

---

### `/scr:panel-layout`

**Description:** Generate comic panel layouts with composition notes and balloon placement.

**Usage:** `/scr:panel-layout <page-number> [--panels <count>] [--style <style>]`

**Prerequisites:** None

**Available for:** Visual (comics only)

**Flags:**
- `--panels <count>` -- Number of panels on the page
- `--style <style>` -- Layout style

**Example:**
```
/scr:panel-layout 12 --panels 6
```
Design a 6-panel layout for page 12 with composition and balloon placement notes.

---

### `/scr:storyboard`

**Description:** Generate storyboard frames for script and visual work types with camera direction.

**Usage:** `/scr:storyboard [--scene <ref>] [--act <number>]`

**Prerequisites:** None

**Available for:** Script, visual

**Flags:**
- `--scene <ref>` -- Storyboard a specific scene
- `--act <number>` -- Storyboard an entire act

**Example:**
```
/scr:storyboard --scene 2-3
```
Generate storyboard frames for Act 2, Scene 3 with camera angles, movement, and blocking notes.

---

## Translation

Commands for translating your manuscript into other languages with consistency and cultural awareness.

### `/scr:translate`

**Description:** Translate manuscript to target language with glossary and translation memory support.

**Usage:** `/scr:translate <language> [--all] [--from <unit>] [--languages] [--add-language <lang>]`

**Prerequisites:** Complete draft must exist

**Flags:**
- `--all` -- Translate all units
- `--from <unit>` -- Start from a specific unit
- `--languages` -- List configured target languages
- `--add-language <lang>` -- Add a new target language

**Available for:** All work types

**Example:**
```
/scr:translate french --all
```
Translate the entire manuscript to French, unit by unit, using your glossary and translation memory.

---

### `/scr:translation-glossary`

**Description:** Create and manage bilingual term glossary for consistent translation.

**Usage:** `/scr:translation-glossary <language> [--add <term> --translation <value>] [--import] [--review] [--category <cat>]`

**Prerequisites:** None

**Flags:**
- `--add <term> --translation <value>` -- Add a term
- `--import` -- Import terms from existing translations
- `--review` -- Review glossary entries
- `--category <cat>` -- Filter by category

**Available for:** All work types

**Example:**
```
/scr:translation-glossary spanish --add "the Fold" --translation "el Pliegue"
```
Ensure "the Fold" is always translated as "el Pliegue" throughout the Spanish edition.

---

### `/scr:translation-memory`

**Description:** Build and manage translation memory from completed translations.

**Usage:** `/scr:translation-memory <language> [--build] [--stats] [--export] [--clear]`

**Prerequisites:** Translation must exist for the language

**Flags:**
- `--build` -- Build memory from existing translations
- `--stats` -- Show translation memory statistics
- `--export` -- Export memory for reuse
- `--clear` -- Clear translation memory

**Available for:** All work types

**Example:**
```
/scr:translation-memory french --build
```
Build translation memory from your completed French translation for reuse in future projects.

---

### `/scr:cultural-adaptation`

**Description:** Flag idioms, humor, customs, and cultural references that need localization for target language.

**Usage:** `/scr:cultural-adaptation <language> [--unit <unit>] [--severity <level>] [--report]`

**Prerequisites:** Translation must exist for the language

**Flags:**
- `--unit <unit>` -- Check a specific unit
- `--severity <level>` -- Filter by severity
- `--report` -- Generate a full report

**Available for:** All work types

**Example:**
```
/scr:cultural-adaptation japanese --report
```
Generate a report of cultural references that need adaptation for Japanese readers.

---

### `/scr:back-translate`

**Description:** Translate the translation back to source language and show side-by-side comparison with drift annotations.

**Usage:** `/scr:back-translate <language> [--unit <unit>] [--report]`

**Prerequisites:** Translation must exist for the language

**Flags:**
- `--unit <unit>` -- Check a specific unit
- `--report` -- Generate a comparison report

**Available for:** All work types

**Example:**
```
/scr:back-translate french --report
```
Verify your French translation by translating it back to English and comparing with the original.

---

### `/scr:multi-publish`

**Description:** Export translated editions in all target formats with localized front/back matter and language-specific formatting.

**Usage:** `/scr:multi-publish [--languages <lang1,lang2,...>] [--format <format>] [--all-languages] [--all-formats]`

**Prerequisites:** Translation must exist

**Flags:**
- `--languages` -- Specific languages to publish
- `--format` -- Target format
- `--all-languages` -- Publish all translated languages
- `--all-formats` -- Export in all available formats

**Available for:** All work types

**Example:**
```
/scr:multi-publish --all-languages --format epub
```
Generate EPUBs for every translated edition with localized front/back matter.

---

### `/scr:autopilot-translate`

**Description:** Run multi-language translation pipeline unattended with glossary, translation, adaptation, and publishing.

**Usage:** `/scr:autopilot-translate [--languages <lang1,lang2,...>] [--all-languages] [--skip-publish] [--skip-adaptation] [--resume]`

**Prerequisites:** Complete draft must exist

**Flags:**
- `--languages` -- Target languages
- `--all-languages` -- Translate to all configured languages
- `--skip-publish` -- Skip the publishing step
- `--skip-adaptation` -- Skip cultural adaptation
- `--resume` -- Resume interrupted pipeline

**Available for:** All work types

**Example:**
```
/scr:autopilot-translate --languages french,spanish,german
```
Translate to French, Spanish, and German end-to-end: glossary, translation, cultural adaptation, and publishing.

---

## Collaboration

Commands for managing revision tracks and collaborative workflows.

### `/scr:track`

**Description:** Manage revision tracks -- create, switch, compare, merge, and propose changes for review.

**Usage:** `/scr:track <create|list|switch|compare|merge|propose> [name] [options]`

**Prerequisites:** None

**Subcommands:**
- `create` -- Create a new revision track
- `list` -- List all tracks
- `switch` -- Switch to a different track
- `compare` -- Compare a revision track against canon or another track
- `merge` -- Merge a track into the canon manuscript
- `propose` -- Propose changes from a track for review

**Available for:** All work types

**Example:**
```
/scr:track create "experimental-ending"
```
Create a revision track to experiment with an alternate ending without affecting your canon manuscript.

---

## Utility

General-purpose commands for project management, quick edits, notes, and system health.

### `/scr:manager`

**Description:** Interactive command center for managing multiple writing projects.

**Usage:** `/scr:manager [--list] [--switch <project>] [--status]`

**Prerequisites:** None

**Flags:**
- `--list` -- List all projects
- `--switch <project>` -- Switch to a different project
- `--status` -- Show status of all projects

**Available for:** All work types

**Example:**
```
/scr:manager --list
```
See all your writing projects with status, word count, and last activity.

---

### `/scr:health`

**Description:** Diagnose and repair common project state issues.

**Usage:** `/scr:health [--repair] [--context]`

**Prerequisites:** None

**Flags:**
- `--repair` -- Attempt to fix detected issues
- `--context` -- Estimate loaded-context size and flag watch, tight, or critical sessions

**Available for:** All work types

**Example:**
```
/scr:health --repair
```
Check for missing files, broken references, and state inconsistencies, then fix what can be fixed.

---

### `/scr:surface`

**Description:** Inspect or change the installed Scriveno command profile.

**Usage:** `/scr:surface [list|status|profile <core|writing|publishing|translation|specialist|full>] [--runtime <runtime>] [--dry-run]`

**Prerequisites:** Node.js >=20.0.0 and a Scriveno package or repo checkout with `bin/install.js`

**Flags:**
- `list` -- Show available profiles and command counts
- `status` -- Show the currently installed profile and runtime surface
- `profile <name>` -- Reinstall a named profile: core, writing, publishing, translation, specialist, or full
- `--dry-run` -- Show the planned install changes without writing files

**Available for:** All work types

**Example:**
```
/scr:surface profile writing --dry-run
```
Preview a smaller drafting-focused command surface before changing installed runtime files.

---

### `/scr:scan`

**Description:** Scan the project for context drift between recorded state and what is actually on disk.

**Usage:** `/scr:scan [--fix] [--quiet] [--deep]`

**Prerequisites:** None

**Flags:**
- `--fix` -- After reporting, offer to apply auto-fixable corrections (e.g. update STATE.md unit counts to match disk, regenerate stale CONTEXT.md)
- `--quiet` -- Suppress the all-clear summary; only emit output when drift is found. Useful in scripts and pre-export gates.
- `--deep` -- After deterministic checks, run read-only audit workers for continuity, geography, relationships, research gaps, and voice risk

**Available for:** All work types

**Example:**
```
/scr:scan          # report-only context-integrity scan
/scr:scan --fix    # report + offer to fix the auto-fixable mismatches
/scr:scan --deep   # add read-only audit workers
```
Complements `/scr:health` (structural fixer) by interrogating whether the *recorded* project state still matches reality. Run at session start, before publish, and after manually editing files outside Scriveno.

---

### `/scr:sync`

**Description:** Synchronize installed Scriveno runtime commands, skills, and agents with the current source.

**Usage:** `/scr:sync [--check] [--apply] [--runtime <key>] [--detected] [--global|--project] [--writer|--developer]`

**Prerequisites:** Node.js >=20.0.0 and a Scriveno package or repo checkout with `bin/install.js`

**Flags:**
- `--check` -- Report stale installed runtime files without writing changes
- `--apply` -- Re-run the installer for stale or selected runtimes
- `--runtime <key>` -- Sync one runtime such as `codex` or `claude-code`
- `--detected` -- Sync every runtime the installer detects
- `--global` / `--project` -- Choose the installed runtime scope
- `--writer` / `--developer` -- Choose the installed output mode

**Available for:** All work types

**Example:**
```
/scr:sync --apply --runtime codex --global --developer
```
Refresh Codex `$scr-*` skills, command mirrors, and agent prompts from the current Scriveno source tree.

---

### `/scr:cleanup`

**Description:** Strip template scaffold markers from draft files. Dry-run by default.

**Usage:** `/scr:cleanup [--apply]`

**Prerequisites:** Draft files must exist

**Flags:**
- `--apply` -- Modify files in place instead of showing a dry-run preview

**Available for:** All work types

**Example:**
```
/scr:cleanup --apply
```
Remove scaffold markers, Alternate blocks, and duplicate H1 headings from the draft files in place.

---

### `/scr:validate`

**Description:** Scan draft files for unresolved scaffold markers before export.

**Usage:** `/scr:validate`

**Prerequisites:** Draft files must exist

**Available for:** All work types

**Example:**
```
/scr:validate
```
Check whether the manuscript is clean enough to export, and list every blocking scaffold marker if it is not.

---

### `/scr:fast`

**Description:** Make a quick inline edit without full planning overhead. For small fixes and tweaks.

**Usage:** `/scr:fast <description of edit>`

**Prerequisites:** None

**Available for:** All work types

**Example:**
```
/scr:fast "change Maria's hair from brown to black in chapter 3"
```
Make a targeted edit without going through the full plan-draft-review cycle.

---

### `/scr:research`

**Description:** Add sourced advisory research notes for any topic without changing project canon.

**Usage:** `/scr:research <topic> [--type <type>] [--place] [--figure] [--era <era>]`

**Prerequisites:** None

**Available for:** All work types

**Flags:**
- `--type <type>` -- Label the research type, such as craft, genre, historical-period, place, figure, event, technology, law, medicine, culture, sacred-source, academic-source, comparable-work, claim, terminology, or source
- `--place` -- Treat the topic as a real or fictionalized place
- `--figure` -- Treat the topic as a historical, sacred, or public figure
- `--era <era>` -- Scope the research to a time period

**Example:**
```
/scr:research "18th century sailing watches" --type historical-period --era 1760s
```
Add sourced notes and caveats to `.manuscript/RESEARCH.md`; nothing becomes project canon until the writer accepts it into an owner file.

Research may fan out focused researcher workers by angle, then merge their source-backed findings into one advisory note.

---

### `/scr:add-note`

**Description:** Add a quick note or reminder to the project notes file.

**Usage:** `/scr:add-note <note text>`

**Prerequisites:** None

**Available for:** All work types

**Example:**
```
/scr:add-note "Research 1920s speakeasy slang for chapter 7"
```
Jot down a thought for later without losing your flow.

---

### `/scr:check-notes`

**Description:** Review all project notes.

**Usage:** `/scr:check-notes [--clear]`

**Prerequisites:** None

**Flags:**
- `--clear` -- Clear all notes after review

**Available for:** All work types

**Example:**
```
/scr:check-notes
```
Review everything you've jotted down during your writing sessions.

---

### `/scr:plant-seed`

**Description:** Plant a creative seed -- an idea, image, or fragment for future use.

**Usage:** `/scr:plant-seed <idea>`

**Prerequisites:** None

**Available for:** All work types

**Example:**
```
/scr:plant-seed "What if the detective's daughter is the real thief?"
```
Save a story idea for later without committing to it now.

---

### `/scr:troubleshoot`

**Description:** Diagnose why something isn't working and suggest fixes.

**Usage:** `/scr:troubleshoot [description of problem]`

**Prerequisites:** None

**Available for:** All work types

**Example:**
```
/scr:troubleshoot "draft command says OUTLINE.md is missing but it exists"
```
Scriveno investigates the issue and tells you exactly what's wrong and how to fix it.

---

### `/scr:thread`

**Description:** Start or continue a focused conversation thread on a specific topic.

**Usage:** `/scr:thread <topic name>`

**Prerequisites:** None

**Available for:** All work types

**Example:**
```
/scr:thread "magic system rules"
```
Start a dedicated conversation about your magic system that you can return to anytime.

---

### `/scr:settings`

**Description:** View or modify project settings.

**Usage:** `/scr:settings`

**Prerequisites:** None

**Available for:** All work types

**Example:**
```
/scr:settings
```
Review and adjust your project configuration -- work type, autopilot profile, developer mode, voice drift threshold, and the `draft` block (drafter quality controls).

**Drafter quality knobs (1.6.0+):**
- `draft.rigor`: `standard` or `strict`. Strict prepends a per-sentence rules check, useful when routing to weaker models.
- `draft.context_profile`: `minimal`, `standard`, or `full`. Controls how much context the drafter loads per atomic unit. `minimal` saves tokens; `full` loads cross-document references for sacred-work continuity.
- `draft.pitfalls_enabled`: `true` or `false`. When `false`, skip loading the per-work-type pitfall pack from `templates/pitfalls/<work_type>.md`. WRITING-RULES.md still loads.

See [Drafter Quality](drafter-quality.md) for the full system and model-tier recommendations.

---

### `/scr:profile-writer`

**Description:** Build or refine the writer's Voice DNA profile through questionnaire, sample analysis, or reference authors.

**Usage:** `/scr:profile-writer [--questionnaire] [--analyze <file>] [--reference] [--all] [--refine] [--refresh] [--export] [--import]`

**Prerequisites:** None

**Flags:**
- `--questionnaire` -- Build profile through questions
- `--analyze <file>` -- Analyze a writing sample
- `--reference` -- Build from reference authors
- `--all` -- Run all three methods
- `--refine` -- Refine existing profile
- `--refresh` -- Rebuild from scratch
- `--export` -- Export voice profile
- `--import` -- Import voice profile

**Available for:** All work types

**Example:**
```
/scr:profile-writer --analyze ~/Documents/my-essay.md
```
Build your Voice DNA profile by analyzing an existing piece of your writing.

---

## Sacred Exclusive

Commands available only for sacred and historical work types (scripture, commentary, devotional, liturgical, historical chronicle, religious epic, sermon, etc.). These commands are hidden from other work types.

### `/scr:sacred-numbering-format`

**Description:** Show verse numbering format for the active sacred tradition.

**Usage:** `/scr:sacred-numbering-format [--example <text>]`

**Prerequisites:** `.manuscript/config.json` must include a valid `tradition`

**Available for:** Sacred

**Flags:**
- `--example <text>` -- Format an example citation using the active tradition's numbering style

**Example:**
```
/scr:sacred-numbering-format --example "John 3 16"
```
Show the active tradition's numbering format and render an example citation using that system.

**Install note:** Flat command runtimes install this compatibility command under a distinct generated name so it cannot collide with nested `/scr:sacred:verse-numbering`.

---

### `/scr:sacred:concordance`

**Description:** Build or search a concordance of key terms, names, and phrases across the sacred text. Essential for cross-referencing and intertextual study.

**Usage:** `/scr:sacred:concordance [--build] [--search <term>] [--tradition <tradition>]`

**Prerequisites:** Draft must exist

**Available for:** Sacred

**Flags:**
- `--build` -- Build the concordance from the text
- `--search <term>` -- Search for a specific term
- `--tradition <tradition>` -- Filter by tradition

**Example:**
```
/scr:sacred:concordance --search "covenant"
```
Find every occurrence of "covenant" across the text with surrounding context and cross-references.

---

### `/scr:sacred:cross-reference`

**Description:** Map connections between passages -- parallel accounts, prophetic fulfillments, intertextual echoes, typological links.

**Usage:** `/scr:sacred:cross-reference [--passage <ref>] [--type <parallel|fulfillment|echo|typology>]`

**Prerequisites:** Draft must exist

**Available for:** Sacred

**Flags:**
- `--passage <ref>` -- Start from a specific passage
- `--type` -- Filter by reference type: parallel, fulfillment, echo, typology

**Example:**
```
/scr:sacred:cross-reference --passage "Genesis 22" --type typology
```
Find typological connections to the binding of Isaac across the text.

---

### `/scr:sacred:genealogy`

**Description:** Build and verify genealogical trees and lineages for figures in the text. Catches contradictions across chapters.

**Usage:** `/scr:sacred:genealogy [--verify] [--figure <name>] [--tradition <tradition>]`

**Prerequisites:** FIGURES.md must exist with at least 2 figures

**Available for:** Sacred

**Flags:**
- `--verify` -- Check for genealogical contradictions
- `--figure <name>` -- Focus on a specific figure
- `--tradition <tradition>` -- Use tradition-specific lineage data

**Example:**
```
/scr:sacred:genealogy --figure Abraham --verify
```
Build Abraham's genealogical tree and verify consistency across all mentions in the text.

---

### `/scr:sacred:chronology`

**Description:** Timeline management with era-appropriate dating systems. Handles overlapping calendars and disputed dates.

**Usage:** `/scr:sacred:chronology [--calendar <system>] [--verify] [--range <start>-<end>]`

**Prerequisites:** None

**Available for:** Sacred

**Flags:**
- `--calendar <system>` -- Calendar system: gregorian, hebrew, hijri, vikram_samvat, buddhist_era, regnal
- `--verify` -- Check for chronological contradictions
- `--range` -- Focus on a specific date range

**Example:**
```
/scr:sacred:chronology --calendar hebrew --verify
```
Build a timeline using the Hebrew calendar and verify dates are consistent across the text.

---

### `/scr:sacred:annotation-layer`

**Description:** Add or manage a commentary/exegetical layer alongside the primary sacred text. Support multiple annotation traditions simultaneously.

**Usage:** `/scr:sacred:annotation-layer [tradition_name] [--list] [--remove <tradition>]`

**Prerequisites:** Draft must exist

**Available for:** Sacred

**Flags:**
- `--list` -- List all annotation layers
- `--remove <tradition>` -- Remove an annotation layer

**Example:**
```
/scr:sacred:annotation-layer reformed
```
Add a Reformed theological annotation layer to your text alongside existing Catholic annotations.

---

### `/scr:sacred:verse-numbering`

**Description:** Manage verse/ayah/pasuk numbering systems. Handles differences between traditions (Masoretic vs. Septuagint numbering, Hafs vs. Warsh Quranic numbering, etc.)

**Usage:** `/scr:sacred:verse-numbering [--system <system>] [--convert <from>-<to>] [--verify]`

**Prerequisites:** Draft must exist

**Available for:** Sacred

**Flags:**
- `--system <system>` -- Numbering system: masoretic, septuagint, quranic_hafs, quranic_warsh, pali_canon
- `--convert <from>-<to>` -- Convert between numbering systems
- `--verify` -- Verify numbering consistency

**Example:**
```
/scr:sacred:verse-numbering --convert masoretic-septuagint
```
Show how verse numbers differ between Masoretic and Septuagint traditions.

---

### `/scr:sacred:source-tracking`

**Description:** Track primary sources, oral traditions, manuscript variants, and source attributions. For historical and critical editions.

**Usage:** `/scr:sacred:source-tracking [--add <source>] [--list] [--verify]`

**Prerequisites:** WORK.md must exist

**Available for:** Sacred

**Flags:**
- `--add <source>` -- Add a primary source
- `--list` -- List all tracked sources
- `--verify` -- Verify source attributions

**Example:**
```
/scr:sacred:source-tracking --add "Dead Sea Scrolls, 1QIsaA"
```
Track the Dead Sea Scrolls as a primary source for your critical edition.

---

### `/scr:sacred:doctrinal-check`

**Description:** Verify internal theological and doctrinal consistency across the text. Flag contradictions in doctrine, moral teaching, or cosmological claims.

**Usage:** `/scr:sacred:doctrinal-check [unit number, optional]`

**Prerequisites:** Draft and DOCTRINES.md must exist

**Available for:** Sacred

**Example:**
```
/scr:sacred:doctrinal-check
```
Scan the entire text for doctrinal inconsistencies -- contradictions in theology, moral teaching, or cosmology.

---

## Work Type Adaptations Quick Reference

Many commands automatically rename based on your work type group. Here is a summary:

| Base Command | Academic Label | Sacred Label |
|---|---|---|
| `/scr:editor-review` | `peer-review` | `scholarly-review` |
| `/scr:beta-reader` | `reviewer-simulation` | `theological-review` |
| `/scr:voice-check` | -- | `register-check` |
| `/scr:sensitivity-review` | `ethics-review` | `interfaith-review` |

Sacred-specific flow labels like `chronology` and `doctrinal-check` are exposed through the dedicated `/scr:sacred:*` command family rather than by relabeling hidden base commands.

Commands with **adaptive terminology** (discuss, plan, draft, submit) keep the runnable command id stable and change only the unit wording in prompts and output. For example, a novel still runs `/scr:draft 5`, but Scriveno frames it as drafting Chapter 5. A screenplay frames the same command as drafting Act 5. A Quranic commentary frames it as drafting Surah 5.

---

*This reference is maintained against `data/CONSTRAINTS.json` and the live command tree in `commands/scr/`. For the most current project-scoped menu, run `/scr:help` inside your project.*
