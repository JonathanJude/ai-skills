const { AGENT_KEYS } = require('./constants');
const { usageError } = require('./errors');
const { readConfig } = require('./config');

function normalizeSkillName(input) {
  const original = String(input || '');
  const normalized = original
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  return {
    original,
    normalized,
    changed: original !== normalized,
  };
}

function validateSkillName(skillName) {
  if (!skillName || typeof skillName !== 'string') {
    throw usageError('skillName is required');
  }

  if (skillName === '.' || skillName === '..') {
    throw usageError('skillName cannot be . or ..');
  }

  if (skillName.includes('/') || skillName.includes('\\')) {
    throw usageError('skillName cannot include path separators');
  }

  if (!/^[a-z0-9_-]+$/.test(skillName)) {
    throw usageError('skillName may only include letters, numbers, hyphen, and underscore');
  }

  return true;
}

function parseAgentsCsv(csv, options = {}) {
  const config = readConfig();
  const { allowDisabled = false } = options;

  if (!csv) {
    return null;
  }

  const raw = String(csv)
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (raw.length === 0) {
    throw usageError('No agents provided');
  }

  const unique = [...new Set(raw)];

  for (const key of unique) {
    if (!AGENT_KEYS.includes(key)) {
      throw usageError(`Unknown agent key: ${key}. Allowed: ${AGENT_KEYS.join(', ')}`);
    }

    if (!allowDisabled && config.agents[key] && config.agents[key].enabled === false) {
      throw usageError(`Agent is disabled in config: ${key}`);
    }
  }

  return unique;
}

function getDefaultInstallAgents() {
  const config = readConfig();
  const defaults = Array.isArray(config.defaults.installAgents)
    ? config.defaults.installAgents
    : [];

  return defaults.filter((agentKey) => {
    return AGENT_KEYS.includes(agentKey) && config.agents[agentKey]?.enabled !== false;
  });
}

function getEnabledAgents() {
  const config = readConfig();
  return AGENT_KEYS.filter((agentKey) => config.agents[agentKey]?.enabled !== false);
}

function resolveAgents(csv, fallback = 'default') {
  const parsed = parseAgentsCsv(csv);
  if (parsed) {
    return parsed;
  }

  if (fallback === 'enabled') {
    return getEnabledAgents();
  }

  return getDefaultInstallAgents();
}

module.exports = {
  normalizeSkillName,
  validateSkillName,
  parseAgentsCsv,
  getDefaultInstallAgents,
  getEnabledAgents,
  resolveAgents,
};
