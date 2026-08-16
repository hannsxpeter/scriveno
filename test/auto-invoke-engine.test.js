const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { describe, it } = require('node:test');

const {
  AGENT_ROUTE_POLICIES,
  CATEGORY_ROUTE_POLICIES,
  DEFAULT_MODEL_POLICY,
  MODEL_ADAPTATION_DOCS,
  analyzeProject,
  buildRouteGraph,
  collectSafeApplyActions,
  formatAgentAvailabilityReport,
  formatReport,
  formatRuntimeSmokeReport,
  formatSafeApplyReport,
  getCommandAutomationPolicy,
  getExpectedAgentNames,
  inspectAgentAvailability,
  inspectRuntimeSmoke,
  getRuntimeAgentSupport,
  LOCAL_ROUTE_POLICIES,
  MANUAL_ROUTE_POLICIES,
  listRuntimeAgentSupport,
  ROUTE_PRIORITY_FIXTURES,
} = require('../lib/auto-invoke-engine.js');

const ROOT = path.resolve(__dirname, '..');

it('discovers only executable agent prompts from the package agent directory', () => {
  assert.deepStrictEqual(
    getExpectedAgentNames({ agentsRoot: path.join(ROOT, 'agents') }),
    ['continuity-checker', 'drafter', 'plan-checker', 'researcher', 'translator', 'voice-checker']
  );
});

function mkProject(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `scriveno-auto-${label}-`));
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

const STYLE_GUIDE_BODY = [
  '# Style Guide',
  'Voice baseline: precise, intimate, concrete, and restrained.',
  'Sentence rhythm: mostly compact sentences with a few longer reflective turns.',
  'Diction: plain language, specific verbs, no generic filler.',
  'Imagery: sensory details grounded in the current scene.',
  'Point of view: close interior attention without explaining too much.',
  'Dialogue: clipped when tense, warmer when trust is present.',
  'Pacing: prioritize momentum and clear transitions.',
  'Revision bias: cut abstraction before cutting emotional truth.',
].join('\n');

function writeVoiceProfile(manuscriptDir, options = {}) {
  write(path.join(manuscriptDir, 'STYLE-GUIDE.md'), STYLE_GUIDE_BODY);
  if (options.calibrated !== false) {
    const configPath = path.join(manuscriptDir, 'config.json');
    const config = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
      : {};
    config.voice = { ...(config.voice || {}), calibrated: true };
    write(configPath, `${JSON.stringify(config, null, 2)}\n`);
  }
}

function touchTime(filePath, secondsAgo) {
  const when = new Date(Date.now() - secondsAgo * 1000);
  fs.utimesSync(filePath, when, when);
}

