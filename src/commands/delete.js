const fs = require('fs-extra');
const { confirm } = require('@inquirer/prompts');
const { ensureConfig } = require('../core/config');
const { AISkillError } = require('../core/errors');
const { info, success, warn } = require('../core/logger');
const {
  normalizeSkillName,
  validateSkillName,
  parseAgentsCsv,
} = require('../core/validation');
const { getCanonicalSkillPath } = require('../core/paths');
const { getSkillStatus } = require('../core/status');
const { uninstallSkillFromAgent } = require('../core/installers');
const { aggregateExitCode, isInteractive } = require('../core/command-utils');

function installedAgentsFromStatus(status) {
  return Object.entries(status.agents)
    .filter(([, value]) => value.installed)
    .map(([key]) => key);
}

async function maybeConfirmUninstallFirst(skillName, installedAgents) {
  if (!isInteractive()) {
    return false;
  }

  return confirm({
    message: `Skill ${skillName} is installed on ${installedAgents.join(', ')}. Uninstall first and continue delete?`,
    default: true,
  });
}

async function handleDeleteCommand(rawSkillName, options) {
  ensureConfig();

  const { normalized } = normalizeSkillName(rawSkillName);
  validateSkillName(normalized);
  const skillName = normalized;

  const canonicalPath = getCanonicalSkillPath(skillName);
  if (!fs.existsSync(canonicalPath)) {
    throw new AISkillError(`Canonical skill does not exist: ${canonicalPath}`, {
      code: 'NOT_FOUND',
      exitCode: 1,
    });
  }

  const status = getSkillStatus(skillName);
  const installedAgents = installedAgentsFromStatus(status);
  const uninstallAgents = parseAgentsCsv(options.agents) || installedAgents;

  let shouldUninstallFirst = Boolean(options.uninstallFirst);

  if (installedAgents.length > 0 && !shouldUninstallFirst && !options.force) {
    shouldUninstallFirst = await maybeConfirmUninstallFirst(skillName, installedAgents);
    if (!shouldUninstallFirst) {
      throw new AISkillError(
        `Refusing to delete while still installed. Re-run with --uninstall-first or --force.`,
        { code: 'DELETE_BLOCKED', exitCode: 1 }
      );
    }
  }

  if (shouldUninstallFirst && installedAgents.length > 0) {
    info(`Uninstalling ${skillName} before delete`);

    const uninstallResults = [];
    for (const agentKey of uninstallAgents) {
      try {
        uninstallSkillFromAgent(skillName, agentKey, Boolean(options.force));
        success(`Uninstalled ${skillName} from ${agentKey}`);
        uninstallResults.push({ ok: true, agentKey });
      } catch (err) {
        warn(`Failed to uninstall ${agentKey}: ${err.message}`);
        uninstallResults.push({ ok: false, agentKey });
      }
    }

    const uninstallCode = aggregateExitCode(uninstallResults);
    const refreshed = getSkillStatus(skillName);
    const stillInstalled = installedAgentsFromStatus(refreshed);

    if (stillInstalled.length > 0 && !options.force) {
      throw new AISkillError(
        `Still installed on: ${stillInstalled.join(', ')}. Use --force to delete anyway.`,
        { code: 'DELETE_BLOCKED', exitCode: uninstallCode === 0 ? 1 : uninstallCode }
      );
    }
  } else if (installedAgents.length > 0 && options.force) {
    warn('Deleting canonical skill with --force while installs still exist.');
  }

  fs.removeSync(canonicalPath);
  success(`Deleted canonical skill: ${canonicalPath}`);

  return 0;
}

function registerDeleteCommand(program) {
  program
    .command('delete')
    .description('Delete canonical skill, optionally uninstalling first')
    .argument('<skillName>', 'skill folder name')
    .option('--uninstall-first', 'Uninstall from agents before deleting canonical skill')
    .option('--agents <csv>', 'Comma-separated list: codex,claude,opencode,kilocode')
    .option('--force', 'Delete canonical skill regardless of install state')
    .action(async (skillName, options) => {
      const code = await handleDeleteCommand(skillName, options);
      process.exitCode = code;
    });
}

module.exports = {
  registerDeleteCommand,
  handleDeleteCommand,
};
