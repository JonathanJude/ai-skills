const path = require('path');
const os = require('os');
const { DEFAULT_CANONICAL_ROOT } = require('./constants');
const { readConfig } = require('./config');

function expandHome(pathStr) {
  if (!pathStr || typeof pathStr !== 'string') {
    return pathStr;
  }

  if (pathStr === '~') {
    return os.homedir();
  }

  if (pathStr.startsWith('~/') || pathStr.startsWith('~\\')) {
    return path.join(os.homedir(), pathStr.slice(2));
  }

  return pathStr;
}

function resolveCanonicalRoot() {
  return path.resolve(expandHome(process.env.AISkill_ROOT || DEFAULT_CANONICAL_ROOT));
}

function getCanonicalSkillsDir() {
  const config = readConfig();
  return path.join(resolveCanonicalRoot(), config.skillsDirName);
}

function getCanonicalSkillPath(name) {
  return path.join(getCanonicalSkillsDir(), name);
}

function getAgentSkillsDir(agentKey) {
  const config = readConfig();
  const agent = config.agents[agentKey];
  if (!agent) {
    throw new Error(`Unknown agent key: ${agentKey}`);
  }

  return path.resolve(expandHome(agent.skillsDir));
}

function getAgentSkillTarget(agentKey, skillName) {
  return path.join(getAgentSkillsDir(agentKey), skillName);
}

module.exports = {
  expandHome,
  resolveCanonicalRoot,
  getCanonicalSkillsDir,
  getCanonicalSkillPath,
  getAgentSkillsDir,
  getAgentSkillTarget,
};
