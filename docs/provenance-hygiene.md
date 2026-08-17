<!-- Implements: P-MUST-01, P-MUST-02, P-MUST-03, P-MUST-04, P-MUST-05, P-MUST-06, P-MUST-07, P-MUST-08, P-MUST-09, P-MUST-10, P-MUST-11, P-MUST-12, P-MUST-13, P-MUST-14, P-MUST-15, P-MUST-17, P-MUST-18 -->

# Provenance Hygiene

Scriveno provides a conservative audit and cleanup workflow for invisible Unicode markers, document metadata, and attached provenance manifests. It adapts the useful local-file techniques from Guillaume Meyer's MIT-licensed [watermarks-remover](https://github.com/guillaumemeyer/watermarks-remover) project to Scriveno's command-only architecture and publishing workflow.

The feature is for files you own or are authorized to process. It does not promise anonymity, detector evasion, or proof that a file has no remaining provenance signal.

Provider use is opt-in. Its privacy default is local-only processing, and it sends file bytes only after endpoint and capability validation. Every provider attempt is reported. A recoverable provider failure falls back to the local lanes with degraded status unless `--require-provider` is set.

## Commands

`/scr:provenance-check [scope]` runs a read-only audit and writes `.manuscript/reviews/PROVENANCE-AUDIT.md`. The scope can be a file, directory, HTTP or HTTPS URL, or one of `source`, `build`, `output`, and `all`. Remote URLs are read-only inputs.

The packaged executable accepts one or more local targets:

```bash
scriveno provenance-check manuscript.md assets/ --jobs 4 --format markdown --provider local
scriveno provenance-check release/ --format json --output audit.json --provider local
scriveno provenance-check release/ --format sarif --output audit.sarif --strict --provider local
SCRIVENO_WATERMARKS_SERVICE_URL=http://127.0.0.1:8765 scriveno provenance-check release/ --provider watermarks-remover
scriveno provenance-clean manuscript.md --provider local
scriveno provenance-clean manuscript.md --apply --format json --output clean-report.json
scriveno provenance-clean manuscript.md --apply --in-place --confirm-in-place
```

`--jobs` accepts 1 through 8. `--format` accepts `markdown`, `json`, or `sarif`. `--output` writes a report without changing audited files. `--provider local` is the default and makes no provider request. `--provider auto` uses the optional provider only when configured. `--provider watermarks-remover` explicitly requests it. Add `--require-provider` when local fallback is unacceptable; provider failure then exits `70`.

`/scr:provenance-clean [scope]` plans cleanup without changing files. Add `--apply` to write cleaned copies. Add `--apply --in-place --confirm-in-place` only when you intentionally want a confirmed replacement with a recoverable backup. The installed CLI accepts the same provider, jobs, format, and report output options as `provenance-check`.

Cleaned copies are the default. A file such as `book.epub` becomes `book.cleaned.epub`. The command stages a temporary sibling, rejects symlink targets, verifies the staged result, and uses no-clobber publication so an output created during verification is never overwritten.

## Supported Formats

The audit covers Markdown, text, HTML, SVG, PNG, JPEG, PDF, DOCX, ODT, EPUB, WebP, AVIF, HEIC, BMP, GIF, TIFF, BigTIFF, XLSX, and PPTX. It also inspects embedded raster data URIs through the decoded media lane. It identifies file types from signatures and container structure before choosing a parser. Binary files must never be decoded and rewritten as plain text.

The Unicode lane removes only carriers recorded as `confirmed` by the normalized pre-audit for the same file and archive member. A code-point class alone never authorizes mutation. It preserves legitimate script joiners, combining marks, emoji sequences, the U+E0100 ideographic variation selector range, and the U+180E Mongolian vowel separator and orthographic control. Code point removal and replacement counts are reported for each action.

