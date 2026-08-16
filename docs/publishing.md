# Publishing Guide

Scriveno takes your manuscript from drafted prose to publication-ready files. Whether you're uploading to Amazon KDP, submitting to IngramSpark, or querying agents, the export pipeline handles format conversion, metadata generation, and platform-specific packaging.

This guide covers all 14 export formats, platform-specific packages, the publish wizard, and autopilot publishing.

## Prerequisites

Scriveno's export pipeline uses external tools for format conversion. You only need the tools required by your chosen formats.

| Tool | Install | Required For |
|------|---------|-------------|
| **Pandoc** | `brew install pandoc` | DOCX, PDF, EPUB, LaTeX |
| **Typst** | `brew install typst` | PDF generation |
| **Ghostscript** | `brew install ghostscript` | IngramSpark CMYK conversion |
| **Afterwriting** | `npm i -g afterwriting` | Screenplay PDF |
| **Screenplain** | `pip install screenplain` | Final Draft (FDX) export |

Scriveno warns at export time if a required tool is missing and shows the install command for the format you selected.

**No tools needed for:** Markdown export and Fountain export -- these are pure text conversions handled by Scriveno directly.

## Export Formats

Export your manuscript with `/scr:export --format <format>`. Scriveno assembles the full manuscript from your outline, front matter, body drafts, and back matter, then converts to the target format.

### Core Formats

These cover the most common publishing and review needs.

**Markdown** -- Plain assembled manuscript with no external dependencies.

```
/scr:export --format markdown
```

Output: `.manuscript/output/manuscript.md`

**DOCX (Manuscript Format)** -- Manuscript DOCX assembled through Pandoc. Use this when you need a Word file as the starting point for submissions or further formatting.

```
/scr:export --format docx
```

Output: `.manuscript/output/manuscript.docx`. The shipped path uses Pandoc's default DOCX styling because Scriveno does not bundle a manuscript reference document. If you need standard manuscript formatting, provide your own Pandoc reference document.

**DOCX (Formatted)** -- Designed and typeset DOCX for review copies and ARCs (advance reader copies). Custom fonts, styled headers, polished layout.

```
/scr:export --format docx --formatted
```

Output: `.manuscript/output/manuscript-formatted.docx`. The shipped command path currently uses Pandoc's default DOCX output. If you want a styled review-copy layout, provide your own Pandoc reference document.

**PDF (Manuscript)** -- Standard manuscript-format PDF via the Typst engine.

```
/scr:export --format pdf
```

Output: `.manuscript/output/manuscript.pdf`. Requires Pandoc and Typst.

**PDF (Review Copy)** -- Printable prepublication PDF for beta readers, editors, collaborators, or your own paper read-through. This does not use ebook styling, paperback trim, hardcover case-wrap assumptions, KDP package formatting, or IngramSpark package formatting.

```
/scr:export --format pdf --review
```

Output: `.manuscript/output/manuscript-review.pdf`. Requires Pandoc and Typst. Defaults to letter paper for ordinary printing and can use `review_paper_size: "a4"` in `.manuscript/config.json`. Use this when you want to print or share before publishing.

**PDF (Print-Ready)** -- Book interior PDF with proper trim sizes, margins, gutters, and page numbers. Ready for print-on-demand services.

```
/scr:export --format pdf --print-ready
```

Output: `.manuscript/output/manuscript-print.pdf`. Uses the `scriveno-book.typst` template. Default trim size is 6" x 9" -- override via `trim_width` and `trim_height` in `.manuscript/config.json`.

### Ebook

**EPUB 3.0** -- Industry-standard ebook format accepted by all major retailers (Amazon, Apple Books, Kobo, Barnes & Noble, Google Play).

```
/scr:export --format epub
```

Output: `.manuscript/output/manuscript.epub`. Includes table of contents, metadata, and custom CSS styling via `scriveno-epub.css`. If an ebook front cover exists at `.manuscript/build/ebook-cover.jpg` (or `.png`), it's embedded automatically.

