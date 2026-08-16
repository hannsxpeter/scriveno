#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const crypto = require('crypto');
const architecturalProfiles = require('../lib/architectural-profiles.js');
const autoInvokeEngine = require('../lib/auto-invoke-engine.js');
const commandContracts = require('../lib/command-contracts.js');
const {
  RUNTIMES,
  SURFACE_PROFILES,
  DEFAULT_SURFACE_PROFILE,
} = require('../lib/installer-runtime-registry.js');

const PKG_ROOT = path.join(__dirname, '..');
const PKG = require('../package.json');
const VERSION = PKG.version;
const DOCS_URL = PKG.homepage || PKG.repository?.url || 'https://github.com/hannsxpeter/scriveno';
const MIN_NODE_MAJOR = 20;

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

function c(color, text) { return `${COLORS[color]}${text}${COLORS.reset}`; }
function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

// Escape a string for safe embedding inside a YAML double-quoted scalar.
// Handles both `\` and `"` -- bare backslashes are invalid in YAML double-quoted
// scalars, so they must be escaped before the `"`-escaping pass.
function yamlDoubleQuoted(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildFilesystemMcpCommand(allowedDirs) {
  return `npx -y @modelcontextprotocol/server-filesystem ${allowedDirs.map(shellQuote).join(' ')}`;
}

function generatePerplexitySetupGuide({ isGlobal, guideDir, dataDir, currentProjectDir }) {
  const connectorCommand = isGlobal
    ? buildFilesystemMcpCommand(['/absolute/path/to/project', dataDir])
    : buildFilesystemMcpCommand([currentProjectDir, dataDir]);
  const currentProjectCommand = buildFilesystemMcpCommand([currentProjectDir, dataDir]);

  return `# Scriveno for Perplexity Desktop

This setup target prepares Scriveno for **Perplexity Desktop on macOS** using Perplexity's documented **local MCP connector** flow.

## What this target supports

- Guided setup assets for Perplexity Desktop
- Local filesystem access to a Scriveno project and Scriveno's shared data
- Honest runtime framing: this is **not** slash-command parity with Claude Code, Codex, Cursor, or Gemini CLI

## Prerequisites

1. Install **Perplexity Desktop** from the Mac App Store
2. In Perplexity Desktop, open **Settings -> Connectors**
3. Install the **PerplexityXPC** helper when prompted
4. Ensure Node.js >=20.0.0 is available so \`npx\` can run the filesystem MCP server

## Add the connector

In Perplexity Desktop:

1. Open **Settings -> Connectors**
2. Click **Add Connector**
3. In the **Simple** tab, choose any server name such as \`Scriveno Project Files\`
4. Paste this command:

\`\`\`bash
${connectorCommand}
\`\`\`

5. Save and wait for the connector to show **Running**
6. Toggle the connector on from **Sources** when you want Perplexity to access your Scriveno files

## Current project command

This installer was run from:

\`\`\`
${currentProjectDir}
\`\`\`

If you want a command that is ready for this specific project right now, use:

\`\`\`bash
${currentProjectCommand}
\`\`\`

## Notes

- ${isGlobal ? 'Global install stores shared setup assets under your home directory, but the MCP connector itself still needs a project path.' : 'Project install points the connector at this project and its local .scriveno directory.'}
- Keep the allowed directories narrow. Prefer the project root and the matching Scriveno data directory only.
- Voice-critical drafting still depends on explicit \`STYLE-GUIDE.md\` loading per unit. Perplexity memory or spaces are not a substitute for Scriveno's Voice DNA pipeline.

## Installed assets

- Guide directory: \`${guideDir}\`
- Scriveno data directory: \`${dataDir}\`
`;
}

const BANNER = `
${c('bold', 'Scriveno')} ${c('gray', 'v' + VERSION)}
${c('dim', 'Spec-driven creative writing, publishing, and translation for AI coding agents.')}
`;

const RUNTIME_SUPPORT_NOTE = c(
  'dim',
  'Installer requires Node.js >=20.0.0. Use a current LTS for new installs.'
);

function normalizeSurfaceProfile(profile) {
  const value = String(profile || DEFAULT_SURFACE_PROFILE).trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(SURFACE_PROFILES, value)) {
    throw new Error(`Unknown profile "${profile}". Expected one of: ${Object.keys(SURFACE_PROFILES).join(', ')}`);
  }
  return value;
}

function resolveProfileCommandKeys(profile, constraints = loadConstraintsForInstall()) {
  const resolvedProfile = normalizeSurfaceProfile(profile);
  const commands = constraints.commands || {};
  const out = new Set();
  const visiting = new Set();

  function addProfile(name) {
    const key = normalizeSurfaceProfile(name);
    if (visiting.has(key)) {
      throw new Error(`Profile cycle detected at "${key}"`);
    }
    visiting.add(key);
    const spec = SURFACE_PROFILES[key];
    if (spec.all) {
      for (const commandKey of Object.keys(commands)) out.add(commandKey);
      visiting.delete(key);
      return;
    }
    for (const parent of spec.includeProfiles || []) addProfile(parent);
    for (const commandKey of spec.commands || []) {
      if (Object.prototype.hasOwnProperty.call(commands, commandKey)) out.add(commandKey);
    }
    const categorySet = new Set(spec.categories || []);
    if (categorySet.size > 0) {
      for (const [commandKey, command] of Object.entries(commands)) {
        if (categorySet.has(command.category)) out.add(commandKey);
      }
    }
    visiting.delete(key);
  }

  addProfile(resolvedProfile);
  return out;
}

function loadConstraintsForInstall(constraintsPath = path.join(PKG_ROOT, 'data', 'CONSTRAINTS.json')) {
  return JSON.parse(fs.readFileSync(constraintsPath, 'utf8'));
}

function commandEntryInProfile(entry, commandKeys) {
  return commandKeys.has(commandRefToConstraintKey(entry.commandRef));
}

function collectCommandEntriesForProfile(commandsRoot, profile = DEFAULT_SURFACE_PROFILE, constraintsPath = path.join(PKG_ROOT, 'data', 'CONSTRAINTS.json')) {
  const entries = collectCommandEntries(commandsRoot);
  const commandKeys = resolveProfileCommandKeys(profile, loadConstraintsForInstall(constraintsPath));
  return entries.filter((entry) => commandEntryInProfile(entry, commandKeys));
}

function collectInstallCommandEntries(profile = DEFAULT_SURFACE_PROFILE) {
  return collectCommandEntriesForProfile(
    path.join(PKG_ROOT, 'commands', 'scr'),
    profile,
    path.join(PKG_ROOT, 'data', 'CONSTRAINTS.json')
  );
}

function writeProfileCommandFiles(commandsRoot, commandsDir, commandEntries, transform = null) {
  let count = 0;
  for (const entry of commandEntries) {
    const sourcePath = path.join(commandsRoot, entry.relativePath);
    const sourceContent = fs.readFileSync(sourcePath, 'utf8');
    const targetPath = path.join(commandsDir, entry.relativePath);
    const sourceWithContract = commandContracts.ensureNextCommandsContract(sourceContent);
    const installedContent = transform ? transform(entry, sourceWithContract) : sourceWithContract;
    atomicWriteFileSync(targetPath, installedContent);
    count++;
  }
  return count;
}

function writeSurfaceProfileMarker(targetDir, profile) {
  if (!targetDir) return;
  fs.mkdirSync(targetDir, { recursive: true });
  atomicWriteFileSync(path.join(targetDir, '.scriveno-profile'), `${normalizeSurfaceProfile(profile)}\n`);
}

function surfaceProfileSummary(profile = DEFAULT_SURFACE_PROFILE, constraintsPath = path.join(PKG_ROOT, 'data', 'CONSTRAINTS.json')) {
  const resolvedProfile = normalizeSurfaceProfile(profile);
  const constraints = loadConstraintsForInstall(constraintsPath);
  const commandKeys = resolveProfileCommandKeys(resolvedProfile, constraints);
  return {
    profile: resolvedProfile,
    label: SURFACE_PROFILES[resolvedProfile].label,
    description: SURFACE_PROFILES[resolvedProfile].description,
    commandCount: commandKeys.size,
    commands: [...commandKeys].sort(),
  };
}

function listSurfaceProfiles(constraintsPath = path.join(PKG_ROOT, 'data', 'CONSTRAINTS.json')) {
  return Object.keys(SURFACE_PROFILES).map((profile) => surfaceProfileSummary(profile, constraintsPath));
}

function generateSkillManifest(constraintsPath, profile = DEFAULT_SURFACE_PROFILE) {
  const commandsRoot = path.join(PKG_ROOT, 'commands', 'scr');
  const profileKeys = resolveProfileCommandKeys(profile, loadConstraintsForInstall(constraintsPath));
  const entries = collectCanonicalCommandInventory(commandsRoot, constraintsPath)
    .filter((entry) => commandEntryInProfile(entry, profileKeys))
    .map((entry) => ({
    name: entry.commandRef,
    category: entry.category,
    description: entry.description,
  }));

  // Sort by category, then alphabetically by name within category
  entries.sort((a, b) => {
    if (a.category < b.category) return -1;
    if (a.category > b.category) return 1;
    return a.name.localeCompare(b.name);
  });

  // Build markdown table
  const tableRows = entries.map(e => `| ${e.name} | ${e.category} | ${e.description} |`);

  return `# Scriveno -- AI Creative Writing Skills

Version: ${VERSION}
Profile: ${normalizeSurfaceProfile(profile)}

Scriveno is a spec-driven creative writing, publishing, and translation pipeline.

## Runtime and Model Adaptation

- This \`SKILL.md\` is the generic host surface for Manus, Kimi-compatible hosts, and any runtime without a dedicated adapter.
- Scriveno does not choose the underlying model. The host owns model selection and native worker support.
- Use the installed files as source of truth: \`commands/scr/\`, \`agents/\`, shared \`.scriveno/templates/RESEARCH.md\`, shared \`.scriveno/docs/model-adaptation.md\`, and shared \`.scriveno/docs/subagent-spawning-protocol.md\`.
- If a command requests workers and native spawning is unavailable, run the named prompt from \`agents/\` in an isolated fresh context and report \`prompt-run fallback used\`.
- Latest shared adaptations include neutral \`RESEARCH.md\` notes, \`/scr:research\` researcher fan-out, \`/scr:scan --deep\` read-only auditors, planning preflight workers, editor diagnostic workers, and autopilot lookahead workers.
- For smaller or weaker models, keep \`STYLE-GUIDE.md\` sovereign and prefer \`draft.rigor: strict\` plus \`draft.context_profile: minimal\` when drafting.

## Available Commands

| Command | Category | Description |
|---------|----------|-------------|
${tableRows.join('\n')}

## Usage

Each command above has a detailed instruction file in the \`commands/scr/\` subdirectory.
To use a command, read the corresponding \`.md\` file and follow its instructions.

## Quick Start

1. Run \`/scr:help\` to see commands grouped by stage
2. Run \`/scr:new-work\` to start a new project
3. Run \`/scr:demo\` to explore a sample project
`;
}

function stripWrappingQuotes(value) {
  if (!value) return '';
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function extractFrontmatterBlock(content) {
  if (typeof content !== 'string' || content.length === 0) return null;
  // Strip a leading UTF-8 BOM if present so the first-line check is robust.
  const stripped = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
  const lines = stripped.split(/\r?\n/);
  if (lines.length === 0 || lines[0] !== '---') return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---' || lines[i] === '...') {
      return lines.slice(1, i);
    }
  }
  // No closing fence -- treat as malformed / no frontmatter.
  return null;
}

