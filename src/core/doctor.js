const fs = require('fs-extra');
const path = require('path');
const { AGENT_KEYS } = require('./constants');
const { readConfig } = require('./config');
const {
  getCanonicalSkillsDir,
  getCanonicalSkillPath,
  getAgentSkillsDir,
  getAgentSkillTarget,
} = require('./paths');
const { detectInstallMode, installSkillToAgent, resolveSymlinkAbsolute } = require('./installers');

function listCanonicalSkills() {
  const skillsDir = getCanonicalSkillsDir();
  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  return fs.readdirSync(skillsDir)
    .filter((name) => fs.existsSync(path.join(skillsDir, name)) && fs.lstatSync(path.join(skillsDir, name)).isDirectory());
}

function issue(type, payload) {
  return {
    type,
    ...payload,
  };
}

function collectDoctorReport() {
  const config = readConfig();
  const canonicalRoot = path.dirname(getCanonicalSkillsDir());
  const canonicalSkillsDir = getCanonicalSkillsDir();
  const canonicalRootExists = fs.existsSync(canonicalRoot);
  const canonicalSkills = listCanonicalSkills();

  const invalidCanonicalSkills = [];
  for (const skillName of canonicalSkills) {
    const skillMd = path.join(getCanonicalSkillPath(skillName), 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      invalidCanonicalSkills.push({
        skillName,
        canonicalPath: getCanonicalSkillPath(skillName),
        details: 'Missing SKILL.md',
      });
    }
  }

  const report = {
    canonicalRootExists,
    canonicalRoot,
    canonicalSkillsDir,
    invalidCanonicalSkills,
    agents: {},
    canonicalSkills,
    issues: [],
    fixesApplied: [],
    fixesSkipped: [],
  };

  for (const agentKey of AGENT_KEYS) {
    const enabled = config.agents[agentKey]?.enabled !== false;
    const agentDir = getAgentSkillsDir(agentKey);
    const agentReport = {
      enabled,
      skillsDir: agentDir,
      exists: fs.existsSync(agentDir),
      entries: [],
      issues: [],
    };

    if (!agentReport.exists) {
      agentReport.issues.push(issue('missing_agent_dir', {
        agentKey,
        targetPath: agentDir,
        details: 'Agent skills directory is missing',
        canFix: true,
      }));
    } else {
      const entries = fs.readdirSync(agentDir);
      for (const entryName of entries) {
        const targetPath = path.join(agentDir, entryName);
        const mode = detectInstallMode(targetPath);
        const entry = {
          skillName: entryName,
          targetPath,
          mode,
        };

        if (mode === 'symlink') {
          const rawLink = fs.readlinkSync(targetPath);
          const resolvedLink = resolveSymlinkAbsolute(targetPath, rawLink);
          entry.linkTarget = resolvedLink;

          if (!fs.existsSync(resolvedLink)) {
            entry.status = 'broken';
            agentReport.issues.push(issue('broken_symlink', {
              agentKey,
              skillName: entryName,
              targetPath,
              linkTarget: resolvedLink,
              details: 'Symlink target does not exist',
              canFix: true,
            }));
          } else {
            const expectedCanonical = getCanonicalSkillPath(entryName);
            if (path.resolve(resolvedLink) !== path.resolve(expectedCanonical)) {
              entry.status = 'collision';
              agentReport.issues.push(issue('collision', {
                agentKey,
                skillName: entryName,
                targetPath,
                linkTarget: resolvedLink,
                details: 'Symlink points outside canonical skill path',
                canFix: false,
              }));
            } else if (!fs.existsSync(path.join(expectedCanonical, 'SKILL.md'))) {
              entry.status = 'orphaned';
              agentReport.issues.push(issue('orphaned_install', {
                agentKey,
                skillName: entryName,
                targetPath,
                linkTarget: resolvedLink,
                details: 'Canonical skill is missing SKILL.md',
                canFix: false,
              }));
            } else {
              entry.status = 'ok';
            }
          }
        } else if (mode === 'copy') {
          const canonicalPath = getCanonicalSkillPath(entryName);
          const hasSkillMd = fs.existsSync(path.join(targetPath, 'SKILL.md'));
          if (!hasSkillMd) {
            entry.status = 'collision';
            agentReport.issues.push(issue('collision', {
              agentKey,
              skillName: entryName,
              targetPath,
              details: 'Directory/file exists without SKILL.md',
              canFix: false,
            }));
          } else if (!fs.existsSync(canonicalPath)) {
            entry.status = 'orphaned';
            agentReport.issues.push(issue('orphaned_install', {
              agentKey,
              skillName: entryName,
              targetPath,
              details: 'Copy exists but canonical skill is missing',
              canFix: false,
            }));
          } else {
            entry.status = 'ok';
          }
        } else {
          entry.status = 'unknown';
        }

        agentReport.entries.push(entry);
      }
    }

    report.agents[agentKey] = agentReport;
    report.issues.push(...agentReport.issues);
  }

  for (const skillName of canonicalSkills) {
    if (!fs.existsSync(path.join(getCanonicalSkillPath(skillName), 'SKILL.md'))) {
      continue;
    }

    for (const agentKey of AGENT_KEYS) {
      if (config.agents[agentKey]?.enabled === false) {
        continue;
      }

      const targetPath = getAgentSkillTarget(agentKey, skillName);
      if (!fs.existsSync(targetPath)) {
        report.issues.push(issue('missing_install', {
          agentKey,
          skillName,
          targetPath,
          details: 'Canonical skill is not installed for this agent',
          canFix: true,
        }));
      }
    }
  }

  return report;
}

function applyFix(issueData, installMode) {
  if (issueData.type === 'missing_agent_dir') {
    fs.ensureDirSync(issueData.targetPath);
    return `Created missing agent directory: ${issueData.targetPath}`;
  }

  if (issueData.type === 'broken_symlink') {
    fs.removeSync(issueData.targetPath);
    return `Removed broken symlink: ${issueData.targetPath}`;
  }

  if (issueData.type === 'missing_install') {
    installSkillToAgent(issueData.skillName, issueData.agentKey, installMode, false);
    return `Reinstalled ${issueData.skillName} for ${issueData.agentKey}`;
  }

  throw new Error(`Unsupported fix type: ${issueData.type}`);
}

async function doctor(options = {}) {
  const fix = Boolean(options.fix);
  const nonInteractive = Boolean(options.nonInteractive);
  const confirmFix = typeof options.confirmFix === 'function'
    ? options.confirmFix
    : async () => false;

  const config = readConfig();
  const installMode = config.defaults.installMode || (process.platform === 'win32' ? 'copy' : 'symlink');

  const report = collectDoctorReport();

  if (!fix) {
    return report;
  }

  if (nonInteractive) {
    report.fixesSkipped.push('Cannot apply --fix in non-interactive mode; rerun with a TTY for confirmations.');
    return report;
  }

  for (const currentIssue of report.issues) {
    if (!currentIssue.canFix) {
      continue;
    }

    const confirmed = await confirmFix(currentIssue);
    if (!confirmed) {
      report.fixesSkipped.push(`Skipped fix for ${currentIssue.type} at ${currentIssue.targetPath}`);
      continue;
    }

    try {
      const outcome = applyFix(currentIssue, installMode);
      report.fixesApplied.push(outcome);
    } catch (err) {
      report.fixesSkipped.push(`Failed fix for ${currentIssue.type} at ${currentIssue.targetPath}: ${err.message}`);
    }
  }

  return report;
}

module.exports = {
  doctor,
  collectDoctorReport,
};
