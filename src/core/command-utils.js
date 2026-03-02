const { EXIT_CODES } = require('./constants');

function aggregateExitCode(results) {
  const success = results.filter((item) => item.ok).length;
  const failed = results.length - success;

  if (failed === 0) {
    return EXIT_CODES.OK;
  }

  if (success === 0) {
    return EXIT_CODES.ERROR;
  }

  return EXIT_CODES.PARTIAL;
}

function isInteractive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

module.exports = {
  aggregateExitCode,
  isInteractive,
};