function stripInlineComment(rawValue) {
  const trimmedLeading = rawValue.replace(/^\s+/, '');
  if (trimmedLeading.startsWith('"') || trimmedLeading.startsWith('\'')) {
    // Preserve `#` inside quoted values; do not attempt to parse quote escaping beyond
    // the simple wrapping-quote behavior already handled by stripWrappingQuotes.
    return rawValue;
  }
  // YAML inline comments require whitespace before `#`.
  // Use [ \t] rather than \s so newline whitespace does not trigger truncation
  // if a multi-line string is ever fed in (defensive for future refactors).
  const idx = rawValue.search(/[ \t]#/);
  if (idx === -1) return rawValue;
  return rawValue.slice(0, idx);
}

function readFrontmatterValues(content) {
  const lines = extractFrontmatterBlock(content);
  const result = {};
  if (!lines) return result;

  for (const line of lines) {
    if (line.length === 0) continue;
    const leading = line.replace(/^\s+/, '');
    if (leading.length === 0) continue;
    if (leading.startsWith('#')) continue; // YAML comment line

    const idx = line.indexOf(':');
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      // L-02: warn on duplicate keys; we retain first-occurrence-wins to avoid
      // changing downstream behavior, but surface the edit bug.
      try {
        console.warn(
          `[scriveno] frontmatter duplicate key "${key}" -- first occurrence retained; later value ignored`
        );
      } catch { /* best effort */ }
      continue;
    }

    let value = line.slice(idx + 1);
    value = stripInlineComment(value);
    // M-03: detect YAML block-scalar indicators (| or >). The parser does not
    // support multi-line continuation; warn and fall back to an empty value so
    // Codex skill metadata does not ship a literal `|` / `>`.
    const leadingValue = value.replace(/^\s+/, '');
    if (leadingValue.startsWith('|') || leadingValue.startsWith('>')) {
      try {
        console.warn(
          `[scriveno] frontmatter key "${key}" uses a YAML block scalar (${leadingValue[0]}); falling back to empty value`
        );
      } catch { /* best effort */ }
      result[key] = '';
      continue;
    }
    value = stripWrappingQuotes(value);
    result[key] = value;
  }

  return result;
}

function readFrontmatterValue(content, key) {
  const values = readFrontmatterValues(content);
  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : '';
}

function commandRefToCodexSkillName(commandRef) {
  if (commandRef === '/scr:sacred-verse-numbering') {
    return 'scr-tradition-verse-numbering';
  }
  return commandRef
    .replace(/^\/scr:/, 'scr-')
    .replace(/:/g, '-');
}

function commandRefToConstraintKey(commandRef) {
  return commandRef.replace(/^\/scr:/, '');
}

function commandRefToClaudeInvocation(commandRef) {
  return `/${commandRefToCodexSkillName(commandRef)}`;
}

function commandRefToCodexInvocation(commandRef) {
  return `$${commandRefToCodexSkillName(commandRef)}`;
}

function commandEntryToFlatCommandFileName(entry) {
  return `${commandRefToCodexSkillName(entry.commandRef)}.md`;
}

function collectCommandEntries(commandsRoot) {
  const entries = [];

  function walk(dir, segments = []) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), segments.concat(entry.name));
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;

      const relSegments = segments.concat(entry.name.replace(/\.md$/, ''));
      const relPath = path.join(...segments, entry.name);
      const filePath = path.join(dir, entry.name);
      const content = fs.readFileSync(filePath, 'utf8');
      const commandTail = relSegments.join(':');
      const commandRef = `/scr:${commandTail}`;
      const description = readFrontmatterValue(content, 'description') || commandTail.replace(/[:\-]/g, ' ');
      const argumentHint = readFrontmatterValue(content, 'argument-hint');

      entries.push({
        commandRef,
        skillName: commandRefToCodexSkillName(commandRef),
        description,
        argumentHint,
        relativePath: relPath,
      });
    }
  }

  walk(commandsRoot);
  entries.sort((a, b) => a.commandRef.localeCompare(b.commandRef));
  assertNoSkillNameCollisions(entries);
  return entries;
}

function stripMarkdownFrontmatter(content) {
  if (typeof content !== 'string' || content.length === 0) return '';
  const stripped = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
  const lines = stripped.split(/\r?\n/);
  if (lines[0] !== '---') return stripped;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---' || lines[i] === '...') {
      return lines.slice(i + 1).join('\n').replace(/^\n/, '');
    }
  }
  return stripped;
}

function collectAgentEntries(agentsRoot = path.join(PKG_ROOT, 'agents')) {
  if (!fs.existsSync(agentsRoot)) return [];
  const entries = [];
  for (const entry of fs.readdirSync(agentsRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const relativePath = entry.name;
    const filePath = path.join(agentsRoot, relativePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const stem = entry.name.replace(/\.md$/, '');
    const frontmatter = readFrontmatterValues(content);
    if (!frontmatter.name || !frontmatter.description) continue;
    const name = frontmatter.name;
    const description = frontmatter.description;
    entries.push({
      name,
      description,
      relativePath,
      metadataFileName: `${name}.toml`,
      content,
      body: stripMarkdownFrontmatter(content),
    });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

function tomlString(value) {
  return JSON.stringify(String(value));
}

function generateCodexAgentMetadata(entry) {
  return [
    `name = ${tomlString(entry.name)}`,
    `description = ${tomlString(entry.description)}`,
    'sandbox_mode = "workspace-write"',
    `developer_instructions = ${tomlString(entry.body)}`,
    '',
  ].join('\n');
}

// Both Claude (flat scr-foo.md filename) and Codex (per-command skill dir
// scr-foo/SKILL.md) install commands keyed by the same skill-name function:
// /scr:foo and /scr:foo:bar both flatten under commandRefToCodexSkillName by
// stripping `/scr:` and replacing remaining `:` with `-`. So
// /scr:sacred-verse-numbering and /scr:sacred:verse-numbering both produce
// scr-sacred-verse-numbering, and at install time the second one written
// silently overwrites the first.
//
// This check is the early gate. Run it once at collection time so every
// install path (Claude flat, Codex skill, generic SKILL.md) sees the same
// guarantee: no two source files can claim the same flat skill name.
function assertNoSkillNameCollisions(entries) {
  const seen = new Map();
  const collisions = [];
  for (const entry of entries) {
    const existing = seen.get(entry.skillName);
    if (existing) {
      collisions.push({ skillName: entry.skillName, sources: [existing.relativePath, entry.relativePath] });
    } else {
      seen.set(entry.skillName, entry);
    }
  }
  if (collisions.length === 0) return;

  const lines = collisions.map(c =>
    `  ${c.skillName}\n    <- ${c.sources[0]}\n    <- ${c.sources[1]}`
  );
  throw new Error(
    `Scriveno installer aborted: two or more source command files flatten to the same skill name.\n` +
    `Both Claude (flat scr-foo.md filenames) and Codex (per-command skill directories) would silently\n` +
    `overwrite one of each pair. Rename one source file in each pair so the flat names differ.\n\n` +
    lines.join('\n\n')
  );
}

function collectCanonicalCommandInventory(commandsRoot, constraintsPath = path.join(PKG_ROOT, 'data', 'CONSTRAINTS.json')) {
  const constraints = JSON.parse(fs.readFileSync(constraintsPath, 'utf8'));
  const commandMetadata = constraints.commands || {};

  return collectCommandEntries(commandsRoot).map((entry) => {
    const key = commandRefToConstraintKey(entry.commandRef);
    const metadata = commandMetadata[key] || {};
    return {
      ...entry,
      category: metadata.category || 'uncategorized',
      description: entry.description || metadata.description || key.replace(/-/g, ' '),
    };
  });
}

function generateCodexSkill(entry, commandPath) {
  const invocation = commandRefToCodexInvocation(entry.commandRef);
  const shortDescription = entry.description.length > 120
    ? `${entry.description.slice(0, 117)}...`
    : entry.description;
  const argumentsLine = entry.argumentHint
    ? `- Treat any text after \`${invocation}\` as the arguments for the underlying Scriveno command ${entry.argumentHint}.`
    : `- Treat any text after \`${invocation}\` as the arguments for the underlying Scriveno command.`;

  return `---
name: "${entry.skillName}"
description: "${yamlDoubleQuoted(entry.description)}"
metadata:
  short-description: "${yamlDoubleQuoted(shortDescription)}"
---

<codex_skill_adapter>
## Invocation
- This skill is invoked by mentioning \`${invocation}\`.
${argumentsLine}
- When the installed Scriveno command file mentions \`/scr:...\`, rewrite that command surface for Codex users as \`$scr-...\`.
  - Example: \`/scr:help\` becomes \`$scr-help\`
  - Example: \`/scr:new-work\` becomes \`$scr-new-work\`
  - Example: \`/scr:sacred:concordance\` becomes \`$scr-sacred-concordance\`

## Model and Runtime Rules
- Codex owns the underlying model and any native agent APIs. Scriveno supplies source prompts, context limits, fallback behavior, and merge rules.
- Use shared \`.scriveno/docs/model-adaptation.md\` and \`.scriveno/docs/subagent-spawning-protocol.md\` for worker fan-out. If native workers are unavailable, use the matching installed prompt from \`.codex/agents\` in a fresh context and report \`prompt-run fallback used\`.
- Treat \`templates/RESEARCH.md\` and project \`RESEARCH.md\` files as advisory research context, never canon by themselves.
- Preserve the latest shared adaptations: \`/scr:research\` researcher fan-out, \`/scr:scan --deep\` read-only auditors, planning preflight workers, editor diagnostic workers, and autopilot lookahead workers.
</codex_skill_adapter>

<objective>
Execute Scriveno's \`${entry.commandRef}\` command inside Codex by reading the installed Scriveno command file below as the source of truth.
</objective>

<context>
Installed command file: ${commandPath}
</context>

<process>
1. Read \`${commandPath}\`.
2. Execute that command file exactly as written.
3. Treat text after \`${invocation}\` as the command arguments.
4. When suggesting other Scriveno commands to Codex users, translate \`/scr:...\` references to the \`$scr-...\` surface.
</process>
`;
}

function listRelativeFiles(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(prefix, entry.name);
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRelativeFiles(abs, rel));
    } else {
      files.push(rel);
    }
  }
  return files;
}

function cleanMirroredFiles(srcDir, destDir) {
  if (!fs.existsSync(srcDir) || !fs.existsSync(destDir)) return 0;
  let removed = 0;
  for (const relPath of listRelativeFiles(srcDir)) {
    const destPath = path.join(destDir, relPath);
    if (fs.existsSync(destPath)) {
      fs.rmSync(destPath, { force: true });
      removed++;
    }
  }
  return removed;
}

function removePathIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) return false;
  fs.rmSync(targetPath, { recursive: true, force: true });
  return true;
}

