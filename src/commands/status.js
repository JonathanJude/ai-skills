const { ensureConfig } = require('../core/config');
const { AGENT_KEYS } = require('../core/constants');
const { info } = require('../core/logger');
const { normalizeSkillName, validateSkillName } = require('../core/validation');
const { getSkillStatus } = require('../core/status');
const { printJson } = require('../core/json-output');

function printStatus(status) {
  info(`Skill: ${status.skillName}`);
  info(`Canonical path: ${status.canonicalPath}`);
  info(`Canonical exists: ${status.canonicalExists ? 'yes' : 'no'}`);
  info(`SKILL.md exists: ${status.hasSkillMd ? 'yes' : 'no'}`);
  info(`Checksum: ${status.checksum || 'n/a'}`);

  if (status.marker) {
    info(`Marker createdAt: ${status.marker.createdAt || 'n/a'}`);
  }

  for (const agentKey of AGENT_KEYS) {
    const agent = status.agents[agentKey];
    info(`${agentKey}: installed=${agent.installed ? 'yes' : 'no'} mode=${agent.mode} status=${agent.status}`);
    info(`  target=${agent.targetPath}`);
    if (agent.linkTarget) {
      info(`  linkTarget=${agent.linkTarget}`);
    }
    info(`  details=${agent.details}`);
  }
}

async function handleStatusCommand(rawSkillName, options) {
  ensureConfig();

  const { normalized } = normalizeSkillName(rawSkillName);
  validateSkillName(normalized);

  const status = getSkillStatus(normalized);

  if (options.json) {
    printJson(status);
  } else {
    printStatus(status);
  }

  return 0;
}

function registerStatusCommand(program) {
  program
    .command('status')
    .description('Show detailed status for one skill')
    .argument('<skillName>', 'skill folder name')
    .option('--json', 'Output JSON')
    .action(async (skillName, options) => {
      const code = await handleStatusCommand(skillName, options);
      process.exitCode = code;
    });
}

module.exports = {
  registerStatusCommand,
  handleStatusCommand,
};
