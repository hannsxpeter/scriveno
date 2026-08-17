---
description: Create verified cleaned copies of writer-owned files by removing confirmed Unicode carriers and removable provenance metadata. Dry-run by default.
argument-hint: "[target] [--scope <source|build|output|all>] [--apply] [--in-place]"
---

# /scr:provenance-clean - Provenance Cleaning

<!-- Implements: P-MUST-02, P-MUST-03, P-MUST-04, P-MUST-08, P-MUST-09, P-MUST-10, P-MUST-11, P-MUST-12, P-MUST-13, P-MUST-14, P-MUST-15, P-MUST-18 -->

Prepare cleaned copies of writer-owned text and publishing files after inspecting them for removable Unicode carriers, generator metadata, EXIF or XMP fields, document properties, and hard-bound C2PA evidence.

This command is dry-run by default. It does not rewrite prose, remove disclosure duties, or promise that vendor tools will find no residual signal.

## Usage

```text
/scr:provenance-clean [target] [--scope <source|build|output|all>] [--apply] [--in-place]
```

- `target`: A local file or directory. Remote targets are not writable and must be audited with `/scr:provenance-check`.
- `--scope`: Resolve manuscript source, build, output, or all targets when no explicit target is supplied.
- `--provider local`: Keep all inspection and cleaning local. This is the default.
- `--provider auto`: Use the optional watermarks-remover service only when its environment configuration is present.
- `--provider watermarks-remover`: Request the configured service, with a visible local fallback on recoverable failure.
- `--require-provider`: Stop with exit `70` if service validation or cleaning fails. Do not write a cleaned output.
- `--apply`: Create cleaned copies and verify them. Without this flag, report proposed actions only.
- `--in-place`: Replace originals only after `--apply`, explicit writer confirmation, and a recoverable backup.
- `--confirm-in-place`: Record the explicit confirmation required for a non-interactive in-place run. It is invalid without `--apply --in-place`.
- `--jobs <1-8>`: Bound concurrent input work with the same hard cap as the audit command.
- `--format <markdown|json|sarif>`: Render the normalized clean result in the selected report format.
- `--output <report>`: Write the report to a safe path. Cleaned artifacts still use adjacent or mirrored cleaned-copy paths.

The installed CLI exposes the same gates:

```bash
scriveno provenance-clean manuscript.md --provider local
scriveno provenance-clean manuscript.md --apply --format json --output clean-report.json
scriveno provenance-clean manuscript.md --apply --in-place --confirm-in-place
```

## Instruction

You are a provenance-cleaning specialist. Change only confirmed removable carriers or metadata, protect visible content and rendering data, and leave a before and after evidence trail.

### STEP 0: LOAD CONTEXT AND POLICY

Read the same manuscript context used by `/scr:provenance-check`, including `.manuscript/STYLE-GUIDE.md` when present, the shared `CONSTRAINTS.json`, and `.manuscript/reviews/PROVENANCE-AUDIT.md` when current.

Operate only on content the writer owns or is authorized to process. This command must not clean a remote URL, a third-party file without authorization, or a target outside the resolved local boundary without confirmation.

Detector scores are context only. The command must not paraphrase prose, run a generic humanizer, or optimize any detector threshold. A cleaned file must not be represented as human-written.

### STEP 1: INSPECT BEFORE PLANNING A CLEAN

Run the `/scr:provenance-check` inspection logic on the selected target if a current audit does not already cover it. Classify by extension and magic bytes before reading.

ZIP containers, PDF files, images, executables, databases, fonts, archives, audio, and video must never pass through a text cleaner. Preserve script joiners, emoji sequences, flag tags, orthographic controls, the U+E0100 ideographic variation selector range, the U+180E Mongolian vowel separator, ICC color profiles, accessibility metadata, navigation, and visible document content. Remove a Unicode carrier only when the normalized pre-audit records confirmed evidence for that code point in the same file and member.

If a lane is degraded or unsupported, do not propose a destructive workaround. Report the missing credible capability.

Warn before processing unusually large inputs. Bound file and directory counts, directory depth, stable-read aggregate bytes, embedded data URI aggregate decoded bytes and match count, and the selected worker pool. For ZIP-based containers, reject absolute paths, parent-directory traversal, normalized aliases, symlink entries, every duplicate entry name, unsupported compression during apply, and expansion or compression ratios beyond the fixed limits. Never extract an unsafe archive.

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

