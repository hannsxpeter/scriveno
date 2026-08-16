## Project

**Scriveno**

Scriveno is a spec-driven writing, publishing, and translation pipeline that runs inside AI coding agents (Codex, Cursor, Gemini CLI). It covers the full lifecycle from blank page to publication-ready manuscript or technical document set -- including voice profiling, adaptive work types, autonomous drafting, illustration, translation, and multi-format export. Supports 50 work types with tradition-native vocabulary (novels use chapters, screenplays use acts, runbooks use procedures, Quran commentaries use surahs).

**Core Value:** **Drafted prose sounds like the writer, not like AI.** The Voice DNA system profiles the writer across 15+ dimensions and loads that profile into every drafter agent invocation. If voice fidelity breaks, trust breaks, and no other feature matters.

### Constraints

- **Architecture**: Must remain a pure skill/command system -- no compiled code, no runtime dependencies beyond Node.js for the installer
- **Voice fidelity**: Every feature must preserve the Voice DNA pipeline -- fresh context per atomic unit, STYLE-GUIDE.md loaded first
- **Backward compatibility**: Existing commands and templates must continue working as new features are added
- **Plan authority**: If a command file contradicts the product plan, fix the command -- plan is canonical (section 15 for command specs)
- **Progressive disclosure**: Onboarding asks 3 questions max; depth is optional and additive
- **Runtime credibility**: `>=20.0.0` is the installer compatibility floor. For new installs, prefer a currently supported LTS such as Node.js 24. `docs/runtime-support.md` is the canonical runtime matrix, and installer targets are not interchangeable proof of host-runtime parity.
## Technology Stack

## Architecture Constraint
- Export tools are **external CLI binaries** the agent invokes via shell, not npm dependencies
- The agent generates intermediate files (markdown, HTML, Typst) then calls converters
- Scriveno's `package.json` stays dependency-free; tools are prerequisites the user installs
- The installer (`bin/install.js`) should detect and guide installation of prerequisites
## Recommended Stack
### Document Conversion Engine
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Pandoc** | Current stable 3.x | Universal document converter | De facto standard for markdown-to-anything. Handles EPUB, DOCX, PDF, LaTeX, Typst, HTML. One tool covers most export needs and has a large ecosystem of filters and templates. | HIGH |
### PDF Generation
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Typst** | Current stable | PDF engine for Pandoc | Clean syntax, smaller install footprint than TeX Live, and native Pandoc support through `--pdf-engine=typst`. Use for general book interiors; reserve LaTeX for academic class requirements. | HIGH |
| **XeLaTeX** (fallback) | TeX Live 2025 | Academic/math-heavy PDF | Only needed if Typst cannot handle specialized mathematical notation or journal-specific LaTeX templates. Most creative writing does not need this. | MEDIUM |
### EPUB Generation
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Pandoc** (built-in) | 3.9.x | EPUB 3 generation | Pandoc's EPUB output is production-quality. Supports custom CSS, metadata, cover images, table of contents. Used by published authors and small presses. No additional tool needed. | HIGH |
### DOCX Generation
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Pandoc** (built-in) | 3.9.x | Manuscript DOCX and formatted DOCX | Supports reference documents (`.docx` templates) for both standard manuscript format (12pt Courier, double-spaced) and formatted/designed output. | HIGH |
### Screenplay Formats (Fountain + FDX)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Afterwriting CLI** | 1.8.x | Fountain to PDF | Node.js-based, npm-installable (`npm i -g afterwriting`). Generates industry-standard screenplay PDFs with page numbers, scene headers, proper formatting. Also provides screenplay statistics. | MEDIUM |
| **Screenplain** | 0.9.x | Fountain to FDX + HTML | Python-based (`pip install screenplain`). Only reliable open-source Fountain-to-FDX converter. FDX is Final Draft's XML format -- essential for screenplay submission. | MEDIUM |
### LaTeX Output
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Pandoc** (built-in) | 3.9.x | Markdown to LaTeX source | For academic writers who need `.tex` files to submit to journals or further edit in Overleaf. Pandoc generates clean LaTeX with customizable templates. | HIGH |
### Publishing Platform Packages
| Platform | Format Required | How Scriveno Produces It | Confidence |
|----------|----------------|------------------------|------------|
| **KDP (ebook)** | EPUB or DOCX | Pandoc EPUB with KDP-specific CSS (alt text on all images, embedded fonts) | HIGH |
| **KDP (print)** | PDF (no marks, embedded fonts, 300dpi images) | Pandoc + Typst with KDP trim size template (e.g., 6x9, 5.5x8.5), 0.25" extra height, 0.125" extra width for bleed | HIGH |
| **IngramSpark** | PDF/X-1a (CMYK, bleeds, full-wrap cover) | Pandoc + Typst for interior; cover requires separate full-wrap PDF. CMYK conversion via ImageMagick or Ghostscript. | MEDIUM |
| **Submission/Query** | DOCX (standard manuscript format) | Pandoc with manuscript reference doc | HIGH |
## Illustration Generation (AI Image APIs)
**Shipped today:** Scriveno does not call an image API. The illustration commands (`commands/scr/cover-art.md`, `commands/scr/illustrate-scene.md`) generate copy-paste prompts that the writer pastes into an external image tool. When no image-generation tool is available, the same commands can build the art directly as original SVG or HTML/CSS and convert it to JPG/PNG/PDF with local CLI tools (`rsvg-convert`, Inkscape, ImageMagick, headless Chrome); agent-built art counts as AI-generated imagery for platform disclosure (`/scr:compliance-check`). The engines below are recommended targets for a future automated path, not current behavior.

