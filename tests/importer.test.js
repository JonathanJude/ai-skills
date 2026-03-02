const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const { ensureConfig } = require('../src/core/config');
const { getCanonicalSkillPath } = require('../src/core/paths');
const { importSkillFromSource } = require('../src/core/importer');

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aiskill-importer-'));
}

describe('importSkillFromSource', () => {
  let tempRoot;
  let prevRoot;
  let prevHome;
  let prevUserProfile;

  beforeEach(() => {
    tempRoot = makeTempRoot();
    prevRoot = process.env.AISkill_ROOT;
    prevHome = process.env.HOME;
    prevUserProfile = process.env.USERPROFILE;

    process.env.AISkill_ROOT = path.join(tempRoot, 'canonical');
    process.env.HOME = path.join(tempRoot, 'home');
    process.env.USERPROFILE = process.env.HOME;

    fs.ensureDirSync(process.env.HOME);
    ensureConfig();
  });

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.AISkill_ROOT;
    else process.env.AISkill_ROOT = prevRoot;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevUserProfile;
    fs.removeSync(tempRoot);
  });

  it('imports a skill from a folder', () => {
    const sourceDir = path.join(tempRoot, 'src-skill', 'my-review-skill');
    fs.ensureDirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir, 'SKILL.md'), '---\nname: my-review-skill\ndescription: "Test"\n---\n\n# Skill\n');

    const imported = importSkillFromSource(sourceDir, {});
    const canonicalPath = getCanonicalSkillPath('my-review-skill');

    expect(imported.skillName).toBe('my-review-skill');
    expect(imported.canonicalPath).toBe(canonicalPath);
    expect(fs.existsSync(path.join(canonicalPath, 'SKILL.md'))).toBe(true);
    expect(imported.frontmatterInjected).toBe(false);
  });

  it('imports a skill from a zip file', () => {
    const zipRoot = path.join(tempRoot, 'zip-source');
    const skillDir = path.join(zipRoot, 'zip-skill');
    fs.ensureDirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: zip-skill\ndescription: "Zip test"\n---\n\n# Skill\n');

    const zipPath = path.join(tempRoot, 'zip-skill.zip');
    const zip = new AdmZip();
    zip.addLocalFolder(zipRoot);
    zip.writeZip(zipPath);

    const imported = importSkillFromSource(zipPath, {});
    const canonicalPath = getCanonicalSkillPath('zip-skill');

    expect(imported.skillName).toBe('zip-skill');
    expect(fs.existsSync(path.join(canonicalPath, 'SKILL.md'))).toBe(true);
    expect(imported.frontmatterInjected).toBe(false);
  });

  it('auto-injects generic YAML frontmatter when missing', () => {
    const sourceDir = path.join(tempRoot, 'src-skill', 'plain-skill');
    fs.ensureDirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir, 'SKILL.md'), '# Skill: Plain Skill\n\nNo frontmatter yet.\n');

    const imported = importSkillFromSource(sourceDir, {});
    const canonicalPath = getCanonicalSkillPath('plain-skill');
    const content = fs.readFileSync(path.join(canonicalPath, 'SKILL.md'), 'utf8');

    expect(imported.frontmatterInjected).toBe(true);
    expect(imported.hasFrontmatterInitially).toBe(false);
    expect(content.startsWith('---\n')).toBe(true);
    expect(content).toContain('name: plain-skill');
  });

  it('rejects sources without SKILL.md', () => {
    const sourceDir = path.join(tempRoot, 'invalid-source');
    fs.ensureDirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir, 'README.md'), 'no skill');

    expect(() => importSkillFromSource(sourceDir, {})).toThrow();
  });
});
