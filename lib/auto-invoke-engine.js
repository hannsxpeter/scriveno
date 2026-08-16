const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_MODEL_POLICY = 'host-owned model; Scriveno supplies prompts, context boundaries, fallback behavior, and merge rules';
const MODEL_ADAPTATION_DOCS = [
  'docs/model-adaptation.md',
  'docs/subagent-spawning-protocol.md',
  'docs/drafter-quality.md',
];

const DEFAULT_RUNTIME_SUPPORT = {
  'claude-code': {
    label: 'Claude Code',
    surface: 'flat commands plus agent prompts',
    nativeSpawn: 'host-supported when Claude Code exposes agents',
    fallback: 'load prompt from .claude/agents',
    metadata: 'none',
  },
  codex: {
    label: 'Codex',
    surface: 'skills, command mirrors, agent prompts, and metadata',
    nativeSpawn: 'host-supported when Codex exposes agent roles',
    fallback: 'load prompt from .codex/agents',
    metadata: 'toml',
  },
  cursor: {
    label: 'Cursor',
    surface: 'nested commands plus agent prompts',
    nativeSpawn: 'host-supported when Cursor exposes agents',
    fallback: 'load prompt from .cursor/agents',
    metadata: 'none',
  },
  'gemini-cli': {
    label: 'Gemini CLI',
    surface: 'nested commands plus agent prompts',
    nativeSpawn: 'host-supported when Gemini CLI exposes agents',
    fallback: 'load prompt from .gemini/agents',
    metadata: 'none',
  },
  opencode: {
    label: 'OpenCode',
    surface: 'nested commands plus agent prompts',
    nativeSpawn: 'host-supported when OpenCode exposes agents',
    fallback: 'load prompt from .config/opencode/agents',
    metadata: 'none',
  },
  copilot: {
    label: 'GitHub Copilot',
    surface: 'nested commands plus agent prompts',
    nativeSpawn: 'host-supported when Copilot exposes agents',
    fallback: 'load prompt from .github/agents',
    metadata: 'none',
  },
  windsurf: {
    label: 'Windsurf',
    surface: 'nested commands plus agent prompts',
    nativeSpawn: 'host-supported when Windsurf exposes agents',
    fallback: 'load prompt from .windsurf/agents',
    metadata: 'none',
  },
  antigravity: {
    label: 'Antigravity',
    surface: 'nested commands plus agent prompts',
    nativeSpawn: 'host-supported when Antigravity exposes agents',
    fallback: 'load prompt from .gemini/antigravity/agents',
    metadata: 'none',
  },
  manus: {
    label: 'Manus Desktop',
    surface: 'bundled skill, mirrored commands, and agent prompts',
    nativeSpawn: 'host-supported when Manus exposes skill agents',
    fallback: 'load prompt from bundled agents directory',
    metadata: 'none',
  },
  'perplexity-desktop': {
    label: 'Perplexity Desktop',
    surface: 'guided local MCP setup',
    nativeSpawn: 'not assumed',
    fallback: 'read project files through the filesystem connector',
    metadata: 'none',
  },
  generic: {
    label: 'Generic (SKILL.md)',
    surface: 'bundled skill, mirrored commands, and agent prompts',
    nativeSpawn: 'not assumed',
    fallback: 'load prompt from bundled agents directory',
    metadata: 'none',
  },
};

const REVIEW_KEYWORDS = [
  'TODO',
  'FIXME',
  'UNRESOLVED',
  'NEEDS REVISION',
  'QUESTION: Blocking',
  'VOICE DRIFT',
  'CONTINUITY',
];
const OPEN_REVIEW_KEYWORDS = REVIEW_KEYWORDS.filter((keyword) => keyword !== 'CONTINUITY');

const CORE_PROJECT_FILES = [
  'WORK.md',
  'OUTLINE.md',
  'STYLE-GUIDE.md',
  'RECORD.md',
  'config.json',
];

const DEFAULT_AGENT_NAMES = [
  'continuity-checker',
  'drafter',
  'plan-checker',
  'researcher',
  'translator',
  'voice-checker',
];

const ROUTE_PRIORITY_FIXTURES = [
  {
    name: 'empty workspace',
    setup: 'no .manuscript directory',
    expectedCommand: '/scr:new-work',
    reason: 'start or import before lifecycle routing',
  },
  {
    name: 'scanned project without drafts',
    setup: 'STATE.md and CONTEXT.md exist, drafts are absent',
    expectedCommand: '/scr:plan',
    reason: 'planning comes before drafting when no plan is ready',
  },
  {
    name: 'planned work without draft',
    setup: 'plan files exist and drafts are absent',
    expectedCommand: '/scr:draft',
    reason: 'connected plan evidence should route to drafting',
  },
  {
    name: 'draft without review coverage',
    setup: 'draft files exist and reviews are absent',
    expectedCommand: '/scr:editor-review',
    reason: 'review should precede export and packaging',
  },
  {
    name: 'revision proposal waiting',
    setup: 'proposal files exist in .manuscript/proposals',
    expectedCommand: '/scr:editor-review --proposal',
    reason: 'proposal review is more urgent than general notes',
  },
  {
    name: 'translation follow-up',
    setup: 'translation folders or target languages exist after review coverage',
    expectedCommand: '/scr:back-translate',
    reason: 'translation needs verification before multi-publish',
  },
  {
    name: 'publishing prerequisite gap',
    setup: 'reviewed drafts exist without front matter, back matter, blurb, or cover handoff',
    expectedCommand: '/scr:front-matter',
    reason: 'specific packaging prerequisites come before final publish',
  },
  {
    name: 'publication-ready editorial gate',
    setup: 'reviewed drafts and publishing prerequisites exist but no prepublish report exists',
    expectedCommand: '/scr:prepublish-review',
    reason: 'final editorial go/no-go should precede export packaging',
  },
];

const RUNTIME_INSTALL_SURFACES = {
  'claude-code': {
    commands: (homeDir) => path.join(homeDir, '.claude', 'commands'),
    agents: (homeDir) => path.join(homeDir, '.claude', 'agents'),
    commandLayout: 'flat',
  },
  cursor: {
    commands: (homeDir) => path.join(homeDir, '.cursor', 'commands', 'scr'),
    agents: (homeDir) => path.join(homeDir, '.cursor', 'agents'),
    commandLayout: 'nested',
  },
  'gemini-cli': {
    commands: (homeDir) => path.join(homeDir, '.gemini', 'commands', 'scr'),
    agents: (homeDir) => path.join(homeDir, '.gemini', 'agents'),
    commandLayout: 'nested',
  },
  codex: {
    commands: (homeDir) => path.join(homeDir, '.codex', 'commands', 'scr'),
    skills: (homeDir) => path.join(homeDir, '.codex', 'skills'),
    agents: (homeDir) => path.join(homeDir, '.codex', 'agents'),
    commandLayout: 'nested',
    metadata: 'toml',
  },
  opencode: {
    commands: (homeDir) => path.join(homeDir, '.config', 'opencode', 'commands', 'scr'),
    agents: (homeDir) => path.join(homeDir, '.config', 'opencode', 'agents'),
    commandLayout: 'nested',
  },
  copilot: {
    commands: (homeDir) => path.join(homeDir, '.github', 'commands', 'scr'),
    agents: (homeDir) => path.join(homeDir, '.github', 'agents'),
    commandLayout: 'nested',
  },
  windsurf: {
    commands: (homeDir) => path.join(homeDir, '.windsurf', 'commands', 'scr'),
    agents: (homeDir) => path.join(homeDir, '.windsurf', 'agents'),
    commandLayout: 'nested',
  },
  antigravity: {
    commands: (homeDir) => path.join(homeDir, '.gemini', 'antigravity', 'commands', 'scr'),
    agents: (homeDir) => path.join(homeDir, '.gemini', 'antigravity', 'agents'),
    commandLayout: 'nested',
  },
  manus: {
    skills: (homeDir) => path.join(homeDir, '.manus', 'skills', 'scriveno'),
    agents: (homeDir) => path.join(homeDir, '.manus', 'skills', 'scriveno', 'agents'),
    commandLayout: 'skill-bundle',
  },
  'perplexity-desktop': {
    guide: (homeDir) => path.join(homeDir, '.scriveno', 'perplexity'),
    commandLayout: 'guided-mcp',
  },
  generic: {
    skills: (homeDir) => path.join(homeDir, '.scriveno', 'skills'),
    agents: (homeDir) => path.join(homeDir, '.scriveno', 'skills', 'agents'),
    commandLayout: 'skill-bundle',
  },
};