| Technology | Purpose | Why | Confidence |
|------------|---------|-----|------------|
| **OpenAI GPT Image 1.5 API** | Primary illustration engine | Current OpenAI image-generation docs describe it as the latest GPT Image model. It supports context-aware generation and editing through the Image API and Responses API. Check official pricing before release work because image costs depend on model, quality, size, and token use. | HIGH |
| **GPT Image 1 Mini** | Budget/draft illustrations | Current OpenAI docs list it as a cost-efficient GPT Image option. Use for concept art, character reference sheets, and storyboard thumbnails when final-quality image cost is not needed. | HIGH |
| **Stable Diffusion (via API)** | Style-consistent illustration sets | Open-source. LoRA fine-tuning allows training on a specific art style for consistent illustration across a book. Best for children's books / comics needing visual consistency. Requires more setup. | MEDIUM |
### Illustration Pipeline Architecture
## Translation Pipeline
**Shipped today:** Scriveno does not call a translation API. Translation runs through the in-context translator agent (`agents/translator.md`), which applies the voice profile and glossary per unit. The engines below are recommended integration targets for a future automated path, not current behavior.

| Technology | Purpose | Why | Confidence |
|------------|---------|-----|------------|
| **DeepL API Pro** | Primary translation engine for European languages | Higher quality than Google for EN/FR/DE/ES/IT/PT/NL/PL/JA/ZH/KO. GDPR-compliant, content not stored or used for training. $5.49/mo + $25/M chars. | HIGH |
| **Google Cloud Translation (v3)** | Broad language coverage, RTL/CJK | 130+ languages vs DeepL's 33. Required for Arabic, Hebrew, Hindi, Swahili, and other languages DeepL doesn't cover. NMT at $20/M chars, LLM mode at $10+$10/M chars. | HIGH |
| **AI Agent (Codex/GPT)** | Cultural adaptation, sacred text translation | Machine translation APIs don't handle literary nuance, sacred registers, or cultural adaptation. The AI agent itself is the best tool for these -- it can apply voice profiles, maintain glossaries, and do formal/dynamic equivalence translation. | HIGH |
### Translation Strategy
### Translation Memory
- Sacred texts (canonical terms must be consistent)
- Series (character names, place names, invented terms)
- Technical writing (terminology consistency)
## npm Publishing Configuration
| Concern | Recommendation | Why | Confidence |
|---------|---------------|-----|------------|
| **Authentication** | Granular Access Tokens (not classic) | Avoid classic tokens for project publishing. Use scoped, short-lived credentials and keep token access narrower than the repo. | HIGH |
| **Publishing method** | `npm publish` with 2FA from local machine | CI runs release checks, but publishing is still manual. Trusted publishing belongs in a future release workflow, not the current local-publish path. | HIGH |
| **Prepublish check** | `npm pack --dry-run` before every publish | Verify no secrets, no unnecessary files leaked. The `"files"` field in package.json already scopes what's included. | HIGH |
| **Versioning** | `npm version patch/minor/major` with git tags | Auto-creates git tag, bumps version. Pair with GitHub releases for changelog. | HIGH |
| **npx support** | Already configured (`"bin": {"scriveno": "bin/install.js"}`) | `npx scriveno@latest` downloads and runs the installer from the active npm package. Legacy names are historical only. | HIGH |
| **Lockfile** | Commit `package-lock.json` but since there are zero dependencies, it's effectively empty | Standard practice. Will matter when/if dev dependencies are added for testing. | HIGH |
| **Node version** | `"engines": {"node": ">=20.0.0"}` | Scriveno's installer compatibility floor is `>=20.0.0`; new installs should use a currently supported LTS such as Node.js 24. This keeps package metadata, installer guidance, and runtime docs aligned on one minimum without presenting Node 20 as the fresh-install target. | HIGH |
See `docs/runtime-support.md` for the canonical runtime matrix, support levels, and host-runtime parity status.
### npm Publish Readiness Checklist
## Supporting Tools (Prerequisites for Users)
| Tool | Purpose | Install | Required For |
|------|---------|---------|-------------|
| **Pandoc** | Document conversion | `brew install pandoc` | All export commands |
| **Typst** | PDF generation | `brew install typst` | PDF export |
| **Ghostscript** | CMYK conversion, PDF/X-1a | `brew install ghostscript` | IngramSpark package only |
| **ImageMagick** | Image processing (resize, format conversion) | `brew install imagemagick` | Cover art processing, illustration pipeline |
| **Afterwriting** | Fountain to PDF | `npm i -g afterwriting` | Screenplay PDF export only |
| **Screenplain** | Fountain to FDX | `pip install screenplain` | FDX export only |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| PDF engine | Typst | XeLaTeX (TeX Live) | 4-6 GB install, 27x slower compilation, worse error messages. Reserve for academic edge cases. |
| PDF engine | Typst | WeasyPrint | HTML-to-PDF, not print-quality typesetting. No proper widow/orphan control, gutter margins. |
| PDF engine | Typst | Prince XML | Commercial ($3,800 license). Overkill for CLI tool targeting indie authors. |
| EPUB | Pandoc | epub-gen-memory (npm) | Would add runtime dependency. Pandoc's EPUB is more mature, handles accessibility, KDP validation. |
| EPUB | Pandoc | Calibre CLI | Calibre is massive (200+ MB). Pandoc is lighter and sufficient. |
| Document conversion | Pandoc | Asciidoctor | Scriveno manuscripts are markdown. Asciidoctor is AsciiDoc-native. Adding a format is unnecessary complexity. |
| Illustration | OpenAI GPT Image 1.5 | Midjourney | No API. Cannot automate from CLI. |
| Illustration | OpenAI GPT Image 1.5 | DALL-E 3 | DALL-E remains a legacy-supported path in the Image API, but GPT Image is the current new-work default in OpenAI's image-generation docs. |
| Illustration | OpenAI GPT Image 1.5 | Replicate (Flux/SD) | Additional API signup. OpenAI key is already likely available to users of AI coding agents. |
| Translation | DeepL + Google + AI agent | Amazon Translate | Lower quality for literary content. No advantage over Google for broad coverage. |
| Translation | DeepL + Google + AI agent | LibreTranslate | Self-hosted, lower quality, limited languages. Not practical for a CLI tool. |
| Screenplay | Afterwriting + Screenplain | Highland (Mac app) | Not a CLI tool. Cannot automate. |
| Screenplay | Afterwriting + Screenplain | Pandoc Lua filter | Could work but would need significant custom development. Afterwriting/Screenplain already exist. |
## What NOT to Use
| Technology | Why Not |
|------------|---------|
| **npm runtime dependencies** | Scriveno is a pure skill system. Adding npm deps means adding a build step, version conflicts, and breaking the zero-dependency architecture. |
| **Calibre** | 200+ MB desktop app. Pandoc does everything Scriveno needs at 1/10th the size. |
| **DALL-E-first workflows** | Prefer the current GPT Image docs for new Scriveno illustration workflows. Treat DALL-E as a legacy-supported fallback, not the default design target. |
| **Midjourney** | No API. Cannot be automated. |
| **wkhtmltopdf** | Deprecated, security issues, poor print quality. |
| **Classic npm tokens** | Do not use them for project publishing. Use granular access tokens or a future trusted-publishing release workflow. |
| **Node.js < 20** | Node versions below 20 are unsupported by the installer. Node 20 is a compatibility floor; use a current LTS for new installs. |
| **WeasyPrint for books** | Fine for reports, not for book typesetting. No proper ligatures, optical margins, or page-level layout control. |
| **Custom EPUB generator** | Reinventing what Pandoc already does well. Waste of effort. |
See `docs/shipped-assets.md` for the canonical inventory of bundled export templates and launch-critical files.

