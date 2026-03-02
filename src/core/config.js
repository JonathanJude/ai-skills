const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const {
  DEFAULT_CANONICAL_ROOT,
  DEFAULT_CONFIG,
  DEFAULT_SKILLS_DIR_NAME,
  AGENT_KEYS,
} = require('./constants');

function expandPathHome(pathStr) {
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

function resolveRootRaw() {
  return process.env.AGENTSKILLS_ROOT || DEFAULT_CANONICAL_ROOT;
}

function resolveRoot() {
  return path.resolve(expandPathHome(resolveRootRaw()));
}

function getConfigPath() {
  return path.join(resolveRoot(), 'config.json');
}

function mergeConfig(userConfig = {}) {
  const merged = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    agents: {
      ...DEFAULT_CONFIG.agents,
      ...(userConfig.agents || {}),
    },
    defaults: {
      ...DEFAULT_CONFIG.defaults,
      ...(userConfig.defaults || {}),
    },
  };

  for (const agentKey of AGENT_KEYS) {
    merged.agents[agentKey] = {
      ...DEFAULT_CONFIG.agents[agentKey],
      ...(merged.agents[agentKey] || {}),
    };
  }

  if (!Array.isArray(merged.defaults.installAgents) || merged.defaults.installAgents.length === 0) {
    merged.defaults.installAgents = [...DEFAULT_CONFIG.defaults.installAgents];
  }

  if (!merged.skillsDirName || typeof merged.skillsDirName !== 'string') {
    merged.skillsDirName = DEFAULT_SKILLS_DIR_NAME;
  }

  return merged;
}

function buildDefaultConfig() {
  return mergeConfig({
    canonicalRoot: resolveRootRaw(),
  });
}

function ensureConfig() {
  const root = resolveRoot();
  const configPath = getConfigPath();

  fs.ensureDirSync(root);

  if (!fs.existsSync(configPath)) {
    fs.writeJsonSync(configPath, buildDefaultConfig(), { spaces: 2 });
  }

  const config = readConfig();
  fs.ensureDirSync(path.join(root, config.skillsDirName));

  return configPath;
}

function readConfig() {
  ensureConfigExistsOnly();
  const configPath = getConfigPath();

  let parsed = {};
  try {
    parsed = fs.readJsonSync(configPath);
  } catch (err) {
    parsed = {};
  }

  return mergeConfig(parsed);
}

function ensureConfigExistsOnly() {
  const root = resolveRoot();
  const configPath = getConfigPath();

  fs.ensureDirSync(root);
  if (!fs.existsSync(configPath)) {
    fs.writeJsonSync(configPath, buildDefaultConfig(), { spaces: 2 });
  }
}

module.exports = {
  ensureConfig,
  readConfig,
  getConfigPath,
};