describe('auto-invoke engine', () => {
  it('recommends starting a work when no manuscript exists', () => {
    const project = mkProject('empty');
    try {
      const analysis = analyzeProject(project);

      assert.equal(analysis.signals.hasProject, false);
      assert.equal(analysis.recommendation.command, '/scr:new-work');
      assert.match(formatReport(analysis), /Automation status:/);
      assert.match(formatReport(analysis), /Spawned agents:\n- none/);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('detects stale context, unresolved reviews, translation work, and stale exports', () => {
    const project = mkProject('signals');
    try {
      const manuscript = path.join(project, '.manuscript');
      write(path.join(manuscript, 'STATE.md'), 'Current unit: 2\n');
      write(path.join(manuscript, 'CONTEXT.md'), 'Suggested next step: old\n');
      write(path.join(manuscript, 'config.json'), JSON.stringify({
        scriveno_version: 'test',
        work_type: 'novel',
        command_unit: 'chapter',
        target_languages: ['es'],
      }, null, 2));
      write(path.join(manuscript, 'drafts', 'body', '1-DRAFT.md'), 'Draft text\n');
      write(path.join(manuscript, 'reviews', '1-REVIEW.md'), 'TODO: resolve pacing\n');
      write(path.join(manuscript, 'translation', 'GLOSSARY-es.md'), '| term | translation |\n');
      write(path.join(manuscript, 'output', 'manuscript.epub'), 'old export\n');

      touchTime(path.join(manuscript, 'CONTEXT.md'), 30);
      touchTime(path.join(manuscript, 'output', 'manuscript.epub'), 20);
      touchTime(path.join(manuscript, 'STATE.md'), 10);
      touchTime(path.join(manuscript, 'drafts', 'body', '1-DRAFT.md'), 5);

      const analysis = analyzeProject(project);

      assert.equal(analysis.signals.context.state, 'stale');
      assert.equal(analysis.signals.reviews.count, 1);
      assert.equal(analysis.signals.translation.state, 'follow-up available');
      assert.equal(analysis.signals.export.state, 'stale');
      assert.equal(analysis.recommendation.command, '/scr:scan');
      assert.match(formatReport(analysis, { trigger: '/scr:next' }), /Proactive checks:/);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('falls back to planning when a project has state but no drafts', () => {
    const project = mkProject('plan');
    try {
      const manuscript = path.join(project, '.manuscript');
      write(path.join(manuscript, 'STATE.md'), 'Current unit: 1\n');
      write(path.join(manuscript, 'CONTEXT.md'), 'Suggested next step: plan\n');
      write(path.join(manuscript, 'config.json'), '{"work_type":"essay","command_unit":"section"}\n');
      writeVoiceProfile(manuscript);

      const analysis = analyzeProject(project);

      assert.equal(analysis.counts.drafts, 0);
      assert.equal(analysis.recommendation.command, '/scr:plan');
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('routes planned-but-undrafted work to the drafter path', () => {
    const project = mkProject('planned-draft');
    try {
      const manuscript = path.join(project, '.manuscript');
      write(path.join(manuscript, 'STATE.md'), 'Current unit: 1\n');
      write(path.join(manuscript, 'CONTEXT.md'), 'Suggested next step: draft\n');
      write(path.join(manuscript, 'config.json'), '{"work_type":"novel","command_unit":"chapter"}\n');
      write(path.join(manuscript, 'plans', '1-1-PLAN.md'), 'Plan\n');
      writeVoiceProfile(manuscript);

      const analysis = analyzeProject(project);
      const report = formatReport(analysis, { trigger: '/scr:next' });

      assert.equal(analysis.signals.plan.state, 'ready-to-draft');
      assert.equal(analysis.recommendation.command, '/scr:draft 1');
      assert.equal(analysis.automation.mode, 'agent-ready');
      assert.deepEqual(analysis.automation.spawnCandidates[0].agents, ['drafter', 'voice-checker']);
      assert.match(report, /Candidate agents:/);
      assert.match(report, /\/scr:draft 1: drafter, voice-checker/);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('keeps planned work behind profile-writer when STYLE-GUIDE.md is still a template', () => {
    const project = mkProject('template-style');
    try {
      const manuscript = path.join(project, '.manuscript');
      write(path.join(manuscript, 'STATE.md'), 'Current unit: 1\n');
      write(path.join(manuscript, 'CONTEXT.md'), 'Suggested next step: draft\n');
      write(path.join(manuscript, 'config.json'), '{"work_type":"novel","command_unit":"chapter"}\n');
      write(path.join(manuscript, 'plans', '1-1-PLAN.md'), 'Plan\n');
      write(path.join(manuscript, 'STYLE-GUIDE.md'), '# Style Guide\nTODO: describe your writing voice\n');

      const analysis = analyzeProject(project);

      assert.equal(analysis.signals.styleGuide.state, 'template');
      assert.equal(analysis.signals.plan.state, 'ready-to-draft');
      assert.equal(analysis.recommendation.command, '/scr:profile-writer');
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('routes a populated but uncalibrated profile through voice-test before drafting', () => {
    const project = mkProject('uncalibrated-style');
    try {
      const manuscript = path.join(project, '.manuscript');
      write(path.join(manuscript, 'STATE.md'), 'Current unit: 1\n');
      write(path.join(manuscript, 'CONTEXT.md'), 'Suggested next step: draft\n');
      write(path.join(manuscript, 'config.json'), '{"work_type":"novel","command_unit":"chapter"}\n');
      write(path.join(manuscript, 'plans', '1-1-PLAN.md'), 'Plan\n');
      writeVoiceProfile(manuscript, { calibrated: false });

      const analysis = analyzeProject(project);

      assert.equal(analysis.signals.styleGuide.state, 'profiled-unverified');
      assert.equal(analysis.signals.plan.state, 'ready-to-draft');
      assert.equal(analysis.recommendation.command, '/scr:voice-test');
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('routes planned gaps before unresolved review notes', () => {
    const project = mkProject('plan-before-review');
    try {
      const manuscript = path.join(project, '.manuscript');
      write(path.join(manuscript, 'STATE.md'), 'Current unit: 5\n');
      write(path.join(manuscript, 'CONTEXT.md'), 'Suggested next step: demo\n');
      write(path.join(manuscript, 'config.json'), '{"work_type":"novel","command_unit":"chapter"}\n');
      write(path.join(manuscript, 'plans', '5-PLAN.md'), 'Plan\n');
      write(path.join(manuscript, 'reviews', '4-REVIEW.md'), 'TODO: tighten previous unit\n');
      writeVoiceProfile(manuscript);

      const analysis = analyzeProject(project);

      assert.equal(analysis.signals.plan.state, 'ready-to-draft');
      assert.equal(analysis.signals.reviews.count, 1);
      assert.equal(analysis.recommendation.command, '/scr:draft 5');
      assert.match(analysis.recommendation.reason, /Unit 5/);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('routes drafted work without reviews to editor review before export', () => {
    const project = mkProject('review-gap');
    try {
      const manuscript = path.join(project, '.manuscript');
      write(path.join(manuscript, 'STATE.md'), 'Current unit: 1\n');
      write(path.join(manuscript, 'CONTEXT.md'), 'Suggested next step: review\n');
      write(path.join(manuscript, 'config.json'), '{"work_type":"novel","command_unit":"chapter"}\n');
      write(path.join(manuscript, 'plans', '1-1-PLAN.md'), 'Plan\n');
      write(path.join(manuscript, 'drafts', 'body', '1-1-DRAFT.md'), 'Draft text\n');
      writeVoiceProfile(manuscript);
      touchTime(path.join(manuscript, 'STATE.md'), 10);
      touchTime(path.join(manuscript, 'drafts', 'body', '1-1-DRAFT.md'), 5);
      touchTime(path.join(manuscript, 'CONTEXT.md'), 1);

      const analysis = analyzeProject(project);

      assert.equal(analysis.signals.reviewCoverage.state, 'missing');
      assert.equal(analysis.recommendation.command, '/scr:editor-review 1');
      assert.equal(analysis.automation.mode, 'agent-ready');
      assert.equal(analysis.automation.spawnCandidates[0].command, '/scr:editor-review 1');
      assert.ok(analysis.automation.manualGates.some((gate) => gate.command === '/scr:publish'));
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('surfaces notes, revision proposals, and publishing gaps as connected routes', () => {
    const project = mkProject('side-flows');
    try {
      const manuscript = path.join(project, '.manuscript');
      write(path.join(manuscript, 'STATE.md'), 'Current unit: 1\n');
      write(path.join(manuscript, 'CONTEXT.md'), 'Suggested next step: review proposal\n');
      write(path.join(manuscript, 'config.json'), '{"work_type":"novel","command_unit":"chapter"}\n');
      write(path.join(manuscript, 'plans', '1-1-PLAN.md'), 'Plan\n');
      write(path.join(manuscript, 'drafts', 'body', '1-1-DRAFT.md'), 'Draft text\n');
      write(path.join(manuscript, 'reviews', '1-REVIEW.md'), 'Review passed\n');
      write(path.join(manuscript, 'notes', 'open.md'), 'TODO: tighten ending\n');
      write(path.join(manuscript, 'tracks.json'), JSON.stringify({ tracks: [{ label: 'Alt ending', status: 'active' }] }, null, 2));
      write(path.join(manuscript, 'proposals', 'alt-ending-proposal.md'), 'Proposal\n');
      write(path.join(manuscript, 'HISTORY.log'), '2026-05-16T12:00:00Z | scr:draft | outcome=ok\n');
      writeVoiceProfile(manuscript);
      touchTime(path.join(manuscript, 'STATE.md'), 10);
      touchTime(path.join(manuscript, 'drafts', 'body', '1-1-DRAFT.md'), 5);
      touchTime(path.join(manuscript, 'CONTEXT.md'), 1);

      const analysis = analyzeProject(project);

      assert.equal(analysis.signals.notes.count, 1);
      assert.equal(analysis.signals.tracks.state, 'proposal-ready');
      assert.deepEqual(analysis.signals.publishing.gaps, ['front-matter', 'back-matter', 'blurb', 'cover-art']);
      assert.equal(analysis.recommendation.command, '/scr:editor-review --proposal');
      assert.ok(analysis.automation.localCandidates.some((candidate) => candidate.command === '/scr:check-notes'));
      assert.ok(analysis.automation.manualGates.some((gate) => gate.command === '/scr:editor-review --proposal'));
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('routes publication-ready manuscripts through prepublish review before export', () => {
    const project = mkProject('prepublish-review');
    try {
      const manuscript = path.join(project, '.manuscript');
      write(path.join(manuscript, 'STATE.md'), 'Current unit: 1\nDraft complete: true\n');
      write(path.join(manuscript, 'CONTEXT.md'), 'Suggested next step: final review\n');
      write(path.join(manuscript, 'config.json'), '{"work_type":"novel","command_unit":"chapter"}\n');
      write(path.join(manuscript, 'plans', '1-1-PLAN.md'), 'Plan\n');
      write(path.join(manuscript, 'drafts', 'body', '1-1-DRAFT.md'), 'Draft text\n');
      write(path.join(manuscript, 'reviews', '1-REVIEW.md'), 'Review passed\n');
      write(path.join(manuscript, 'front-matter', '03-title-page.md'), '# Title\n');
      write(path.join(manuscript, 'back-matter', 'about-author.md'), '# About the Author\n');
      write(path.join(manuscript, 'output', 'blurb.md'), 'Blurb\n');
      write(path.join(manuscript, 'build', 'ebook-cover.jpg'), 'cover\n');
      write(path.join(manuscript, 'HISTORY.log'), '2026-05-16T12:00:00Z | scr:complete-draft | outcome=ok\n');
      writeVoiceProfile(manuscript);
      touchTime(path.join(manuscript, 'STATE.md'), 10);
      touchTime(path.join(manuscript, 'drafts', 'body', '1-1-DRAFT.md'), 5);
      touchTime(path.join(manuscript, 'CONTEXT.md'), 1);

      const analysis = analyzeProject(project);

      assert.equal(analysis.signals.publishing.state, 'editorial-review-needed');
      assert.equal(analysis.signals.publishing.suggest, '/scr:prepublish-review');
      assert.equal(analysis.recommendation.command, '/scr:prepublish-review');
      assert.equal(analysis.automation.mode, 'manual-gated');
      assert.ok(analysis.automation.manualGates.some((gate) => gate.command === '/scr:prepublish-review'));
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('routes prepublish-approved manuscripts to compliance before publish', () => {
    const project = mkProject('compliance-review');
    try {
      const manuscript = path.join(project, '.manuscript');
      write(path.join(manuscript, 'STATE.md'), 'Current unit: 1\nDraft complete: true\n');
      write(path.join(manuscript, 'CONTEXT.md'), 'Suggested next step: publish\n');
      write(path.join(manuscript, 'config.json'), '{"work_type":"novel","command_unit":"chapter"}\n');
      write(path.join(manuscript, 'plans', '1-1-PLAN.md'), 'Plan\n');
      write(path.join(manuscript, 'drafts', 'body', '1-1-DRAFT.md'), 'Draft text\n');
      write(path.join(manuscript, 'reviews', '1-REVIEW.md'), 'Review passed\n');
      write(path.join(manuscript, 'reviews', 'PREPUBLISH-REVIEW.md'), 'GO\n');
      write(path.join(manuscript, 'front-matter', '03-title-page.md'), '# Title\n');
      write(path.join(manuscript, 'back-matter', 'about-author.md'), '# About the Author\n');
      write(path.join(manuscript, 'marketing', 'BLURB.md'), 'Blurb\n');
      write(path.join(manuscript, 'build', 'ebook-cover.jpg'), 'cover\n');
      writeVoiceProfile(manuscript);
      touchTime(path.join(manuscript, 'STATE.md'), 10);
      touchTime(path.join(manuscript, 'drafts', 'body', '1-1-DRAFT.md'), 5);
      touchTime(path.join(manuscript, 'CONTEXT.md'), 1);

      const analysis = analyzeProject(project);

      assert.equal(analysis.signals.publishing.state, 'compliance-needed');
      assert.equal(analysis.signals.publishing.suggest, '/scr:compliance-check');
      assert.equal(analysis.recommendation.command, '/scr:compliance-check');
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('exports route policies for docs and coverage checks', () => {
    assert.ok(AGENT_ROUTE_POLICIES['/scr:draft']);
    assert.ok(LOCAL_ROUTE_POLICIES['/scr:save']);
    assert.ok(MANUAL_ROUTE_POLICIES['/scr:prepublish-review']);
    assert.ok(MANUAL_ROUTE_POLICIES['/scr:publish']);
    assert.ok(CATEGORY_ROUTE_POLICIES.publishing);
  });

  it('classifies every command registry route into an automation lane', () => {
    const constraints = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'CONSTRAINTS.json'), 'utf8'));
    const lanes = new Set();

    for (const [name, command] of Object.entries(constraints.commands)) {
      const policy = getCommandAutomationPolicy(name, command);

      assert.ok(policy.ref.startsWith('/scr:'), `${name} should have a runnable ref`);
      assert.ok(policy.lane, `${name} should have an automation lane`);
      assert.ok(policy.reason, `${name} should explain its automation lane`);
      lanes.add(policy.lane);
    }

    assert.ok(lanes.has('agent-ready'));
    assert.ok(lanes.has('local-helper'));
    assert.ok(lanes.has('manual-gated'));
    assert.ok(lanes.has('read-only'));
  });

  it('exposes a route graph audit and priority fixtures', () => {
    const graph = buildRouteGraph({ constraintsPath: path.join(ROOT, 'data', 'CONSTRAINTS.json') });
    const commandNames = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'CONSTRAINTS.json'), 'utf8')).commands));

    assert.equal(graph.commandCount, commandNames.size);
    assert.ok(graph.edgeCount > 0);
    assert.ok(graph.familyCount >= 5);
    assert.equal(graph.commandFamilies.structure.hub, 'outline');
    assert.ok(graph.commandFamilies.publishing.commands.includes('build-ebook'));
    assert.ok(graph.nodes.some((node) => node.name === 'add-unit' && node.families.includes('structure')));
    assert.ok(graph.edges.some((edge) => edge.type === 'family-member' && edge.from === '/scr:outline' && edge.to === '/scr:add-unit'));
    assert.ok(graph.lanes['agent-ready'] > 0);
    assert.ok(graph.lanes['local-helper'] > 0);
    assert.ok(graph.lanes['manual-gated'] > 0);
    for (const fixture of ROUTE_PRIORITY_FIXTURES) {
      assert.ok(fixture.expectedCommand.startsWith('/scr:'));
      const commandName = fixture.expectedCommand.replace(/^\/scr:/, '').split(/\s+/)[0];
      assert.ok(commandNames.has(commandName), `${fixture.name} should point at a known command`);
    }
  });

  it('reports safe apply without mutating writer-owned paths', () => {
    const project = mkProject('safe-apply');
    try {
      const manuscript = path.join(project, '.manuscript');
      write(path.join(manuscript, 'STATE.md'), 'Current unit: 1\n');
      write(path.join(manuscript, 'CONTEXT.md'), 'Suggested next step: notes\n');
      write(path.join(manuscript, 'config.json'), '{"work_type":"novel","command_unit":"chapter"}\n');
      write(path.join(manuscript, 'drafts', 'body', '1-DRAFT.md'), 'Draft text\n');
      write(path.join(manuscript, 'notes', 'todo.md'), 'TODO: resolve this\n');
      writeVoiceProfile(manuscript);
      touchTime(path.join(manuscript, 'STATE.md'), 10);
      touchTime(path.join(manuscript, 'drafts', 'body', '1-DRAFT.md'), 5);
      touchTime(path.join(manuscript, 'CONTEXT.md'), 1);

      const result = collectSafeApplyActions(project);
      const report = formatSafeApplyReport(result);

      assert.equal(result.appliedCount, 1);
      assert.ok(result.safeToRunCount >= 1);
      assert.ok(result.agentCandidateCount >= 1);
      assert.ok(result.actions.some((action) => action.command === '/scr:check-notes' && action.status === 'ready'));
      assert.ok(result.actions.some((action) => action.command === '/scr:editor-review 1' && action.status === 'agent-candidate'));
      assert.match(report, /Safe apply status:/);
      assert.match(report, /read-only/);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('checks agent availability and runtime smoke across runtime surfaces', () => {
    const homeDir = mkProject('runtime-home');
    try {
      const agentNames = ['drafter', 'voice-checker'];
      for (const name of agentNames) {
        write(path.join(homeDir, '.claude', 'agents', `${name}.md`), `# ${name}\n`);
        write(path.join(homeDir, '.codex', 'agents', `${name}.md`), `# ${name}\n`);
        write(path.join(homeDir, '.codex', 'agents', `${name}.toml`), `name = "${name}"\n`);
      }
      for (const command of ['scr-next.md', 'scr-sync.md']) {
        write(path.join(homeDir, '.claude', 'commands', command), '# command\n');
      }
      for (const command of ['next.md', 'sync.md']) {
        write(path.join(homeDir, '.codex', 'commands', 'scr', command), '# command\n');
      }
      for (const skill of ['scr-next', 'scr-sync']) {
        write(path.join(homeDir, '.codex', 'skills', skill, 'SKILL.md'), '# skill\n');
      }
      write(path.join(homeDir, '.scriveno', 'lib', 'auto-invoke-engine.js'), 'module.exports = {};\n');
      for (const docPath of MODEL_ADAPTATION_DOCS) {
        write(path.join(homeDir, '.scriveno', docPath), `# ${docPath}\n`);
      }

      const availability = inspectAgentAvailability({
        homeDir,
        agentNames,
        runtimeKeys: ['claude-code', 'codex'],
      });
      const smoke = inspectRuntimeSmoke({
        homeDir,
        agentNames,
        expectedCommands: 2,
        runtimeKeys: ['claude-code', 'codex'],
      });

      assert.equal(availability.runtimes.find((runtime) => runtime.runtime === 'claude-code').status, 'prompt-fallback-ready');
      assert.equal(availability.runtimes.find((runtime) => runtime.runtime === 'codex').status, 'metadata-ready');
      assert.equal(availability.runtimes.find((runtime) => runtime.runtime === 'codex').modelPolicy, DEFAULT_MODEL_POLICY);
      assert.equal(smoke.ok, true);
      assert.equal(smoke.runtimes.find((runtime) => runtime.runtime === 'codex').modelDocsReady, true);
      assert.match(formatAgentAvailabilityReport(availability), /Model policy: host-owned model/);
      assert.match(formatRuntimeSmokeReport(smoke), /Runtime smoke status:/);
      assert.match(formatRuntimeSmokeReport(smoke), /Model docs: 3\/3/);
    } finally {
      fs.rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('scopes runtime smoke to installed project runtimes', () => {
    const project = mkProject('runtime-project');
    try {
      const agentNames = ['drafter', 'voice-checker'];
      write(path.join(project, '.scriveno', 'settings.json'), JSON.stringify({
        runtimes: ['codex'],
        scope: 'project',
      }, null, 2));
      for (const name of agentNames) {
        write(path.join(project, '.codex', 'agents', `${name}.md`), `# ${name}\n`);
        write(path.join(project, '.codex', 'agents', `${name}.toml`), `name = "${name}"\n`);
      }
      for (const command of ['next.md', 'sync.md']) {
        write(path.join(project, '.codex', 'commands', 'scr', command), '# command\n');
      }
      for (const skill of ['scr-next', 'scr-sync']) {
        write(path.join(project, '.codex', 'skills', skill, 'SKILL.md'), '# skill\n');
      }
      write(path.join(project, '.scriveno', 'lib', 'auto-invoke-engine.js'), 'module.exports = {};\n');
      for (const docPath of MODEL_ADAPTATION_DOCS) {
        write(path.join(project, '.scriveno', docPath), `# ${docPath}\n`);
      }

      const smoke = inspectRuntimeSmoke({
        projectRoot: project,
        agentNames,
        expectedCommands: 2,
      });
      const availability = inspectAgentAvailability({
        projectRoot: project,
        agentNames,
      });

      assert.equal(smoke.runtimes.length, 1);
      assert.equal(smoke.runtimes[0].runtime, 'codex');
      assert.equal(smoke.runtimes[0].scope, 'project');
      assert.equal(smoke.ok, true);
      assert.equal(availability.runtimes.length, 1);
      assert.equal(availability.runtimes[0].status, 'metadata-ready');
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('exposes runtime support for Codex, Claude Code, and every installer runtime', () => {
    const runtimes = listRuntimeAgentSupport();
    const keys = runtimes.map((runtime) => runtime.key).sort();

    assert.deepEqual(keys, [
      'antigravity',
      'claude-code',
      'codex',
      'copilot',
      'cursor',
      'gemini-cli',
      'generic',
      'manus',
      'opencode',
      'perplexity-desktop',
      'windsurf',
    ].sort());
    assert.equal(getRuntimeAgentSupport('codex').metadata, 'toml');
    assert.equal(getRuntimeAgentSupport('claude-code').surface, 'flat commands plus agent prompts');
    assert.equal(getRuntimeAgentSupport('generic').modelPolicy, DEFAULT_MODEL_POLICY);
    assert.deepEqual(getRuntimeAgentSupport('generic').adaptationDocs, MODEL_ADAPTATION_DOCS);
    for (const runtime of runtimes) {
      assert.ok(runtime.fallback, `${runtime.key} should document fallback behavior`);
      assert.ok(runtime.surface, `${runtime.key} should document installed surface`);
      assert.ok(runtime.modelPolicy, `${runtime.key} should document the host-owned model policy`);
    }
  });

  it('classifies research as agent-ready while keeping default scan local', () => {
    assert.equal(getCommandAutomationPolicy('/scr:research', { category: 'utility' }).lane, 'agent-ready');
    assert.equal(getCommandAutomationPolicy('/scr:scan', { category: 'utility' }).lane, 'local-helper');
    assert.equal(AGENT_ROUTE_POLICIES['/scr:research'].agents[0], 'researcher');
  });

  it('runs from the command line for installed command callers', () => {
    const project = mkProject('cli');
    try {
      const out = execFileSync(
        process.execPath,
        [path.join(ROOT, 'lib', 'auto-invoke-engine.js'), '--project', project, '--trigger', '/scr:progress'],
        { encoding: 'utf8' }
      );

      assert.match(out, /Proactive checks:/);
      assert.match(out, /Trigger: \/scr:progress/);
      assert.match(out, /Next commands:/);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('runs through the public scriveno status command in text mode', () => {
    const project = mkProject('bin-status');
    try {
      const out = execFileSync(
        process.execPath,
        [
          path.join(ROOT, 'bin', 'install.js'),
          'status',
          '--project',
          project,
          '--trigger',
          '/scr:next',
        ],
        { encoding: 'utf8' }
      );

      assert.match(out, /Proactive checks:/);
      assert.match(out, /Trigger: \/scr:next/);
      assert.match(out, /Next commands:/);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('runs through the public scriveno status command in JSON mode', () => {
    const project = mkProject('bin-json');
    try {
      const out = execFileSync(
        process.execPath,
        [path.join(ROOT, 'bin', 'install.js'), 'status', project, '--json'],
        { encoding: 'utf8' }
      );
      const parsed = JSON.parse(out);

      assert.equal(parsed.projectRoot, project);
      assert.equal(parsed.recommendation.command, '/scr:new-work');
      assert.equal(parsed.signals.hasProject, false);
      assert.deepEqual(parsed.recommendation.alternatives, [
        '/scr:demo',
        '/scr:import',
        '/scr:profile-writer',
      ]);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('runs through the public scriveno first-run command', () => {
    const project = mkProject('bin-first-run');
    try {
      const textOut = execFileSync(
        process.execPath,
        [path.join(ROOT, 'bin', 'install.js'), 'first-run', '--project', project],
        { encoding: 'utf8' }
      );
      const jsonOut = execFileSync(
        process.execPath,
        [path.join(ROOT, 'bin', 'install.js'), 'first-run', '--project', project, '--json'],
        { encoding: 'utf8' }
      );
      const parsed = JSON.parse(jsonOut);

      assert.match(textOut, /Scriveno first-run guide/);
      assert.match(textOut, /Runtime command shapes:/);
      assert.match(textOut, /Generic skills:/);
      assert.match(textOut, /Model adaptation:/);
      assert.match(textOut, /docs\/model-adaptation\.md/);
      assert.match(textOut, /\/scr:demo/);
      assert.equal(parsed.projectRoot, project);
      assert.equal(parsed.recommendation.command, '/scr:new-work');
      assert.ok(parsed.firstPath.includes('/scr:draft 5'));
      assert.ok(parsed.firstPath.includes('/scr:save'));
      assert.equal(parsed.modelAdaptation.policy, DEFAULT_MODEL_POLICY);
      assert.ok(parsed.modelAdaptation.latest.includes('/scr:scan --deep read-only auditors'));
      // Cross-check the subprocess output against the in-process engine rather
      // than a hardcoded count, so adding/removing a command does not break this.
      assert.equal(parsed.checks.commandCount, buildRouteGraph().commandCount);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('runs public proactive audit commands in JSON mode', () => {
    const project = mkProject('bin-audit');
    try {
      const statusOut = execFileSync(
        process.execPath,
        [path.join(ROOT, 'bin', 'install.js'), 'status', project, '--apply-safe', '--json'],
        { encoding: 'utf8' }
      );
      const syncOut = execFileSync(
        process.execPath,
        [path.join(ROOT, 'bin', 'install.js'), 'sync', '--check', '--project', project, '--json'],
        { encoding: 'utf8' }
      );
      const routesOut = execFileSync(
        process.execPath,
        [path.join(ROOT, 'bin', 'install.js'), 'routes', '--json'],
        { encoding: 'utf8' }
      );

      assert.equal(JSON.parse(statusOut).safeApply.appliedCount, 1);
      assert.equal(JSON.parse(syncOut).analysis.projectRoot, project);
      assert.equal(JSON.parse(routesOut).commandCount, buildRouteGraph().commandCount);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });
});