## Currently Shipped Export Templates
Load-bearing baseline. Files live in `data/export-templates/`. See `docs/shipped-assets.md` for the full inventory of bundled templates.

| Template | Format | Purpose |
|----------|--------|---------|
| `scriveno-book.typst` | Typst template | Book interior PDF (trim sizes, margins, headers, page numbers) |
| `scriveno-epub.css` | CSS | EPUB styling (clean, readable, KDP-compatible) |
| `scriveno-academic.latex` | LaTeX template | Academic paper/thesis formatting |

This table is the load-bearing baseline. The full shipped set (verify with `ls data/export-templates/`; 17 files today, including stageplay, chapbook, and picturebook Typst templates, five academic LaTeX wrappers, fixed-layout EPUB assets, and DOCX reference docs) is inventoried in `docs/shipped-assets.md`.

## Planned Export Templates
| Template | Format | Purpose |
|----------|--------|---------|
| `scriveno-manuscript.docx` | DOCX reference doc | Standard manuscript format (12pt Courier, double-spaced, 1" margins) |
| `scriveno-formatted.docx` | DOCX reference doc | Designed/formatted DOCX for review copies |
| `scriveno-kdp-cover.typst` | Typst template | KDP cover with calculated spine width |
| `scriveno-ingram-cover.typst` | Typst template | IngramSpark full-wrap cover |
## Sources
- [Pandoc Official Site](https://pandoc.org/) -- Document conversion reference
- [Typst Documentation](https://typst.app/docs/) -- PDF engine reference
- [Pandoc Typst PDF Engine](https://pandoc.org/MANUAL.html#creating-a-pdf) -- Pandoc PDF engine guidance
- [Afterwriting GitHub](https://github.com/ifrost/afterwriting-labs) -- Fountain CLI tool
- [Screenplain GitHub](https://github.com/vilcans/screenplain) -- Fountain to FDX converter
- [OpenAI Image Generation Guide](https://platform.openai.com/docs/guides/image-generation) -- GPT Image and DALL-E support
- [OpenAI API Pricing](https://platform.openai.com/docs/pricing) -- GPT Image pricing
- Translation API pricing and quality should be refreshed against provider docs before implementation.
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) -- Token deprecation timeline
- [Snyk npm Best Practices](https://snyk.io/blog/best-practices-create-modern-npm-package/) -- Security guidance
- [KDP Formatting Requirements](https://kdp.amazon.com/en_US/help/topic/G201857950) -- Print submission specs
- [IngramSpark File Requirements](https://www.ingramspark.com/blog/file-requirements-for-print-books) -- PDF/X-1a specs
- Image-provider capability checks should be refreshed against provider docs before implementation.
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.

<!-- pillars:begin -->
# Godpowers Project Context

This is a Godpowers project. Godpowers uses the Pillars standard as its native project context layer.
Coding agents read project context from `./agents/*.md` before changing code, while `.godpowers/` remains the Godpowers workflow state and artifact layer.

This project follows Pillars 1.1.0. Coding agents read project pillar files before acting.

## At the start of any task

1. Resolve scopes from repository root to the task target. A scope contains both `AGENTS.md` and `agents/`. Apply outer scopes first and let the nearest scope win conflicts.
2. Inventory pillar frontmatter recursively, local exclusions, and optional `agents/catalog.yaml` absent concerns in each scope.
3. Load every pillar whose frontmatter has `always_load: true`. Match remaining `triggers` with the Pillars portable ASCII token matcher to select primaries and absent concerns.
4. Add each primary pillar direct `must_read_with` dependencies, depth 1 only. Path-qualified sub-pillars use identities such as `auth/agent-registration`.
5. Add a selected pillar `see_also` target only when the task matches the target identity, triggers, or covers. Do not follow soft references recursively.
6. Read every selected body. Follow Rules, apply Workflows, heed Watchouts, and ask before deciding open Gaps.

## Handling missing pillars

| State | Action |
|---|---|
| `status: present` | Load and comply. |
| `status: stub` | Treat the concern as acknowledged but undecided. Ask before making domain decisions. |
| Name in `excluded:` | Treat as intentionally not applicable in that scope. |
| Trigger matches local `agents/catalog.yaml` entry | Infer from code, state the assumption, and recommend authoring the pillar. |
| No local file, exclusion, or catalog entry | Make no Pillars-specific claim about that concern. |

If `context.md` or `repo.md` is missing and not explicitly excluded, pause and ask the human to create a stub or record an exclusion.

## Excluded pillars

```yaml
excluded: []
```
<!-- pillars:end -->
