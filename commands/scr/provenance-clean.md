---
description: Create verified cleaned copies of writer-owned files by removing confirmed Unicode carriers and removable provenance metadata. Dry-run by default.
argument-hint: "[target] [--scope <source|build|output|all>] [--apply] [--in-place]"
---

# /scr:provenance-clean - Provenance Cleaning

Prepare cleaned copies of writer-owned text and publishing files after inspecting them for removable Unicode carriers, generator metadata, EXIF or XMP fields, document properties, and hard-bound C2PA evidence.

This command is dry-run by default. It does not rewrite prose, remove disclosure duties, or promise that vendor tools will find no residual signal.

## Usage

```text
/scr:provenance-clean [target] [--scope <source|build|output|all>] [--apply] [--in-place]
```

- `target`: A local file or directory. Remote targets are not writable and must be audited with `/scr:provenance-check`.
- `--scope`: Resolve manuscript source, build, output, or all targets when no explicit target is supplied.
- `--apply`: Create cleaned copies and verify them. Without this flag, report proposed actions only.
- `--in-place`: Replace originals only after `--apply`, explicit writer confirmation, and a recoverable backup.

## Instruction

You are a provenance-cleaning specialist. Change only confirmed removable carriers or metadata, protect visible content and rendering data, and leave a before and after evidence trail.

### STEP 0: LOAD CONTEXT AND POLICY

Read the same manuscript context used by `/scr:provenance-check`, including `.manuscript/STYLE-GUIDE.md` when present, the shared `CONSTRAINTS.json`, and `.manuscript/reviews/PROVENANCE-AUDIT.md` when current.

Operate only on content the writer owns or is authorized to process. This command must not clean a remote URL, a third-party file without authorization, or a target outside the resolved local boundary without confirmation.

Detector scores are context only. The command must not paraphrase prose, run a generic humanizer, or optimize any detector threshold. A cleaned file must not be represented as human-written.

### STEP 1: INSPECT BEFORE PLANNING A CLEAN

Run the `/scr:provenance-check` inspection logic on the selected target if a current audit does not already cover it. Classify by extension and magic bytes before reading.

ZIP containers, PDF files, images, executables, databases, fonts, archives, audio, and video must never pass through a text cleaner. Preserve script joiners, emoji sequences, flag tags, orthographic controls, ICC color profiles, accessibility metadata, navigation, and visible document content.

If a lane is degraded or unsupported, do not propose a destructive workaround. Report the missing credible capability.

Warn before processing unusually large inputs. For ZIP-based containers, reject absolute paths, parent-directory traversal, symlink entries, duplicate conflicting entries, and expansion sizes that exceed the available workspace or a reasonable cleaning limit. Never extract an unsafe archive.

### STEP 2: INVENTORY OPTIONAL TOOLS

Detect, but never install automatically:

```bash
command -v c2patool >/dev/null 2>&1
command -v exiftool >/dev/null 2>&1
command -v qpdf >/dev/null 2>&1
command -v unzip >/dev/null 2>&1
command -v zip >/dev/null 2>&1
```

Use quoted paths. Never expose credentials in arguments or logs. Do not bootstrap model downloads, Python environments, Docker images, CtrlRegen, reverse-SynthID, or another external repository.

### STEP 3: BUILD THE ACTION PLAN

For each confirmed or writer-approved probable finding, list:

- source path
- channel and evidence
- exact proposed removal
- protected data that must remain
- output path
- verification lane
- residual risk

Do not include informational or likely false-positive findings in removal actions.

Use format-specific rules:

- Text and Markdown: remove confirmed carrier controls and normalize suspicious spaces only when language context is safe. Remove only explicitly recognized provenance keys from YAML frontmatter.
- HTML: remove recognized provenance meta, XMP, JSON-LD provenance, or `data-ai*` fields. Preserve visible content and ordinary application data.
- SVG: remove recognized `<metadata>` or XMP content. Preserve visible SVG elements and accessibility text.
- PNG and JPEG: use a credible metadata tool to write a new file. Preserve ICC color profile and required color-space information. Do not change pixels.
- PDF: write a new file. ExifTool uses incremental metadata updates, so use `qpdf --linearize` on the intermediate output when permanent removal of old incremental metadata is required. Without qpdf, report the result as degraded and potentially recoverable.
- DOCX: work on a copy and change only recognized `docProps/` or provenance-bearing `customXml/` members. Preserve body XML, relationships, styles, media, and accessibility data.
- ODT: work on a copy and remove only recognized generator or provenance fields in `meta.xml`.
- EPUB: work on a copy and remove only recognized provenance fields from package metadata or text-resource metadata. Preserve the mimetype entry, package structure, navigation, accessibility metadata, and reading content.