function atomicWriteFileSync(targetPath, content) {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${targetPath}.tmp.${crypto.randomUUID()}`;
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
  let fd;
  try {
    fd = fs.openSync(tmpPath, 'w');
    fs.writeSync(fd, buffer, 0, buffer.length, 0);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tmpPath, targetPath);
    // H-01: fsync the parent directory so the rename is durable on crash.
    // Best effort -- Windows rejects dir fsync with EISDIR/EPERM; some network
    // filesystems also reject it. Swallow any error to preserve existing
    // cross-platform behavior.
    try {
      const dfd = fs.openSync(dir, 'r');
      try { fs.fsyncSync(dfd); } finally { fs.closeSync(dfd); }
    } catch { /* best effort -- Windows rejects dir fsync */ }
  } catch (err) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* best effort */ }
    }
    try { fs.unlinkSync(tmpPath); } catch { /* best effort */ }
    throw err;
  }
}

// L-01: match the exact canonical UUID shape emitted by crypto.randomUUID(),
// so a user file incidentally named `foo.tmp.<36 dashes>` is NOT deleted.
const ORPHAN_TMP_PATTERN = /\.tmp\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// M-02: orphan tmp files can sit deep in skill directories (e.g.
// `~/.codex/skills/scr-help/SKILL.md.tmp.<uuid>`). Sweep recursively with a
// depth cap so an adversarial / pathological tree cannot hang the installer.
const ORPHAN_SWEEP_MAX_DEPTH = 4;

function cleanOrphanedTempFiles(dir, _depth = 0) {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (_depth < ORPHAN_SWEEP_MAX_DEPTH) {
        removed += cleanOrphanedTempFiles(full, _depth + 1);
      }
      continue;
    }
    if (!entry.isFile()) continue;
    if (!ORPHAN_TMP_PATTERN.test(entry.name)) continue;
    try {
      fs.unlinkSync(full);
      removed++;
    } catch { /* best effort */ }
  }
  return removed;
}

function insertMarkerComment(content, comment) {
  if (content.startsWith('---\n')) {
    const frontmatterEnd = content.indexOf('\n---\n', 4);
    if (frontmatterEnd !== -1) {
      const insertAt = frontmatterEnd + '\n---\n'.length;
      return `${content.slice(0, insertAt)}${comment}\n${content.slice(insertAt)}`;
    }
  }
  return `${comment}\n${content}`;
}

// Code-block-aware rewriter.
//
// Splits content into an ordered sequence of prose/code segments using
// CommonMark-ish fenced code block rules, then applies `transform` only to
// `/scr:*` references in prose. Code segments (including the fence lines)
// pass through byte-for-byte unchanged, except fenced `Next commands:` examples.
// Those are writer-facing command suggestions, not executable shell snippets,
// so they must use the target runtime's invocation syntax.
//
// Fence rules:
//   - An opener is a line whose first non-whitespace content matches `^(?:`{3,}|~{3,})`.
//   - A closer is a subsequent line whose first non-whitespace content is the
//     SAME fence character repeated at least as many times as the opener.
//     (`\`\`\`` does not close a `~~~` block and vice versa.)
//   - If a code block has no closer before EOF, the remainder of the file is
//     treated as code (fail-safe: prefer under-rewriting over mangling code).
//
// Indented (4-space / tab) code blocks are NOT detected -- only fenced blocks.
// This is intentional per Phase 27 CONTEXT: documentation snippets use fences.
function isNextCommandsFenceBlock(lines) {
  const firstContentLine = lines.find((line) => line.trim().length > 0);
  return firstContentLine ? firstContentLine.trim() === 'Next commands:' : false;
}

const INSTALLED_COMMAND_REF_RE = /\/scr:(?:[a-z0-9:-]+|\.\.\.)/gi;

function rewriteInstalledCommandRefs(content, transform) {
  if (typeof content !== 'string' || content.length === 0) return content;

  // Preserve original line endings by splitting on \r?\n but also tracking
  // the separators. Simpler approach: split into lines and remember whether
  // the original ended with a trailing newline so we can reconstruct.
  const lines = content.split(/\n/);
  // Note: because we split on /\n/, any \r is preserved at the end of each
  // non-final line. We re-join with \n and the \r stays attached, preserving
  // CRLF round-trip.

  const out = [];
  let i = 0;
  const FENCE_RE = /^(\s*)(`{3,}|~{3,})/;

  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(FENCE_RE);
    if (!m) {
      // prose line
      out.push(line.replace(INSTALLED_COMMAND_REF_RE, (ref) => transform(ref)));
      i++;
      continue;
    }
    // Opener: collect until matching closer or EOF.
    const fenceChar = m[2][0]; // '`' or '~'
    const fenceLen = m[2].length;
    out.push(line);
    i++;
    const blockLines = [];
    let closer = null;
    while (i < lines.length) {
      const inner = lines[i];
      const mc = inner.match(FENCE_RE);
      if (mc && mc[2][0] === fenceChar && mc[2].length >= fenceLen) {
        closer = inner;
        i++;
        break;
      }
      blockLines.push(inner);
      i++;
    }
    const shouldRewriteBlock = closer !== null && isNextCommandsFenceBlock(blockLines);
    for (const blockLine of blockLines) {
      out.push(shouldRewriteBlock
        ? blockLine.replace(INSTALLED_COMMAND_REF_RE, (ref) => transform(ref))
        : blockLine);
    }
    if (closer !== null) {
      out.push(closer);
    }
    // If we reached EOF without a closer, the code block implicitly extends to
    // EOF. Keep the trailing lines verbatim, including a `Next commands:` block,
    // because an unterminated fence is treated as code for fail-safe handling.
  }

  return out.join('\n');
}

function markInstalledCommand(content, runtimeKey, commandRef, sourcePath) {
  const marker = `<!-- scriveno-installed-command runtime:${runtimeKey} command:${commandRef} source:${sourcePath} -->`;
  return insertMarkerComment(content, marker);
}

function generateClaudeCommandContent(entry, sourceContent) {
  const rewritten = rewriteInstalledCommandRefs(sourceContent, commandRefToClaudeInvocation);
  return markInstalledCommand(rewritten, 'claude-code', commandRefToClaudeInvocation(entry.commandRef), entry.relativePath);
}

function generateCodexCommandContent(entry, sourceContent) {
  const rewritten = rewriteInstalledCommandRefs(sourceContent, commandRefToCodexInvocation);
  return markInstalledCommand(
    rewritten,
    'codex',
    commandRefToCodexInvocation(entry.commandRef),
    entry.relativePath
  );
}

function isScrivenoInstalledCommandFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('scriveno-installed-command') || content.includes('scriveno-cli-installed-command');
}

function cleanFlatCommandFiles(commandsDir, currentFileNames, legacyDirs = []) {
  if (!fs.existsSync(commandsDir)) return 0;

  const manifestPath = path.join(commandsDir, '.scriveno-installed.json');
  const manifest = readJsonIfExists(manifestPath);
  const currentFileSet = new Set(currentFileNames);
  const knownFileNames = new Set(Array.isArray(manifest?.files) ? manifest.files : []);
  let removed = 0;

  for (const entry of fs.readdirSync(commandsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const filePath = path.join(commandsDir, entry.name);
    if (isScrivenoInstalledCommandFile(filePath)) {
      knownFileNames.add(entry.name);
    }
  }

  removePathIfExists(manifestPath);

  for (const legacyDir of legacyDirs) {
    if (removePathIfExists(path.join(commandsDir, legacyDir))) {
      removed++;
    }
  }

  for (const fileName of knownFileNames) {
    if (!currentFileSet.has(fileName) && removePathIfExists(path.join(commandsDir, fileName))) {
      removed++;
    }
  }

  for (const fileName of currentFileNames) {
    if (removePathIfExists(path.join(commandsDir, fileName))) {
      removed++;
    }
  }

  return removed;
}

function writeInstalledCommandManifest(commandsDir, runtimeKey, fileNames) {
  const manifestPath = path.join(commandsDir, '.scriveno-installed.json');
  const manifest = {
    installer: 'scriveno',
    version: VERSION,
    runtime: runtimeKey,
    files: fileNames,
    generated_at: new Date().toISOString(),
  };
  atomicWriteFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function printHelp() {
  console.log(BANNER);
  console.log(`Usage:
  scriveno
  scriveno first-run --project .
  scriveno status --project .
  scriveno status . --json
  scriveno status --project . --apply-safe
  scriveno sync --check
  scriveno smoke --json
  scriveno agents --json
  scriveno routes --json
  scriveno surface list
  scriveno surface status
  scriveno surface profile core --runtimes codex --project
  scriveno --runtimes codex,claude-code --global --writer --silent

Options:
  --runtimes <list>   Comma-separated runtime keys to install (for example: codex,claude-code)
  --runtime <key>     Repeatable single-runtime selector
  --detected          Install to every detected runtime
  --profile <name>    Command profile: ${Object.keys(SURFACE_PROFILES).join(', ')}
  --dry-run           Show planned writes without changing files
  --json              Print machine-readable output for supported commands
  --global            Install for all projects (default)
  --project           Install only in the current directory
  --writer            Use writer mode (default)
  --developer         Use developer mode
  --silent            Skip prompts and reduce output
  --help              Show this help text
  --version           Show the Scriveno package version

Status options:
  first-run           Print the guided first-run path and proof checklist
  status              Inspect a project and recommend the next command
  --project <path>    Project root to inspect (default: current directory)
  --trigger <name>    Status trigger label (default: scriveno status)
  --apply-safe        Run read-only checks and report write-gated helpers
  --json              Print machine-readable status JSON

Audit commands:
  sync --check        Check shared sync, runtime, and agent surfaces
  smoke               Smoke-test installed runtime surfaces
  agents              Inspect installed agent prompts and metadata
  routes              Audit route graph and automation lanes
  surface             Inspect or change the installed command profile

Runtime keys:
  ${Object.keys(RUNTIMES).join(', ')}
`);
}

function parseArgs(argv) {
  const options = {
    command: 'install',
    runtimeKeys: [],
    installDetected: false,
    isGlobal: null,
    developerMode: null,
    silent: false,
    showHelp: false,
    showVersion: false,
    statusProjectRoot: process.cwd(),
    statusTrigger: 'scriveno status',
    statusJson: false,
    statusApplySafe: false,
    auditJson: false,
    syncCheck: false,
    installProfile: DEFAULT_SURFACE_PROFILE,
    installProfileExplicit: false,
    installDryRun: false,
    installJson: false,
    surfaceAction: 'status',
    surfaceProfile: DEFAULT_SURFACE_PROFILE,
  };

  if (argv[0] === 'status' || argv[0] === 'first-run') {
    options.command = argv[0];
    if (argv[0] === 'first-run') {
      options.statusTrigger = 'scriveno first-run';
    }
    for (let i = 1; i < argv.length; i++) {
      const arg = argv[i];
      if (arg === '--help' || arg === '-h') {
        options.showHelp = true;
      } else if (arg === '--version' || arg === '-v') {
        options.showVersion = true;
      } else if (arg === '--json') {
        options.statusJson = true;
      } else if (arg === '--apply-safe') {
        options.statusApplySafe = true;
      } else if (arg === '--project') {
        const value = argv[i + 1];
        if (!value) throw new Error('--project requires a value for status');
        options.statusProjectRoot = value;
        i++;
      } else if (arg.startsWith('--project=')) {
        options.statusProjectRoot = arg.slice('--project='.length);
      } else if (arg === '--trigger') {
        const value = argv[i + 1];
        if (!value) throw new Error('--trigger requires a value');
        options.statusTrigger = value;
        i++;
      } else if (arg.startsWith('--trigger=')) {
        options.statusTrigger = arg.slice('--trigger='.length);
      } else if (arg.startsWith('-')) {
        throw new Error(`Unknown status argument "${arg}"`);
      } else {
        options.statusProjectRoot = arg;
      }
    }
    return options;
  }

  if (['sync', 'smoke', 'agents', 'routes'].includes(argv[0])) {
    options.command = argv[0];
    for (let i = 1; i < argv.length; i++) {
      const arg = argv[i];
      if (arg === '--help' || arg === '-h') {
        options.showHelp = true;
      } else if (arg === '--version' || arg === '-v') {
        options.showVersion = true;
      } else if (arg === '--json') {
        options.auditJson = true;
      } else if (arg === '--check' && argv[0] === 'sync') {
        options.syncCheck = true;
      } else if (arg === '--project') {
        const value = argv[i + 1];
        if (!value) throw new Error('--project requires a value');
        options.statusProjectRoot = value;
        i++;
      } else if (arg.startsWith('--project=')) {
        options.statusProjectRoot = arg.slice('--project='.length);
      } else if (arg.startsWith('-')) {
        throw new Error(`Unknown ${argv[0]} argument "${arg}"`);
      } else if (argv[0] === 'sync') {
        options.statusProjectRoot = arg;
      } else {
        throw new Error(`Unknown ${argv[0]} argument "${arg}"`);
      }
    }
    return options;
  }

  function addRuntimeList(value) {
    for (const key of String(value).split(',').map((item) => item.trim()).filter(Boolean)) {
      if (!Object.prototype.hasOwnProperty.call(RUNTIMES, key)) {
        throw new Error(`Unknown runtime "${key}". Expected one of: ${Object.keys(RUNTIMES).join(', ')}`);
      }
      if (!options.runtimeKeys.includes(key)) {
        options.runtimeKeys.push(key);
      }
    }
  }

  if (argv[0] === 'surface') {
    options.command = 'surface';
    let actionSet = false;
    for (let i = 1; i < argv.length; i++) {
      const arg = argv[i];
      if (arg === '--help' || arg === '-h') {
        options.showHelp = true;
      } else if (arg === '--version' || arg === '-v') {
        options.showVersion = true;
      } else if (arg === '--json') {
        options.installJson = true;
      } else if (arg === '--silent' || arg === '--yes') {
        options.silent = true;
      } else if (arg === '--dry-run') {
        options.installDryRun = true;
      } else if (arg === '--detected') {
        options.installDetected = true;
      } else if (arg === '--global') {
        options.isGlobal = true;
      } else if (arg === '--project') {
        options.isGlobal = false;
      } else if (arg === '--writer') {
        options.developerMode = false;
      } else if (arg === '--developer') {
        options.developerMode = true;
      } else if (arg === '--runtime') {
        const value = argv[i + 1];
        if (!value) throw new Error('--runtime requires a value');
        addRuntimeList(value);
        i++;
      } else if (arg.startsWith('--runtime=')) {
        addRuntimeList(arg.slice('--runtime='.length));
      } else if (arg === '--runtimes') {
        const value = argv[i + 1];
        if (!value) throw new Error('--runtimes requires a value');
        addRuntimeList(value);
        i++;
      } else if (arg.startsWith('--runtimes=')) {
        addRuntimeList(arg.slice('--runtimes='.length));
      } else if (arg === '--profile') {
        const value = argv[i + 1];
        if (!value) throw new Error('--profile requires a value');
        options.surfaceProfile = normalizeSurfaceProfile(value);
        options.installProfile = options.surfaceProfile;
        options.installProfileExplicit = true;
        i++;
      } else if (arg.startsWith('--profile=')) {
        options.surfaceProfile = normalizeSurfaceProfile(arg.slice('--profile='.length));
        options.installProfile = options.surfaceProfile;
        options.installProfileExplicit = true;
      } else if (arg.startsWith('-')) {
        throw new Error(`Unknown surface argument "${arg}"`);
      } else if (!actionSet) {
        options.surfaceAction = arg;
        actionSet = true;
      } else if (options.surfaceAction === 'profile') {
        options.surfaceProfile = normalizeSurfaceProfile(arg);
        options.installProfile = options.surfaceProfile;
      } else {
        throw new Error(`Unknown surface argument "${arg}"`);
      }
    }
    if (!['status', 'list', 'profile'].includes(options.surfaceAction)) {
      throw new Error(`Unknown surface action "${options.surfaceAction}". Expected status, list, or profile.`);
    }
    return options;
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.showHelp = true;
    } else if (arg === '--version' || arg === '-v') {
      options.showVersion = true;
    } else if (arg === '--silent' || arg === '--yes') {
      options.silent = true;
    } else if (arg === '--dry-run') {
      options.installDryRun = true;
    } else if (arg === '--json') {
      options.installJson = true;
    } else if (arg === '--detected') {
      options.installDetected = true;
    } else if (arg === '--global') {
      options.isGlobal = true;
    } else if (arg === '--project') {
      options.isGlobal = false;
    } else if (arg === '--writer') {
      options.developerMode = false;
    } else if (arg === '--developer') {
      options.developerMode = true;
    } else if (arg === '--runtime') {
      const value = argv[i + 1];
      if (!value) throw new Error('--runtime requires a value');
      addRuntimeList(value);
      i++;
    } else if (arg.startsWith('--runtime=')) {
      addRuntimeList(arg.slice('--runtime='.length));
    } else if (arg === '--runtimes') {
      const value = argv[i + 1];
      if (!value) throw new Error('--runtimes requires a value');
      addRuntimeList(value);
      i++;
    } else if (arg.startsWith('--runtimes=')) {
      addRuntimeList(arg.slice('--runtimes='.length));
    } else if (arg === '--profile') {
      const value = argv[i + 1];
      if (!value) throw new Error('--profile requires a value');
      options.installProfile = normalizeSurfaceProfile(value);
      options.installProfileExplicit = true;
      i++;
    } else if (arg.startsWith('--profile=')) {
      options.installProfile = normalizeSurfaceProfile(arg.slice('--profile='.length));
      options.installProfileExplicit = true;
    } else {
      throw new Error(`Unknown argument "${arg}"`);
    }
  }

  return options;
}

function runStatus({ projectRoot, trigger, json, applySafe }) {
  const analysis = autoInvokeEngine.analyzeProject(projectRoot);
  const safeApply = applySafe
    ? autoInvokeEngine.collectSafeApplyActions(projectRoot, { analysis, trigger })
    : null;
  if (json) {
    console.log(JSON.stringify(safeApply ? { analysis, safeApply } : analysis, null, 2));
  } else {
    console.log(autoInvokeEngine.formatReport(analysis, { trigger }));
    if (safeApply) {
      console.log('');
      console.log(autoInvokeEngine.formatSafeApplyReport(safeApply));
    }
  }
  return safeApply ? { analysis, safeApply } : analysis;
}

function readInstallSettingsForProject(projectRoot) {
  const projectSettings = readJsonIfExists(path.join(path.resolve(projectRoot || process.cwd()), '.scriveno', 'settings.json'));
  if (projectSettings) return migrateSettings(projectSettings);
  const globalSettings = readJsonIfExists(path.join(os.homedir(), '.scriveno', 'settings.json'));
  return globalSettings ? migrateSettings(globalSettings) : null;
}

function commandRefToRuntimeInvocation(commandRef, runtimeKey) {
  if (runtimeKey === 'claude-code') return commandRefToClaudeInvocation(commandRef);
  if (runtimeKey === 'codex') return commandRefToCodexInvocation(commandRef);
  return commandRef;
}

function commandStepToRuntimeInvocation(step, runtimeKey) {
  const match = String(step).match(/^(\/scr:[a-z0-9:-]+)(.*)$/i);
  if (!match) return step;
  return `${commandRefToRuntimeInvocation(match[1], runtimeKey)}${match[2]}`;
}

function buildFirstRunGuide({ projectRoot }) {
  const analysis = autoInvokeEngine.analyzeProject(projectRoot);
  const smoke = autoInvokeEngine.inspectRuntimeSmoke({ projectRoot });
  const routes = autoInvokeEngine.buildRouteGraph();
  const settings = readInstallSettingsForProject(projectRoot);
  const activeRuntime = Array.isArray(settings?.runtimes) && settings.runtimes.length > 0
    ? settings.runtimes[0]
    : settings?.runtime || 'standard';
  return {
    projectRoot,
    activeRuntime,
    recommendation: analysis.recommendation,
    commandShapes: {
      claudeCode: ['/scr-first-run', '/scr-demo', '/scr-next'],
      standardSlash: ['/scr:first-run', '/scr:demo', '/scr:next'],
      codex: ['$scr-first-run', '$scr-demo', '$scr-next'],
      genericSkills: ['Read SKILL.md', 'open commands/scr/first-run.md', 'run the same /scr:* instructions'],
      guided: ['Follow the generated local-MCP setup notes'],
    },
    modelAdaptation: {
      policy: autoInvokeEngine.getRuntimeAgentSupport('generic').modelPolicy,
      docs: autoInvokeEngine.getRuntimeAgentSupport('generic').adaptationDocs,
      latest: [
        'neutral RESEARCH.md notes',
        '/scr:research researcher fan-out',
        '/scr:scan --deep read-only auditors',
        'planning preflight workers',
        'editor diagnostic workers',
        'autopilot lookahead workers',
      ],
    },
    firstPath: [
      '/scr:demo',
      'cd scriveno-demo',
      '/scr:next',
      '/scr:draft 5',
      '/scr:editor-review 5',
      '/scr:save',
    ],
    proofArtifacts: [
      'docs/quick-proof.md',
      'docs/starter-sets.md',
      'data/proof/first-run/README.md',
      'data/proof/runtime-parity/README.md',
      'data/proof/watchmaker-flow/README.md',
      'data/proof/voice-dna/README.md',
    ],
    checks: {
      smokeOk: smoke.ok,
      commandCount: routes.commandCount,
      expectedAgents: smoke.expectedAgents,
    },
  };
}

function formatFirstRunGuide(guide) {
  const firstPath = guide.firstPath.map((step) => commandStepToRuntimeInvocation(step, guide.activeRuntime));
  const recommendation = commandStepToRuntimeInvocation(guide.recommendation.command, guide.activeRuntime);
  const nextDemo = commandRefToRuntimeInvocation('/scr:demo', guide.activeRuntime);
  const nextNext = commandRefToRuntimeInvocation('/scr:next', guide.activeRuntime);
  const nextNewWork = commandRefToRuntimeInvocation('/scr:new-work', guide.activeRuntime);
  return [
    'Scriveno first-run guide',
    `Project: ${guide.projectRoot}`,
    `Current recommendation: ${recommendation}`,
    `Active command shape: ${guide.activeRuntime}`,
    '',
    'Runtime command shapes:',
    `- Claude Code: ${guide.commandShapes.claudeCode.join(', ')}`,
    `- Standard slash-command runtimes: ${guide.commandShapes.standardSlash.join(', ')}`,
    `- Codex: ${guide.commandShapes.codex.join(', ')}`,
    `- Generic skills: ${guide.commandShapes.genericSkills.join(', ')}`,
    `- Guided targets: ${guide.commandShapes.guided.join(', ')}`,
    '',
    'Model adaptation:',
    `- Policy: ${guide.modelAdaptation.policy}`,
    `- Docs: ${guide.modelAdaptation.docs.join(', ')}`,
    `- Latest adaptations: ${guide.modelAdaptation.latest.join(', ')}`,
    '',
    'Recommended first path:',
    ...firstPath.map((step, index) => `${index + 1}. ${step}`),
    '',
    'Proof artifacts:',
    ...guide.proofArtifacts.map((artifact) => `- ${artifact}`),
    '',
    'Checks:',
    `- runtime smoke: ${guide.checks.smokeOk ? 'ok' : 'needs install refresh'}`,
    `- command count: ${guide.checks.commandCount}`,
    `- expected agents: ${guide.checks.expectedAgents.join(', ')}`,
    '',
    'Next commands:',
    `- ${nextDemo}: Create the isolated watchmaker demo project.`,
    `- ${nextNext}: Let Scriveno inspect the current project state.`,
    `- ${nextNewWork}: Start a real project instead of using the demo.`,
  ].join('\n');
}

function runFirstRun({ projectRoot, json }) {
  const guide = buildFirstRunGuide({ projectRoot });
  if (json) {
    console.log(JSON.stringify(guide, null, 2));
  } else {
    console.log(formatFirstRunGuide(guide));
  }
  return guide;
}

function runSyncCheck({ projectRoot, json }) {
  const analysis = autoInvokeEngine.analyzeProject(projectRoot);
  const safeApply = autoInvokeEngine.collectSafeApplyActions(projectRoot, { analysis, trigger: 'scriveno sync --check' });
  const agents = autoInvokeEngine.inspectAgentAvailability({ projectRoot });
  const smoke = autoInvokeEngine.inspectRuntimeSmoke({ projectRoot });
  const result = { analysis, safeApply, agents, smoke };
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Sync status:');
    console.log(`Project: ${analysis.projectRoot}`);
    console.log(`Recommendation: ${analysis.recommendation.command}`);
    console.log('');
    console.log(autoInvokeEngine.formatSafeApplyReport(safeApply));
    console.log('');
    console.log(autoInvokeEngine.formatAgentAvailabilityReport(agents));
    console.log('');
    console.log(autoInvokeEngine.formatRuntimeSmokeReport(smoke));
  }
  return result;
}

function runRuntimeSmoke({ projectRoot, json }) {
  const result = autoInvokeEngine.inspectRuntimeSmoke({ projectRoot });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(autoInvokeEngine.formatRuntimeSmokeReport(result));
  }
  return result;
}

