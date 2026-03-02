const chalk = require('chalk');

function info(message) {
  console.log(`- ${message}`);
}

function success(message) {
  console.log(chalk.green(`- ${message}`));
}

function warn(message) {
  console.warn(chalk.yellow(`- ${message}`));
}

function error(message) {
  console.error(chalk.red(`- ${message}`));
}

module.exports = {
  info,
  success,
  warn,
  error,
};