const PROJECT_RUNTIME_INSTALL_SURFACES = {
  'claude-code': {
    commands: (projectRoot) => path.join(projectRoot, '.claude', 'commands'),
    agents: (projectRoot) => path.join(projectRoot, '.claude', 'agents'),
    commandLayout: 'flat',
  },
  cursor: {
    commands: (projectRoot) => path.join(projectRoot, '.cursor', 'commands', 'scr'),
    agents: (projectRoot) => path.join(projectRoot, '.cursor', 'agents'),
    commandLayout: 'nested',
  },
  'gemini-cli': {
    commands: (projectRoot) => path.join(projectRoot, '.gemini', 'commands', 'scr'),
    agents: (projectRoot) => path.join(projectRoot, '.gemini', 'agents'),
    commandLayout: 'nested',
  },
  codex: {
    commands: (projectRoot) => path.join(projectRoot, '.codex', 'commands', 'scr'),
    skills: (projectRoot) => path.join(projectRoot, '.codex', 'skills'),
    agents: (projectRoot) => path.join(projectRoot, '.codex', 'agents'),
    commandLayout: 'nested',
    metadata: 'toml',
  },
  opencode: {
    commands: (projectRoot) => path.join(projectRoot, '.config', 'opencode', 'commands', 'scr'),
    agents: (projectRoot) => path.join(projectRoot, '.config', 'opencode', 'agents'),
    commandLayout: 'nested',
  },
  copilot: {
    commands: (projectRoot) => path.join(projectRoot, '.github', 'commands', 'scr'),
    agents: (projectRoot) => path.join(projectRoot, '.github', 'agents'),
    commandLayout: 'nested',
  },
  windsurf: {
    commands: (projectRoot) => path.join(projectRoot, '.windsurf', 'commands', 'scr'),
    agents: (projectRoot) => path.join(projectRoot, '.windsurf', 'agents'),
    commandLayout: 'nested',
  },
  antigravity: {
    commands: (projectRoot) => path.join(projectRoot, '.gemini', 'antigravity', 'commands', 'scr'),
    agents: (projectRoot) => path.join(projectRoot, '.gemini', 'antigravity', 'agents'),
    commandLayout: 'nested',
  },
  manus: {
    skills: (projectRoot) => path.join(projectRoot, '.manus', 'skills', 'scriveno'),
    agents: (projectRoot) => path.join(projectRoot, '.manus', 'skills', 'scriveno', 'agents'),
    commandLayout: 'skill-bundle',
  },
  'perplexity-desktop': {
    guide: (projectRoot) => path.join(projectRoot, '.scriveno', 'perplexity'),
    commandLayout: 'guided-mcp',
  },
  generic: {
    skills: (projectRoot) => path.join(projectRoot, '.scriveno', 'skills'),
    agents: (projectRoot) => path.join(projectRoot, '.scriveno', 'skills', 'agents'),
    commandLayout: 'skill-bundle',
  },
};

const AGENT_ROUTE_POLICIES = {
  '/scr:plan': {
    agents: ['plan-checker'],
    reason: 'planning can validate unit plans before drafting',
  },
  '/scr:draft': {
    agents: ['drafter', 'voice-checker'],
    reason: 'drafting uses fresh-context prose generation and voice checks',
  },
  '/scr:editor-review': {
    agents: ['diagnostic worker'],
    reason: 'editor review can isolate flagged issue groups',
  },
  '/scr:research': {
    agents: ['researcher'],
    reason: 'research can fan out source-grounded angles before merging advisory notes',
  },
  '/scr:voice-check': {
    agents: ['voice-checker'],
    reason: 'voice review compares drafts against STYLE-GUIDE.md',
  },
  '/scr:continuity-check': {
    agents: ['continuity-checker'],
    reason: 'continuity review checks contradictions and timeline drift',
  },
  '/scr:translate': {
    agents: ['translator'],
    reason: 'translation runs one fresh-context translation pass per unit',
  },
  '/scr:back-translate': {
    agents: ['translator'],
    reason: 'back-translation verifies target-language drift',
  },
  '/scr:beta-reader': {
    agents: ['beta-reader worker'],
    reason: 'beta review benefits from isolated reader perspectives',
  },
  '/scr:quick-write': {
    agents: ['drafter', 'voice-checker'],
    reason: 'quick writing still benefits from voice-aware isolation',
  },
  '/scr:map-manuscript': {
    agents: ['voice analyst', 'structure analyst', 'character analyst', 'theme analyst', 'world analyst', 'pacing analyst'],
    reason: 'manuscript import uses parallel analysis workers when available',
  },
};

const LOCAL_ROUTE_POLICIES = {
  '/scr:save': 'refresh CONTEXT.md, HISTORY.log, and project checkpoint state',
  '/scr:scan': 'reconcile STATE.md and disk evidence',
  '/scr:health': 'diagnose project and runtime health',
  '/scr:sync': 'compare and refresh installed runtime surfaces',
  '/scr:validate': 'run project validation checks',
  '/scr:check-notes': 'surface unresolved writer notes',
  '/scr:progress': 'compute read-only project progress',
  '/scr:session-report': 'compute read-only session metrics',
};

const MANUAL_ROUTE_POLICIES = {
  '/scr:prepublish-review': 'final editorial go/no-go is a writer-owned publishing decision',
  '/scr:publish': 'publication packaging can overwrite deliverables and needs writer choices',
  '/scr:export': 'export writes output artifacts and may overwrite packages',
  '/scr:track merge': 'merging revision tracks is a writer-owned decision',
  '/scr:undo': 'undo changes state and should stay explicit',
};

const CATEGORY_ROUTE_POLICIES = {
  core: { lane: 'mixed', level: 3, reason: 'core lifecycle routes may read, write, or spawn depending on the current stage' },
  navigation: { lane: 'read-only', level: 1, reason: 'navigation routes should inspect and recommend by default' },
  quality: { lane: 'agent-or-local', level: 3, reason: 'quality routes may run bounded diagnostics or text transforms' },
  character_world: { lane: 'local-helper', level: 2, reason: 'character and world routes update project knowledge files' },
  structure: { lane: 'local-helper', level: 2, reason: 'structure routes update maps, outlines, and state evidence' },
  structure_management: { lane: 'manual-gated', level: 4, reason: 'structure management can rename, remove, or reorder manuscript units' },
  review: { lane: 'agent-or-local', level: 3, reason: 'review routes may invoke bounded diagnostic workers' },
  illustration: { lane: 'local-helper', level: 2, reason: 'illustration routes generate prompts and asset briefs' },
  publishing: { lane: 'manual-gated', level: 4, reason: 'publishing routes write deliverables and package outputs' },
  translation: { lane: 'agent-or-local', level: 3, reason: 'translation routes use translator agents or verification helpers' },
  sacred_exclusive: { lane: 'agent-or-local', level: 3, reason: 'sacred routes perform specialized consistency and reference work' },
  utility: { lane: 'local-helper', level: 2, reason: 'utility routes perform deterministic diagnostics or project updates' },
  session: { lane: 'local-helper', level: 2, reason: 'session routes save, compare, resume, or report project state' },
  collaboration: { lane: 'manual-gated', level: 4, reason: 'collaboration routes change revision tracks and require writer control' },
};

function normalizeCommandRef(commandName) {
  if (commandName.startsWith('/scr:')) return commandName;
  return `/scr:${commandName}`;
}

function baseCommandRef(commandName) {
  return normalizeCommandRef(String(commandName).trim()).split(/\s+/)[0];
}

function commandWithUnit(commandRef, unit) {
  if (!unit) return commandRef;
  if (/\s+\S+/.test(commandRef)) return commandRef;
  return `${commandRef} ${unit}`;
}

function getCommandAutomationPolicy(commandName, command = {}) {
  const ref = baseCommandRef(commandName);
  if (AGENT_ROUTE_POLICIES[ref]) {
    return { ref, lane: 'agent-ready', level: 3, reason: AGENT_ROUTE_POLICIES[ref].reason };
  }
  if (LOCAL_ROUTE_POLICIES[ref]) {
    return { ref, lane: 'local-helper', level: 2, reason: LOCAL_ROUTE_POLICIES[ref] };
  }
  if (MANUAL_ROUTE_POLICIES[ref]) {
    return { ref, lane: 'manual-gated', level: 4, reason: MANUAL_ROUTE_POLICIES[ref] };
  }
  const categoryPolicy = CATEGORY_ROUTE_POLICIES[command.category] || {
    lane: 'read-only',
    level: 1,
    reason: 'unclassified routes should only suggest until a category policy is added',
  };
  return { ref, ...categoryPolicy };
}

function pathExists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    throw err;
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    if (err instanceof SyntaxError) return null;
    throw err;
  }
}

function listFiles(dir, options = {}) {
  const { extensions = null, recursive = true } = options;
  if (!pathExists(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) out.push(...listFiles(fullPath, options));
    } else if (!extensions || extensions.includes(path.extname(entry.name))) {
      out.push(fullPath);
    }
  }
  return out;
}

function newestMtime(files) {
  let newest = 0;
  for (const file of files) {
    const stat = safeStat(file);
    if (stat && stat.mtimeMs > newest) newest = stat.mtimeMs;
  }
  return newest;
}

function countMarkdownFiles(dir) {
  return listFiles(dir, { extensions: ['.md'], recursive: true }).length;
}

function countFiles(dir, extensions = null) {
  return listFiles(dir, { extensions, recursive: true }).length;
}

function anyPathExists(paths) {
  return paths.some(pathExists);
}

function containsAny(text, keywords) {
  const haystack = text.toUpperCase();
  return keywords.some((keyword) => haystack.includes(keyword.toUpperCase()));
}

function detectProjectReadiness(manuscriptDir) {
  const missing = CORE_PROJECT_FILES.filter((file) => !pathExists(path.join(manuscriptDir, file)));
  return {
    state: missing.length ? 'incomplete' : 'ready',
    missing,
    suggest: missing.length ? '/scr:scan' : null,
  };
}

function detectPlanSignal(manuscriptDir, draftFiles) {
  const planned = ledgerUnitNumbers(path.join(manuscriptDir, 'plans'), /^(\d+)\D.*PLAN\.md$/i);
  for (const unit of ledgerUnitNumbers(manuscriptDir, /^(\d+)\D.*PLAN\.md$/i)) {
    planned.add(unit);
  }
  const drafted = new Set(
    draftFiles
      .map((file) => path.basename(file).match(/^(\d+)\D.*DRAFT\.md$/i))
      .filter(Boolean)
      .map((match) => parseInt(match[1], 10))
  );
  const undraftedUnits = [...planned].filter((unit) => !drafted.has(unit)).sort((a, b) => a - b);
  if (planned.size === 0) {
    return { state: 'missing', count: 0, suggest: '/scr:plan' };
  }
  if (drafted.size === 0) {
    const nextUnit = undraftedUnits[0] || null;
    return { state: 'ready-to-draft', count: planned.size, undraftedUnits, nextUnit, suggest: commandWithUnit('/scr:draft', nextUnit) };
  }
  if (undraftedUnits.length > 0) {
    const nextUnit = undraftedUnits[0];
    return { state: 'partially-drafted', count: planned.size, undraftedUnits, nextUnit, suggest: commandWithUnit('/scr:draft', nextUnit) };
  }
  return { state: 'covered', count: planned.size, undraftedUnits: [], nextUnit: null, suggest: null };
}

