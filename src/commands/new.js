const fs = require('fs-extra');
const path = require('path');
const { input, confirm, checkbox } = require('@inquirer/prompts');
const { ensureConfig, readConfig } = require('../core/config');
const { AGENT_KEYS, AGENT_LABELS, DEFAULT_INSTALL_MODE } = require('../core/constants');
const { AgentSkillsError } = require('../core/errors');
const { info, success, warn } = require('../core/logger');
const { renderSkillTemplate } = require('../core/skill-template');
const {
  normalizeSkillName,
  validateSkillName,
  parseAgentsCsv,
  getDefaultInstallAgents,
} = require('../core/validation');
const { getCanonicalSkillPath } = require('../core/paths');
const { installSkillToAgent } = require('../core/installers');
const { aggregateExitCode, isInteractive } = require('../core/command-utils');

function parseListField(value, fallback) {
  if (!value || !value.trim()) {
    return fallback;
  }

  return value
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function collectTemplateData(skillName, options) {
  const interactive = isInteractive();

  const defaults = {
    title: skillName
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
    purpose: 'Describe what this skill helps with and the expected result.',
    whenToUse: ['Use this skill when the request matches its intended domain.'],
    rules: ['Follow repository constraints and project conventions.'],
    outputContract: ['Clarify the task.', 'Produce a concrete output.', 'Summarize decisions and next steps.'],
  };

  if (!interactive) {
    return defaults;
  }

  const title = await input({ message: 'Skill title', default: defaults.title });
  const purpose = await input({ message: 'Skill description/purpose', default: defaults.purpose });
  const whenToUseRaw = await input({
    message: 'When to use (comma or semicolon separated)',
    default: defaults.whenToUse.join('; '),
  });
  const rulesRaw = await input({
    message: 'Rules (comma or semicolon separated)',
    default: defaults.rules.join('; '),
  });
  const outputRaw = await input({
    message: 'Output contract steps (comma or semicolon separated)',
    default: defaults.outputContract.join('; '),
  });

  return {
    title,
    purpose,
    whenToUse: parseListField(whenToUseRaw, defaults.whenToUse),
    rules: parseListField(rulesRaw, defaults.rules),
    outputContract: parseListField(outputRaw, defaults.outputContract),
  };
}

async function resolveNewAgents(options) {
  if (options.agents) {
    return parseAgentsCsv(options.agents);
  }

  const defaults = getDefaultInstallAgents();
  if (!isInteractive()) {
    return defaults;
  }

  const selected = await checkbox({
    message: 'Select agents to install',
    choices: AGENT_KEYS.map((agentKey) => ({
      name: `${AGENT_LABELS[agentKey]} (${agentKey})`,
      value: agentKey,
      checked: defaults.includes(agentKey),
    })),
  });

  return selected;
}

async function maybeFallbackToCopy(err, mode, skillName, agentKey, force) {
  if (mode !== 'symlink' || err.code !== 'SYMLINK_FAILED') {
    throw err;
  }

  if (!isInteractive()) {
    throw new AgentSkillsError(
      `Symlink failed for ${agentKey}. Rerun with --mode copy or use install command in copy mode.`,
      { code: 'SYMLINK_FAILED', exitCode: 1 }
    );
  }

  const shouldFallback = await confirm({
    message: `Symlink failed for ${agentKey}. Install in copy mode instead?`,
    default: true,
  });

  if (!shouldFallback) {
    throw err;
  }

  return installSkillToAgent(skillName, agentKey, 'copy', force);
}

async function handleNewCommand(rawSkillName, options) {
  ensureConfig();

  const { normalized, changed, original } = normalizeSkillName(rawSkillName);
  if (changed && isInteractive()) {
    const shouldUse = await confirm({
      message: `Normalize skill name from "${original}" to "${normalized}"?`,
      default: true,
    });

    if (!shouldUse) {
      throw new AgentSkillsError('Skill name normalization rejected by user', {
        code: 'INVALID_USAGE',
        exitCode: 2,
      });
    }
  }

  validateSkillName(normalized);

  const skillName = normalized;
  if (changed && !isInteractive()) {
    info(`Normalized skill name: ${skillName}`);
  }

  const skillPath = getCanonicalSkillPath(skillName);
  if (fs.existsSync(skillPath)) {
    throw new AgentSkillsError(`Skill already exists: ${skillPath}`, { code: 'ALREADY_EXISTS', exitCode: 1 });
  }

  const templateData = await collectTemplateData(skillName, options);

  let withReferences = Boolean(options.withReferences);
  let withScripts = Boolean(options.withScripts);

  if (!options.withReferences && isInteractive()) {
    withReferences = await confirm({ message: 'Include references/ directory?', default: true });
  }

  if (!options.withScripts && isInteractive()) {
    withScripts = await confirm({ message: 'Include scripts/ directory?', default: true });
  }

  fs.ensureDirSync(skillPath);
  const skillMarkdown = renderSkillTemplate(options.template || 'default', {
    ...templateData,
    skillName,
  });
  fs.writeFileSync(path.join(skillPath, 'SKILL.md'), skillMarkdown, 'utf8');

  if (withReferences) {
    fs.ensureDirSync(path.join(skillPath, 'references'));
  }

  if (withScripts) {
    fs.ensureDirSync(path.join(skillPath, 'scripts'));
  }

  fs.writeJsonSync(path.join(skillPath, '.agentskills.json'), {
    createdAt: new Date().toISOString(),
    toolVersion: require('../../package.json').version,
    description: templateData.purpose,
  }, { spaces: 2 });

  info(`Canonical skill created: ${skillPath}`);

  if (!options.install) {
    return 0;
  }

  const agents = await resolveNewAgents(options);
  if (agents.length === 0) {
    warn('No agents selected for install.');
    return 0;
  }

  const config = readConfig();
  const preferredMode = config.defaults?.installMode || (process.platform === 'win32' ? 'copy' : DEFAULT_INSTALL_MODE);
  const results = [];

  for (const agentKey of agents) {
    try {
      const installed = installSkillToAgent(skillName, agentKey, preferredMode, false);
      results.push({ ok: true, result: installed });
      success(`Installed for ${agentKey} at ${installed.targetPath} (${installed.mode})`);
    } catch (err) {
      try {
        const fallback = await maybeFallbackToCopy(err, preferredMode, skillName, agentKey, false);
        results.push({ ok: true, result: fallback });
        success(`Installed for ${agentKey} at ${fallback.targetPath} (${fallback.mode})`);
      } catch (innerErr) {
        results.push({ ok: false, error: innerErr, agentKey });
        warn(`Failed install for ${agentKey}: ${innerErr.message}`);
      }
    }
  }

  return aggregateExitCode(results);
}

function registerNewCommand(program) {
  program
    .command('new')
    .description('Create a canonical skill and install it to agents by default')
    .argument('<skillName>', 'skill folder name')
    .option('--agents <csv>', 'Comma-separated list: codex,claude,opencode,kilocode')
    .option('--no-install', 'Skip install after creation')
    .option('--template <name>', 'Template name, e.g. default or flutter', 'default')
    .option('--with-references', 'Create references/ directory')
    .option('--with-scripts', 'Create scripts/ directory')
    .action(async (skillName, options) => {
      const code = await handleNewCommand(skillName, options);
      process.exitCode = code;
    });
}

module.exports = {
  registerNewCommand,
  handleNewCommand,
};