The optional service URL and bearer token come only from `SCRIVENO_WATERMARKS_SERVICE_URL` and `SCRIVENO_WATERMARKS_SERVICE_TOKEN`. Apply the same global-unicast endpoint policy, redirect refusal, absolute wall-clock deadlines, separate request and response caps, strict schema validation, stable-handle ownership and digest binding, capability checks, format checks, and bounded concurrency as `/scr:provenance-check` before sending bytes.

When the provider is selected, request only its conservative deterministic cleaning path. Send exactly `keep_non_ai_metadata: true` and `also_layer_a_text: true`. Build residual summary findings only from explicit `still_has_c2pa` and `still_has_ai_metadata` booleans. Ignore every untyped upstream `post_findings` string. Never request pixel removal, NFKC rewriting, aggressive homoglyph replacement, Layer B rewriting, detector optimization, or humanizing. Missing, malformed, or incompatible capabilities make the provider degraded and must never authorize a clean.

Before publishing provider output, apply the local protected-content invariant directly to the returned bytes. Provider output must equal the exact locally proven safe cleaned result, or the original when the local lane cannot prove a safe change, and it may add no finding. Visible prose, pixels, image frames, loop data, ICC data, mixed metadata structures, archive structure, relationships, styles, media, navigation, and accessibility content must remain protected. Refuse an invariant failure and write nothing in every provider mode. In optional-provider mode, only a recoverable transport or capability failure can fall back locally after the failed attempt is recorded.

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

- Text and Markdown: remove only carrier controls confirmed by the normalized pre-audit. Preserve probable variation selectors and orthographic controls. Report removal and replacement counts by code point. Remove only explicitly recognized provenance keys from YAML frontmatter.
- HTML: remove recognized provenance meta, XMP, JSON-LD provenance, or `data-ai*` fields. Preserve visible content and ordinary application data.
- SVG: remove recognized `<metadata>` or XMP content. Preserve visible SVG elements and accessibility text.
- PNG and JPEG: remove only a structurally isolated generator or software field, including ordinary tool values. A PNG key must match the exact whole-key allowlist, and mixed or protected values remain byte-for-byte with a residual. Preserve PNG eXIf byte-for-byte with a residual. Never delete an entire JPEG Exif segment to remove one field. Preserve Orientation and every non-generator Exif field exactly; leave the generator field as residual when safe field-level rewriting is unproven. Preserve every JPEG XMP segment whole, including alt text, rights, copyright, accessibility fields, and mixed protected content. Leave generator XMP as an explicit residual unless field-level removal is structurally proven. Preserve JPEG APP13 and mixed COM byte-for-byte with a residual. A generator COM segment may be removed only when exact whole-segment removal is proven. Preserve bytes after JPEG EOI, ICC color profile, required color-space information, and image data. Do not change pixels.
- WebP, AVIF, HEIC, BMP, GIF, TIFF, and BigTIFF: use the deterministic local parser only where a safe structural rewrite is proven. Preserve WebP XMP and EXIF and GIF comment metadata byte-for-byte with an explicit residual when field-level removal is not proven. Preserve bytes after the GIF trailer. Validate BMP V5 ICC boundaries. Parse nested AVIF and HEIC boxes with bounded depth and count. Leave c2pa, jumb, Exif, XML, and recognized UUID boxes unchanged with a degraded residual because iloc and other absolute offsets could become stale. Traverse every TIFF and BigTIFF IFD through next-IFD pointers with cycle, count, and bounds protection, then collect headers, IFD tables and next pointers, strip and tile tables and data, and every unrelated referenced value before considering a candidate mutation. Leave any unproven or overlapping metadata unchanged with a residual. Preserve pixels, image frames, loop data, and ICC data.
- PDF: write a new file. ExifTool uses incremental metadata updates, so use `qpdf --linearize` on the intermediate output when permanent removal of old incremental metadata is required. Without qpdf, report the result as degraded and potentially recoverable.
- DOCX: work on a copy and change only recognized `docProps/` or provenance-bearing `customXml/` members. Preserve body XML, relationships, styles, media, and accessibility data.
- ODT: work on a copy and remove only recognized generator or provenance fields in `meta.xml`.
- EPUB: work on a copy and remove only recognized provenance fields from package metadata or text-resource metadata. Preserve the mimetype entry, package structure, navigation, accessibility metadata, and reading content.
- XLSX and PPTX: remove only recognized `docProps/` or provenance-bearing `customXml/` values. Preserve workbook or presentation XML, relationships, styles, media, visible strings, entry order, and compression semantics.
- DOCX and ODT body resources: remove only confirmed Layer A controls from visible text nodes in `word/document.xml` or `content.xml`. Preserve valid script joiners and emoji ZWJ sequences.
- EPUB body resources: clean only declared HTML or XHTML manifest resources, excluding navigation resources. Preserve undeclared resources, navigation, accessibility attributes, relationships, styles, and media. Keep script and style blocks byte-identical.
- Archive text resources: parse the XML declaration and BOM, then use fatal UTF-8 decoding. Preserve UTF-16, ISO-8859-1, invalid UTF-8, and every unsupported encoding byte-for-byte unchanged with degraded residual coverage. Return the original archive bytes when no member changes.
- Embedded image data URIs: require MIME and signature agreement, enforce per-item and aggregate decoded byte caps plus the match count limit, clean through the matching raster lane, and re-encode only a verified result.

