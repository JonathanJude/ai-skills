const fs = require('fs-extra');
const { ensureConfig } = require('../core/config');
const { AGENT_KEYS } = require('../core/constants');
const { info } = require('../core/logger');
const { getCanonicalSkillsDir } = require('../core/paths');
const { getSkillStatus } = require('../core/status');
const { printJson } = require('../core/json-output');

function listCanonicalSkills() {
  const skillsDir = getCanonicalSkillsDir();
  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  return fs.readdirSync(skillsDir)
    .filter((entry) => fs.lstatSync(`${skillsDir}/${entry}`).isDirectory())
    .sort();
}

function printSkillStatus(status) {
  info(`Skill: ${status.skillName}`);
  info(`  canonical: ${status.canonicalPath}`);
  info(`  SKILL.md: ${status.hasSkillMd ? 'yes' : 'no'}`);
  for (const agentKey of AGENT_KEYS) {
    const agent = status.agents[agentKey];
    info(`  ${agentKey}: installed=${agent.installed ? 'yes' : 'no'} mode=${agent.mode} status=${agent.status} target=${agent.targetPath}`);
  }
}

async function handleListCommand(options) {
  ensureConfig();

  const skills = listCanonicalSkills();
  const rows = skills.map((skillName) => getSkillStatus(skillName));

  if (options.json) {
    printJson(rows);
    return 0;
  }

  if (rows.length === 0) {
    info('No canonical skills found.');
    return 0;
  }

  for (const row of rows) {
    printSkillStatus(row);
  }

  return 0;
}

function registerListCommand(program) {
  program
    .command('list')
    .description('List canonical skills and install coverage across agents')
    .option('--json', 'Output JSON')
    .action(async (options) => {
      const code = await handleListCommand(options);
      process.exitCode = code;
    });
}

module.exports = {
  registerListCommand,
  handleListCommand,
};
