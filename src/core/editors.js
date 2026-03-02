const { spawnSync } = require('child_process');

function commandExists(command) {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(finder, [command], { stdio: 'ignore' });
  return result.status === 0;
}

function getAvailableEditors() {
  const known = ['code', 'cursor', 'nano', 'vi', 'vim', 'idea', 'webstorm'];
  return known.filter((item) => commandExists(item));
}

function resolveEditor(preferredEditor) {
  const candidates = [
    preferredEditor,
    process.env.AGENTSKILLS_EDITOR,
    process.env.EDITOR,
    'code',
    'cursor',
    'nano',
    'vi',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (commandExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function openInEditor(editorCmd, filePath) {
  const result = spawnSync(editorCmd, [filePath], { stdio: 'inherit' });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`Editor exited with status ${result.status}`);
  }
}

module.exports = {
  commandExists,
  getAvailableEditors,
  resolveEditor,
  openInEditor,
};
