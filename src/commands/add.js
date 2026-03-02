const { confirm } = require('@inquirer/prompts');
const { ensureConfig, readConfig } = require('../core/config');
const { DEFAULT_INSTALL_MODE } = require('../core/constants');
const { AgentSkillsError } = require('../core/errors');
const { info, success, warn } = require('../core/logger');
const { parseAgentsCsv, getDefaultInstallAgents } = require('../core/validation');
const { importSkillFromSource } = require('../core/importer');
const { installSkillToAgent } = require('../core/installers');
const { aggregateExitCode, isInteractive } = require('../core/command-utils');

function resolveAgentsForAdd(options) {
  if (options.agents) {
    return parseAgentsCsv(options.agents);
  }

  return getDefaultInstallAgents();
}

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
    message: `Symlink failed for ${agentKey}. Install in copy mode for this agent?`,
    default: true,
  });

  if (!fallback) {
    throw err;
  }

  return installSkillToAgent(skillName, agentKey, 'copy', force);
}

async function handleAddCommand(source, options) {
  ensureConfig();

  const imported = importSkillFromSource(source, {
    name: options.name,
    force: Boolean(options.force),
  });

  info(`Imported skill: ${imported.skillName}`);
  info(`Canonical path: ${imported.canonicalPath}`);

  if (imported.frontmatterInjected) {
    warn('Imported SKILL.md had no YAML frontmatter. Added a generic frontmatter block automatically.');
    warn(`Review and customize: ${imported.canonicalPath}/SKILL.md`);
  }

  if (!options.install) {
    return 0;
  }

  const agents = resolveAgentsForAdd(options);
  if (agents.length === 0) {
    warn('No agents selected for install.');
    return 0;
  }

  const config = readConfig();
  const mode = options.mode || config.defaults.installMode || (process.platform === 'win32' ? 'copy' : DEFAULT_INSTALL_MODE);
  if (!['symlink', 'copy'].includes(mode)) {
    throw new AgentSkillsError('Mode must be symlink or copy', { code: 'INVALID_USAGE', exitCode: 2 });
  }

  info(`Installing ${imported.skillName} to agents: ${agents.join(', ')} using mode=${mode}`);

  const results = [];
  for (const agentKey of agents) {
    try {
      const result = installSkillToAgent(imported.skillName, agentKey, mode, Boolean(options.force));
      success(`Installed ${imported.skillName} for ${agentKey}: ${result.targetPath} (${result.mode})`);
      results.push({ ok: true, agentKey });
    } catch (err) {
      try {
        const fallback = await maybeFallbackToCopy(err, mode, imported.skillName, agentKey, Boolean(options.force));
        success(`Installed ${imported.skillName} for ${agentKey}: ${fallback.targetPath} (${fallback.mode})`);
        results.push({ ok: true, agentKey });
      } catch (innerErr) {
        warn(`Install failed for ${agentKey}: ${innerErr.message}`);
        results.push({ ok: false, agentKey, error: innerErr.message });
      }
    }
  }

  return aggregateExitCode(results);
}

function registerAddCommand(program) {
  program
    .command('add')
    .description('Import an existing skill from a folder or zip into canonical storage, then sync to agents')
    .argument('<source>', 'Path to skill folder or .zip file')
    .option('--name <skillName>', 'Override imported skill name')
    .option('--agents <csv>', 'Comma-separated list: codex,claude,opencode,kilocode')
    .option('--mode <mode>', 'Install mode: symlink|copy')
    .option('--no-install', 'Skip install after import')
    .option('--force', 'Replace existing canonical/target conflicts')
    .action(async (source, options) => {
      const code = await handleAddCommand(source, options);
      process.exitCode = code;
    });
}

module.exports = {
  registerAddCommand,
  handleAddCommand,
};