For platform-aware EPUB builds, use `/scr:build-ebook --platform <platform>`. Shipped platform profiles live under `templates/platforms/` for `kdp`, `ingram`, `apple`, `bn`, `d2d`, `kobo`, `google`, and `smashwords`. The build command validates the platform manifest, confirms EPUB support, and carries the selected platform label plus `epub_variant` into output metadata.

## Canonical Cover Deliverables

Scriveno treats cover files as a separate build contract under `.manuscript/build/`.

| Deliverable | Canonical file | Requirements |
|-------------|----------------|--------------|
| Ebook cover | `.manuscript/build/ebook-cover.jpg` (PNG also accepted) | Front cover only, `1600 x 2560`, RGB, no spine, no back, no bleed |
| Paperback cover | `.manuscript/build/paperback-cover.pdf` | Full wrap, PDF/X-1a:2001, CMYK, 300 DPI, embedded fonts, flattened transparency, `0.125"` bleed |
| Hardcover cover | `.manuscript/build/hardcover-cover.pdf` | Full case wrap, PDF/X-1a:2001, CMYK, 300 DPI, embedded fonts, flattened transparency, board-wrap allowances |

Keep editable source files under `.manuscript/build/source/`.

For paperback and hardcover, treat exact wrap width, spine width, and guide lines as **template-driven** values from the current IngramSpark Cover Template Generator (or the current target-platform equivalent), not static math baked into Scriveno docs.

**No image-generation tool?** `/scr:cover-art` does not require one. Besides generating prompts for an external AI image tool or a human designer, it can build the cover directly as original SVG or HTML/CSS art and convert it to the canonical deliverables with local CLI tools (`rsvg-convert`, Inkscape, ImageMagick, or headless Chrome). The editable vector source lives in `.manuscript/build/source/`. Agent-built covers count as AI-generated imagery on platforms with AI-content disclosure rules; `/scr:compliance-check` maps that disclosure per platform.

After export, consider validating with EPUBCheck if you have Java installed -- most retailers run their own validation and will reject non-compliant files.

### Screenplay Formats

Available for screenplay, stage play, TV pilot, TV series bible, audio drama, and libretto work types.

**Fountain** -- Plain-text screenplay format. No external tools needed -- Scriveno converts your manuscript directly.

```
/scr:export --format fountain
```

Output: `.manuscript/output/screenplay.fountain`. If Afterwriting is installed, Scriveno can also generate a formatted screenplay PDF (`screenplay.pdf`).

**FDX (Final Draft XML)** -- The industry-standard format for screenplay submission. Chains through Fountain as an intermediate step.

```
/scr:export --format fdx
```

Output: `.manuscript/output/screenplay.fdx`. Requires Screenplain.

### Academic

Available for academic and sacred text work types.

**LaTeX** -- LaTeX source file for journal submissions, thesis formatting, or further editing in Overleaf.

```
/scr:export --format latex
```

Output: `.manuscript/output/manuscript.tex`. Uses the `scriveno-academic.latex` template. If a bibliography file exists at `.manuscript/bibliography.bib`, citations are processed automatically with `--citeproc`.

## Platform Packages

Platform packages bundle everything a specific publishing platform needs into a single directory -- interior files, cover specifications, metadata, and checklists.

The lower-level build commands are platform-aware too:

- `/scr:build-ebook --platform <platform>` loads `templates/platforms/{platform}/manifest.yaml`, validates EPUB support, and writes platform metadata.
- `/scr:build-print --platform <platform>` uses print and academic platform profiles for trim-size, page-count, and template routing.

If a project has top-level `platform` in `.manuscript/config.json`, build commands use it when `--platform` is omitted. Otherwise ebook builds default to `kdp`.

### KDP (Kindle Direct Publishing)

**KDP Ebook** -- EPUB package optimized for Kindle with KDP-specific CSS, alt text on all images, and embedded fonts.

```
/scr:export --format epub
```

Use the standard EPUB export for KDP ebook submissions. The `scriveno-epub.css` template is already KDP-compatible.

**KDP Print** -- Paperback submission package with interior PDF, cover handoff brief, and metadata.

```
/scr:export --format kdp-package
```

Output: `.manuscript/output/kdp-package/` containing:

- `interior.pdf` -- Print-ready interior with your chosen trim size
- `cover-specs.md` -- Canonical print-cover handoff brief pointing at `.manuscript/build/paperback-cover.pdf`
- `kdp-metadata.md` -- Title, author, language, suggested categories and keywords

**Print-cover geometry:** Use the current platform template generator for exact wrap width, spine width, bleed, and safe zones. Scriveno's package tells you which canonical build asset to supply; it does not treat hard-coded paper-factor math as the final source of truth for print covers.

**Supported trim sizes:** 5" x 8", 5.25" x 8", 5.5" x 8.5", 6" x 9", and others. Set `trim_width` and `trim_height` in `.manuscript/config.json`.

### IngramSpark

Complete submission package with CMYK PDF/X-1a interior for offset printing.

```
/scr:export --format ingram-package
```

Output: `.manuscript/output/ingram-package/` containing:

- `manuscript-cmyk.pdf` -- Interior converted to CMYK color space via Ghostscript
- `cover-specs.md` -- Full-wrap cover handoff brief pointing at `.manuscript/build/paperback-cover.pdf`
- `ingram-metadata.md` -- Publishing metadata for IngramSpark

**IngramSpark-specific requirements:** PDF/X-1a compliance, CMYK color space, 300 DPI minimum, all fonts embedded, no transparency. Scriveno handles the CMYK conversion automatically for the interior -- review the output for color accuracy, especially blues and greens which can shift during RGB-to-CMYK conversion. Exact print-cover geometry still comes from the IngramSpark Cover Template Generator.

### Submission and Query Packages

**Query Package** -- Everything you need to query literary agents: query letter, synopsis, and sample chapters bundled into a single DOCX.

```
/scr:export --format query-package
```

Output: `.manuscript/output/query-package/` containing `query-letter.md`, `synopsis.md`, `sample-chapters.md` (first 3 chapters), and a combined `query-package.docx`. If the query letter or synopsis don't exist yet, Scriveno tells you which commands to run (`/scr:query-letter`, `/scr:synopsis`).

**Submission Package** -- Full manuscript submission for agents or publishers who request the complete work.

```
/scr:export --format submission-package
```

Output: `.manuscript/output/submission-package/` containing `manuscript.docx` (full manuscript in standard format), `synopsis.md`, `cover-letter.md`, `about-author.md`, and a `submission-checklist.md` with formatting reminders and common submission requirements.

## Publish Wizard

The publish wizard chains multiple export and build commands into a single workflow based on your publishing destination.

Publishing boundary:

- `/scr:publish`: destination wizard and sequencing.
- `/scr:export`: one-off format output.
- `/scr:build-ebook`, `/scr:build-print`, `/scr:build-smashwords`, and `/scr:build-poetry-submission`: final package builders for a specific channel or format.
- `/scr:front-matter` and `/scr:back-matter`: content creation before packaging.
- `/scr:prepublish-review`: final editorial gate.
- `/scr:provenance-check`: optional read-only audit of invisible markers, metadata, and provenance manifests.
- `/scr:provenance-clean`: optional dry-run cleanup plan that writes cleaned copies only after `--apply`.

```
/scr:publish
```

Without arguments, the wizard runs interactively. It checks your publishing readiness (complete draft, front/back matter, blurb, synopsis, cover art), offers to generate missing non-matter prerequisites, then asks where you're publishing and runs the right pipeline. Front matter and back matter remain dedicated writer-facing commands.

### Presets

Skip the interactive flow by specifying a preset:

```
/scr:publish --preset kdp-paperback
```

Available presets:

| Preset | What It Does |
|--------|-------------|
| `kdp-paperback` | Print-ready PDF + KDP package with cover specs |
| `kdp-ebook` | EPUB with KDP-compatible CSS and metadata |
| `query-submission` | Query letter + synopsis + sample chapters as DOCX |
| `ebook-wide` | EPUB for all retailers (Apple, Kobo, B&N, Google) |
| `ingram-paperback` | CMYK PDF/X-1a + IngramSpark package |
| `academic-submission` | LaTeX or DOCX for journal/conference submission |
| `thesis-defense` | Formatted PDF + DOCX for committee review |
| `screenplay-query` | Fountain + PDF + FDX for screenplay submission |

