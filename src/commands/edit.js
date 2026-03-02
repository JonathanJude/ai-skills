const path = require('path');
const fs = require('fs-extra');
const { ensureConfig } = require('../core/config');
const { AgentSkillsError } = require('../core/errors');
const { info } = require('../core/logger');
const { normalizeSkillName, validateSkillName } = require('../core/validation');
const { getCanonicalSkillPath } = require('../core/paths');
const { resolveEditor, openInEditor, getAvailableEditors } = require('../core/editors');

function validateTargetFile(skillPath, requestedFile) {
  const fileName = requestedFile || 'SKILL.md';
  const resolved = path.resolve(skillPath, fileName);

  if (!resolved.startsWith(path.resolve(skillPath) + path.sep) && resolved !== path.resolve(skillPath)) {
    throw new AgentSkillsError('The --file path must stay inside the skill directory', {
      code: 'INVALID_USAGE',
      exitCode: 2,
    });
  }

  return resolved;
}

async function handleEditCommand(rawSkillName, options) {
  ensureConfig();

  const { normalized } = normalizeSkillName(rawSkillName);
  validateSkillName(normalized);
  const skillName = normalized;

  const skillPath = getCanonicalSkillPath(skillName);
  if (!fs.existsSync(skillPath)) {
    throw new AgentSkillsError(`Skill does not exist: ${skillPath}`, {
      code: 'NOT_FOUND',
      exitCode: 1,
    });
  }

  const targetFile = validateTargetFile(skillPath, options.file);
  if (!fs.existsSync(targetFile)) {
    throw new AgentSkillsError(`File does not exist: ${targetFile}`, {
      code: 'NOT_FOUND',
      exitCode: 1,
    });
  }

  const editor = resolveEditor(options.editor);
  if (!editor) {
    const available = getAvailableEditors();
    throw new AgentSkillsError(
      `No editor command found. Detected available editors: ${available.join(', ') || 'none'}`,
      { code: 'MISSING_EDITOR', exitCode: 1 }
    );
  }

  info(`Opening ${targetFile} with ${editor}`);
  openInEditor(editor, targetFile);
  return 0;
}

function registerEditCommand(program) {
  program
    .command('edit')
    .description('Open canonical skill in an editor')
    .argument('<skillName>', 'skill folder name')
    .option('--file <relativePath>', 'File path inside skill directory, default SKILL.md')
    .option('--editor <editorCmd>', 'Editor command to use')
    .action(async (skillName, options) => {
      const code = await handleEditCommand(skillName, options);
      process.exitCode = code;
    });
}

module.exports = {
  registerEditCommand,
  handleEditCommand,
};