function detectReviewCoverage(draftFiles, reviewFiles) {
  if (draftFiles.length === 0) {
    return { state: 'none', suggest: null };
  }
  const drafted = new Set(
    draftFiles
      .map((file) => path.basename(file).match(/^(\d+)\D.*DRAFT\.md$/i))
      .filter(Boolean)
      .map((match) => parseInt(match[1], 10))
  );
  const reviewed = new Set(
    reviewFiles
      .map((file) => path.basename(file).match(/^(\d+)\D.*(?:REVIEW|EDITOR-NOTES)\.md$/i))
      .filter(Boolean)
      .map((match) => parseInt(match[1], 10))
  );
  const missingUnits = [...drafted].filter((unit) => !reviewed.has(unit)).sort((a, b) => a - b);
  if (missingUnits.length === drafted.size) {
    const nextUnit = missingUnits[0] || null;
    return { state: 'missing', missingUnits, nextUnit, suggest: commandWithUnit('/scr:editor-review', nextUnit) };
  }
  if (missingUnits.length > 0) {
    const nextUnit = missingUnits[0];
    return { state: 'partial', missingUnits, nextUnit, suggest: commandWithUnit('/scr:editor-review', nextUnit) };
  }
  return { state: 'covered', missingUnits: [], nextUnit: null, suggest: null };
}

function detectStyleGuideSignal(manuscriptDir, config) {
  const stylePath = path.join(manuscriptDir, 'STYLE-GUIDE.md');
  if (!pathExists(stylePath)) {
    return { state: 'missing', calibrated: false, suggest: '/scr:profile-writer' };
  }
  const text = readText(stylePath);
  const placeholderPatterns = [
    /\{\{[A-Z0-9_ -]+\}\}/,
    /\[(?:fill in|delete if not applicable)/i,
    /\bTBD\b/i,
    /\bTODO\b/i,
    /\bplaceholder\b/i,
    /your writing voice/i,
  ];
  const substantiveLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('---')).length;
  const hasPlaceholders = placeholderPatterns.some((pattern) => pattern.test(text));
  if (hasPlaceholders || substantiveLines < 8) {
    return { state: 'template', calibrated: false, suggest: '/scr:profile-writer' };
  }
  if (config?.voice?.calibrated === true) {
    return { state: 'calibrated', calibrated: true, suggest: null };
  }
  return { state: 'profiled-unverified', calibrated: false, suggest: '/scr:voice-test' };
}

function detectNotesSignal(manuscriptDir) {
  const noteFiles = [
    ...listFiles(path.join(manuscriptDir, 'notes'), { extensions: ['.md', '.txt'], recursive: true }),
    path.join(manuscriptDir, 'NOTES.md'),
    path.join(manuscriptDir, 'TODO.md'),
  ].filter(pathExists);
  const pending = noteFiles.filter((file) => containsAny(readText(file), ['TODO', 'FIXME', 'UNRESOLVED', 'QUESTION:', 'NOTE:']));
  return {
    state: pending.length ? 'pending' : 'none',
    count: pending.length,
    files: pending.map((file) => path.relative(manuscriptDir, file)),
    suggest: pending.length ? '/scr:check-notes' : null,
  };
}

function detectTrackSignal(manuscriptDir) {
  const tracks = readJson(path.join(manuscriptDir, 'tracks.json'));
  const proposals = listFiles(path.join(manuscriptDir, 'proposals'), { extensions: ['.md'], recursive: true });
  const activeTracks = Array.isArray(tracks?.tracks)
    ? tracks.tracks.filter((track) => track && track.status !== 'merged')
    : [];
  let state = 'none';
  let suggest = null;
  if (proposals.length > 0) {
    state = 'proposal-ready';
    suggest = '/scr:editor-review --proposal';
  } else if (activeTracks.length > 0) {
    state = 'active';
    suggest = '/scr:track';
  }
  return {
    state,
    activeCount: activeTracks.length,
    proposalCount: proposals.length,
    suggest,
  };
}

function detectPublishingSignal(manuscriptDir, draftFiles) {
  const frontMatter = countMarkdownFiles(path.join(manuscriptDir, 'front-matter'));
  const backMatter = countMarkdownFiles(path.join(manuscriptDir, 'back-matter'));
  const blurb = anyPathExists([
    path.join(manuscriptDir, 'marketing', 'BLURB.md'),
    path.join(manuscriptDir, 'marketing', 'blurb.md'),
    path.join(manuscriptDir, 'output', 'blurb.md'),
  ]);
  const ebookCover = anyPathExists([
    path.join(manuscriptDir, 'build', 'ebook-cover.jpg'),
    path.join(manuscriptDir, 'build', 'ebook-cover.png'),
  ]);
  const printCover = anyPathExists([
    path.join(manuscriptDir, 'build', 'paperback-cover.pdf'),
    path.join(manuscriptDir, 'build', 'hardcover-cover.pdf'),
  ]);
  const promptFiles = countFiles(path.join(manuscriptDir, 'illustrations', 'cover'), ['.md']);
  const prepublishReview = anyPathExists([
    path.join(manuscriptDir, 'reviews', 'PREPUBLISH-REVIEW.md'),
    path.join(manuscriptDir, 'PREPUBLISH-REVIEW.md'),
  ]);
  const complianceReview = anyPathExists([
    path.join(manuscriptDir, 'reviews', 'PLATFORM-COMPLIANCE.md'),
    path.join(manuscriptDir, 'PLATFORM-COMPLIANCE.md'),
  ]);
  const gaps = [];
  if (draftFiles.length > 0 && frontMatter === 0) gaps.push('front-matter');
  if (draftFiles.length > 0 && backMatter === 0) gaps.push('back-matter');
  if (draftFiles.length > 0 && !blurb) gaps.push('blurb');
  if (draftFiles.length > 0 && !ebookCover && promptFiles === 0) gaps.push('cover-art');
  const state = gaps.length
    ? 'gaps'
    : draftFiles.length && !prepublishReview
      ? 'editorial-review-needed'
      : draftFiles.length && !complianceReview
        ? 'compliance-needed'
        : draftFiles.length
          ? 'ready'
          : 'not-started';
  let suggest = null;
  if (gaps.length) {
    suggest = `/scr:${gaps[0]}`;
  } else if (state === 'editorial-review-needed') {
    suggest = '/scr:prepublish-review';
  } else if (state === 'compliance-needed') {
    suggest = '/scr:compliance-check';
  }
  return {
    state,
    frontMatter,
    backMatter,
    blurb,
    ebookCover,
    printCover,
    coverPrompts: promptFiles,
    prepublishReview,
    complianceReview,
    gaps,
    suggest,
  };
}

function scanReviewSignals(manuscriptDir) {
  const reviewDirs = [
    'reviews',
    'reports',
    'voice',
    'continuity',
    'translation',
  ].map((name) => path.join(manuscriptDir, name));
  const files = reviewDirs.flatMap((dir) => listFiles(dir, { extensions: ['.md', '.txt'], recursive: true }));
  const pending = [];
  for (const file of files) {
    const text = readText(file);
    if (containsAny(text, REVIEW_KEYWORDS)) {
      pending.push(path.relative(manuscriptDir, file));
    }
  }
  return pending;
}

function findNewestOutput(manuscriptDir) {
  const outputDirs = [
    path.join(manuscriptDir, 'output'),
    path.join(manuscriptDir, 'build'),
    path.join(manuscriptDir, 'exports'),
  ];
  return newestMtime(outputDirs.flatMap((dir) => listFiles(dir, { recursive: true })));
}

function detectTranslationSignal(manuscriptDir, config) {
  const translationDir = path.join(manuscriptDir, 'translation');
  const configuredTargets = [
    ...(Array.isArray(config?.target_languages) ? config.target_languages : []),
    ...(Array.isArray(config?.translation?.target_languages) ? config.translation.target_languages : []),
    ...(Array.isArray(config?.translations) ? config.translations : []),
  ];
  const translationFiles = listFiles(translationDir, { recursive: true });
  if (translationFiles.length > 0 || configuredTargets.length > 0) {
    return {
      state: 'follow-up available',
      count: translationFiles.length,
      configuredTargets,
    };
  }
  return {
    state: 'none',
    count: 0,
    configuredTargets: [],
  };
}

function detectHistorySignal(manuscriptDir) {
  const historyPath = path.join(manuscriptDir, 'HISTORY.log');
  if (!pathExists(historyPath)) {
    return { state: 'missing', lastFailed: false };
  }
  const lines = readText(historyPath).split(/\r?\n/).filter(Boolean);
  const last = lines[lines.length - 1] || '';
  return {
    state: 'present',
    lastFailed: /\b(fail|failed|error|blocked)\b/i.test(last),
  };
}

function detectContextSignal(manuscriptDir, draftFiles) {
  const contextPath = path.join(manuscriptDir, 'CONTEXT.md');
  const statePath = path.join(manuscriptDir, 'STATE.md');
  const contextStat = safeStat(contextPath);
  const stateStat = safeStat(statePath);
  const newestDraft = newestMtime(draftFiles);

  if (!contextStat) {
    return { state: 'missing', suggest: '/scr:save' };
  }
  if (stateStat && contextStat.mtimeMs < stateStat.mtimeMs) {
    return { state: 'stale', suggest: '/scr:scan' };
  }
  if (newestDraft > 0 && contextStat.mtimeMs < newestDraft) {
    return { state: 'stale', suggest: '/scr:save' };
  }
  return { state: 'fresh', suggest: null };
}

const CONTEXT_HEALTH_LIMITS = {
  watch: 45000,
  tight: 80000,
  critical: 120000,
};

