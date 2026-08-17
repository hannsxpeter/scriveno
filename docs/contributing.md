# Contributing to Scriveno

Scriveno is a markdown-first skill system with a dependency-free Node.js support layer. Most behavior lives in files that AI agents read and execute. Deterministic installer, status, safety, and provenance behavior lives in `bin/` and `lib/`. There is no compilation or bundling step and no npm runtime dependency graph.

This guide walks you through extending Scriveno: adding commands, agents, work types, templates, and export formats. Each section is self-contained -- jump to what you need. For release operations, use [Release Checklist](release-checklist.md).

## File Structure Overview

Before diving in, here is how the codebase is organized:

```
commands/scr/          Core command tree (100+ command files, including sacred subcommands)
commands/scr/sacred/   8 sacred-exclusive subcommands
agents/                6 specialized agents (drafter, voice-checker, etc.)
data/CONSTRAINTS.json  Central constraint registry -- every command checks this
data/demo/             Pre-baked demo project (watchmaker story)
data/export-templates/ Export templates (Typst, CSS, LaTeX)
templates/             Base project templates + technical/ and sacred/ variants
templates/technical/   6 technical-writing context variants
templates/sacred/      Sacred-specific context templates and tradition manifests
bin/install.js         Multi-platform installer (Node.js)
lib/                   Dependency-free Node.js status, safety, and provenance helpers
docs/                  Documentation suite (25 guides)
```

Key principle: the AI agent reads command and agent files at runtime, while deterministic CLI behavior is implemented with Node.js built-ins and covered by tests. There is no compilation, bundling, or transpilation. Markdown contributions remain welcome, and helper changes should include focused `node --test` coverage.

## Adding a Command

Every `/scr:*` command is a markdown file in `commands/scr/`. The agent reads the file and follows its instructions. Here is the complete process.

### Step 1: Create the command file

Create `commands/scr/{name}.md` with YAML frontmatter and a markdown body. Here is a minimal example based on the `add-note` command:

```yaml
---
description: Add a quick note or reminder to the project notes file.
argument-hint: "<note text>"
---
```

The frontmatter has two fields:

- **`description`** -- One-line summary shown in help and command listings
- **`argument-hint`** -- Shows the expected arguments (use `<required>` and `[optional]` notation)

After the frontmatter, write the command instructions in markdown. Here is what the body of `add-note.md` looks like:

```markdown
# Add Note

You are adding a quick note to the project's notes file.

## What to do

1. Take the note text from the argument
2. Open `.manuscript/NOTES.md` (create it if it doesn't exist)
3. If creating: add header `# Project Notes\n\n`
4. Append the note with a timestamp:
   - [2026-04-07 14:30] Note text here
5. Save the file
6. Confirm: "Note added."
```

The body tells the AI agent exactly what to do -- step by step, in plain language.

### Step 2: Add to CONSTRAINTS.json

Open `data/CONSTRAINTS.json` and add an entry under the `"commands"` object:

```json
"add-note": {
  "category": "utility",
  "available": ["all"],
  "description": "Add a quick note or reminder to the project notes file"
}
```

The command entry fields:

- **`category`** -- Groups the command in help output (core, navigation, structure, craft, publishing, utility, sacred_exclusive, etc.)
- **`available`** -- Which work type groups can use this command. Use `["all"]` for universal commands, or list specific groups like `["prose", "script"]`
- **`description`** -- Same as the frontmatter description

Some commands have additional fields:

```json
"draft": {
  "category": "core",
  "available": ["all"],
  "renames_by_unit": true,
  "description": "Draft the planned unit"
}
```

- **`renames_by_unit`** -- Legacy schema flag indicating that the command adapts its terminology based on the work type. A novel project still runs `/scr:draft`, but Scriveno presents the work as drafting a chapter; a screenplay presents it as drafting an act.
- **`adapted`** -- Work-type-specific overrides (renames, behavior changes). For example, `editor-review` becomes `peer-review` for academic works.

### Step 3: Understand adaptive terminology

Commands that set `renames_by_unit: true` in CONSTRAINTS.json adapt their terminology based on `command_unit` in the project's `.manuscript/config.json`. The command file itself handles this:

```markdown
## Adaptive naming

