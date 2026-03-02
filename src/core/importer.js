const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { AgentSkillsError } = require('./errors');
const { getCanonicalSkillPath } = require('./paths');
const { normalizeSkillName, validateSkillName } = require('./validation');

function isZipSource(sourcePath) {
  return sourcePath.toLowerCase().endsWith('.zip');
}

function findSkillRootInDirectory(baseDir) {
  const directSkillMd = path.join(baseDir, 'SKILL.md');
  if (fs.existsSync(directSkillMd)) {
    return baseDir;
  }

  const entries = fs.readdirSync(baseDir)
    .map((entry) => path.join(baseDir, entry))
    .filter((entryPath) => fs.existsSync(entryPath) && fs.lstatSync(entryPath).isDirectory())
    .filter((entryPath) => fs.existsSync(path.join(entryPath, 'SKILL.md')));

  if (entries.length === 1) {
    return entries[0];
  }

  if (entries.length > 1) {
    throw new AgentSkillsError(
      `Source contains multiple skill directories. Pass --name and provide a single skill folder/zip with one SKILL.md.`,
      { code: 'INVALID_USAGE', exitCode: 2 }
    );
  }

  throw new AgentSkillsError('Could not find SKILL.md in source path.', {
    code: 'INVALID_USAGE',
    exitCode: 2,
  });
}

function extractZipToTemp(zipPath) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentskills-import-'));
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tempDir, true);
  } catch (err) {
    fs.removeSync(tempDir);
    throw new AgentSkillsError(`Failed to extract zip: ${err.message}`, {
      code: 'INVALID_USAGE',
      exitCode: 2,
    });
  }

  return tempDir;
}

function resolveImportedSkillName(sourceSkillRoot, explicitName) {
  const baseName = explicitName || path.basename(sourceSkillRoot);
  const { normalized } = normalizeSkillName(baseName);
  validateSkillName(normalized);
  return normalized;
}

function escapeYamlDoubleQuote(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function hasYamlFrontmatter(content) {
  const trimmed = content.trimStart();
  return /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(trimmed);
}

function ensureFrontmatter(skillMdPath, skillName) {
  const content = fs.readFileSync(skillMdPath, 'utf8');
  const hadFrontmatter = hasYamlFrontmatter(content);

  if (hadFrontmatter) {
    return {
      hadFrontmatter: true,
      frontmatterInjected: false,
    };
  }

  const frontmatter = [
    '---',
    `name: ${skillName}`,
    `description: "${escapeYamlDoubleQuote(`Imported skill ${skillName}`)}"`,
    '---',
    '',
  ].join('\n');

  fs.writeFileSync(skillMdPath, `${frontmatter}${content}`, 'utf8');
  return {
    hadFrontmatter: false,
    frontmatterInjected: true,
  };
}

function importSkillFromSource(sourcePath, options = {}) {
  const resolvedSource = path.resolve(sourcePath);
  if (!fs.existsSync(resolvedSource)) {
    throw new AgentSkillsError(`Source does not exist: ${resolvedSource}`, {
      code: 'INVALID_USAGE',
      exitCode: 2,
    });
  }

  let extractedTempDir = null;
  let sourceSkillRoot;

  try {
    if (isZipSource(resolvedSource)) {
      extractedTempDir = extractZipToTemp(resolvedSource);
      sourceSkillRoot = findSkillRootInDirectory(extractedTempDir);
    } else {
      const stat = fs.lstatSync(resolvedSource);
      if (!stat.isDirectory()) {
        throw new AgentSkillsError('Source must be a directory or .zip file.', {
          code: 'INVALID_USAGE',
          exitCode: 2,
        });
      }
      sourceSkillRoot = findSkillRootInDirectory(resolvedSource);
    }

    const importedName = resolveImportedSkillName(sourceSkillRoot, options.name);
    const canonicalPath = getCanonicalSkillPath(importedName);

    if (fs.existsSync(canonicalPath)) {
      if (!options.force) {
        throw new AgentSkillsError(`Canonical skill already exists: ${canonicalPath}. Use --force to replace it.`, {
          code: 'ALREADY_EXISTS',
          exitCode: 1,
        });
      }
      fs.removeSync(canonicalPath);
    }

    fs.ensureDirSync(path.dirname(canonicalPath));
    fs.copySync(sourceSkillRoot, canonicalPath, {
      overwrite: true,
      dereference: true,
    });

    const skillMdPath = path.join(canonicalPath, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      throw new AgentSkillsError(`Imported source is invalid; missing SKILL.md at ${skillMdPath}`, {
        code: 'INVALID_USAGE',
        exitCode: 2,
      });
    }

    const frontmatterResult = ensureFrontmatter(skillMdPath, importedName);

    const markerPath = path.join(canonicalPath, '.agentskills.json');
    if (!fs.existsSync(markerPath)) {
      fs.writeJsonSync(markerPath, {
        createdAt: new Date().toISOString(),
        toolVersion: require('../../package.json').version,
        importedFrom: resolvedSource,
      }, { spaces: 2 });
    }

    return {
      skillName: importedName,
      canonicalPath,
      sourceSkillRoot,
      hasFrontmatter: true,
      hasFrontmatterInitially: frontmatterResult.hadFrontmatter,
      frontmatterInjected: frontmatterResult.frontmatterInjected,
    };
  } finally {
    if (extractedTempDir) {
      fs.removeSync(extractedTempDir);
    }
  }
}

module.exports = {
  importSkillFromSource,
};