function runAgentAvailability({ projectRoot, json }) {
  const result = autoInvokeEngine.inspectAgentAvailability({ projectRoot });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(autoInvokeEngine.formatAgentAvailabilityReport(result));
  }
  return result;
}

function runRouteAudit({ json }) {
  const result = autoInvokeEngine.buildRouteGraph();
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(autoInvokeEngine.formatRouteGraphReport(result));
  }
  return result;
}

function resolveSurfaceDataDir(isGlobal) {
  if (isGlobal === false) return path.resolve('.scriveno');
  if (isGlobal === true) return path.join(os.homedir(), '.scriveno');
  const projectDir = path.resolve('.scriveno');
  const projectSettings = path.join(projectDir, 'settings.json');
  return fs.existsSync(projectSettings) ? projectDir : path.join(os.homedir(), '.scriveno');
}

function readSurfaceSettings(isGlobal) {
  const dataDir = resolveSurfaceDataDir(isGlobal);
  const settingsPath = path.join(dataDir, 'settings.json');
  const raw = readJsonIfExists(settingsPath);
  if (!raw) {
    return { dataDir, settings: null, settingsPath };
  }
  try {
    const settings = migrateSettings(raw);
    const validation = validateSettings(settings);
    return { dataDir, settings, settingsPath, validation };
  } catch (err) {
    return { dataDir, settings: null, settingsPath, error: err.message };
  }
}