Load `.manuscript/config.json` for `command_unit`. This command stays `/scr:draft`; use the active unit term in prompts and output.
```

When a writer starts a novel project, `command_unit` is set to `"chapter"`, so `/scr:draft` is presented in chapter terms. For a screenplay, the same `/scr:draft` command is presented in act terms. The command file itself does not change -- the adaptation happens at runtime through config.json.

### Step 4: Write a full command

A full command file typically has these sections:

1. **Title** -- `# Command Name`
2. **Adaptive naming** (if applicable) -- How the command name adapts
3. **Prerequisites** -- What must exist before this command runs
4. **What to do** -- Step-by-step instructions for the agent
5. **Tone** -- How the agent should communicate with the writer
6. **Edge Cases** -- What to do when things go wrong

Look at `commands/scr/draft.md` for a complex example (orchestrates the drafter agent) or `commands/scr/add-unit.md` for a structural command with work-type adaptation.

### Minimal vs full

A minimal command needs only frontmatter + basic instructions (like `add-note.md` at 29 lines). A full command like `draft.md` (46 lines) includes adaptive terminology, prerequisites, autopilot behavior, and tone guidance. Start minimal and add sections as needed.

## Adding an Agent

Agents are specialized markdown files in `agents/`. They are invoked by commands in fresh context -- each invocation starts with a clean slate.

### Step 1: Create the agent file

Create `agents/{name}.md` with YAML frontmatter:

```yaml
---
name: drafter
description: Drafts a single atomic unit in the writer's voice. Invoked in fresh context per atomic unit.
tools: Read, Write
---
```

The frontmatter fields:

- **`name`** -- Agent identifier
- **`description`** -- What the agent does
- **`tools`** -- Which tools the agent needs (Read, Write, Bash, etc.)

### Step 2: Write the agent body

The body explains what the agent receives, what it does, and what it must never do. Here is the pattern from `agents/drafter.md`:

```markdown
# Drafter agent

You are the Scriveno drafter. Your single job is to draft one atomic unit
in the writer's established voice.

## What you receive

1. **STYLE-GUIDE.md** -- The voice DNA
2. **.manuscript/plans/{N}-{A}-PLAN.md** -- The plan for this atomic unit
3. **CHARACTERS.md excerpt** -- Relevant characters only
4. **Previous unit tail** -- Last 200 words of previous unit
5. **THEMES.md excerpt** -- Relevant thematic threads

## What you do NOT receive

- The full manuscript
- The writer's conversation history
- Other units' drafts

## How to draft

[Step-by-step instructions...]

## What you must never do

[Hard constraints...]
```

### The fresh-context-per-unit pattern

This is the most important architectural pattern in Scriveno. When a command invokes an agent:

- The agent is started in a **clean context** -- no prior conversation, no accumulated state
- It receives only the specific files it needs for this one unit
- STYLE-GUIDE.md is **always loaded first** -- voice DNA is the top priority
- After completing its work, the agent context is discarded

This prevents voice drift, context bloat, and cross-contamination between units. It is the key to voice fidelity.

### Existing agents

Scriveno ships with 6 agents:

| Agent | Purpose |
|-------|---------|
| `drafter` | Drafts one atomic unit in the writer's voice |
| `voice-checker` | Compares drafts against STYLE-GUIDE.md, flags drift |
| `continuity-checker` | Catches contradictions, timeline errors, character drift |
| `plan-checker` | Validates unit plans before drafting |
| `researcher` | Gathers research material for a topic |
| `translator` | Translates content with voice preservation |

## Adding a Work Type

Work types define what a writer is creating -- novel, screenplay, Quran commentary, etc. They live in `data/CONSTRAINTS.json` under two sections.

### Step 1: Check if you need a new group

Work types belong to groups. Existing groups:

- `prose` -- novel, memoir, essay, etc.
- `script` -- screenplay, stage play, TV pilot, etc.
- `academic` -- research paper, thesis, journal article, etc.
- `technical` -- technical guide, runbook, API reference, design spec
- `visual` -- comic, graphic novel, children's book, etc.
- `poetry` -- poetry collection, single poem, song lyric
- `interactive` -- interactive fiction, game narrative
- `speech_song` -- speech
- `sacred` -- scripture, commentary, devotional, etc.

If your work type fits an existing group, skip to Step 2. To add a new group:

```json
"work_type_groups": {
  "your_group": {
    "label": "Your Group",
    "members": ["your_work_type"]
  }
}
```

### Step 2: Add the work type entry

Add to the `"work_types"` object in CONSTRAINTS.json:

```json
"your_work_type": {
  "label": "Your Work Type",
  "group": "prose",
  "hierarchy": { "top": "part", "mid": "chapter", "atomic": "scene" },
  "command_unit": "chapter"
}
```

The fields:

- **`label`** -- Human-readable name
- **`group`** -- Which group this belongs to
- **`hierarchy`** -- Three structural levels:
  - `top` -- Largest division (part, act, testament). Use `null` if not applicable.
  - `mid` -- Middle division (chapter, scene, section)
  - `atomic` -- Smallest draft unit (scene, beat, verse, stanza)
- **`command_unit`** -- Which hierarchy level commands operate on by default

For sacred work types, you can also add `config_defaults`:

```json
"scripture_quranic": {
  "label": "Scripture (Quranic)",
  "group": "sacred",
  "hierarchy": { "top": null, "mid": "surah", "atomic": "ayah" },
  "command_unit": "surah",
  "config_defaults": {
    "verse_numbering_system": "quranic_hafs",
    "calendar_system": "hijri"
  }
}
```

### Step 3: Add to the group's members array

Add your work type key to the appropriate group's `members` array:

```json
"prose": {
  "label": "Prose",
  "members": ["novel", "novella", "short_story", "your_work_type"]
}
```

### Step 4: Update command availability

Review commands in CONSTRAINTS.json. For each command, check its `available` array. If the command should work with your new work type's group, it probably already does (most commands use `["all"]`). If a command is group-restricted and should include your type, add the group name.

## Adding a Template

Templates are markdown files in `templates/` that define the starting content for project context files. When a writer runs `/scr:new-work`, these templates are copied into `.manuscript/`.

### Step 1: Create the template file

Create `templates/{NAME}.md` with placeholder content. Here is the pattern -- each template uses `{placeholders}` that the `new-work` command fills in:

```markdown
# {work_title} -- Work Overview

## Premise

{premise}

## Tone & Mood

[To be developed during /scr:discuss]
```

### Step 2: Technical and sacred variants

If your template needs a technical-writing-specific or sacred-specific version, add it to `templates/technical/` or `templates/sacred/`. These templates replace or extend the standard ones for their work-type groups. For example:

- `templates/CHARACTERS.md` is the standard character template
- `templates/technical/AUDIENCE.md` replaces it for technical docs
- `templates/sacred/FIGURES.md` replaces it for sacred works (uses "figures" instead of "characters")

Existing technical templates: `DOC-BRIEF.md`, `AUDIENCE.md`, `DEPENDENCIES.md`, `SYSTEM.md`, `PROCEDURES.md`, `REFERENCES.md`.
Existing sacred templates: `COSMOLOGY.md`, `DOCTRINES.md`, `FIGURES.md`, `FRAMEWORK.md`, `LINEAGES.md`, `THEOLOGICAL-ARC.md`.

### Step 3: Register in config.json

The `templates/config.json` file is the project configuration template. If your new template adds a configuration option, add the default value there.

## Adding an Export Format

Export templates live in `data/export-templates/` and define how manuscripts are converted to output formats.

See `docs/shipped-assets.md` for the canonical inventory of shipped export templates and trust-critical launch assets.

### Step 1: Create the template file

Add your template to `data/export-templates/`. Existing templates:

- `scriveno-book.typst` -- Book interior PDF (Typst template)
- `scriveno-epub.css` -- EPUB styling (CSS)
- `scriveno-academic.latex` -- Academic paper formatting (LaTeX)