function estimateTextTokens(byteCount) {
  return Math.ceil(byteCount / 4);
}

function fileByteSize(filePath) {
  const stat = safeStat(filePath);
  return stat && stat.isFile() ? stat.size : 0;
}

function newestFiles(files, limit) {
  return files
    .map((file) => ({ file, mtime: safeStat(file)?.mtimeMs || 0 }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)
    .map((entry) => entry.file);
}

function detectContextHealth(manuscriptDir, draftFiles) {
  const coreFiles = [
    'STYLE-GUIDE.md',
    'CONTEXT.md',
    'STATE.md',
    'OUTLINE.md',
    'RECORD.md',
    'WORK.md',
    'config.json',
  ].map((name) => path.join(manuscriptDir, name));
  const reviewFiles = newestFiles(listFiles(path.join(manuscriptDir, 'reviews'), { extensions: ['.md', '.txt'], recursive: true }), 3);
  const planFiles = newestFiles(listFiles(path.join(manuscriptDir, 'plans'), { extensions: ['.md'], recursive: true }), 3);
  const recentDrafts = newestFiles(draftFiles, 5);
  const uniqueFiles = [...new Set([...coreFiles, ...planFiles, ...recentDrafts, ...reviewFiles])].filter(pathExists);
  const files = uniqueFiles.map((file) => ({
    file: path.relative(manuscriptDir, file),
    bytes: fileByteSize(file),
  }));
  const estimatedBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const estimatedTokens = estimateTextTokens(estimatedBytes);
  let state = 'ok';
  let suggest = null;
  if (estimatedTokens >= CONTEXT_HEALTH_LIMITS.critical) {
    state = 'critical';
    suggest = '/scr:thread';
  } else if (estimatedTokens >= CONTEXT_HEALTH_LIMITS.tight) {
    state = 'tight';
    suggest = '/scr:save';
  } else if (estimatedTokens >= CONTEXT_HEALTH_LIMITS.watch) {
    state = 'watch';
    suggest = '/scr:health --context';
  }
  return {
    state,
    estimatedTokens,
    estimatedBytes,
    fileCount: files.length,
    limits: { ...CONTEXT_HEALTH_LIMITS },
    largestFiles: files.sort((a, b) => b.bytes - a.bytes).slice(0, 5),
    suggest,
  };
}

function detectExportSignal(manuscriptDir, sourceFiles) {
  const newestSource = newestMtime(sourceFiles);
  const newestOutput = findNewestOutput(manuscriptDir);
  if (newestOutput === 0) {
    return { state: sourceFiles.length ? 'missing' : 'none', suggest: sourceFiles.length ? '/scr:export' : null };
  }
  if (newestSource > newestOutput) {
    return { state: 'stale', suggest: '/scr:export' };
  }
  return { state: 'fresh', suggest: null };
}

function detectSaveSignal(historySignal, draftFiles) {
  if (draftFiles.length === 0) return { state: 'clean', suggest: null };
  if (historySignal.state === 'missing') return { state: 'unsaved manuscript changes', suggest: '/scr:save' };
  return { state: 'clean', suggest: null };
}

function chooseRecommendation(signals, counts) {
  if (!signals.hasProject) {
    return {
      command: '/scr:new-work',
      reason: 'No .manuscript directory was found.',
      alternatives: ['/scr:demo', '/scr:import', '/scr:profile-writer'],
    };
  }
  if (!signals.hasState) {
    return {
      command: '/scr:scan',
      reason: 'The project is missing STATE.md.',
      alternatives: ['/scr:health', '/scr:next'],
    };
  }
  if (signals.history.lastFailed) {
    return {
      command: '/scr:troubleshoot',
      reason: 'The last history entry appears to have failed.',
      alternatives: ['/scr:scan', '/scr:health'],
    };
  }
  if (signals.context.state === 'stale') {
    return {
      command: signals.context.suggest || '/scr:scan',
      reason: 'CONTEXT.md is older than the current project state.',
      alternatives: ['/scr:progress', '/scr:resume-work'],
    };
  }
  if (signals.tracks?.state === 'proposal-ready') {
    return {
      command: signals.tracks.suggest,
      reason: `${signals.tracks.proposalCount} revision proposal(s) are waiting for review.`,
      alternatives: ['/scr:track', '/scr:compare', '/scr:progress'],
    };
  }
  if (signals.styleGuide?.state === 'missing' || signals.styleGuide?.state === 'template') {
    return {
      command: signals.styleGuide.suggest || '/scr:profile-writer',
      reason: 'STYLE-GUIDE.md is not populated with a usable writer voice profile yet.',
      alternatives: ['/scr:import', '/scr:discuss', '/scr:next'],
    };
  }
  if (signals.styleGuide?.state === 'profiled-unverified') {
    return {
      command: signals.styleGuide.suggest || '/scr:voice-test',
      reason: 'A voice profile exists but has not passed the calibration gate yet.',
      alternatives: ['/scr:profile-writer --refine', '/scr:discuss', '/scr:progress'],
    };
  }
  if (signals.plan?.state === 'ready-to-draft' || signals.plan?.state === 'partially-drafted') {
    const unitText = signals.plan.nextUnit ? ` Unit ${signals.plan.nextUnit}` : '';
    return {
      command: signals.plan.suggest,
      reason: `${unitText.trim() || 'A planned unit'} has a plan but no draft yet.`,
      alternatives: ['/scr:plan', '/scr:voice-test', '/scr:progress'],
    };
  }
  if (signals.reviews.count > 0) {
    return {
      command: '/scr:editor-review',
      reason: `${signals.reviews.count} review signal(s) still look unresolved.`,
      alternatives: ['/scr:voice-check', '/scr:continuity-check', '/scr:progress'],
    };
  }
  if (signals.notes?.count > 0) {
    return {
      command: signals.notes.suggest,
      reason: `${signals.notes.count} note file(s) contain unresolved items.`,
      alternatives: ['/scr:progress', '/scr:scan', '/scr:next'],
    };
  }
  if (counts.drafts === 0) {
    return {
      command: '/scr:plan',
      reason: 'No draft files were found yet.',
      alternatives: ['/scr:discuss', '/scr:draft', '/scr:voice-test'],
    };
  }
  if (signals.reviewCoverage?.state === 'missing' || signals.reviewCoverage?.state === 'partial') {
    return {
      command: signals.reviewCoverage.suggest,
      reason: `Drafts exist but review coverage is ${signals.reviewCoverage.state}.`,
      alternatives: ['/scr:voice-check', '/scr:continuity-check', '/scr:progress'],
    };
  }
  if (signals.translation.state !== 'none') {
    return {
      command: '/scr:back-translate',
      reason: 'Translation work exists and may need a verification pass.',
      alternatives: ['/scr:cultural-adaptation', '/scr:multi-publish', '/scr:progress'],
    };
  }
  if (signals.publishing?.state === 'gaps' && signals.export.state === 'missing') {
    return {
      command: signals.publishing.suggest || '/scr:publish',
      reason: `Publishing prerequisites have gaps: ${signals.publishing.gaps.join(', ')}.`,
      alternatives: ['/scr:publish', '/scr:export', '/scr:progress'],
    };
  }
  if (signals.publishing?.state === 'editorial-review-needed') {
    return {
      command: signals.publishing.suggest || '/scr:prepublish-review',
      reason: 'Publishing prerequisites look present, but no final prepublish review report was found.',
      alternatives: ['/scr:polish', '/scr:publish --preflight', '/scr:export'],
    };
  }
  if (signals.publishing?.state === 'compliance-needed') {
    return {
      command: signals.publishing.suggest || '/scr:compliance-check',
      reason: 'The final policy and rights gate has not been recorded for this publishing route.',
      alternatives: ['/scr:publish --preflight', '/scr:prepublish-review', '/scr:progress'],
    };
  }
  if (signals.export.state === 'stale' || signals.export.state === 'missing') {
    return {
      command: signals.export.suggest || '/scr:export',
      reason: `Export output is ${signals.export.state}.`,
      alternatives: ['/scr:publish', '/scr:progress', '/scr:save'],
    };
  }
  if (signals.save.state !== 'clean') {
    return {
      command: signals.save.suggest || '/scr:save',
      reason: 'Draft files exist without a current history signal.',
      alternatives: ['/scr:progress', '/scr:scan'],
    };
  }
  return {
    command: '/scr:next',
    reason: 'Project state looks consistent; continue with the lifecycle route.',
    alternatives: ['/scr:progress', '/scr:editor-review', '/scr:save'],
  };
}

function dedupeByCommand(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.command)) return false;
    seen.add(item.command);
    return true;
  });
}