function formatSurfaceList(profiles) {
  return [
    'Scriveno command profiles',
    ...profiles.map((profile) => `- ${profile.profile}: ${profile.commandCount} registered commands, ${profile.description}`),
  ].join('\n');
}

function formatSurfaceStatus(status) {
  const lines = [
    'Scriveno surface status',
    `Settings: ${status.settingsPath}`,
  ];
  if (!status.settings) {
    lines.push('Installed profile: not found');
  } else {
    lines.push(`Installed profile: ${status.settings.profile || DEFAULT_SURFACE_PROFILE}`);
    lines.push(`Installed runtimes: ${(status.settings.runtimes || []).join(', ') || 'none recorded'}`);
    lines.push(`Scope: ${status.settings.scope || 'unknown'}`);
    lines.push(`Mode: ${status.settings.developer_mode ? 'developer' : 'writer'}`);
  }
  lines.push('');
  lines.push('Available profiles:');
  for (const profile of listSurfaceProfiles()) {
    lines.push(`- ${profile.profile}: ${profile.commandCount} registered commands`);
  }
  lines.push('');
  lines.push('Use `scriveno surface profile <name> --runtimes <runtime>` to reinstall a smaller or larger surface.');
  return lines.join('\n');
}

function runSurface(parsed, detectedRuntimeKeys) {
  if (parsed.surfaceAction === 'list') {
    const profiles = listSurfaceProfiles();
    console.log(parsed.installJson ? JSON.stringify(profiles, null, 2) : formatSurfaceList(profiles));
    return profiles;
  }

  const surfaceState = readSurfaceSettings(parsed.isGlobal);

  if (parsed.surfaceAction === 'status') {
    console.log(parsed.installJson ? JSON.stringify(surfaceState, null, 2) : formatSurfaceStatus(surfaceState));
    return surfaceState;
  }

  const runtimeKeys = parsed.runtimeKeys.length > 0
    ? parsed.runtimeKeys
    : parsed.installDetected
      ? detectedRuntimeKeys
      : (surfaceState.settings?.runtimes && surfaceState.settings.runtimes.length > 0)
        ? surfaceState.settings.runtimes
        : detectedRuntimeKeys;

  if (runtimeKeys.length === 0) {
    throw new Error('No runtime target found. Re-run with --runtimes <list> or --detected.');
  }

  return runInstall({
    runtimeKeys,
    isGlobal: parsed.isGlobal ?? (surfaceState.settings?.scope !== 'project'),
    developerMode: parsed.developerMode ?? Boolean(surfaceState.settings?.developer_mode),
    silent: parsed.silent,
    installMode: 'non-interactive',
    profile: parsed.surfaceProfile,
    dryRun: parsed.installDryRun,
    json: parsed.installJson,
  });
}

function resolveInstallRequest(parsed, detectedRuntimeKeys, { isTTY }) {
  const hasRuntimeDirective = parsed.runtimeKeys.length > 0 || parsed.installDetected;
  const hasModifierOverrides = parsed.isGlobal !== null || parsed.developerMode !== null;

  if (!isTTY && !hasRuntimeDirective) {
    return {
      action: 'usage_error',
      message: 'Non-interactive use requires --runtimes <list> or --detected.',
    };
  }

  if (parsed.silent && !hasRuntimeDirective) {
    return {
      action: 'usage_error',
      message: 'Silent installs require --runtimes <list>, --runtime <key>, or --detected.',
    };
  }

  if (hasRuntimeDirective) {
    return {
      action: 'install',
      runtimeKeys: parsed.runtimeKeys.length > 0
        ? parsed.runtimeKeys
        : detectedRuntimeKeys,
      isGlobal: parsed.isGlobal ?? true,
      developerMode: parsed.developerMode ?? false,
      silent: parsed.silent,
      installMode: 'non-interactive',
      profile: parsed.installProfile,
      profileExplicit: parsed.installProfileExplicit,
      dryRun: parsed.installDryRun,
      json: parsed.installJson,
    };
  }

  return {
    action: 'interactive',
    isGlobal: parsed.isGlobal,
    developerMode: parsed.developerMode,
    hasModifierOverrides,
    profile: parsed.installProfile,
    profileExplicit: parsed.installProfileExplicit,
    dryRun: parsed.installDryRun,
    json: parsed.installJson,
  };
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function requireSupportedNode() {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  if (!Number.isInteger(major) || major < MIN_NODE_MAJOR) {
    console.error(c('red', `Scriveno's installer requires Node.js >=20.0.0. You are running ${process.versions.node}.`));
    console.error(c('dim', 'See the repository README for the full runtime support matrix and current installer guidance.'));
    process.exit(1);
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

function sha256File(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function copyDirWithPreservation(src, dest, options = {}) {
  const timestamp = options.timestamp || new Date().toISOString().replace(/[:.]/g, '-');
  const result = { fresh: 0, replaced: 0, backedUp: 0 };
  if (!fs.existsSync(src)) return result;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      const sub = copyDirWithPreservation(srcPath, destPath, { ...options, timestamp });
      result.fresh += sub.fresh;
      result.replaced += sub.replaced;
      result.backedUp += sub.backedUp;
      continue;
    }
    // H-02 + M-01: use lstat on the destination so we can (a) detect
    // non-regular-file dests (symlinks, sockets, FIFOs) and refuse to hash
    // through them, and (b) route the final write through atomicWriteFileSync
    // so a crash mid-copy cannot leave destPath truncated.
    let destStat = null;
    try {
      destStat = fs.lstatSync(destPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    // Read the source buffer once -- used for both hashing and the atomic write.
    const srcBuf = fs.readFileSync(srcPath);

    if (destStat === null) {
      // No existing dest -- fresh write.
      atomicWriteFileSync(destPath, srcBuf);
      result.fresh++;
      continue;
    }

    if (!destStat.isFile()) {
      // M-01: dest is a symlink / socket / directory-named-like-a-file /
      // anything non-regular. Treat it as "modified" and back it up before
      // installing the shipped template. Removing the non-regular entry via
      // rename preserves the user's data under a .backup.<timestamp> sibling.
      const backupPath = `${destPath}.backup.${timestamp}`;
      try {
        fs.renameSync(destPath, backupPath);
      } catch {
        // Fall back to unlink -- renameSync can fail across some boundaries.
        try { fs.unlinkSync(destPath); } catch { /* best effort */ }
      }
      atomicWriteFileSync(destPath, srcBuf);
      result.backedUp++;
      continue;
    }

    const destHash = sha256File(destPath);
    const srcHash = crypto.createHash('sha256').update(srcBuf).digest('hex');
    if (srcHash === destHash) {
      // Identical content -- rewrite atomically so an interrupted run still
      // leaves a complete file (no partial-write window).
      atomicWriteFileSync(destPath, srcBuf);
      result.replaced++;
    } else {
      const backupPath = `${destPath}.backup.${timestamp}`;
      fs.renameSync(destPath, backupPath);
      atomicWriteFileSync(destPath, srcBuf);
      result.backedUp++;
    }
  }
  return result;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// I-01: tag ownership on schema entries and derive INSTALLER_OWNED_FIELDS from
// the schema so a future contributor cannot forget to classify a new field.
// `developer_mode` is the only user-owned field today; everything else is
// installer-owned (matches prior INSTALLER_OWNED_FIELDS list exactly).
const SETTINGS_SCHEMA = [
  { name: 'version', type: 'string', required: true, owned_by: 'installer' },
  { name: 'runtime', type: 'string', required: true, allow_empty: true, owned_by: 'installer' },
  { name: 'runtimes', type: 'array-of-string', required: true, owned_by: 'installer' },
  { name: 'scope', type: 'string', required: true, enum: ['global', 'project'], owned_by: 'installer' },
  { name: 'developer_mode', type: 'boolean', required: true, owned_by: 'user' },
  { name: 'data_dir', type: 'string', required: true, owned_by: 'installer' },
  { name: 'install_mode', type: 'string', required: true, enum: ['interactive', 'non-interactive'], owned_by: 'installer' },
  { name: 'profile', type: 'string', required: false, enum: Object.keys(SURFACE_PROFILES), owned_by: 'installer' },
  { name: 'installed_at', type: 'string', required: true, owned_by: 'installer' },
];

const INSTALLER_OWNED_FIELDS = SETTINGS_SCHEMA
  .filter((f) => f.owned_by === 'installer')
  .map((f) => f.name);

function mergeSettings(existing, incoming, _schema = SETTINGS_SCHEMA) {
  const merged = { ...incoming };
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return merged;
  for (const [key, value] of Object.entries(existing)) {
    if (INSTALLER_OWNED_FIELDS.includes(key)) continue;
    merged[key] = value;
  }
  return merged;
}

function migrateSettings(raw) {
  if (raw == null) return null;
  const out = { ...raw };
  if (!Object.prototype.hasOwnProperty.call(out, 'runtimes') || out.runtimes === undefined) {
    if (typeof out.runtime === 'string' && out.runtime.length > 0) {
      out.runtimes = [out.runtime];
    } else {
      out.runtimes = [];
    }
  }
  if (!Object.prototype.hasOwnProperty.call(out, 'scope') || out.scope === undefined) {
    out.scope = 'global';
  }
  if (!Object.prototype.hasOwnProperty.call(out, 'install_mode') || out.install_mode === undefined) {
    out.install_mode = 'interactive';
  }
  if (!Object.prototype.hasOwnProperty.call(out, 'profile') || out.profile === undefined) {
    out.profile = DEFAULT_SURFACE_PROFILE;
  }
  return out;
}

function describeActualType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function validateSettings(settings) {
  const errors = [];
  if (settings === null || typeof settings !== 'object' || Array.isArray(settings)) {
    return {
      valid: false,
      errors: [`settings: expected object, received ${describeActualType(settings)}`],
    };
  }

  const schemaFieldNames = new Set(SETTINGS_SCHEMA.map((f) => f.name));
  let hardErrorCount = 0;

  for (const field of SETTINGS_SCHEMA) {
    const hasKey = Object.prototype.hasOwnProperty.call(settings, field.name);
    if (!hasKey) {
      if (field.required) {
        errors.push(`${field.name}: required field is missing`);
        hardErrorCount++;
      }
      continue;
    }
    const value = settings[field.name];
    const actual = describeActualType(value);

    if (field.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`${field.name}: expected string, received ${actual}`);
        hardErrorCount++;
        continue;
      }
      if (!field.allow_empty && value === '') {
        errors.push(`${field.name}: expected non-empty string, received empty string`);
        hardErrorCount++;
        continue;
      }
    } else if (field.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(`${field.name}: expected boolean, received ${actual}`);
        hardErrorCount++;
        continue;
      }
    } else if (field.type === 'array-of-string') {
      if (!Array.isArray(value)) {
        errors.push(`${field.name}: expected array, received ${actual}`);
        hardErrorCount++;
        continue;
      }
      const badIdx = value.findIndex((el) => typeof el !== 'string');
      if (badIdx !== -1) {
        errors.push(`${field.name}: expected array of string, received ${describeActualType(value[badIdx])} at index ${badIdx}`);
        hardErrorCount++;
        continue;
      }
    }

    if (Array.isArray(field.enum) && !field.enum.includes(value)) {
      errors.push(`${field.name}: expected one of [${field.enum.join(', ')}], received ${value}`);
      hardErrorCount++;
    }
  }

  for (const key of Object.keys(settings)) {
    if (!schemaFieldNames.has(key)) {
      errors.push(`${key}: unknown field (warning)`);
    }
  }

  return { valid: hardErrorCount === 0, errors };
}

function readSettings(dataDir) {
  const settingsPath = path.join(dataDir, 'settings.json');
  const raw = readJsonIfExists(settingsPath);
  if (raw === null) {
    throw new Error(`settings.json not found at ${settingsPath}`);
  }
  const migrated = migrateSettings(raw);
  const result = validateSettings(migrated);
  if (!result.valid) {
    const hardErrors = result.errors.filter((e) => !/\(warning\)\s*$/.test(e));
    throw new Error(`Invalid settings: ${hardErrors.join('; ')}`);
  }
  return migrated;
}

function isScrivenoCodexSkillDir(skillDir) {
  const skillFile = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) return false;
  const content = fs.readFileSync(skillFile, 'utf8');
  return content.includes('<codex_skill_adapter>')
    && content.includes("Execute Scriveno's `")
    && content.includes('Installed command file:');
}

function cleanCodexSkillDirs(skillsDir, currentSkillNames) {
  if (!fs.existsSync(skillsDir)) return 0;

  const manifestPath = path.join(skillsDir, '.scriveno-installed.json');
  const manifest = readJsonIfExists(manifestPath);
  const currentSkillSet = new Set(currentSkillNames);
  const knownScrivenoSkillNames = new Set(Array.isArray(manifest?.skills) ? manifest.skills : []);

  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(skillsDir, entry.name);
    if (isScrivenoCodexSkillDir(skillDir)) {
      knownScrivenoSkillNames.add(entry.name);
    }
  }

  let removed = 0;
  removePathIfExists(path.join(skillsDir, 'scriveno'));
  removePathIfExists(manifestPath);

  for (const skillName of knownScrivenoSkillNames) {
    if (!currentSkillSet.has(skillName)) {
      if (removePathIfExists(path.join(skillsDir, skillName))) {
        removed++;
      }
    }
  }

  for (const skillName of currentSkillNames) {
    if (removePathIfExists(path.join(skillsDir, skillName))) {
      removed++;
    }
  }

  return removed;
}

