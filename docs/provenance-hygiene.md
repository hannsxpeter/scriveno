# Provenance Hygiene

Scriveno provides a conservative audit and cleanup workflow for invisible Unicode markers, document metadata, and attached provenance manifests. It adapts the useful local-file techniques from Guillaume Meyer's MIT-licensed [watermarks-remover](https://github.com/guillaumemeyer/watermarks-remover) project to Scriveno's command-only architecture and publishing workflow.

The feature is for files you own or are authorized to process. It does not promise anonymity, detector evasion, or proof that a file has no remaining provenance signal.

## Commands

`/scr:provenance-check [scope]` runs a read-only audit and writes `.manuscript/reviews/PROVENANCE-AUDIT.md`. The scope can be a file, directory, HTTP or HTTPS URL, or one of `source`, `build`, `output`, and `all`. Remote URLs are read-only inputs.

`/scr:provenance-clean [scope]` plans cleanup without changing files. Add `--apply` to write cleaned copies. Add `--apply --in-place` only when you intentionally want a confirmed replacement with a recoverable backup.

Cleaned copies are the default. A file such as `book.epub` becomes `book.cleaned.epub`. The command uses a temporary sibling and atomic rename, rejects symlink targets, and verifies the result after writing.

## Supported Formats

The audit covers Markdown, text, HTML, SVG, PNG, JPEG, PDF, DOCX, ODT, and EPUB. It identifies file types from signatures and container structure before choosing a parser. Binary files must never be decoded and rewritten as plain text.

The Unicode lane removes only explicit marker classes such as zero-width separators, byte-order marks in non-leading positions, bidi controls, and selected invisible format controls. It preserves legitimate script joiners, variation selectors, combining marks, and emoji sequences unless the audit supplies file-specific evidence that a code point is unwanted.

Archive-based formats are unpacked into a temporary workspace, cleaned entry by entry, and rebuilt without changing required archive structure. Images preserve pixel data and ICC color profiles when only metadata is cleaned.

## Optional Tools

Scriveno stays dependency-free. It detects external tools and explains any degraded lane instead of installing software automatically.

- `c2patool` reads C2PA and Content Credentials manifests when available.
- ExifTool reads and removes supported metadata from images and documents.
- `qpdf` validates and rewrites PDFs after metadata cleanup when needed.
- `unzip` and `zip` inspect and rebuild DOCX, ODT, and EPUB containers.

If a tool is missing, the report records the skipped evidence class. Scriveno does not download models or add package dependencies.

## Safety and Residual Risk

Every finding is labeled `confirmed`, `probable`, `informational`, or `likely_false_positive`. A clean report means only that the available lanes found no targeted markers. Soft bindings, pixel-domain signals, audio or video watermarks, prior copies, server logs, and unknown proprietary schemes can remain.

PDF cleanup needs special care because metadata edits can be incremental. The cleaner may use ExifTool followed by `qpdf` validation and rewriting, but it must report exactly which tools ran and keep the original or backup recoverable.

Provenance hygiene does not include a humanizer and never paraphrases prose. If visible writing needs revision, use `/scr:line-edit` or `/scr:polish` with `.manuscript/STYLE-GUIDE.md` as the voice authority. External detector scores remain context only.

Removing metadata does not change how an asset was created. Platform disclosure, copyright, licensing, and attribution decisions remain governed by the project record and `/scr:compliance-check`.

## Suggested Workflow

1. Export or identify the files you are authorized to inspect.
2. Run `/scr:provenance-check` and read the audit report.
3. Run `/scr:provenance-clean` to preview the exact cleanup plan.
4. Use `/scr:provenance-clean --apply` to create cleaned copies.
5. Re-run `/scr:provenance-check` on those copies.
6. Run `/scr:compliance-check` before publishing when disclosure or rights duties apply.