function buildAutomationPlan(signals, recommendation) {
  const recommendationBase = baseCommandRef(recommendation.command);
  const spawnPolicy = AGENT_ROUTE_POLICIES[recommendationBase];
  const localPolicy = LOCAL_ROUTE_POLICIES[recommendationBase];
  const manualPolicy = MANUAL_ROUTE_POLICIES[recommendationBase];
  const spawnCandidates = [];
  const localCandidates = [];
  const manualGates = [];

  if (spawnPolicy) {
    spawnCandidates.push({
      command: recommendation.command,
      agents: spawnPolicy.agents,
      reason: spawnPolicy.reason,
    });
  }
  if (signals.plan?.state === 'ready-to-draft' || signals.plan?.state === 'partially-drafted') {
    spawnCandidates.push({
      command: signals.plan.suggest || commandWithUnit('/scr:draft', signals.plan.nextUnit),
      agents: AGENT_ROUTE_POLICIES['/scr:draft'].agents,
      reason: 'planned units can be drafted by the drafter route',
    });
  }
  if (signals.reviewCoverage?.state === 'missing' || signals.reviewCoverage?.state === 'partial') {
    spawnCandidates.push({
      command: signals.reviewCoverage.suggest || commandWithUnit('/scr:editor-review', signals.reviewCoverage.nextUnit),
      agents: AGENT_ROUTE_POLICIES['/scr:editor-review'].agents,
      reason: 'drafts without review coverage should enter the review route',
    });
  }
  if (signals.translation?.state !== 'none') {
    spawnCandidates.push({
      command: '/scr:back-translate',
      agents: AGENT_ROUTE_POLICIES['/scr:back-translate'].agents,
      reason: 'translation work needs a verification pass',
    });
  }

  if (localPolicy) {
    localCandidates.push({ command: recommendation.command, reason: localPolicy });
  }
  if (signals.context?.state === 'stale') {
    localCandidates.push({ command: signals.context.suggest || '/scr:scan', reason: 'refresh stale context before chaining work' });
  }
  if (signals.contextHealth?.state === 'tight' || signals.contextHealth?.state === 'critical') {
    localCandidates.push({
      command: signals.contextHealth.suggest || '/scr:health --context',
      reason: `loaded context estimate is ${signals.contextHealth.state}`,
    });
  }
  if (signals.notes?.count > 0) {
    localCandidates.push({ command: '/scr:check-notes', reason: 'surface unresolved notes before the next writing route' });
  }
  if (signals.save?.state !== 'clean') {
    localCandidates.push({ command: signals.save.suggest || '/scr:save', reason: 'save manuscript changes before branching or packaging' });
  }

  if (manualPolicy) {
    manualGates.push({ command: recommendation.command, reason: manualPolicy });
  }
  if (signals.publishing?.state === 'gaps') {
    manualGates.push({
      command: '/scr:publish',
      reason: `publishing still needs ${signals.publishing.gaps.join(', ')}`,
    });
  }
  if (signals.publishing?.state === 'editorial-review-needed') {
    manualGates.push({
      command: '/scr:prepublish-review',
      reason: 'final editorial go/no-go belongs before publishing packages',
    });
  }
  if (signals.tracks?.state === 'active' || signals.tracks?.state === 'proposal-ready') {
    manualGates.push({
      command: signals.tracks.suggest || '/scr:track',
      reason: 'revision-track decisions belong to the writer',
    });
  }

  const recommendationIsManual = manualGates.some((gate) => gate.command === recommendation.command);
  return {
    mode: recommendationIsManual ? 'manual-gated' : spawnCandidates.length ? 'agent-ready' : localCandidates.length ? 'local-helper' : 'read-only',
    spawnCandidates: dedupeByCommand(spawnCandidates),
    localCandidates: dedupeByCommand(localCandidates),
    manualGates: dedupeByCommand(manualGates),
  };
}

function analyzeProject(projectRoot = process.cwd(), options = {}) {
  const root = path.resolve(projectRoot);
  const manuscriptDir = options.manuscriptDir || path.join(root, '.manuscript');
  const hasProject = pathExists(manuscriptDir);
  const statePath = path.join(manuscriptDir, 'STATE.md');
  const config = readJson(path.join(manuscriptDir, 'config.json')) || {};

  if (!hasProject) {
    const signals = {
      hasProject: false,
      hasState: false,
      context: { state: 'none', suggest: null },
      contextHealth: { state: 'none', estimatedTokens: 0, estimatedBytes: 0, fileCount: 0, largestFiles: [], suggest: null },
      history: { state: 'none', lastFailed: false },
      reviews: { state: 'none', count: 0, files: [] },
      reviewCoverage: { state: 'none', suggest: null },
      readiness: { state: 'none', missing: [], suggest: null },
      plan: { state: 'none', count: 0, suggest: null },
      styleGuide: { state: 'none', calibrated: false, suggest: null },
      notes: { state: 'none', count: 0, files: [], suggest: null },
      tracks: { state: 'none', activeCount: 0, proposalCount: 0, suggest: null },
      translation: { state: 'none', count: 0, configuredTargets: [] },
      export: { state: 'none', suggest: null },
      publishing: { state: 'not-started', gaps: [], suggest: null },
      save: { state: 'clean', suggest: null },
    };
    const recommendation = chooseRecommendation(signals, { drafts: 0 });
    const automation = buildAutomationPlan(signals, recommendation);
    return {
      projectRoot: root,
      manuscriptDir,
      commandUnit: config.command_unit || 'unit',
      workType: config.work_type || '',
      counts: { drafts: 0, plans: 0, reviews: 0 },
      progress: computeProgressLedger(manuscriptDir),
      signals,
      recommendation,
      automation,
    };
  }

  const draftFiles = listFiles(path.join(manuscriptDir, 'drafts'), { extensions: ['.md'], recursive: true });
  const reviewFiles = scanReviewSignals(manuscriptDir);
  const allReviewFiles = listFiles(path.join(manuscriptDir, 'reviews'), { extensions: ['.md', '.txt'], recursive: true });
  const historySignal = detectHistorySignal(manuscriptDir);
  const sourceFiles = [
    statePath,
    path.join(manuscriptDir, 'OUTLINE.md'),
    path.join(manuscriptDir, 'RECORD.md'),
    path.join(manuscriptDir, 'STYLE-GUIDE.md'),
    ...draftFiles,
  ].filter(pathExists);

  const signals = {
    hasProject: true,
    hasState: pathExists(statePath),
    context: detectContextSignal(manuscriptDir, draftFiles),
    contextHealth: detectContextHealth(manuscriptDir, draftFiles),
    history: historySignal,
    readiness: detectProjectReadiness(manuscriptDir),
    plan: detectPlanSignal(manuscriptDir, draftFiles),
    styleGuide: detectStyleGuideSignal(manuscriptDir, config),
    reviews: {
      state: reviewFiles.length ? 'pending' : 'none',
      count: reviewFiles.length,
      files: reviewFiles,
    },
    reviewCoverage: detectReviewCoverage(draftFiles, allReviewFiles),
    notes: detectNotesSignal(manuscriptDir),
    tracks: detectTrackSignal(manuscriptDir),
    translation: detectTranslationSignal(manuscriptDir, config),
    export: detectExportSignal(manuscriptDir, sourceFiles),
    publishing: detectPublishingSignal(manuscriptDir, draftFiles),
    save: detectSaveSignal(historySignal, draftFiles),
  };
  const counts = {
    drafts: draftFiles.length,
    plans: signals.plan.count,
    reviews: reviewFiles.length,
  };
  const recommendation = chooseRecommendation(signals, counts);
  const automation = buildAutomationPlan(signals, recommendation);
  return {
    projectRoot: root,
    manuscriptDir,
    commandUnit: config.command_unit || 'unit',
    workType: config.work_type || '',
    counts,
    progress: computeProgressLedger(manuscriptDir),
    signals,
    recommendation,
    automation,
  };
}

function formatProactiveChecks(analysis) {
  const { signals } = analysis;
  const progress = analysis.progress || {};
  const stateLine = signals.hasProject
    ? `  State: ${signals.hasState ? 'fresh' : 'missing, suggest /scr:scan'}`
    : '  Project: missing, suggest /scr:new-work';
  const progressLine = progress.total
    ? `  Progress: ${progress.bar} ${progress.done}/${progress.total} done (${progress.percent}%), ${progress.inProgress} in progress, ${progress.untouched} untouched`
    : '  Progress: no units yet';
  return [
    'Proactive checks:',
    stateLine,
    progressLine,
    `  Readiness: ${signals.readiness?.state || 'none'}${signals.readiness?.missing?.length ? `, missing ${signals.readiness.missing.join(', ')}` : ''}`,
    `  Session: ${signals.context.state}${signals.context.suggest ? `, suggest ${signals.context.suggest}` : ''}`,
    `  Context health: ${signals.contextHealth?.state || 'none'}${signals.contextHealth?.estimatedTokens ? `, about ${signals.contextHealth.estimatedTokens} tokens` : ''}${signals.contextHealth?.suggest ? `, suggest ${signals.contextHealth.suggest}` : ''}`,
    `  Plans: ${signals.plan?.state || 'none'}${signals.plan?.suggest ? `, suggest ${signals.plan.suggest}` : ''}`,
    `  Reviews: ${signals.reviews.count ? `${signals.reviews.count} pending, suggest /scr:editor-review` : 'none'}`,
    `  Review coverage: ${signals.reviewCoverage?.state || 'none'}${signals.reviewCoverage?.suggest ? `, suggest ${signals.reviewCoverage.suggest}` : ''}`,
    `  Notes: ${signals.notes?.count ? `${signals.notes.count} pending, suggest ${signals.notes.suggest}` : 'none'}`,
    `  Tracks: ${signals.tracks?.state || 'none'}${signals.tracks?.suggest ? `, suggest ${signals.tracks.suggest}` : ''}`,
    `  Translation: ${signals.translation.state}`,
    `  Publishing: ${signals.publishing?.state || 'none'}${signals.publishing?.gaps?.length ? `, gaps ${signals.publishing.gaps.join(', ')}` : ''}`,
    `  Export: ${signals.export.state}${signals.export.suggest ? `, suggest ${signals.export.suggest}` : ''}`,
    `  Save: ${signals.save.state}${signals.save.suggest ? `, suggest ${signals.save.suggest}` : ''}`,
  ].join('\n');
}