function writeCodexSkillManifest(skillsDir, skillNames) {
  const manifestPath = path.join(skillsDir, '.scriveno-installed.json');
  const manifest = {
    installer: 'scriveno',
    version: VERSION,
    skills: skillNames,
    generated_at: new Date().toISOString(),
  };
  atomicWriteFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function isScrivenoCodexAgentMetadataFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('developer_instructions = ') && (
    content.includes('# Drafter agent')
    || content.includes('# Voice checker agent')
    || content.includes('# Continuity checker agent')
    || content.includes('# Plan checker agent')
    || content.includes('# Researcher agent')
    || content.includes('# Translator agent')
  );
}

function cleanCodexAgentFiles(agentsDir, currentFileNames) {
  if (!fs.existsSync(agentsDir)) return 0;

  const manifestPath = path.join(agentsDir, '.scriveno-agents-installed.json');
  const manifest = readJsonIfExists(manifestPath);
  const currentFileSet = new Set(currentFileNames);
  const knownFileNames = new Set(Array.isArray(manifest?.files) ? manifest.files : []);

  for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.toml')) continue;
    const filePath = path.join(agentsDir, entry.name);
    if (isScrivenoCodexAgentMetadataFile(filePath)) {
      knownFileNames.add(entry.name);
    }
  }

  removePathIfExists(manifestPath);

  let removed = 0;
  for (const fileName of knownFileNames) {
    if (!currentFileSet.has(fileName) && removePathIfExists(path.join(agentsDir, fileName))) {
      removed++;
    }
  }

  for (const fileName of currentFileNames) {
    if (removePathIfExists(path.join(agentsDir, fileName))) {
      removed++;
    }
  }

  return removed;
}

function writeCodexAgentManifest(agentsDir, fileNames) {
  const manifestPath = path.join(agentsDir, '.scriveno-agents-installed.json');
  const manifest = {
    installer: 'scriveno',
    version: VERSION,
    files: fileNames,
    generated_at: new Date().toISOString(),
  };
  atomicWriteFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.showHelp) {
    printHelp();
    return;
  }
  if (parsed.showVersion) {
    console.log(VERSION);
    return;
  }

  if (parsed.command === 'status') {
    runStatus({
      projectRoot: parsed.statusProjectRoot,
      trigger: parsed.statusTrigger,
      json: parsed.statusJson,
      applySafe: parsed.statusApplySafe,
    });
    return;
  }

  if (parsed.command === 'first-run') {
    runFirstRun({
      projectRoot: parsed.statusProjectRoot,
      json: parsed.statusJson,
    });
    return;
  }

  if (parsed.command === 'sync') {
    runSyncCheck({
      projectRoot: parsed.statusProjectRoot,
      json: parsed.auditJson,
    });
    return;
  }

  if (parsed.command === 'smoke') {
    runRuntimeSmoke({ projectRoot: parsed.statusProjectRoot, json: parsed.auditJson });
    return;
  }

  if (parsed.command === 'agents') {
    runAgentAvailability({ projectRoot: parsed.statusProjectRoot, json: parsed.auditJson });
    return;
  }

  if (parsed.command === 'routes') {
    runRouteAudit({ json: parsed.auditJson });
    return;
  }

  const detectedRuntimeKeys = Object.entries(RUNTIMES).filter(([, runtime]) => runtime.detect()).map(([key]) => key);
  if (parsed.command === 'surface') {
    runSurface(parsed, detectedRuntimeKeys);
    return;
  }

  const installRequest = resolveInstallRequest(parsed, detectedRuntimeKeys, { isTTY: Boolean(process.stdin.isTTY) });

  if (installRequest.action === 'usage_error') {
    printHelp();
    console.log(c('yellow', `\n${installRequest.message}`));
    process.exitCode = 1;
    return;
  }

  if (installRequest.action === 'install') {
    runInstall(installRequest);
    return;
  }

  console.log(BANNER);
  console.log(RUNTIME_SUPPORT_NOTE + '\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const runtimeKeys = Object.keys(RUNTIMES);

  console.log(c('bold', 'Select your AI coding agent:'));
  runtimeKeys.forEach((key, i) => {
    const label = RUNTIMES[key].label;
    const badge = detectedRuntimeKeys.includes(key) ? c('green', ' (detected)') : '';
    console.log(`  ${c('cyan', (i + 1) + '.')} ${label}${badge}`);
  });

  const runtimeChoice = await ask(rl, `\n${c('dim', 'Choice [1]: ')}`);
  const parsedRuntimeChoice = Number.parseInt((runtimeChoice || '1').trim(), 10);
  const validRuntimeChoice = Number.isInteger(parsedRuntimeChoice)
    && parsedRuntimeChoice >= 1
    && parsedRuntimeChoice <= runtimeKeys.length;
  if ((runtimeChoice || '').trim() && !validRuntimeChoice) {
    console.log(c('yellow', `Invalid choice "${runtimeChoice.trim()}". Defaulting to 1 (${RUNTIMES[runtimeKeys[0]].label}).`));
  }
  const runtimeKey = runtimeKeys[validRuntimeChoice ? parsedRuntimeChoice - 1 : 0];
  const runtime = RUNTIMES[runtimeKey];

  let isGlobal;
  if (installRequest.isGlobal !== null) {
    isGlobal = installRequest.isGlobal;
    console.log('\n' + c('bold', 'Install scope:'));
    console.log(`  ${c('green', 'OK')} Preset via CLI flag: ${isGlobal ? 'Global' : 'Project'}`);
  } else {
    console.log('\n' + c('bold', 'Install scope:'));
    console.log(`  ${c('cyan', '1.')} Global -- available in all your projects`);
    console.log(`  ${c('cyan', '2.')} Project -- just this directory`);
    if (runtime.type === 'guided-mcp') {
      console.log(c('dim', '  Note: Perplexity Desktop connectors still point at specific project paths even when you choose Global scope.'));
    }
    const scopeChoice = await ask(rl, `\n${c('dim', 'Choice [1]: ')}`);
    isGlobal = (scopeChoice || '1').trim() === '1';
  }

  let developerMode;
  if (installRequest.developerMode !== null) {
    developerMode = installRequest.developerMode;
    console.log('\n' + c('bold', 'Mode:'));
    console.log(`  ${c('green', 'OK')} Preset via CLI flag: ${developerMode ? 'Developer mode' : 'Writer mode'}`);
  } else {
    console.log('\n' + c('bold', 'Mode:'));
    console.log(`  ${c('cyan', '1.')} ${c('bold', 'Writer mode')} -- git terminology hidden, friendly errors (default for non-developers)`);
    console.log(`  ${c('cyan', '2.')} ${c('bold', 'Developer mode')} -- full git access, technical output`);
    const modeChoice = await ask(rl, `\n${c('dim', 'Choice [1]: ')}`);
    developerMode = (modeChoice || '1').trim() === '2';
  }

  let profile = installRequest.profile;
  if (installRequest.profileExplicit) {
    console.log('\n' + c('bold', 'Command profile:'));
    console.log(`  ${c('green', 'OK')} Preset via CLI flag: ${profile}`);
  } else {
    const profiles = listSurfaceProfiles();
    const defaultProfileIndex = profiles.findIndex((entry) => entry.profile === DEFAULT_SURFACE_PROFILE);
    const defaultChoice = defaultProfileIndex >= 0 ? defaultProfileIndex + 1 : profiles.length;
    console.log('\n' + c('bold', 'Command profile:'));
    for (const [index, entry] of profiles.entries()) {
      const note = entry.profile === 'writing' ? ' (good for active drafting)' : '';
      console.log(`  ${c('cyan', `${index + 1}.`)} ${entry.profile} -- ${entry.commandCount} commands, ${entry.description}${note}`);
    }
    console.log(c('dim', '  You can change this later with /scr:surface without deleting project data.'));
    const profileChoice = await ask(rl, `\n${c('dim', `Choice [${defaultChoice}]: `)}`);
    const parsedProfileChoice = Number.parseInt((profileChoice || String(defaultChoice)).trim(), 10);
    const validProfileChoice = Number.isInteger(parsedProfileChoice)
      && parsedProfileChoice >= 1
      && parsedProfileChoice <= profiles.length;
    if ((profileChoice || '').trim() && !validProfileChoice) {
      console.log(c('yellow', `Invalid choice "${profileChoice.trim()}". Defaulting to ${defaultChoice} (${DEFAULT_SURFACE_PROFILE}).`));
    }
    profile = profiles[validProfileChoice ? parsedProfileChoice - 1 : defaultChoice - 1].profile;
  }
  rl.close();

  runInstall({
    runtimeKeys: [runtimeKey],
    isGlobal,
    developerMode,
    silent: false,
    detectedRuntimeKeys,
    installMode: 'interactive',
    profile,
    dryRun: installRequest.dryRun,
    json: installRequest.json,
  });
}

function installCommandRuntime(runtime, isGlobal, log, profile = DEFAULT_SURFACE_PROFILE) {
  const commandsDir = isGlobal ? runtime.commands_dir_global : path.resolve(runtime.commands_dir_project);
  const agentsDir = isGlobal ? runtime.agents_dir_global : path.resolve(runtime.agents_dir_project);
  const commandsRoot = path.join(PKG_ROOT, 'commands', 'scr');
  const commandEntries = collectInstallCommandEntries(profile);
  const removedCommandFiles = cleanMirroredFiles(commandsRoot, commandsDir);
  const removedAgentFiles = cleanMirroredFiles(path.join(PKG_ROOT, 'agents'), agentsDir);
  const commandCount = writeProfileCommandFiles(commandsRoot, commandsDir, commandEntries);
  writeSurfaceProfileMarker(commandsDir, profile);
  const agentCount = copyDir(path.join(PKG_ROOT, 'agents'), agentsDir);
  log(`  ${c('green', 'OK')} ${runtime.label}: ${commandCount} command files (${normalizeSurfaceProfile(profile)} profile) -> ${c('dim', commandsDir)}${removedCommandFiles ? c('dim', ` (cleaned ${removedCommandFiles} stale files)`) : ''}`);
  log(`  ${c('green', 'OK')} ${runtime.label}: ${agentCount} agent prompts -> ${c('dim', agentsDir)}${removedAgentFiles ? c('dim', ` (cleaned ${removedAgentFiles} stale files)`) : ''}`);
}

