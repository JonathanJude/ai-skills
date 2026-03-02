const fs = require('fs-extra');
const path = require('path');
const { AGENT_KEYS } = require('./constants');
const { readConfig } = require('./config');
const {
  getCanonicalSkillPath,
  getAgentSkillTarget,
} = require('./paths');
const {
  detectInstallMode,
  resolveSymlinkAbsolute,
  isManagedCopyTarget,
  computeFileSha256,
} = require('./installers');

function safeReadJson(filePath) {
  try {
    return fs.readJsonSync(filePath);
  } catch (err) {
    return null;
  }
}

function getAgentInstallStatus(skillName, agentKey, canonicalPath, canonicalExists) {
  const targetPath = getAgentSkillTarget(agentKey, skillName);

  if (!fs.existsSync(targetPath)) {
    return {
      installed: false,
      mode: 'unknown',
      ok: true,
      status: 'missing',
      details: 'Target path does not exist',
      targetPath,
    };
  }

  const mode = detectInstallMode(targetPath);
  if (mode === 'symlink') {
    const rawLink = fs.readlinkSync(targetPath);
    const resolvedLink = resolveSymlinkAbsolute(targetPath, rawLink);
    const linkExists = fs.existsSync(resolvedLink);

    if (!linkExists) {
      return {
        installed: true,
        mode,
        ok: false,
        status: canonicalExists ? 'broken' : 'orphaned',
        details: canonicalExists
          ? 'Symlink target is missing'
          : 'Canonical skill is missing while symlink still exists',
        targetPath,
        linkTarget: resolvedLink,
      };
    }

    if (path.resolve(resolvedLink) === path.resolve(canonicalPath)) {
      return {
        installed: true,
        mode,
        ok: canonicalExists,
        status: canonicalExists ? 'ok' : 'orphaned',
        details: canonicalExists
          ? 'Symlink points to canonical skill'
          : 'Symlink points to missing canonical skill',
        targetPath,
        linkTarget: resolvedLink,
      };
    }

    return {
      installed: true,
      mode,
      ok: false,
      status: 'collision',
      details: 'Symlink points to a different location',
      targetPath,
      linkTarget: resolvedLink,
    };
  }

  const hasSkillMd = fs.existsSync(path.join(targetPath, 'SKILL.md'));
  if (!hasSkillMd) {
    return {
      installed: true,
      mode,
      ok: false,
      status: 'collision',
      details: 'Target exists without SKILL.md',
      targetPath,
    };
  }

  if (!canonicalExists) {
    return {
      installed: true,
      mode,
      ok: false,
      status: 'orphaned',
      details: 'Installed copy exists but canonical skill is missing',
      targetPath,
    };
  }

  const managedCopy = isManagedCopyTarget(targetPath, canonicalPath);
  return {
    installed: true,
    mode,
    ok: managedCopy,
    status: managedCopy ? 'ok' : 'collision',
    details: managedCopy
      ? 'Copy appears to match canonical skill'
      : 'Copy does not appear to match canonical skill',
    targetPath,
  };
}

function getSkillStatus(skillName) {
  const config = readConfig();
  const canonicalPath = getCanonicalSkillPath(skillName);
  const skillMdPath = path.join(canonicalPath, 'SKILL.md');
  const markerPath = path.join(canonicalPath, '.agentskills.json');

  const canonicalExists = fs.existsSync(canonicalPath);
  const hasSkillMd = fs.existsSync(skillMdPath);
  const marker = fs.existsSync(markerPath) ? safeReadJson(markerPath) : null;

  let checksum = null;
  if (hasSkillMd) {
    checksum = computeFileSha256(skillMdPath);
  }

  const agents = {};
  for (const agentKey of AGENT_KEYS) {
    const enabled = config.agents[agentKey]?.enabled !== false;
    const status = getAgentInstallStatus(skillName, agentKey, canonicalPath, canonicalExists && hasSkillMd);
    agents[agentKey] = {
      ...status,
      enabled,
    };
  }

  return {
    skillName,
    canonicalPath,
    canonicalExists,
    hasSkillMd,
    checksum,
    marker,
    agents,
  };
}

module.exports = {
  getSkillStatus,
};
