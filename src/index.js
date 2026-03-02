const { Command, CommanderError } = require('commander');
const { ensureConfig } = require('./core/config');
const { EXIT_CODES, TOOL_NAME } = require('./core/constants');
const { AgentSkillsError } = require('./core/errors');
const { error } = require('./core/logger');
const { registerNewCommand } = require('./commands/new');
const { registerInstallCommand } = require('./commands/install');
const { registerAddCommand } = require('./commands/add');
const { registerUninstallCommand } = require('./commands/uninstall');
const { registerDeleteCommand } = require('./commands/delete');
const { registerListCommand } = require('./commands/list');
const { registerStatusCommand } = require('./commands/status');
const { registerDoctorCommand } = require('./commands/doctor');
const { registerEditCommand } = require('./commands/edit');

function createProgram() {
  const pkg = require('../package.json');

  const program = new Command();
  program
    .name(TOOL_NAME)
    .description('Global skills sync CLI for Codex, Claude Code, OpenCode, and Kilo Code')
    .version(pkg.version)
    .showSuggestionAfterError(true)
    .showHelpAfterError('(run with --help for usage)')
    .allowExcessArguments(false)
    .allowUnknownOption(false);

  registerNewCommand(program);
  registerAddCommand(program);
  registerInstallCommand(program);
  registerUninstallCommand(program);
  registerDeleteCommand(program);
  registerListCommand(program);
  registerStatusCommand(program);
  registerDoctorCommand(program);
  registerEditCommand(program);

  return program;
}

function mapCommanderExitCode(code) {
  const usageCodes = new Set([
    'commander.invalidArgument',
    'commander.missingArgument',
    'commander.optionMissingArgument',
    'commander.unknownOption',
    'commander.unknownCommand',
  ]);

  if (usageCodes.has(code)) {
    return EXIT_CODES.USAGE;
  }

  return EXIT_CODES.ERROR;
}

async function run(argv = process.argv) {
  ensureConfig();
  const program = createProgram();

  try {
    await program.parseAsync(argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      process.exitCode = mapCommanderExitCode(err.code);
      return;
    }

    if (err instanceof AgentSkillsError) {
      error(err.message);
      if (err.details) {
        error(String(err.details));
      }
      process.exitCode = err.exitCode || EXIT_CODES.ERROR;
      return;
    }

    error(err.message || String(err));
    process.exitCode = EXIT_CODES.ERROR;
  }
}

module.exports = {
  run,
  createProgram,
};

if (require.main === module) {
  run();
}
