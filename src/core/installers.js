const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const {
  getCanonicalSkillPath,
  getAgentSkillsDir,
  getAgentSkillTarget,
} = require('./paths');
const { AgentSkillsError } = require('./errors');

function resolveSymlinkAbsolute(linkPath, rawLinkTarget) {
  if (path.isAbsolute(rawLinkTarget)) {
    return path.resolve(rawLinkTarget);
  }

  return path.resolve(path.dirname(linkPath), rawLinkTarget);
}

function computeFileSha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function canonicalSkillMdPath(skillName) {
  return path.join(getCanonicalSkillPath(skillName), 'SKILL.md');
}

function detectInstallMode(agentTargetPath) {
  try {
    const stat = fs.lstatSync(agentTargetPath);
    if (stat.isSymbolicLink()) {
      return 'symlink';
    }

    if (stat.isDirectory() || stat.isFile()) {
      return 'copy';
    }

    return 'unknown';
  } catch (err) {
    if (err.code === 'ENOENT') {
      return 'unknown';
    }

    throw err;
  }
}

function isManagedCopyTarget(targetPath, canonicalPath) {
  const targetSkillMd = path.join(targetPath, 'SKILL.md');
  const targetMarker = path.join(targetPath, '.agentskills.json');

  if (fs.existsSync(targetMarker)) {
    return true;
  }

  if (!fs.existsSync(targetSkillMd)) {
    return false;
  }

  const canonicalSkillMd = path.join(canonicalPath, 'SKILL.md');
  if (!fs.existsSync(canonicalSkillMd)) {
    return false;
  }

  try {
    return computeFileSha256(targetSkillMd) === computeFileSha256(canonicalSkillMd);
  } catch (err) {
    return false;
  }
}

function assertCanonicalSkillExists(skillName) {
  const canonicalPath = getCanonicalSkillPath(skillName);
  const skillMdPath = path.join(canonicalPath, 'SKILL.md');

  if (!fs.existsSync(canonicalPath) || !fs.existsSync(skillMdPath)) {
    throw new AgentSkillsError(
      `Canonical skill is missing or invalid: ${canonicalPath}`,
      { code: 'MISSING_CANONICAL', exitCode: 1 }
    );
  }

  return { canonicalPath, skillMdPath };
}

function installSkillToAgent(skillName, agentKey, mode, force = false) {
  const { canonicalPath } = assertCanonicalSkillExists(skillName);
  const agentDir = getAgentSkillsDir(agentKey);
  const targetPath = getAgentSkillTarget(agentKey, skillName);

  fs.ensureDirSync(agentDir);

  if (fs.existsSync(targetPath)) {
    const existingMode = detectInstallMode(targetPath);

    if (existingMode === 'symlink') {
      const rawLink = fs.readlinkSync(targetPath);
      const resolvedLink = resolveSymlinkAbsolute(targetPath, rawLink);

      if (path.resolve(resolvedLink) === path.resolve(canonicalPath)) {
        return {
          agentKey,
          targetPath,
          mode: 'symlink',
          action: 'already-installed',
        };
      }

      if (!force) {
        throw new AgentSkillsError(
          `Target is a symlink to a different location: ${targetPath}`,
          { code: 'CONFLICTING_TARGET', exitCode: 1 }
        );
      }

      fs.removeSync(targetPath);
    } else {
      if (!force) {
        throw new AgentSkillsError(
          `Target already exists and is not a managed symlink: ${targetPath}`,
          { code: 'CONFLICTING_TARGET', exitCode: 1 }
        );
      }

      fs.removeSync(targetPath);
    }
  }

  if (mode === 'copy') {
    fs.copySync(canonicalPath, targetPath, { overwrite: true, dereference: true });
    return {
      agentKey,
      targetPath,
      mode,
      action: 'installed',
    };
  }

  try {
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(canonicalPath, targetPath, linkType);
  } catch (err) {
    throw new AgentSkillsError(
      `Failed to create symlink at ${targetPath}: ${err.message}`,
      { code: 'SYMLINK_FAILED', exitCode: 1, details: err.message }
    );
  }

  return {
    agentKey,
    targetPath,
    mode,
    action: 'installed',
  };
}

function uninstallSkillFromAgent(skillName, agentKey, force = false) {
  const canonicalPath = getCanonicalSkillPath(skillName);
  const targetPath = getAgentSkillTarget(agentKey, skillName);

  if (!fs.existsSync(targetPath)) {
    return {
      agentKey,
      targetPath,
      removed: false,
      action: 'missing',
    };
  }

  const mode = detectInstallMode(targetPath);

  if (mode === 'symlink') {
    const rawLink = fs.readlinkSync(targetPath);
    const resolvedLink = resolveSymlinkAbsolute(targetPath, rawLink);

    if (path.resolve(resolvedLink) !== path.resolve(canonicalPath) && !force) {
      throw new AgentSkillsError(
        `Refusing to remove symlink not pointing to canonical skill: ${targetPath}`,
        { code: 'UNMANAGED_TARGET', exitCode: 1 }
      );
    }

    fs.removeSync(targetPath);
    return {
      agentKey,
      targetPath,
      removed: true,
      action: 'removed',
      mode,
    };
  }

  const managedCopy = isManagedCopyTarget(targetPath, canonicalPath);
  if (!managedCopy && !force) {
    throw new AgentSkillsError(
      `Refusing to remove non-managed directory/file: ${targetPath}`,
      { code: 'UNMANAGED_TARGET', exitCode: 1 }
    );
  }

  fs.removeSync(targetPath);

  return {
    agentKey,
    targetPath,
    removed: true,
    action: 'removed',
    mode,
  };
}

module.exports = {
  installSkillToAgent,
  uninstallSkillFromAgent,
  detectInstallMode,
  computeFileSha256,
  isManagedCopyTarget,
  resolveSymlinkAbsolute,
  canonicalSkillMdPath,
};