Run all available presets at once:

```
/scr:publish --all
```

## Autopilot Publishing

For hands-off publishing, autopilot-publish runs quality checks, generates missing non-matter prerequisites, executes the export pipeline, and produces a full report without asking questions. It does not draft front matter or back matter; run `/scr:autopilot --matter balanced`, `/scr:front-matter`, or `/scr:back-matter` before packaging when you want those included.

```
/scr:autopilot-publish --preset kdp-paperback
```

The autopilot pipeline:

1. **Quality gate** -- Runs voice check and continuity check. Results are advisory -- the pipeline proceeds regardless, but you get a report.
2. **Prerequisites** -- Auto-generates missing non-matter prerequisites such as blurb, synopsis, or query letter when needed by your preset. Front matter and back matter stay in their dedicated commands.
3. **Export** -- Runs the preset pipeline and reports progress.
4. **Report** -- Shows everything that happened: quality scores, generated prerequisites, exported files, and any errors with fix instructions.

Autopilot requires the `--preset` flag -- there's no interactive mode. Valid presets are the same as the publish wizard.

## Pre-Publish Checklist

Before exporting, run these commands to make sure your manuscript is ready:

**Prepublish review** -- Final editorial go/no-go before technical packaging:

```
/scr:prepublish-review
```

Use `--preset <preset>` when you already know the target destination, and `--strict` when you want major issues treated as stop conditions.

**Provenance hygiene** -- Optional artifact audit before upload or distribution:

```
/scr:provenance-check output
/scr:provenance-clean output
```

The first command writes a read-only evidence report. The second previews cleanup and requires `--apply` before writing cleaned copies. Missing provenance evidence does not block publishing, and removing metadata does not change creation history or any AI-content disclosure, copyright, licensing, or attribution duty.

**Platform compliance** -- Policy, copyright, and AI-disclosure gate for retail destinations:

```
/scr:compliance-check --platform kdp-ebook
```

Fetches the current official platform policies (KDP content and metadata guidelines, IngramSpark file requirements, and other retailers as targeted), inventories quoted material, cover and font licensing, and public-domain posture, and writes `.manuscript/reviews/PLATFORM-COMPLIANCE.md` with per-platform verdicts plus the exact upload-screen answers (AI-disclosure boxes, series fields, safe keywords). Policies change without notice, so the command verifies live pages instead of trusting remembered rules.

**Manuscript statistics** -- Check your word count, page estimate, and draft completion:

```
/scr:manuscript-stats
```

Use `--detail` for a per-chapter breakdown. Estimated page count uses the standard 250 words per page.

**Polish** -- Final quality pass over the manuscript:

```
/scr:polish
```

**Voice check** -- Verify voice consistency across the manuscript:

```
/scr:voice-check
```

## Template Customization

Scriveno ships with templates that control the look of your exported files. You can customize them to match your preferences or publisher requirements.

| Template | Location | Controls |
|----------|----------|----------|
| `scriveno-book.typst` | active shared data directory, `export-templates/` | Book interior PDF layout: trim size, margins, headers, page numbers |
| `scriveno-epub.css` | active shared data directory, `export-templates/` | EPUB ebook styling and KDP compatibility |
| `scriveno-academic.latex` | active shared data directory, `export-templates/` | Academic paper and thesis formatting |

Export commands resolve templates from `.scriveno/data/export-templates/` for project installs, `$HOME/.scriveno/data/export-templates/` for global installs, then the repository `data/export-templates/` during development. To customize a template, edit the active installed copy for the runtime scope you are using. The Typst template supports variable overrides for trim size and margins through the export command's flags.

## See Also

- [Getting Started](getting-started.md) -- Installation and first project
- [Command Reference](command-reference.md) -- Full list of export and publish commands
- [Provenance Hygiene](provenance-hygiene.md) -- Read-only audits, safe cleaned copies, optional tools, and residual risk
- [Translation Guide](translation.md) -- Translating your manuscript for international publication