function formatAutomationStatus(analysis, options = {}) {
  const trigger = options.trigger || '/scr:next';
  const localOperation = options.localOperation || 'auto-invoke engine: read-only';
  const autoInvoked = options.autoInvoked || `${analysis.recommendation.command}: no`;
  const automation = analysis.automation || { mode: 'read-only', spawnCandidates: [], localCandidates: [], manualGates: [] };
  const candidateAgentLines = automation.spawnCandidates.length
    ? automation.spawnCandidates.map((candidate) => `- ${candidate.command}: ${candidate.agents.join(', ')} (${candidate.reason})`)
    : ['- none'];
  const localCandidateLines = automation.localCandidates.length
    ? automation.localCandidates.map((candidate) => `- ${candidate.command}: ${candidate.reason}`)
    : ['- none'];
  const manualGateLines = automation.manualGates.length
    ? automation.manualGates.map((gate) => `- ${gate.command}: ${gate.reason}`)
    : ['- none'];
  return [
    'Automation status:',
    `Trigger: ${trigger}`,
    `Mode: ${automation.mode}`,
    'Spawned agents:',
    '- none',
    'Candidate agents:',
    ...candidateAgentLines,
    'Local operations:',
    `- ${localOperation}`,
    `- state route computed: ${analysis.signals.hasProject ? 'yes' : 'no project'}`,
    'Candidate local helpers:',
    ...localCandidateLines,
    'Manual gates:',
    ...manualGateLines,
    'Auto-invoked:',
    `- ${autoInvoked}`,
    `Why: ${analysis.recommendation.reason}`,
  ].join('\n');
}

function formatRecommendation(analysis) {
  const lines = [
    `${analysis.recommendation.command} is the recommended next command.`,
    analysis.recommendation.reason,
    '',
    'Next commands:',
    `- \`${analysis.recommendation.command}\`: Run the highest-confidence next step from disk state.`,
  ];
  for (const command of analysis.recommendation.alternatives.slice(0, 3)) {
    lines.push(`- \`${command}\`: Use this alternate path if it better matches the writer's intent.`);
  }
  return lines.join('\n');
}

function formatReport(analysis, options = {}) {
  return [
    formatProactiveChecks(analysis),
    '',
    formatAutomationStatus(analysis, options),
    '',
    formatRecommendation(analysis),
  ].join('\n');
}

function getRuntimeAgentSupport(runtimeKey) {
  const support = DEFAULT_RUNTIME_SUPPORT[runtimeKey] || null;
  if (!support) return null;
  return {
    ...support,
    modelPolicy: support.modelPolicy || DEFAULT_MODEL_POLICY,
    adaptationDocs: MODEL_ADAPTATION_DOCS.slice(),
  };
}

function listRuntimeAgentSupport() {
  return Object.entries(DEFAULT_RUNTIME_SUPPORT).map(([key]) => ({
    key,
    ...getRuntimeAgentSupport(key),
  }));
}

function getPackageRoot() {
  return path.resolve(__dirname, '..');
}

function loadConstraints(options = {}) {
  const constraintsPath = options.constraintsPath || path.join(getPackageRoot(), 'data', 'CONSTRAINTS.json');
  const constraints = readJson(constraintsPath);
  return constraints && constraints.commands ? constraints : { commands: {}, command_intents: {}, command_families: {}, dependencies: {} };
}

function expectedCommandCount(options = {}) {
  return Object.keys(loadConstraints(options).commands || {}).length;
}

function getExpectedAgentNames(options = {}) {
  if (Array.isArray(options.agentNames) && options.agentNames.length > 0) {
    return options.agentNames.slice().sort();
  }
  const agentsRoot = options.agentsRoot || path.join(getPackageRoot(), 'agents');
  const files = listFiles(agentsRoot, { extensions: ['.md'], recursive: false })
    .filter((file) => {
      const content = readText(file);
      const normalized = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
      if (!normalized.startsWith('---\n') && !normalized.startsWith('---\r\n')) return false;
      const end = normalized.search(/\r?\n(?:---|\.\.\.)\r?\n/);
      if (end < 0) return false;
      const frontmatter = normalized.slice(0, end);
      return /^name:\s*\S+/m.test(frontmatter) && /^description:\s*\S+/m.test(frontmatter);
    })
    .map((file) => path.basename(file, '.md'))
    .sort();
  return files.length ? files : DEFAULT_AGENT_NAMES.slice().sort();
}

function collectSafeApplyActions(projectRoot = process.cwd(), options = {}) {
  const analysis = options.analysis || analyzeProject(projectRoot);
  const actions = [
    {
      name: 'status sweep',
      command: 'scriveno status',
      status: 'ran',
      mutation: false,
      reason: 'computed the current route, local-helper, agent, and manual-gate state',
    },
  ];

  const readOnlyHelpers = new Set(['/scr:progress', '/scr:session-report', '/scr:check-notes', '/scr:health', '/scr:validate']);
  const writeOrInstallHelpers = new Set(['/scr:save', '/scr:scan', '/scr:sync']);

  for (const candidate of analysis.automation.localCandidates || []) {
    const command = candidate.command;
    if (readOnlyHelpers.has(command)) {
      actions.push({
        name: command.replace('/scr:', ''),
        command,
        status: 'ready',
        mutation: false,
        reason: candidate.reason,
      });
    } else if (writeOrInstallHelpers.has(command)) {
      actions.push({
        name: command.replace('/scr:', ''),
        command,
        status: 'skipped',
        mutation: true,
        reason: `${candidate.reason}; safe apply reports this instead of writing files`,
      });
    } else {
      actions.push({
        name: command.replace('/scr:', ''),
        command,
        status: 'suggested',
        mutation: null,
        reason: candidate.reason,
      });
    }
  }

  for (const candidate of analysis.automation.spawnCandidates || []) {
    actions.push({
      name: candidate.command.replace('/scr:', ''),
      command: candidate.command,
      status: 'agent-candidate',
      mutation: null,
      reason: `${candidate.agents.join(', ')}: ${candidate.reason}`,
    });
  }

  for (const gate of analysis.automation.manualGates || []) {
    actions.push({
      name: gate.command.replace('/scr:', ''),
      command: gate.command,
      status: 'manual-gate',
      mutation: true,
      reason: gate.reason,
    });
  }

  return {
    projectRoot: analysis.projectRoot,
    trigger: options.trigger || 'scriveno status --apply-safe',
    appliedCount: actions.filter((action) => action.status === 'ran').length,
    skippedCount: actions.filter((action) => action.status === 'skipped' || action.status === 'manual-gate').length,
    safeToRunCount: actions.filter((action) => action.status === 'ready').length,
    agentCandidateCount: actions.filter((action) => action.status === 'agent-candidate').length,
    actions,
  };
}

function formatSafeApplyReport(result) {
  const actionLines = result.actions.length
    ? result.actions.map((action) => {
      const mutation = action.mutation === false ? 'read-only' : action.mutation === true ? 'writes or external action' : 'host-dependent';
      return `- ${action.command}: ${action.status} (${mutation}) - ${action.reason}`;
    })
    : ['- none'];
  return [
    'Safe apply status:',
    `Trigger: ${result.trigger}`,
    `Project: ${result.projectRoot}`,
    `Read-only checks run: ${result.appliedCount}`,
    `Safe helpers ready: ${result.safeToRunCount}`,
    `Agent candidates: ${result.agentCandidateCount}`,
    `Manual or write-gated actions: ${result.skippedCount}`,
    'Actions:',
    ...actionLines,
  ].join('\n');
}

function readRuntimeSettings(options = {}) {
  const homeDir = options.homeDir || os.homedir();
  const projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : null;
  const candidates = [
    options.dataDir,
    projectRoot ? path.join(projectRoot, '.scriveno') : null,
    path.join(homeDir, '.scriveno'),
  ].filter(Boolean);
  for (const dataDir of candidates) {
    const settings = readJson(path.join(dataDir, 'settings.json'));
    if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
      return { dataDir, settings };
    }
  }
  return {
    dataDir: candidates[0] || path.join(homeDir, '.scriveno'),
    settings: null,
  };
}

function resolveRuntimeKeysForAudit(options = {}) {
  if (Array.isArray(options.runtimeKeys) && options.runtimeKeys.length > 0) {
    return options.runtimeKeys;
  }
  const { settings } = readRuntimeSettings(options);
  if (Array.isArray(settings?.runtimes) && settings.runtimes.length > 0) {
    return settings.runtimes.filter((key) => DEFAULT_RUNTIME_SUPPORT[key]);
  }
  if (typeof settings?.runtime === 'string' && DEFAULT_RUNTIME_SUPPORT[settings.runtime]) {
    return [settings.runtime];
  }
  return Object.keys(DEFAULT_RUNTIME_SUPPORT);
}

function resolveRuntimeAuditScope(options = {}) {
  if (options.scope) return options.scope;
  const { settings } = readRuntimeSettings(options);
  return settings?.scope === 'project' ? 'project' : 'global';
}

function runtimeSurfacePaths(runtimeKey, options = {}) {
  const homeDir = options.homeDir || os.homedir();
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const scope = resolveRuntimeAuditScope(options);
  const surface = scope === 'project'
    ? PROJECT_RUNTIME_INSTALL_SURFACES[runtimeKey]
    : RUNTIME_INSTALL_SURFACES[runtimeKey];
  if (!surface) return null;
  const out = { runtimeKey };
  for (const [key, value] of Object.entries(surface)) {
    if (typeof value === 'function') out[key] = value(scope === 'project' ? projectRoot : homeDir);
  }
  out.commandLayout = surface.commandLayout;
  out.metadata = surface.metadata || 'none';
  out.scope = scope;
  return out;
}

