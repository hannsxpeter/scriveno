<!-- Implements: P-MUST-01, P-MUST-02, P-MUST-04, P-MUST-05, P-MUST-06, P-MUST-07, P-MUST-08, P-MUST-10, P-MUST-11, P-MUST-12, P-MUST-13, P-MUST-14, P-MUST-15, P-MUST-17 -->

# Provenance Hygiene

Scriveno provides a conservative audit and cleanup workflow for invisible Unicode markers, document metadata, and attached provenance manifests. It adapts the useful local-file techniques from Guillaume Meyer's MIT-licensed [watermarks-remover](https://github.com/guillaumemeyer/watermarks-remover) project to Scriveno's command-only architecture and publishing workflow.

The feature is for files you own or are authorized to process. It does not promise anonymity, detector evasion, or proof that a file has no remaining provenance signal.

## Commands

`/scr:provenance-check [scope]` runs a read-only audit and writes `.manuscript/reviews/PROVENANCE-AUDIT.md`. The scope can be a file, directory, HTTP or HTTPS URL, or one of `source`, `build`, `output`, and `all`. Remote URLs are read-only inputs.

The packaged executable accepts one or more local targets:

```bash
scriveno provenance-check manuscript.md assets/ --jobs 4 --format markdown --provider local
scriveno provenance-check release/ --format json --output audit.json --provider local
scriveno provenance-check release/ --format sarif --output audit.sarif --strict --provider local
SCRIVENO_WATERMARKS_SERVICE_URL=http://127.0.0.1:8765 scriveno provenance-check release/ --provider watermarks-remover
```

`--jobs` accepts 1 through 8. `--format` accepts `markdown`, `json`, or `sarif`. `--output` writes a report without changing audited files. `--provider local` is the default and makes no provider request. `--provider auto` uses the optional provider only when configured. `--provider watermarks-remover` explicitly requests it. Add `--require-provider` when local fallback is unacceptable; provider failure then exits `70`.

`/scr:provenance-clean [scope]` plans cleanup without changing files. Add `--apply` to write cleaned copies. Add `--apply --in-place` only when you intentionally want a confirmed replacement with a recoverable backup.

Cleaned copies are the default. A file such as `book.epub` becomes `book.cleaned.epub`. The command uses a temporary sibling and atomic rename, rejects symlink targets, and verifies the result after writing.

## Supported Formats

The audit covers Markdown, text, HTML, SVG, PNG, JPEG, PDF, DOCX, ODT, EPUB, WebP, AVIF, HEIC, BMP, GIF, TIFF, BigTIFF, XLSX, and PPTX. It also inspects embedded raster data URIs through the decoded media lane. It identifies file types from signatures and container structure before choosing a parser. Binary files must never be decoded and rewritten as plain text.

The Unicode lane removes only explicit marker classes such as zero-width separators, byte-order marks in non-leading positions, bidi controls, and selected invisible format controls. It preserves legitimate script joiners, variation selectors, combining marks, and emoji sequences unless the audit supplies file-specific evidence that a code point is unwanted.

Read-only archive inspection validates names and structure in memory. It rejects absolute or parent-traversal names, conflicting duplicate entries, encryption, symlinks, excessive entry counts, excessive expansion, and an unsafe compression ratio. Later cleaning may use a temporary workspace, but an audit never extracts over the target or changes archive bytes. Images preserve pixel data and ICC color profiles when only metadata is cleaned.

Fixed limits cap file count, aggregate input bytes, embedded data URI bytes, archive entries, expanded archive bytes, compression ratio, and concurrent reads. Limit violations exit as invalid or unsafe input.

## Machine-Readable Results

All output formats originate from one normalized audit record. It includes operation, target inventory, capability inventory, findings, actions, outputs, residual risks, errors, status, and recommended exit code. Stable rule ids and artifact locations are preserved across Markdown, JSON, and SARIF 2.1.0.

Exit codes are:

- `0`: clear with no actionable findings
- `1`: findings or actionable residuals
- `2`: degraded or unsupported coverage
- `64`: invalid or unsafe input
- `70`: unrecovered internal failure

## Optional Tools

Scriveno stays dependency-free. It detects external tools and explains any degraded lane instead of installing software automatically.

