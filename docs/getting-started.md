# Getting Started with Scriveno

Go from zero to a drafted scene in under 10 minutes. This guide walks you through installation, project setup, and your first draft.

Want evidence first? Start with [Quick Proof](quick-proof.md), then continue to [Proof Artifacts](proof-artifacts.md) and [Proof Badges](proof-badges.md). The first path is deliberately narrow: first-run, demo, next, draft, review, save. Once that flagship path is clear, [Versatility Paths](versatility-paths.md) shows how the same engine adapts to technical, sacred, visual, translation, and publishing work.

## Prerequisites

- **An AI coding agent** -- Claude Code, Cursor, Gemini CLI, or another current Scriveno installer target
- **Node.js >=20.0.0** -- needed for the installer only. For new installs, use a currently supported LTS such as Node.js 24.
- That's it. No other dependencies for the core writing workflow.

Before choosing a runtime, check [Runtime Support](runtime-support.md) for the current installer targets, install types, support levels, and verification status.

## Step 1: Install Scriveno

Run the installer in your terminal:

```
npx @hxp-tools/scriveno@latest
```

This installs Scriveno into the runtime you choose. Command-directory and skills targets place files where the runtime expects them. Guided targets like Perplexity Desktop instead write setup assets and show the exact connector steps you need. Takes about 30 seconds.

Once installed, Claude Code uses flat `/scr-*` commands such as `/scr-help`, `/scr-first-run`, and `/scr-new-work`. Other command-directory runtimes currently keep `/scr:*`. Codex uses generated `$scr-*` skills such as `$scr-help`, `$scr-first-run`, and `$scr-new-work`. Guided targets explain their supported setup path directly in the generated setup files.

You can also ask Scriveno for a read-only project status from any terminal:

```
npx @hxp-tools/scriveno@latest status --project .
npx @hxp-tools/scriveno@latest first-run --project .
npx @hxp-tools/scriveno@latest status . --json
npx @hxp-tools/scriveno@latest status --project . --apply-safe
npx @hxp-tools/scriveno@latest sync --check
```

If you installed globally with `npm i -g @hxp-tools/scriveno`, the shorter `scriveno status --project .` form works too. If you only ran `npx @hxp-tools/scriveno@latest`, keep using `npx @hxp-tools/scriveno@latest <command>` for terminal checks.

That status command is the same shared auto-invoke engine used by `/scr-next`, `/scr:next`, `/scr:progress`, `/scr:session-report`, and `/scr:sync` when local command execution is available. It recommends the next safest command, but does not mutate files or spawn agents by itself. Current status output separates candidate agents, candidate local helpers, and manual gates so you can tell whether Scriveno is pointing at a specialist route, a deterministic file helper, or a writer-owned decision.

Use `--apply-safe` when you want Scriveno to run the read-only checks and show which helpers are safe, skipped, or agent-ready. Use `sync --check` when you want the installed runtime surfaces checked too.

If you want one guided proof path instead of separate checks, start with `npx @hxp-tools/scriveno@latest first-run --project .`. Follow only the first-run path at first: demo, next, draft, review, save. Start a real project after that proof loop makes sense.

## Step 2: Explore the Demo First

Try the demo before starting your own project:

Claude Code:

```
/scr-demo
```

Codex:

```
$scr-demo
```

This creates a pre-built short story project -- a retired watchmaker who receives a letter from a daughter he never knew. The demo includes:

- 4 fully drafted scenes with distinct voice and style
- A complete voice profile (STYLE-GUIDE.md)
- Character files, plot graph, and thematic threads
- Editor notes on one scene so you can see the revision workflow
- 1 planned-but-undrafted scene so you can watch the drafter work

Explore at your own pace. When you're ready to start your own work, run `/scr-demo --clear` to clean up.

If you want a curated reading path instead of jumping straight into the demo files, open [Quick Proof](quick-proof.md) first. It maps the install checks, runtime command shapes, watchmaker demo, next, draft, review, and save into one 10-minute path.

## Step 3: Ask Next, Draft, Review, And Save

Inside the demo project, keep the path small:

Claude Code:

```
/scr-next
/scr-draft 5
/scr-editor-review 5
/scr-save
```

Codex:

```
$scr-next
$scr-draft 5
$scr-editor-review 5
$scr-save
```

That route proves the central loop before you decide whether to explore profiles, publishing, research, translation, or worldbuilding.

## Step 4: Start Your Project

Create a new writing project:

Claude Code:

```
/scr-new-work
```

Codex:

```
$scr-new-work
```

Scriveno asks just 3 questions -- what you're writing, your premise, and whether you have existing material. That's it. No long setup forms, no configuration wizards.

From your answers, Scriveno generates your project structure:

```
.manuscript/
  WORK.md          -- your project's identity
  OUTLINE.md       -- structure and unit breakdown
  RECORD.md        -- what the work has established
  STYLE-GUIDE.md   -- your Voice DNA profile
  CHARACTERS.md    -- cast and voice anchors
  THEMES.md        -- thematic threads
  PLOT-GRAPH.md    -- story arc and beats
  STATE.md         -- workflow position tracker
  config.json      -- project settings
```

Every file adapts to your work type. Writing a screenplay? You get acts and scenes. A research paper? Sections and argument maps. A runbook? Procedures and system maps. A Quran commentary? Surahs and doctrinal frameworks. Scriveno supports 50 work types with tradition-native vocabulary.

## Step 5: Calibrate Your Voice

Before you draft anything substantial, turn the STYLE-GUIDE template into a real voice profile:

Claude Code:

```
/scr-profile-writer
```

Codex:

```
$scr-profile-writer
```

This interview builds your Voice DNA from your preferences, reference works, or a writing sample. When it finishes, run:

Claude Code:

```
/scr-voice-test
```

Codex:

```
$scr-voice-test
```

That calibration pass writes a short sample and lets you say what sounds right or wrong before Scriveno starts drafting real units.

## Step 6: Develop Your Story

Before drafting, shape your ideas:

Claude Code:

```
/scr-discuss
```

Codex:

```
$scr-discuss
```

This opens a collaborative conversation where you and the AI work through the creative decisions for your next unit -- pacing, voice, character dynamics, what to include, what to avoid. Scriveno picks the 3-4 most relevant questions for your specific scene rather than running through a checklist.

Your decisions get saved to a context file that the drafter will use. Think of this as giving the drafter its marching orders.

If you already refined your voice profile, you can also skip this step and draft with the defaults you've approved.

## Step 7: Write Your First Draft

Draft your first unit:

Claude Code:

```
/scr-draft
```

Codex:

```
$scr-draft
```

The drafter loads your Voice DNA (STYLE-GUIDE.md) and writes in your voice, not generic AI prose. Each atomic unit (scene, beat, passage) is drafted in a fresh context to prevent voice drift and keep quality consistent across the entire work.

After drafting, Scriveno runs a voice-check pass to flag anything that drifted from your established style. You'll see a summary like: "Drafted Chapter 1: 2,400 words across 3 scenes. Voice consistency: 94%."

Your draft files appear in `.manuscript/` ready for you to read and revise.

## What's Next

Not sure what to do? There's one command that always knows:

Claude Code:

```
/scr-next
```

Codex:

```
$scr-next
```

`/scr-next` reads your project state and runs the right next step automatically. A writer who only ever types `/scr-next` in Claude Code can complete an entire manuscript from start to finish.

For a terminal-readable version of the same project-state reasoning, run `npx @hxp-tools/scriveno@latest status --project .`.

Beyond the core workflow, Scriveno offers:

- **Revision** -- `/scr-editor-review`, `/scr-line-edit`, `/scr-continuity-check`
- **World and research** -- `/scr-build-world`, `/scr-new-place`, `/scr-geography-map`, `/scr-research`
- **Publishing** -- `/scr-front-matter`, `/scr-back-matter`, `/scr-prepublish-review`, `/scr-publish`, `/scr-export`, `/scr-cover-art`, `/scr-blurb`
- **Collaboration** -- `/scr-track` for revision tracks (`create`, `compare`, `merge`, `propose`)
- **Versions** -- `/scr-save`, `/scr-history`, `/scr-versions`, `/scr-compare`
- **Navigation** -- `/scr-help`, `/scr-next`, `/scr-pause-work`
- **Surface tuning** -- `/scr-surface profile writing --dry-run` previews fewer visible commands without removing features

For small goal-based paths, use [Starter Sets](starter-sets.md). For curated showcase paths across non-flagship work types, use [Versatility Paths](versatility-paths.md). For the full command list, see [Command Reference](command-reference.md).

If you want the trust surfaces around installation and shipping details, continue with:

- [Runtime Support](runtime-support.md) -- installer targets, support levels, and verification status
- [Quick Proof](quick-proof.md) -- proof-first first-run path through install, demo, next, draft, review, and save
- [Proof Badges](proof-badges.md) -- evidence levels for major claims
- [Starter Sets](starter-sets.md) -- small command sets by writing goal
- [Versatility Paths](versatility-paths.md) -- curated showcase paths for the product's range
- [Auto-Invoke Policy](auto-invoke-policy.md) -- status engine, visible automation, and agent-spawn boundaries
- [Route Graph Audit](route-graph.md) -- generated route graph, automation lanes, and priority fixtures
- [Shipped Assets](shipped-assets.md) -- what the npm package actually includes on the trust-critical surface
- [Release Notes](release-notes.md) -- what changed in the latest package release
