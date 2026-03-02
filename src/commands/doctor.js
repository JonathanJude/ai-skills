const { confirm } = require('@inquirer/prompts');
const { ensureConfig } = require('../core/config');
const { EXIT_CODES } = require('../core/constants');
const { info, warn, success } = require('../core/logger');
const { doctor } = require('../core/doctor');
const { printJson } = require('../core/json-output');
const { isInteractive } = require('../core/command-utils');

function printReport(report) {
  info(`Canonical root: ${report.canonicalRoot}`);
  info(`Canonical root exists: ${report.canonicalRootExists ? 'yes' : 'no'}`);

  if (report.invalidCanonicalSkills.length > 0) {
    warn('Invalid canonical skills:');
    for (const invalid of report.invalidCanonicalSkills) {
      warn(`  ${invalid.skillName}: ${invalid.details}`);
    }
  }

  if (report.issues.length === 0) {
    success('No issues found.');
  } else {
    warn(`Issues found: ${report.issues.length}`);
    for (const item of report.issues) {
      warn(`  [${item.type}] ${item.agentKey || 'core'} ${item.skillName || ''} ${item.targetPath || ''} :: ${item.details}`);
    }
  }

  if (report.fixesApplied.length > 0) {
    success('Applied fixes:');
    for (const line of report.fixesApplied) {
      success(`  ${line}`);
    }
  }

  if (report.fixesSkipped.length > 0) {
    warn('Skipped fixes:');
    for (const line of report.fixesSkipped) {
      warn(`  ${line}`);
    }
  }
}

async function handleDoctorCommand(options) {
  ensureConfig();

  const fix = Boolean(options.fix);
  const nonInteractive = fix && !isInteractive();

  const report = await doctor({
    fix,
    nonInteractive,
    confirmFix: async (currentIssue) => {
      return confirm({
        message: `Apply fix [${currentIssue.type}] at ${currentIssue.targetPath}?`,
        default: false,
      });
    },
  });

  if (options.json) {
    printJson(report);
  } else {
    printReport(report);
  }

  if (fix && nonInteractive) {
    return EXIT_CODES.ERROR;
  }

  if (report.issues.length > 0 && report.fixesApplied.length === 0 && !fix) {
    return EXIT_CODES.ERROR;
  }

  return EXIT_CODES.OK;
}

function registerDoctorCommand(program) {
  program
    .command('doctor')
    .description('Run health checks and optionally fix safe issues')
    .option('--fix', 'Prompt and apply safe fixes')
    .option('--json', 'Output JSON')
    .action(async (options) => {
      const code = await handleDoctorCommand(options);
      process.exitCode = code;
    });
}

module.exports = {
  registerDoctorCommand,
  handleDoctorCommand,
};