Name your file `scriveno-{purpose}.{ext}` following the existing pattern.

### Step 2: Update the export command

The export command (`commands/scr/export.md`) needs to know about your format. Add handling for the new format in the command's instruction body.

### Step 3: Add CONSTRAINTS.json entry (if restricted)

If your export format is only available for certain work types, add an entry to the `"exports"` section of CONSTRAINTS.json with an `available` array specifying which work type groups can use it (or `["all"]` for universal formats).

## Testing Your Changes

Scriveno has a test suite that validates the constraint system and command structure.

### Run the tests

```bash
node --test test/
```

This runs all tests, including:

- **CONSTRAINTS.json validation** -- Ensures all work types, commands, and cross-references are consistent
- **Command structure tests** -- Verifies command files have valid frontmatter
- **Installer tests** -- Checks that the installer handles all platforms correctly

### Manual verification

After adding a command, verify:

1. The command file exists at `commands/scr/{name}.md`
2. The CONSTRAINTS.json entry matches the file
3. The description in frontmatter matches CONSTRAINTS.json
4. If the command references other files, those files exist

## Documenting a Release

When a package release changes the public story, update the release docs alongside the code.

### Release docs to update

- `CHANGELOG.md` -- package-level release history
- `docs/release-notes.md` -- public-facing summary of what changed and why it matters
- `README.md` -- current version/status blurb when the release changes the headline positioning
- `docs/quick-proof.md` -- proof-first first-run route when install, demo, or proof expectations change
- `docs/starter-sets.md` -- goal-based command paths when command positioning changes
- `docs/release-checklist.md` -- publish workflow when release validation changes
- `docs/shipped-assets.md` -- canonical inventory when bundled docs, templates, proof assets, or trust-critical files change
- `docs/command-reference.md` -- command contract reference when command behavior or flags change
- `docs/auto-invoke-policy.md` -- proactive routing, safe apply, local-helper, and agent-spawn policy
- `docs/runtime-support.md` -- runtime matrix, install-surface checks, and agent availability claims
- `docs/route-graph.md` -- route graph, automation lanes, and priority fixtures when route logic changes
- `templates/*/README.md` and `data/proof/*/README.md` -- shipped profile and proof documentation when those assets change
- `.planning/` milestone summary files -- only when the release closes out milestone work or changes the archive story

### Minimum release checklist

1. Bump the package version in `package.json` and any mirrored version metadata such as `data/CONSTRAINTS.json`
2. Update `CHANGELOG.md` with the new version and the user-visible changes
3. Update `docs/release-notes.md` with a concise explanation of what changed, why, and how it was verified
4. Run `npm test`
5. Run `npm run release:check`
6. For runtime, installer, agent, sync, or route-intelligence changes, run `scriveno sync --check`, `scriveno smoke --json`, `scriveno agents --json`, and `scriveno routes --json`
7. For docs, prompts, command markdown, release notes, and README changes, run `npm run policy:check`
8. Follow [Release Checklist](release-checklist.md) before publishing
9. Publish only after the docs and package metadata tell the same story

## Code Style

Scriveno follows these conventions:

- **Markdown files** -- All commands, agents, and templates are markdown
- **YAML frontmatter** -- Delimited by `---` on its own line, top and bottom
- **No build step** -- Changes take effect immediately (the agent reads files at runtime)
- **Friendly, direct tone** -- Write instructions as if talking to a capable colleague
- **Real examples** -- Use actual codebase patterns, not invented ones
- **Self-contained sections** -- Each command file should work without reading other files (except CONSTRAINTS.json and config.json)

### Frontmatter conventions

Command frontmatter uses lowercase keys with hyphens:

```yaml
---
description: What this command does in one line.
argument-hint: "[optional args] <required args>"
---
```

Agent frontmatter uses lowercase keys:

```yaml
---
name: agent-name
description: What this agent does.
tools: Read, Write
---
```

## Questions?

Check the [architecture overview](architecture.md) for how the whole system fits together, or the [command reference](command-reference.md) for the full list of commands and their usage.