function inspectAgentAvailability(options = {}) {
  const runtimeKeys = resolveRuntimeKeysForAudit(options);
  const agentNames = getExpectedAgentNames(options);
  const runtimes = [];

  for (const runtimeKey of runtimeKeys) {
    const support = getRuntimeAgentSupport(runtimeKey);
    const paths = runtimeSurfacePaths(runtimeKey, options);
    if (!support || !paths) continue;

    if (runtimeKey === 'perplexity-desktop') {
      const guideReady = pathExists(path.join(paths.guide || '', 'SETUP.md'));
      runtimes.push({
        runtime: runtimeKey,
        label: support.label,
        scope: paths.scope,
        status: guideReady ? 'guided-ready' : 'guided-missing',
        nativeSpawn: support.nativeSpawn,
        fallback: support.fallback,
        modelPolicy: support.modelPolicy,
        adaptationDocs: support.adaptationDocs,
        agentsDir: null,
        promptCount: 0,
        missingPrompts: agentNames,
        metadataCount: 0,
        missingMetadata: [],
      });
      continue;
    }

    const agentsDir = paths.agents || path.join(paths.skills || '', 'agents');
    const promptFiles = agentNames.map((name) => `${name}.md`);
    const missingPrompts = promptFiles
      .filter((fileName) => !pathExists(path.join(agentsDir, fileName)))
      .map((fileName) => path.basename(fileName, '.md'));
    const metadataFiles = support.metadata === 'toml'
      ? agentNames.map((name) => `${name}.toml`)
      : [];
    const missingMetadata = metadataFiles
      .filter((fileName) => !pathExists(path.join(agentsDir, fileName)))
      .map((fileName) => path.basename(fileName, '.toml'));
    const promptCount = promptFiles.length - missingPrompts.length;
    const metadataCount = metadataFiles.length - missingMetadata.length;
    let status = 'missing';
    if (missingPrompts.length === 0 && missingMetadata.length === 0 && support.metadata === 'toml') {
      status = 'metadata-ready';
    } else if (missingPrompts.length === 0) {
      status = 'prompt-fallback-ready';
    }

    runtimes.push({
      runtime: runtimeKey,
      label: support.label,
      scope: paths.scope,
      status,
      nativeSpawn: support.nativeSpawn,
      fallback: support.fallback,
      modelPolicy: support.modelPolicy,
      adaptationDocs: support.adaptationDocs,
      agentsDir,
      promptCount,
      missingPrompts,
      metadataCount,
      missingMetadata,
    });
  }

  return {
    checkedAt: new Date().toISOString(),
    expectedAgents: agentNames,
    runtimes,
  };
}

function formatAgentAvailabilityReport(report) {
  const lines = [
    'Agent availability:',
    `Expected agents: ${report.expectedAgents.join(', ')}`,
  ];
  for (const runtime of report.runtimes) {
    lines.push(`- ${runtime.label}: ${runtime.status}`);
    if (runtime.scope) lines.push(`  Scope: ${runtime.scope}`);
    if (runtime.agentsDir) lines.push(`  Agents: ${runtime.agentsDir}`);
    lines.push(`  Prompts: ${runtime.promptCount}/${report.expectedAgents.length}`);
    if (runtime.missingPrompts.length) lines.push(`  Missing prompts: ${runtime.missingPrompts.join(', ')}`);
    if (runtime.missingMetadata.length) lines.push(`  Missing metadata: ${runtime.missingMetadata.join(', ')}`);
    lines.push(`  Fallback: ${runtime.fallback}`);
    lines.push(`  Model policy: ${runtime.modelPolicy}`);
    if (runtime.adaptationDocs?.length) lines.push(`  Adaptation docs: ${runtime.adaptationDocs.join(', ')}`);
  }
  return lines.join('\n');
}

function countInstalledCommands(paths) {
  if (!paths) return 0;
  if (paths.commandLayout === 'flat') {
    return listFiles(paths.commands, { extensions: ['.md'], recursive: false })
      .filter((file) => /^scr-/.test(path.basename(file)))
      .length;
  }
  if (paths.commandLayout === 'skill-bundle') {
    return countMarkdownFiles(path.join(paths.skills || '', 'commands', 'scr'));
  }
  if (paths.commandLayout === 'guided-mcp') {
    return pathExists(path.join(paths.guide || '', 'SETUP.md')) ? 1 : 0;
  }
  return countMarkdownFiles(paths.commands || '');
}

function inspectRuntimeSmoke(options = {}) {
  const runtimeKeys = resolveRuntimeKeysForAudit(options);
  const expectedCommands = options.expectedCommands || expectedCommandCount(options);
  const expectedAgents = getExpectedAgentNames(options);
  const settingsState = readRuntimeSettings(options);
  const dataDir = options.dataDir || settingsState.dataDir;
  const enginePath = path.join(dataDir, 'lib', 'auto-invoke-engine.js');
  const modelDocPaths = MODEL_ADAPTATION_DOCS.map((docPath) => path.join(dataDir, docPath));
  const results = [];

  for (const runtimeKey of runtimeKeys) {
    const support = getRuntimeAgentSupport(runtimeKey);
    const paths = runtimeSurfacePaths(runtimeKey, options);
    if (!support || !paths) continue;
    const commandCount = countInstalledCommands(paths);
    const skillCount = runtimeKey === 'codex' && pathExists(paths.skills || '')
      ? fs.readdirSync(paths.skills, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name.startsWith('scr-')).length
      : paths.skills && pathExists(path.join(paths.skills, 'SKILL.md')) ? 1 : 0;
    const agentsDir = paths.agents || (paths.skills ? path.join(paths.skills, 'agents') : null);
    const promptCount = countFiles(agentsDir, ['.md']);
    const metadataCount = runtimeKey === 'codex' ? countFiles(agentsDir, ['.toml']) : 0;
    const commandReady = runtimeKey === 'perplexity-desktop' ? commandCount === 1 : commandCount >= expectedCommands;
    const skillReady = runtimeKey === 'codex' ? skillCount >= expectedCommands : !paths.skills || skillCount >= 1;
    const agentReady = runtimeKey === 'perplexity-desktop' ? true : promptCount >= expectedAgents.length;
    const metadataReady = runtimeKey === 'codex' ? metadataCount >= expectedAgents.length : true;
    const engineReady = pathExists(enginePath);
    const modelDocsReady = modelDocPaths.every(pathExists);
    const ok = commandReady && skillReady && agentReady && metadataReady && engineReady && modelDocsReady;

    results.push({
      runtime: runtimeKey,
      label: support.label,
      scope: paths.scope,
      ok,
      commands: commandCount,
      expectedCommands: runtimeKey === 'perplexity-desktop' ? 1 : expectedCommands,
      skills: skillCount,
      agents: promptCount,
      expectedAgents: runtimeKey === 'perplexity-desktop' ? 0 : expectedAgents.length,
      metadata: metadataCount,
      expectedMetadata: runtimeKey === 'codex' ? expectedAgents.length : 0,
      engineReady,
      modelDocsReady,
      modelDocs: modelDocPaths.filter(pathExists).length,
      expectedModelDocs: modelDocPaths.length,
      paths,
    });
  }

  return {
    checkedAt: new Date().toISOString(),
    dataDir,
    enginePath,
    expectedCommands,
    expectedAgents,
    ok: results.every((result) => result.ok),
    runtimes: results,
  };
}

function formatRuntimeSmokeReport(report) {
  const lines = [
    'Runtime smoke status:',
    `Shared engine: ${report.enginePath} (${report.runtimes.some((runtime) => runtime.engineReady) ? 'present' : 'missing'})`,
    `Overall: ${report.ok ? 'pass' : 'needs attention'}`,
  ];
  for (const runtime of report.runtimes) {
    lines.push(`- ${runtime.label}: ${runtime.ok ? 'pass' : 'needs attention'}`);
    if (runtime.scope) lines.push(`  Scope: ${runtime.scope}`);
    lines.push(`  Commands: ${runtime.commands}/${runtime.expectedCommands}`);
    if (runtime.skills) lines.push(`  Skills: ${runtime.skills}`);
    if (runtime.expectedAgents) lines.push(`  Agent prompts: ${runtime.agents}/${runtime.expectedAgents}`);
    if (runtime.expectedMetadata) lines.push(`  Agent metadata: ${runtime.metadata}/${runtime.expectedMetadata}`);
    lines.push(`  Shared engine: ${runtime.engineReady ? 'present' : 'missing'}`);
    lines.push(`  Model docs: ${runtime.modelDocs}/${runtime.expectedModelDocs}`);
  }
  return lines.join('\n');
}

function buildRouteGraph(options = {}) {
  const constraints = options.commands ? options : loadConstraints(options);
  const commands = constraints.commands || {};
  const categories = {};
  const lanes = {};
  const commandFamilies = {};
  const familyNamesByCommand = {};

  for (const [familyKey, family] of Object.entries(constraints.command_families || {})) {
    const declaredCommands = Array.isArray(family?.commands) ? family.commands : [];
    const knownCommands = declaredCommands.filter((name) => commands[name]);
    const missingCommands = declaredCommands.filter((name) => !commands[name]);
    const hub = family?.hub && commands[family.hub] ? family.hub : knownCommands[0] || null;
    commandFamilies[familyKey] = {
      label: family?.label || familyKey,
      hub,
      description: family?.description || '',
      commandCount: knownCommands.length,
      commands: knownCommands,
      missingCommands,
    };
    for (const commandName of knownCommands) {
      familyNamesByCommand[commandName] = familyNamesByCommand[commandName] || [];
      familyNamesByCommand[commandName].push(familyKey);
    }
  }

  const nodes = Object.entries(commands).map(([name, command]) => {
    const policy = getCommandAutomationPolicy(name, command);
    categories[command.category || 'uncategorized'] = (categories[command.category || 'uncategorized'] || 0) + 1;
    lanes[policy.lane] = (lanes[policy.lane] || 0) + 1;
    return {
      id: `/scr:${name}`,
      name,
      category: command.category || 'uncategorized',
      families: familyNamesByCommand[name] || [],
      lane: policy.lane,
      level: policy.level,
      available: command.available || [],
      reason: policy.reason,
    };
  });

  const edges = [];
  for (const [intent, names] of Object.entries(constraints.command_intents || {})) {
    for (let i = 0; i < names.length - 1; i++) {
      if (commands[names[i]] && commands[names[i + 1]]) {
        edges.push({ from: `/scr:${names[i]}`, to: `/scr:${names[i + 1]}`, type: 'intent-order', label: intent });
      }
    }
  }
  for (const [chainName, entries] of Object.entries(constraints.dependencies || {})) {
    if (!Array.isArray(entries)) continue;
    const commandEntries = entries.filter((entry) => entry && typeof entry === 'object' && entry.command);
    for (let i = 0; i < commandEntries.length - 1; i++) {
      const from = commandEntries[i].command;
      const to = commandEntries[i + 1].command;
      if (commands[from] && commands[to]) {
        edges.push({ from: `/scr:${from}`, to: `/scr:${to}`, type: 'dependency-chain', label: chainName });
      }
    }
  }
  for (const [familyKey, family] of Object.entries(commandFamilies)) {
    if (!family.hub) continue;
    for (const commandName of family.commands) {
      if (commandName !== family.hub) {
        edges.push({ from: `/scr:${family.hub}`, to: `/scr:${commandName}`, type: 'family-member', label: familyKey });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    commandCount: nodes.length,
    edgeCount: edges.length,
    categories,
    lanes,
    familyCount: Object.keys(commandFamilies).length,
    commandFamilies,
    agentRoutes: nodes.filter((node) => node.lane === 'agent-ready' || node.lane === 'agent-or-local').length,
    localRoutes: nodes.filter((node) => node.lane === 'local-helper').length,
    manualRoutes: nodes.filter((node) => node.lane === 'manual-gated').length,
    readOnlyRoutes: nodes.filter((node) => node.lane === 'read-only').length,
    nodes,
    edges,
  };
}

function formatRouteGraphReport(graph) {
  const laneLines = Object.entries(graph.lanes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lane, count]) => `- ${lane}: ${count}`);
  const familyLines = Object.entries(graph.commandFamilies || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, family]) => `- ${family.label}: /scr:${family.hub || 'none'} -> ${family.commandCount} commands`);
  return [
    'Route graph audit:',
    `Commands: ${graph.commandCount}`,
    `Edges: ${graph.edgeCount}`,
    `Command families: ${graph.familyCount || 0}`,
    `Agent-capable routes: ${graph.agentRoutes}`,
    `Local-helper routes: ${graph.localRoutes}`,
    `Manual-gated routes: ${graph.manualRoutes}`,
    `Read-only routes: ${graph.readOnlyRoutes}`,
    'Automation lanes:',
    ...laneLines,
    'Command families:',
    ...familyLines,
  ].join('\n');
}

