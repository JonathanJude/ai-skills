const { confirm } = require('@inquirer/prompts');
const { ensureConfig, readConfig } = require('../core/config');
const { AGENT_LABELS, DEFAULT_INSTALL_MODE } = require('../core/constants');
const { AgentSkillsError } = require('../core/errors');
const { info, success, warn } = require('../core/logger');
const {
  normalizeSkillName,
  validateSkillName,
  resolveAgents,
} = require('../core/validation');
const { installSkillToAgent } = require('../core/installers');
const { aggregateExitCode, isInteractive } = require('../core/command-utils');

async function maybeFallbackToCopy(err, mode, skillName, agentKey, force) {
  if (mode !== 'symlink' || err.code !== 'SYMLINK_FAILED') {
    throw err;
  }

  if (!isInteractive()) {
    throw new AgentSkillsError(
      `Symlink failed for ${agentKey}. Re-run with --mode copy.`,
      { code: 'SYMLINK_FAILED', exitCode: 1 }
    );
  }

  const fallback = await confirm({
    message: `Symlink failed for ${AGENT_LABELS[agentKey]}. Try copy mode for this agent?`,
    default: true,
  });

  if (!fallback) {
    throw err;
  }

  return installSkillToAgent(skillName, agentKey, 'copy', force);
}

async function handleInstallCommand(rawSkillName, options) {
  ensureConfig();

  const { normalized } = normalizeSkillName(rawSkillName);
  validateSkillName(normalized);

  const skillName = normalized;
  const agents = resolveAgents(options.agents, 'default');
  const config = readConfig();

  const mode = options.mode || config.defaults.installMode || DEFAULT_INSTALL_MODE;
  if (!['symlink', 'copy'].includes(mode)) {
    throw new AgentSkillsError('Mode must be symlink or copy', { code: 'INVALID_USAGE', exitCode: 2 });
  }

  if (process.platform === 'win32' && mode === 'symlink') {
    warn('Windows symlink mode may require elevated privileges.');
  }

  info(`Installing ${skillName} to agents: ${agents.join(', ')} using mode=${mode}`);

  const results = [];

  for (const agentKey of agents) {
    try {
      const installed = installSkillToAgent(skillName, agentKey, mode, Boolean(options.force));
      success(`Installed ${skillName} for ${agentKey}: ${installed.targetPath} (${installed.mode})`);
      results.push({ ok: true, agentKey });
    } catch (err) {
      try {
        const fallback = await maybeFallbackToCopy(err, mode, skillName, agentKey, Boolean(options.force));
        success(`Installed ${skillName} for ${agentKey}: ${fallback.targetPath} (${fallback.mode})`);
        results.push({ ok: true, agentKey });
      } catch (innerErr) {
        warn(`Install failed for ${agentKey}: ${innerErr.message}`);
        results.push({ ok: false, agentKey, error: innerErr.message });
      }
    }
  }

  return aggregateExitCode(results);
}

function registerInstallCommand(program) {
  program
    .command('install')
    .description('Install an existing canonical skill to one or more agents')
    .argument('<skillName>', 'skill folder name')
    .option('--agents <csv>', 'Comma-separated list: codex,claude,opencode,kilocode')
    .option('--mode <mode>', 'Install mode: symlink|copy')
    .option('--force', 'Overwrite conflicting target')
    .action(async (skillName, options) => {
      const code = await handleInstallCommand(skillName, options);
      process.exitCode = code;
    });
}

module.exports = {
  registerInstallCommand,
  handleInstallCommand,
};
