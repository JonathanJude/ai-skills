function printJson(data) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

module.exports = {
  printJson,
};