function parseCliArgs(argv) {
  const out = {
    projectRoot: process.cwd(),
    trigger: '/scr:next',
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--project') {
      out.projectRoot = argv[++i] || out.projectRoot;
    } else if (arg.startsWith('--project=')) {
      out.projectRoot = arg.slice('--project='.length);
    } else if (arg === '--trigger') {
      out.trigger = argv[++i] || out.trigger;
    } else if (arg.startsWith('--trigger=')) {
      out.trigger = arg.slice('--trigger='.length);
    } else if (arg === '--json') {
      out.json = true;
    }
  }
  return out;
}

if (require.main === module) {
  const args = parseCliArgs(process.argv.slice(2));
  const analysis = analyzeProject(args.projectRoot);
  if (args.json) {
    console.log(JSON.stringify(analysis, null, 2));
  } else {
    console.log(formatReport(analysis, { trigger: args.trigger }));
  }
}

// Progress ledger: deterministic deliverable-progress computation from disk.
// See docs/progress-protocol.md. Additive helper used by /scr:progress and any
// runtime that loads this module, so the ledger is consistent across hosts.
function ledgerUnitNumbers(dir, suffixRegex) {
  const found = new Set();
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    return found;
  }
  for (const name of entries) {
    const match = name.match(suffixRegex);
    if (match) {
      found.add(parseInt(match[1], 10));
    }
  }
  return found;
}

function ledgerUnitFileMap(dir, suffixRegex) {
  const found = new Map();
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    return found;
  }
  for (const name of entries) {
    const match = name.match(suffixRegex);
    if (match) {
      found.set(parseInt(match[1], 10), path.join(dir, name));
    }
  }
  return found;
}

function mergeUnitFileMaps(target, source) {
  for (const [unit, file] of source.entries()) {
    if (!target.has(unit)) target.set(unit, file);
  }
  return target;
}

function ledgerOutlineUnitCount(manuscriptDir) {
  let text;
  try {
    text = fs.readFileSync(path.join(manuscriptDir, 'OUTLINE.md'), 'utf8');
  } catch (err) {
    return 0;
  }
  const tableRows = text.match(/^\|\s*\d+\s*\|/gm);
  if (tableRows && tableRows.length) {
    return tableRows.length;
  }
  const numberedLines = text.match(/^\s*\d+[.)]\s+\S/gm);
  return numberedLines ? numberedLines.length : 0;
}

function ledgerBar(done, total, width) {
  const cells = width || 10;
  const filled = total > 0 ? Math.round((done / total) * cells) : 0;
  const clamped = Math.max(0, Math.min(cells, filled));
  return '█'.repeat(clamped) + '░'.repeat(cells - clamped);
}

function ledgerReferencedUnits(text) {
  const units = new Set();
  const pattern = /\b(?:unit|chapter|scene|section|act|part|surah|procedure|poem)\s*#?\s*(\d+)\b/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const unit = parseInt(match[1], 10);
    if (unit > 0) units.add(unit);
  }
  return units;
}

function stateOpenRevisionUnits(manuscriptDir) {
  const text = readText(path.join(manuscriptDir, 'STATE.md'));
  const open = new Set();
  for (const line of text.split(/\r?\n/)) {
    if (!/(open revisions|unresolved review|editor notes.*awaiting revision|awaiting revision|revisions pending)/i.test(line)) {
      continue;
    }
    for (const unit of ledgerReferencedUnits(line)) open.add(unit);
  }
  return open;
}

function stateSubmittedUnits(manuscriptDir) {
  const text = readText(path.join(manuscriptDir, 'STATE.md'));
  const submitted = new Set();
  for (const line of text.split(/\r?\n/)) {
    if (!/\b(submit|submitted)\b/i.test(line)) continue;
    for (const unit of ledgerReferencedUnits(line)) submitted.add(unit);
  }
  return submitted;
}

// Returns deliverable progress for a project's .manuscript directory: total
// units, per-stage counts, the done / in-progress / untouched buckets, a
// percent, a rendered bar, and the unit-number sets. Derived purely from disk
// (plan/draft/review files reconciled with the OUTLINE unit count).
function computeProgressLedger(manuscriptDir) {
  const drafted = ledgerUnitNumbers(
    path.join(manuscriptDir, 'drafts', 'body'),
    /^(\d+)\D.*DRAFT\.md$/i
  );
  const planned = ledgerUnitNumbers(path.join(manuscriptDir, 'plans'), /^(\d+)\D.*PLAN\.md$/i);
  for (const unit of ledgerUnitNumbers(manuscriptDir, /^(\d+)\D.*PLAN\.md$/i)) {
    planned.add(unit);
  }
  const reviewFiles = ledgerUnitFileMap(path.join(manuscriptDir, 'reviews'), /^(\d+)\D.*REVIEW\.md$/i);
  mergeUnitFileMaps(reviewFiles, ledgerUnitFileMap(manuscriptDir, /^(\d+)\D.*EDITOR-NOTES\.md$/i));
  const reviewed = new Set(reviewFiles.keys());
  const submitted = stateSubmittedUnits(manuscriptDir);
  const openReviews = stateOpenRevisionUnits(manuscriptDir);
  for (const [unit, file] of reviewFiles.entries()) {
    if (containsAny(readText(file), OPEN_REVIEW_KEYWORDS)) {
      openReviews.add(unit);
    }
  }
  for (const unit of submitted) {
    openReviews.delete(unit);
  }
  const doneUnits = new Set(submitted);
  for (const unit of reviewed) {
    if (!openReviews.has(unit)) doneUnits.add(unit);
  }

  const worked = new Set([...planned, ...drafted, ...reviewed, ...submitted]);
  const maxWorked = worked.size ? Math.max(...worked) : 0;
  const total = Math.max(ledgerOutlineUnitCount(manuscriptDir), worked.size, maxWorked);

  const done = doneUnits.size;
  const inProgress = [...worked].filter((unit) => !doneUnits.has(unit)).length;
  const untouched = Math.max(0, total - worked.size);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    total,
    drafted: drafted.size,
    planned: planned.size,
    reviewed: reviewed.size,
    submitted: submitted.size,
    done,
    inProgress,
    untouched,
    percent,
    bar: ledgerBar(done, total, 10),
    units: {
      drafted: [...drafted].sort((a, b) => a - b),
      planned: [...planned].sort((a, b) => a - b),
      reviewed: [...reviewed].sort((a, b) => a - b),
      submitted: [...submitted].sort((a, b) => a - b),
      openReviews: [...openReviews].sort((a, b) => a - b),
      done: [...doneUnits].sort((a, b) => a - b),
    },
  };
}

module.exports = {
  AGENT_ROUTE_POLICIES,
  CATEGORY_ROUTE_POLICIES,
  DEFAULT_RUNTIME_SUPPORT,
  DEFAULT_MODEL_POLICY,
  MODEL_ADAPTATION_DOCS,
  DEFAULT_AGENT_NAMES,
  LOCAL_ROUTE_POLICIES,
  MANUAL_ROUTE_POLICIES,
  ROUTE_PRIORITY_FIXTURES,
  analyzeProject,
  buildRouteGraph,
  collectSafeApplyActions,
  expectedCommandCount,
  formatAgentAvailabilityReport,
  formatRouteGraphReport,
  formatProactiveChecks,
  formatAutomationStatus,
  formatRecommendation,
  formatReport,
  formatRuntimeSmokeReport,
  formatSafeApplyReport,
  getCommandAutomationPolicy,
  getExpectedAgentNames,
  getRuntimeAgentSupport,
  inspectAgentAvailability,
  inspectRuntimeSmoke,
  listRuntimeAgentSupport,
  parseCliArgs,
  computeProgressLedger,
  detectContextHealth,
  estimateTextTokens,
};