function installClaudeCommandRuntime(runtime, isGlobal, log, profile = DEFAULT_SURFACE_PROFILE) {
  const commandsDir = isGlobal ? runtime.commands_dir_global : path.resolve(runtime.commands_dir_project);
  const agentsDir = isGlobal ? runtime.agents_dir_global : path.resolve(runtime.agents_dir_project);
  const commandsRoot = path.join(PKG_ROOT, 'commands', 'scr');
  const commandEntries = collectInstallCommandEntries(profile);
  const fileNames = commandEntries.map((entry) => commandEntryToFlatCommandFileName(entry));

  fs.mkdirSync(commandsDir, { recursive: true });
  const removedCommandFiles = cleanFlatCommandFiles(commandsDir, fileNames, ['scr']);
  const removedAgentFiles = cleanMirroredFiles(path.join(PKG_ROOT, 'agents'), agentsDir);

  for (const entry of commandEntries) {
    const sourcePath = path.join(commandsRoot, entry.relativePath);
    const sourceContent = fs.readFileSync(sourcePath, 'utf8');
    const fileName = commandEntryToFlatCommandFileName(entry);
    const targetPath = path.join(commandsDir, fileName);
    const sourceWithContract = commandContracts.ensureNextCommandsContract(sourceContent);
    const installedContent = generateClaudeCommandContent(entry, sourceWithContract);
    atomicWriteFileSync(targetPath, installedContent);
  }

  writeInstalledCommandManifest(commandsDir, 'claude-code', fileNames);
  writeSurfaceProfileMarker(commandsDir, profile);
  const agentCount = copyDir(path.join(PKG_ROOT, 'agents'), agentsDir);

  log(`  ${c('green', 'OK')} ${runtime.label}: ${commandEntries.length} /scr-* command files (${normalizeSurfaceProfile(profile)} profile) -> ${c('dim', commandsDir)}${removedCommandFiles ? c('dim', ` (cleaned ${removedCommandFiles} stale items)`) : ''}`);
  log(`  ${c('green', 'OK')} ${runtime.label}: ${agentCount} agent prompts -> ${c('dim', agentsDir)}${removedAgentFiles ? c('dim', ` (cleaned ${removedAgentFiles} stale files)`) : ''}`);
}

function installManifestSkillRuntime(runtime, isGlobal, log, profile = DEFAULT_SURFACE_PROFILE) {
  const skillsDir = isGlobal ? runtime.skills_dir_global : path.resolve(runtime.skills_dir_project);
  const commandsRoot = path.join(PKG_ROOT, 'commands', 'scr');
  const commandEntries = collectInstallCommandEntries(profile);
  const manifest = generateSkillManifest(path.join(PKG_ROOT, 'data', 'CONSTRAINTS.json'), profile);
  fs.mkdirSync(skillsDir, { recursive: true });
  removePathIfExists(path.join(skillsDir, 'SKILL.md'));
  const commandsTarget = path.join(skillsDir, 'commands', 'scr');
  const agentsTarget = path.join(skillsDir, 'agents');
  cleanMirroredFiles(commandsRoot, commandsTarget);
  cleanMirroredFiles(path.join(PKG_ROOT, 'agents'), agentsTarget);
  atomicWriteFileSync(path.join(skillsDir, 'SKILL.md'), manifest);
  const commandCount = writeProfileCommandFiles(commandsRoot, commandsTarget, commandEntries);
  writeSurfaceProfileMarker(skillsDir, profile);
  const agentCount = copyDir(path.join(PKG_ROOT, 'agents'), agentsTarget);
  log(`  ${c('green', 'OK')} ${runtime.label}: SKILL.md manifest -> ${c('dim', path.join(skillsDir, 'SKILL.md'))}`);
  log(`  ${c('green', 'OK')} ${runtime.label}: ${commandCount} command files (${normalizeSurfaceProfile(profile)} profile) -> ${c('dim', commandsTarget)}`);
  log(`  ${c('green', 'OK')} ${runtime.label}: ${agentCount} agent prompts -> ${c('dim', agentsTarget)}`);
}

function installCodexAgentsWithMetadata(agentsDir) {
  const agentEntries = collectAgentEntries(path.join(PKG_ROOT, 'agents'));
  const currentFileNames = agentEntries.flatMap((entry) => [entry.relativePath, entry.metadataFileName]);

  fs.mkdirSync(agentsDir, { recursive: true });
  const removed = cleanCodexAgentFiles(agentsDir, currentFileNames);

  for (const entry of agentEntries) {
    atomicWriteFileSync(path.join(agentsDir, entry.relativePath), entry.content);
    atomicWriteFileSync(path.join(agentsDir, entry.metadataFileName), generateCodexAgentMetadata(entry));
  }
  writeCodexAgentManifest(agentsDir, currentFileNames);

  return {
    agentCount: agentEntries.length,
    metadataCount: agentEntries.length,
    removed,
  };
}

function installCodexRuntime(runtime, isGlobal, log, profile = DEFAULT_SURFACE_PROFILE) {
  const skillsDir = isGlobal ? runtime.skills_dir_global : path.resolve(runtime.skills_dir_project);
  const commandsDir = isGlobal ? runtime.commands_dir_global : path.resolve(runtime.commands_dir_project);
  const agentsDir = isGlobal ? runtime.agents_dir_global : path.resolve(runtime.agents_dir_project);
  const sourceCommandsRoot = path.join(PKG_ROOT, 'commands', 'scr');
  const commandEntries = collectInstallCommandEntries(profile);
  const skillNames = commandEntries.map((entry) => entry.skillName);

  const removedCommandFiles = cleanMirroredFiles(sourceCommandsRoot, commandsDir);
  fs.mkdirSync(skillsDir, { recursive: true });
  const removedSkillDirs = cleanCodexSkillDirs(skillsDir, skillNames);

  // NOTE: `collectCommandEntries` returns .md files only, and the authoritative
  // `commands/scr/**` tree is .md-only today. No non-.md assets need mirroring.
  // Rewrite each command file individually for the Codex invocation surface
  // ($scr-*) using atomicWriteFileSync (Phase 23). Re-reading the pristine
  // source on every run means the install marker is inserted once against
  // clean content -- not on top of a previously-marked installed file -- so
  // re-runs are idempotent (single marker, current prose rewrite).
  let commandCount = 0;
  commandCount = writeProfileCommandFiles(sourceCommandsRoot, commandsDir, commandEntries, generateCodexCommandContent);
  writeSurfaceProfileMarker(commandsDir, profile);

  const agentInstall = installCodexAgentsWithMetadata(agentsDir);

  for (const entry of commandEntries) {
    const skillDir = path.join(skillsDir, entry.skillName);
    fs.mkdirSync(skillDir, { recursive: true });
    const commandPath = path.join(commandsDir, entry.relativePath);
    atomicWriteFileSync(path.join(skillDir, 'SKILL.md'), generateCodexSkill(entry, commandPath));
  }
  writeCodexSkillManifest(skillsDir, skillNames);
  writeSurfaceProfileMarker(skillsDir, profile);

  log(`  ${c('green', 'OK')} ${runtime.label}: ${commandEntries.length} \$scr-* skills (${normalizeSurfaceProfile(profile)} profile) -> ${c('dim', skillsDir)}${removedSkillDirs ? c('dim', ` (cleaned ${removedSkillDirs} stale dirs)`) : ''}`);
  log(`  ${c('green', 'OK')} ${runtime.label}: ${commandCount} command files -> ${c('dim', commandsDir)}${removedCommandFiles ? c('dim', ` (cleaned ${removedCommandFiles} stale files)`) : ''}`);
  log(`  ${c('green', 'OK')} ${runtime.label}: ${agentInstall.agentCount} agent prompts + ${agentInstall.metadataCount} metadata files -> ${c('dim', agentsDir)}${agentInstall.removed ? c('dim', ` (cleaned ${agentInstall.removed} stale files)`) : ''}`);
}

function installGuidedRuntime(runtime, isGlobal, dataDir, log, profile = DEFAULT_SURFACE_PROFILE) {
  const guideDir = isGlobal ? runtime.guide_dir_global : path.resolve(runtime.guide_dir_project);
  const currentProjectDir = path.resolve('.');
  const setupGuide = generatePerplexitySetupGuide({
    isGlobal,
    guideDir,
    dataDir,
    currentProjectDir,
  });
  const connectorCommand = isGlobal
    ? buildFilesystemMcpCommand(['/absolute/path/to/project', dataDir])
    : buildFilesystemMcpCommand([currentProjectDir, dataDir]);
  const currentProjectCommand = buildFilesystemMcpCommand([currentProjectDir, dataDir]);

  removePathIfExists(guideDir);
  fs.mkdirSync(guideDir, { recursive: true });
  atomicWriteFileSync(path.join(guideDir, 'SETUP.md'), setupGuide);
  atomicWriteFileSync(path.join(guideDir, 'connector-command.txt'), connectorCommand + '\n');
  atomicWriteFileSync(path.join(guideDir, 'connector-command.current-project.txt'), currentProjectCommand + '\n');
  writeSurfaceProfileMarker(guideDir, profile);

  log(`  ${c('green', 'OK')} ${runtime.label}: setup guide -> ${c('dim', path.join(guideDir, 'SETUP.md'))}`);
  log(`  ${c('green', 'OK')} ${runtime.label}: connector recipe -> ${c('dim', path.join(guideDir, 'connector-command.txt'))}`);
}

function writeSharedAssets(dataDir, runtimeKeys, isGlobal, developerMode, installMode, log, profile = DEFAULT_SURFACE_PROFILE) {
  fs.mkdirSync(path.join(dataDir, 'templates'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'docs'), { recursive: true });
  const templateResult = copyDirWithPreservation(path.join(PKG_ROOT, 'templates'), path.join(dataDir, 'templates'));
  const dataResult = copyDirWithPreservation(path.join(PKG_ROOT, 'data'), path.join(dataDir, 'data'));
  const libResult = copyDirWithPreservation(path.join(PKG_ROOT, 'lib'), path.join(dataDir, 'lib'));
  const docsResult = copyDirWithPreservation(path.join(PKG_ROOT, 'docs'), path.join(dataDir, 'docs'));
  const sum = (r) => r.fresh + r.replaced + r.backedUp;
  log(`  ${c('green', 'OK')} ${sum(templateResult)} templates + ${sum(dataResult)} data files + ${sum(libResult)} lib files + ${sum(docsResult)} docs -> ${c('dim', dataDir)}`);
  const totalBackedUp = templateResult.backedUp + dataResult.backedUp + libResult.backedUp + docsResult.backedUp;
  if (totalBackedUp > 0) {
    log(`  ${c('yellow', 'i')} Preserved ${totalBackedUp} user-modified file(s) as .backup.<timestamp>`);
  }

  const settingsPath = path.join(dataDir, 'settings.json');
  // M-04: run migrate + validate on the existing file before merging so
  // hand-edited / schema-invalid / stale-format settings do not silently
  // propagate user-owned junk across installs. On invalid, back up the file
  // to `settings.json.invalid.<timestamp>` and fall back to a clean merge
  // (i.e. drop the unusable existing).
  const rawExistingSettings = readJsonIfExists(settingsPath);
  let existingSettings = null;
  if (rawExistingSettings !== null) {
    const migrated = migrateSettings(rawExistingSettings);
    const validation = validateSettings(migrated);
    if (validation.valid) {
      existingSettings = migrated;
    } else {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const invalidPath = `${settingsPath}.invalid.${ts}`;
      try {
        fs.renameSync(settingsPath, invalidPath);
        log(`  ${c('yellow', 'i')} Existing settings.json was invalid; preserved as ${c('dim', invalidPath)}`);
      } catch {
        // If rename fails, we still proceed with a fresh merge below.
      }
      existingSettings = null;
    }
  }
  const incomingSettings = {
    version: VERSION,
    runtime: runtimeKeys[0],
    runtimes: runtimeKeys,
    scope: isGlobal ? 'global' : 'project',
    developer_mode: developerMode,
    data_dir: dataDir,
    install_mode: installMode,
    profile: normalizeSurfaceProfile(profile),
    installed_at: new Date().toISOString(),
  };
  const mergedSettings = mergeSettings(existingSettings, incomingSettings);
  atomicWriteFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
  log(`  ${c('green', 'OK')} settings.json -> ${c('dim', settingsPath)}`);
}