The deterministic local cleaner covers recognized metadata structures in PNG, JPEG, WebP, AVIF, HEIC, BMP, GIF, TIFF, BigTIFF, XLSX, and PPTX. It removes a whole field or carrier only when its structure proves that the change is isolated. An ordinary PNG generator or software field can therefore be removed without requiring an AI-like value, but the key must match an exact whole-key allowlist and the value must contain no mixed or protected content. Partial keys, protected values, mixed PNG text, and PNG eXIf remain byte-for-byte with an explicit residual. WebP XMP and EXIF, AVIF and HEIC Exif and XML, GIF comment metadata, JPEG APP13, and mixed JPEG COM remain byte-for-byte when field-level removal is not proven. JPEG Exif segments are never deleted as a shortcut: Orientation and every non-generator Exif field are preserved exactly. When field-level Exif rewriting cannot be proven, the generator field remains as an explicit residual. JPEG XMP segments are preserved whole locally, including alt text, rights, copyright, accessibility fields, and other mixed protected content. Generator XMP remains an explicit residual when field-level rewriting cannot be proven safe. A generator COM segment can be removed only when its exact whole-segment removal is proven safe. Bytes after a GIF trailer or JPEG EOI marker are preserved byte-for-byte rather than silently discarded.

TIFF and BigTIFF traverse every IFD with cycle, count, and bounds protection before collecting strip and tile offset and byte-count ranges. Headers, IFD tables, next pointers, strip and tile tables and data, plus unrelated referenced values are protected. Candidate metadata stays unchanged with a residual when mutation safety is not proven, including any overlap with protected ranges. BMP V5 ICC profile offsets and lengths are validated, and BMP bytes are preserved when a safe metadata rewrite cannot be proven. Nested AVIF and HEIC ISO BMFF boxes are parsed with bounded box depth and count and retained with a residual. Local cleaning leaves c2pa, jumb, Exif, XML, and recognized UUID metadata unchanged because removing a box could stale iloc or other absolute offsets. The result carries an explicit degraded residual unless an offset-safe rewrite can be proven. Raster rewrites preserve pixels, frames, loop data, and ICC payloads. Office rewrites preserve relationships, styles, media, navigation, accessibility data, visible workbook or slide content, entry order, and compression semantics.

DOCX visible body XML, ODT `content.xml`, and declared EPUB HTML or XHTML body resources receive only Layer A character cleaning. EPUB navigation resources are excluded. Script and style blocks remain byte-identical. XML declarations and BOMs are parsed before rewriting. Fatal UTF-8 decoding rejects invalid byte sequences. UTF-16, ISO-8859-1, and every other unsupported encoding remain byte-for-byte unchanged with a degraded residual. Valid script joiners and emoji ZWJ sequences remain intact. Embedded raster data URIs require MIME and signature agreement, enforce both aggregate decoded bytes and match count limits, run through the matching media lane, and are re-encoded only after format verification.

Read-only archive inspection validates names and structure in memory. Every duplicate entry name is rejected, including byte-identical duplicates and normalized aliases. ZIP local headers must agree with central entries on decoded and raw names, flags, method, CRC, sizes, offsets, and data descriptor semantics. Local ranges must not overlap. The parser also rejects absolute or parent-traversal names, encryption, symlinks, excessive entry counts, excessive expansion, an unsafe compression ratio, and unsupported compression during apply. Cleaning rebuilds a fresh archive from validated members and reparses it to verify package invariants. When no member changes, it returns the original archive bytes. Otherwise it writes a temporary sibling that retains the final extension, proves that its bytes still match the staged result, re-audits it under the logical final path and format, and publishes it only after verification succeeds. An audit never extracts over the target or changes archive bytes. Images preserve pixel data and ICC color profiles when only metadata is cleaned.

Fixed limits cap file count, aggregate input bytes, embedded data URI aggregate decoded bytes and match count, directory depth and directory count, archive entries, expanded archive bytes, compression ratio, and concurrent reads and cleaning. Stable reads recheck the actual byte count after opening each source. The `--jobs` worker pool reports its observed `peakWorkers`, which never exceeds the selected bound. Limit violations exit as invalid or unsafe input.

