const { ensureConfig } = require('../core/config');
const { info, success, warn } = require('../core/logger');
const {
  normalizeSkillName,
  validateSkillName,
  resolveAgents,
} = require('../core/validation');
const { uninstallSkillFromAgent } = require('../core/installers');
const { aggregateExitCode } = require('../core/command-utils');

async function handleUninstallCommand(rawSkillName, options) {
  ensureConfig();

  const { normalized } = normalizeSkillName(rawSkillName);
  validateSkillName(normalized);

  const skillName = normalized;
  const agents = resolveAgents(options.agents, 'default');

  info(`Uninstalling ${skillName} from agents: ${agents.join(', ')}`);

  const results = [];
  for (const agentKey of agents) {
    try {
      const removed = uninstallSkillFromAgent(skillName, agentKey, Boolean(options.force));
      if (removed.action === 'missing') {
        info(`No target for ${agentKey}: ${removed.targetPath}`);
      } else {
        success(`Removed ${skillName} from ${agentKey}: ${removed.targetPath}`);
      }
      results.push({ ok: true, agentKey });
    } catch (err) {
      warn(`Uninstall failed for ${agentKey}: ${err.message}`);
      results.push({ ok: false, agentKey, error: err.message });
    }
  }

  return aggregateExitCode(results);
}

function registerUninstallCommand(program) {
  program
    .command('uninstall')
    .description('Uninstall a skill from one or more agents without deleting canonical source')
    .argument('<skillName>', 'skill folder name')
    .option('--agents <csv>', 'Comma-separated list: codex,claude,opencode,kilocode')
    .option('--force', 'Force removal for non-managed targets')
    .action(async (skillName, options) => {
      const code = await handleUninstallCommand(skillName, options);
      process.exitCode = code;
    });
}

module.exports = {
  registerUninstallCommand,
  handleUninstallCommand,
};