- `c2patool` reads C2PA and Content Credentials manifests when available.
- ExifTool reads and removes supported metadata from images and documents.
- `qpdf` validates and rewrites PDFs after metadata cleanup when needed.
- `unzip` and `zip` inspect and rebuild DOCX, ODT, and EPUB containers.

If a tool is missing, the report records the skipped evidence class. Scriveno does not download models or add package dependencies.

## Optional Watermarks-Remover Service

Scriveno's optional adapter is tested against watermarks-remover release `v0.5.0` at commit `c2ac8eeef3ff1a17aaab0cdb86889c7ad21675a7`. The executable adapter stays dependency-free and speaks the upstream JSON contract for `GET /health`, `GET /capabilities`, `POST /inspect`, and `POST /clean`.

Configuration is environment-only:

```bash
export SCRIVENO_WATERMARKS_SERVICE_URL=http://127.0.0.1:8765
export SCRIVENO_WATERMARKS_SERVICE_TOKEN='replace-with-local-secret'
scriveno provenance-check manuscript.md --provider watermarks-remover
```

The token is optional when the service does not require authentication. Scriveno never accepts the URL or token as command arguments. Provider JSON passes through bounded iterative complexity validation with explicit depth and node limits. That validation does not rewrite protocol keys, enum values, counts, versions, capabilities, or cleaned base64. The token is redacted only from schema-approved public evidence and error text while the normalized result is built, so provider-supplied secrets do not appear in reports, errors, logs, Markdown, JSON, or SARIF.

Health and capabilities are validated before any upload. The adapter records the service version, checks operations and formats, and clamps concurrency to the lowest Scriveno, user, and advertised limit. It opens each input once through a non-symlink stable handle, establishes ownership and file identity, reads and hashes from that handle, compares the expected validated digest, and uploads those exact bytes. Every provider attempt is accounted for before a batch failure returns, so work cannot continue unreported after fallback begins.

The loopback service may use HTTP. Remote providers require HTTPS and a global-unicast address. DNS resolution rejects private, loopback, link-local, shared, multicast, unspecified, cloud metadata, and all other special-purpose ranges. The DNS deadline and continuously streaming HTTP response deadline are directly tested. The same absolute request deadline covers connection establishment and the TLS handshake. Redirects are refused.

Input bytes and the base64 request envelope have independent caps. Small health, capability, and inspect reports use a report response cap. Clean responses use a separate bounded clean response cap sized for the base64 representation of every accepted input. Provider responses must match a strict kind-specific schema before normalization; empty, malformed, cross-kind, or contradictory payloads trigger visible local fallback.

Provider output is mapped into Scriveno's normalized findings. Only typed text `hits`, typed container `layer_a_hits`, and explicit C2PA or AI-metadata summary booleans are authoritative deterministic fields. True summary booleans create their own normalized summary findings. Every untyped upstream `report.findings` and `post_findings` string is ignored, even when it sounds like C2PA or metadata evidence and a report-wide boolean is true. The upstream service includes a Layer B stylometry score for text and can use it in its aggregate `suspicious` flag. Stylometry is ignored as authoritative evidence, and Scriveno does not turn that aggregate flag into a finding. This categorical exclusion covers the v0.5.0 phrases `AI phrase marker`, `AI cadence phrase`, `unnaturally uniform sentence cadence`, `elevated AI formulaic transition density`, `n-gram density`, `burstiness`, and `lexical diversity` without relying on a vocabulary denylist.

Provider cleaning uses only `keep_non_ai_metadata: true` and `also_layer_a_text: true`. The response is mapped into the `scriveno.provenance.clean/v1` schema with normalized changes, byte counts, and residual summary findings synthesized from explicit booleans instead of exposing the raw provider report. Scriveno never requests pixel removal, statistical rewriting, aggressive homoglyph replacement, or humanizing. A missing, malformed, or incompatible capability response cannot authorize cleaning.

If an optional provider attempt fails, the audit records the reason and falls back to the same local lanes. The report contains both attempts and is degraded rather than silently clear. Batch execution waits for and records every started provider attempt before fallback. `--require-provider` disables fallback, returns exit `70`, and writes no cleaned output.

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