Before mutation, the cleaner computes every output, backup, temporary, and report destination. It rejects lexical aliases, canonical aliases, hardlink identities, symlinked components, non-directory boundaries, and paths outside the selected boundary. Each source is held to a stable device, inode, size, and hash identity. In-place apply refuses hardlinked sources. Boundary and source identities are revalidated before staging and publication, and report boundaries are revalidated immediately before report publication. The whole batch is staged and verified before commit. A failed worker or collision removes every stage, and a commit failure triggers rollback so there are no partial outputs when restoration succeeds. If rollback fails, every relevant backup is retained, the original publication error remains visible, and each rollback error reports the exact recovery path.

## Machine-Readable Results

All output formats originate from one normalized audit record. Every clean target includes its normalized `preAudit`, normalized `postAudit`, and a `findingComparison` with removed, remaining, and added findings. The comparison uses an occurrence-aware multiset over stable rule, channel, confidence, code point, and archive-member identity. Absolute location is not part of semantic identity, so offsets shifted by an approved removal still pair correctly. Markdown renders each preAudit and postAudit schema and status plus detailed removed, remaining, and added finding records, not counts alone. Markdown context-escapes every external field, including finding members, errors, provider reasons, residuals, headings, links, pipes, newlines, and control characters. Actions include removal and replacement counts by code point. It also includes operation, target inventory, capability inventory, findings, actions, outputs, residual risks, errors, status, and recommended exit code. Stable rule ids and artifact locations are preserved across Markdown, JSON, and SARIF 2.1.0. An ordinary no-change dry-run records `no_safe_change` as a non-actionable note and exits clear with code `0`. Degraded pre-audit coverage propagates to the target and top-level status with explicit residual risk and exit `2`, even when the post-audit is clear.

Exit codes are:

- `0`: clear with no actionable findings
- `1`: findings or actionable residuals
- `2`: degraded or unsupported coverage
- `64`: invalid or unsafe input
- `70`: unrecovered internal failure

The installed-package consumer proof exercises all five exit codes, provider success, provider failure with local fallback, dry-run behavior, cleaned-copy publication, invalid input, JSON, and SARIF without reading source-checkout internals.

## Optional Tools

Scriveno stays dependency-free. It detects external tools and explains any degraded lane instead of installing software automatically.

- `c2patool` reads C2PA and Content Credentials manifests when available.
- ExifTool reads and removes supported metadata from images and documents.
- `qpdf` validates and rewrites PDFs after metadata cleanup when needed.
- `unzip` and `zip` inspect and rebuild DOCX, ODT, and EPUB containers.

If a tool is missing, the report records the skipped evidence class. Scriveno does not download models or add package dependencies.

## Optional Watermarks-Remover Service

Scriveno's optional adapter is tested against watermarks-remover commit `c2ac8eeef3ff1a17aaab0cdb86889c7ad21675a7` on upstream `main`. The latest published upstream release at that commit is `v0.5.0`, whose peeled tag points to `dc0ff78f39bedfe0a1986eef54efb297645372ba`; Scriveno negotiates advertised capabilities instead of assuming that the release tag includes later `main` additions. The executable adapter stays dependency-free and speaks the upstream JSON contract for `GET /health`, `GET /capabilities`, `POST /inspect`, and `POST /clean`.

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

Provider cleaning uses only `keep_non_ai_metadata: true` and `also_layer_a_text: true`. Before publication, every provider result must equal the exact locally proven safe cleaned result, or the original when no safe local change is proven, and it may add no finding. This direct protected-content invariant is applied before any destructive canonicalization. It protects visible prose, pixels, frames, loop data, ICC data, mixed metadata structures, archive structure, relationships, styles, media, navigation, and accessibility content. An invariant failure writes nothing in every provider mode. Required-provider transport failure exits `70`; optional transport failure records the failed attempt before local fallback. The response is mapped into the `scriveno.provenance.clean/v1` schema with normalized changes, byte counts, and residual summary findings synthesized from explicit booleans instead of exposing the raw provider report. Scriveno never requests pixel removal, statistical rewriting, aggressive homoglyph replacement, or humanizing. A missing, malformed, incompatible, or invariant-breaking response cannot authorize cleaning.

Soft-bound signals, pixel-domain watermarks, vendor-keyed statistical marks, and unrecognized container channels remain unsupported for removal. They are reported as residual or degraded coverage instead of being treated as clear.

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