function printNextSteps(runtimeKeys) {
  console.log('\n' + c('bold', 'Next steps:'));
  let step = 1;
  if (runtimeKeys.includes('codex')) {
    console.log(`  ${c('cyan', `${step}.`)} In Codex, run ${c('bold', '$scr-help')} to see available commands`);
    step++;
    console.log(`  ${c('cyan', `${step}.`)} Start with ${c('bold', '$scr-new-work')} or ${c('bold', '$scr-demo')}`);
    step++;
  }
  if (runtimeKeys.includes('claude-code')) {
    console.log(`  ${c('cyan', `${step}.`)} In Claude Code, run ${c('bold', '/scr-help')}`);
    step++;
  }
  if (runtimeKeys.some((key) => key !== 'codex' && key !== 'claude-code' && RUNTIMES[key].type !== 'guided-mcp')) {
    console.log(`  ${c('cyan', `${step}.`)} In another command-directory runtime, run ${c('bold', '/scr:help')}`);
    step++;
  }
  if (runtimeKeys.includes('perplexity-desktop')) {
    console.log(`  ${c('cyan', `${step}.`)} Open the generated Perplexity Desktop setup guide and add the connector recipe`);
  }
  console.log('\n' + c('dim', `Docs: ${DOCS_URL}\n`));
}

function collectTargetDirsForSweep(runtimeKeys, isGlobal, dataDir) {
  const dirs = new Set([dataDir]);
  for (const runtimeKey of runtimeKeys) {
    const runtime = RUNTIMES[runtimeKey];
    if (!runtime) continue;
    const resolve = (g, p) => isGlobal ? g : (p ? path.resolve(p) : null);
    if (runtime.commands_dir_global || runtime.commands_dir_project) {
      const d = resolve(runtime.commands_dir_global, runtime.commands_dir_project);
      if (d) dirs.add(d);
    }
    if (runtime.skills_dir_global || runtime.skills_dir_project) {
      const d = resolve(runtime.skills_dir_global, runtime.skills_dir_project);
      if (d) dirs.add(d);
    }
    if (runtime.agents_dir_global || runtime.agents_dir_project) {
      const d = resolve(runtime.agents_dir_global, runtime.agents_dir_project);
      if (d) dirs.add(d);
    }
    if (runtime.guide_dir_global || runtime.guide_dir_project) {
      const d = resolve(runtime.guide_dir_global, runtime.guide_dir_project);
      if (d) dirs.add(d);
    }
  }
  return Array.from(dirs);
}

function runtimeInstallTargets(runtimeKey, runtime, isGlobal) {
  const resolve = (globalPath, projectPath) => isGlobal ? globalPath : (projectPath ? path.resolve(projectPath) : null);
  return {
    runtime: runtimeKey,
    label: runtime.label,
    type: runtime.type,
    commandsDir: resolve(runtime.commands_dir_global, runtime.commands_dir_project),
    skillsDir: resolve(runtime.skills_dir_global, runtime.skills_dir_project),
    agentsDir: resolve(runtime.agents_dir_global, runtime.agents_dir_project),
    guideDir: resolve(runtime.guide_dir_global, runtime.guide_dir_project),
  };
}

function buildInstallDryRun({ runtimeKeys, isGlobal, developerMode, installMode, profile = DEFAULT_SURFACE_PROFILE }) {
  const resolvedProfile = normalizeSurfaceProfile(profile);
  const dataDir = isGlobal ? path.join(os.homedir(), '.scriveno') : path.resolve('.scriveno');
  const commandEntries = collectInstallCommandEntries(resolvedProfile);
  const profileSummary = surfaceProfileSummary(resolvedProfile);
  const agentCount = collectAgentEntries(path.join(PKG_ROOT, 'agents')).length;
  const sharedAssets = {
    templates: listRelativeFiles(path.join(PKG_ROOT, 'templates')).length,
    data: listRelativeFiles(path.join(PKG_ROOT, 'data')).length,
    lib: listRelativeFiles(path.join(PKG_ROOT, 'lib')).length,
    docs: listRelativeFiles(path.join(PKG_ROOT, 'docs')).length,
  };

  return {
    version: VERSION,
    profile: resolvedProfile,
    profileLabel: profileSummary.label,
    profileDescription: profileSummary.description,
    registeredCommands: profileSummary.commandCount,
    commandFiles: commandEntries.length,
    agentPrompts: agentCount,
    scope: isGlobal ? 'global' : 'project',
    mode: developerMode ? 'developer' : 'writer',
    installMode,
    dataDir,
    sharedAssets,
    targets: runtimeKeys.map((runtimeKey) => {
      const runtime = RUNTIMES[runtimeKey];
      if (!runtime) throw new Error(`Unknown runtime "${runtimeKey}"`);
      return runtimeInstallTargets(runtimeKey, runtime, isGlobal);
    }),
    writes: false,
  };
}

function formatInstallDryRunReport(plan) {
  const lines = [
    'Scriveno install dry run',
    `Version: ${plan.version}`,
    `Profile: ${plan.profile} (${plan.profileLabel})`,
    `Scope: ${plan.scope}`,
    `Mode: ${plan.mode}`,
    `Command files selected: ${plan.commandFiles}`,
    `Registered command entries selected: ${plan.registeredCommands}`,
    `Agent prompts selected: ${plan.agentPrompts}`,
    `Shared assets: ${plan.sharedAssets.templates} templates, ${plan.sharedAssets.data} data files, ${plan.sharedAssets.lib} lib files, ${plan.sharedAssets.docs} docs`,
    `Data directory: ${plan.dataDir}`,
    '',
    'Runtime targets:',
  ];
  for (const target of plan.targets) {
    lines.push(`- ${target.label} (${target.runtime})`);
    if (target.commandsDir) lines.push(`  commands: ${target.commandsDir}`);
    if (target.skillsDir) lines.push(`  skills: ${target.skillsDir}`);
    if (target.agentsDir) lines.push(`  agents: ${target.agentsDir}`);
    if (target.guideDir) lines.push(`  guide: ${target.guideDir}`);
  }
  lines.push('');
  lines.push('No files were written.');
  return lines.join('\n');
}

function runInstall({ runtimeKeys, isGlobal, developerMode, silent, installMode, profile = DEFAULT_SURFACE_PROFILE, dryRun = false, json = false }) {
  const resolvedProfile = normalizeSurfaceProfile(profile);
  const dataDir = isGlobal ? path.join(os.homedir(), '.scriveno') : path.resolve('.scriveno');
  const log = (silent || json || dryRun) ? () => {} : (message) => console.log(message);

  if (!runtimeKeys.length) {
    throw new Error('No runtimes selected for installation');
  }

  if (dryRun) {
    const plan = buildInstallDryRun({
      runtimeKeys,
      isGlobal,
      developerMode,
      installMode,
      profile: resolvedProfile,
    });
    console.log(json ? JSON.stringify(plan, null, 2) : formatInstallDryRunReport(plan));
    return plan;
  }

  let totalOrphansRemoved = 0;
  for (const dir of collectTargetDirsForSweep(runtimeKeys, isGlobal, dataDir)) {
    totalOrphansRemoved += cleanOrphanedTempFiles(dir);
  }
  if (totalOrphansRemoved > 0) {
    log(c('dim', `  Cleaned ${totalOrphansRemoved} orphaned temp file(s) from prior interrupted install`));
  }

  if (!silent && !json) {
    console.log('\n' + c('bold', 'Installing...'));
  }

  for (const runtimeKey of runtimeKeys) {
    const runtime = RUNTIMES[runtimeKey];
    if (!runtime) {
      throw new Error(`Unknown runtime "${runtimeKey}"`);
    }
    if (runtimeKey === 'codex') {
      installCodexRuntime(runtime, isGlobal, log, resolvedProfile);
    } else if (runtime.command_layout === 'flat-prefixed') {
      installClaudeCommandRuntime(runtime, isGlobal, log, resolvedProfile);
    } else if (runtime.type === 'skills') {
      installManifestSkillRuntime(runtime, isGlobal, log, resolvedProfile);
    } else if (runtime.type === 'guided-mcp') {
      installGuidedRuntime(runtime, isGlobal, dataDir, log, resolvedProfile);
    } else {
      installCommandRuntime(runtime, isGlobal, log, resolvedProfile);
    }
  }

  writeSharedAssets(dataDir, runtimeKeys, isGlobal, developerMode, installMode, log, resolvedProfile);

  const summary = {
    version: VERSION,
    runtimes: runtimeKeys,
    scope: isGlobal ? 'global' : 'project',
    mode: developerMode ? 'developer' : 'writer',
    profile: resolvedProfile,
    dataDir,
  };

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  if (silent) {
    console.log(`Installed Scriveno ${VERSION} to ${runtimeKeys.join(', ')} (${isGlobal ? 'global' : 'project'}, ${developerMode ? 'developer' : 'writer'} mode, ${resolvedProfile} profile).`);
    return summary;
  }

  console.log('\n' + c('bold', c('green', 'Installation complete!')));
  printNextSteps(runtimeKeys);
  return summary;
}

// Only run interactive installer when executed directly
if (require.main === module) {
  requireSupportedNode();
  main().catch((err) => {
    console.error(c('red', '\nInstallation failed:'), err.message);
    process.exit(1);
  });
}

module.exports = {
  copyDir,
  RUNTIMES,
  SURFACE_PROFILES,
  DEFAULT_SURFACE_PROFILE,
  parseArgs,
  resolveInstallRequest,
  runInstall,
  runStatus,
  runSyncCheck,
  runRuntimeSmoke,
  runAgentAvailability,
  runRouteAudit,
  collectCommandEntries,
  collectCommandEntriesForProfile,
  collectInstallCommandEntries,
  collectAgentEntries,
  assertNoSkillNameCollisions,
  cleanCodexSkillDirs,
  cleanCodexAgentFiles,
  commandRefToCodexSkillName,
  commandRefToClaudeInvocation,
  commandRefToCodexInvocation,
  commandEntryToFlatCommandFileName,
  generateClaudeCommandContent,
  generateCodexCommandContent,
  generateCodexAgentMetadata,
  rewriteInstalledCommandRefs,
  installCommandRuntime,
  installClaudeCommandRuntime,
  installManifestSkillRuntime,
  installCodexRuntime,
  installCodexAgentsWithMetadata,
  runSurface,
  cleanFlatCommandFiles,
  generateCodexSkill,
  generateSkillManifest,
  normalizeSurfaceProfile,
  resolveProfileCommandKeys,
  surfaceProfileSummary,
  listSurfaceProfiles,
  buildInstallDryRun,
  formatInstallDryRunReport,
  buildFilesystemMcpCommand,
  generatePerplexitySetupGuide,
  commandContracts,
  atomicWriteFileSync,
  cleanOrphanedTempFiles,
  collectTargetDirsForSweep,
  readFrontmatterValue,
  readFrontmatterValues,
  SETTINGS_SCHEMA,
  validateSettings,
  migrateSettings,
  readSettings,
  readJsonIfExists,
  sha256File,
  copyDirWithPreservation,
  mergeSettings,
  INSTALLER_OWNED_FIELDS,
  writeSharedAssets,
  // Phase 29 v1.7 -- architectural profiles (tradition / platform)
  listTraditions: architecturalProfiles.listTraditions,
  listPlatforms: architecturalProfiles.listPlatforms,
  validateTradition: architecturalProfiles.validateTradition,
  validatePlatform: architecturalProfiles.validatePlatform,
  inferTradition: architecturalProfiles.inferTradition,
  inferPlatform: architecturalProfiles.inferPlatform,
  // Per-work-type pitfall packs
  listPitfallPacks: architecturalProfiles.listPitfallPacks,
  getPitfallPackPath: architecturalProfiles.getPitfallPackPath,
  // Shared proactive status engine
  autoInvokeEngine,
  analyzeProject: autoInvokeEngine.analyzeProject,
  formatAutoInvokeReport: autoInvokeEngine.formatReport,
  getRuntimeAgentSupport: autoInvokeEngine.getRuntimeAgentSupport,
  listRuntimeAgentSupport: autoInvokeEngine.listRuntimeAgentSupport,
};