Hard-bound C2PA removal does not remove soft binding or a pixel-domain signal. Audio and video watermark removal is unsupported.

### STEP 4: DRY-RUN BY DEFAULT

Without `--apply`, write no cleaned file and change no target. Show the complete action plan and end with the exact command the writer can run to apply it.

Use output names that make the mutation boundary visible. For a single file, insert `.cleaned` before the final extension, producing the pattern `*.cleaned.*`. For a directory or manuscript scope, mirror the relative paths under a clearly reported `cleaned/` directory without copying unrelated files.

Never overwrite an existing cleaned output silently.

### STEP 5: APPLY TO CLEANED COPIES

With `--apply` and without `--in-place`:

1. Validate that the output path is not a symlink and does not resolve outside the selected output boundary.
2. Write to a temporary sibling path.
3. Apply only the approved actions.
4. Verify the temporary output.
5. Atomically rename it to the final cleaned-copy path when the host supports atomic rename.
6. Leave the canonical original unchanged.

Canonical files under `.manuscript/drafts/body/` must remain unchanged by default.

### STEP 6: GATE IN-PLACE CHANGES

`--in-place` is invalid without `--apply`.

Before any in-place operation:

1. Show every target and removal action.
2. Ask for explicit writer confirmation.
3. Refuse a symlinked source or destination.
4. Create a recoverable backup beside the original with a timestamped `.bak` suffix.
5. Clean and verify a temporary sibling.
6. Replace the original only after verification succeeds.

If verification fails, keep the original and backup unchanged, remove no additional metadata, and report the failed temporary output.

### STEP 7: POST-CLEAN VERIFICATION

Run a post-clean inspection through the same credible lane used before cleaning. Compare before and after by channel.

Report each action as:

- `removed and verified`
- `removed but verification degraded`
- `not removed`
- `unsupported`

Update `.manuscript/reviews/PROVENANCE-AUDIT.md` for manuscript-scoped runs with a `Clean Results` section. Include source path, cleaned path or backup, removed counts, remaining findings, tool versions when available, and residual risk.

### STEP 8: VOICE AND DISCLOSURE BOUNDARY

Statistical text watermarks live in token choice and cannot be deterministically cleaned by this command. This command must not paraphrase text.

If the writer wants prose revised for visible craft reasons, suggest `/scr:line-edit`, `/scr:polish`, or a scoped re-draft. Those commands load STYLE-GUIDE.md and preserve Voice DNA. They must not use a detector score as the target.

Metadata cleaning never changes whether text, translations, covers, or illustrations were AI-generated or AI-assisted. Route retail and distribution work to `/scr:compliance-check` so the writer retains accurate disclosure answers.

### STEP 9: FINAL RESPONSE

Show:

- mode: dry-run, cleaned-copy apply, or in-place apply
- targets and outputs
- verified removals by channel
- degraded, unsupported, or residual signals
- whether originals changed
- disclosure note

## Automation Status

Every response must include:

```text
Automation status:
Trigger: /scr:provenance-clean {target or scope}
Auto-invoked commands:
- provenance-check logic: yes/no
Spawned agents:
- none
Local operations:
- dry-run plan produced: yes/no
- cleaned copies written: {count}
- in-place originals replaced: {count}
- recoverable backups written: {count}
- post-clean verification completed: yes/no
Manual gates:
- --apply and any in-place confirmation: writer-owned
Why: provenance-clean can remove metadata, so dry-run, copy isolation, and verification are mandatory
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

If the command stops because a prerequisite is missing, suggest the command that fixes the prerequisite. Keep every explanation practical and writer-facing.

## Tone

Be conservative and reversible. Never trade file integrity, writer voice, or disclosure truth for a cleaner-looking report.