Hard-bound C2PA removal does not remove soft binding or a pixel-domain signal. Audio and video watermark removal is unsupported.

### STEP 4: DRY-RUN BY DEFAULT

Without `--apply`, write no cleaned file and change no target. Show the complete action plan and end with the exact command the writer can run to apply it.

Use output names that make the mutation boundary visible. For a single file, insert `.cleaned` before the final extension, producing the pattern `*.cleaned.*`. For a directory or manuscript scope, mirror the relative paths under a clearly reported `cleaned/` directory without copying unrelated files.

Never overwrite an existing cleaned output silently.

### STEP 5: APPLY TO CLEANED COPIES

With `--apply` and without `--in-place`:

1. Precompute every output, backup, temporary, and report path before mutation. Reject lexical, canonical, inode, and hardlink aliases.
2. Validate that the boundary itself and every output component are non-symlink paths and that the boundary is a real directory with a stable identity.
3. Open every source through a stable handle and bind it to device, inode, size, and hash. Recheck the actual stable-read byte count.
4. Write only to precomputed temporary sibling paths and apply the approved actions.
5. Give every temporary sibling the final extension, verify that its staged bytes are unchanged, and re-audit it through the normalized inspection engine under the logical final path and format.
6. Revalidate source, boundary, output, backup, temporary, and report identities immediately before publication.
7. Stage and verify the whole batch before commit. Use no-clobber publication for cleaned copies and rollback commit failures. If restoration fails, retain every relevant backup and report the original publication error, each rollback error, and every exact recovery path.
8. Leave the canonical original unchanged.

Canonical files under `.manuscript/drafts/body/` must remain unchanged by default.

### STEP 6: GATE IN-PLACE CHANGES

`--in-place` is invalid without `--apply`.

Before any in-place operation:

1. Show every target and removal action.
2. Ask for explicit writer confirmation.
3. Refuse a symlinked source or destination.
4. Refuse a hardlinked in-place source, then create a recoverable backup beside the original with a timestamped `.bak` suffix.
5. Clean and verify a temporary sibling by re-audit.
6. Replace the original only after verification succeeds.

If verification fails, keep the original and backup unchanged, remove no additional metadata, and report the failed temporary output.

### STEP 7: POST-CLEAN VERIFICATION

Run a post-clean inspection through the same credible lane used before cleaning. For every target, preserve the normalized `preAudit`, normalized `postAudit`, and `findingComparison` with removed, remaining, and added findings. Pair findings as an occurrence-aware multiset over stable rule, channel, confidence, code point, and archive-member properties; absolute offsets and line locations are not semantic identity. Markdown must include both audit schemas and statuses and the detailed finding groups, not counts alone. Context-escape every external Markdown field, including finding members, errors, provider reasons, residuals, newlines, pipes, headings, links, and controls. Propagate degraded pre-audit coverage to the target and top-level degraded status, residual risk, and exit `2` even when the post-audit is clear. Report removal and replacement counts by code point. A `no_safe_change` note is non-actionable, so an ordinary no-change dry-run remains clear with exit `0`. Record the bounded worker pool's observed `peakWorkers`.

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
