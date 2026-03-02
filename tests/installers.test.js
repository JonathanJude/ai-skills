const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { ensureConfig } = require('../src/core/config');
const { getCanonicalSkillPath, getAgentSkillTarget } = require('../src/core/paths');
const {
  installSkillToAgent,
  uninstallSkillFromAgent,
  detectInstallMode,
} = require('../src/core/installers');

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentskills-test-'));
}

describe('installers', () => {
  let tempRoot;
  let prevRoot;
  let prevHome;
  let prevUserProfile;

  beforeEach(() => {
    tempRoot = makeTempRoot();
    prevRoot = process.env.AGENTSKILLS_ROOT;
    prevHome = process.env.HOME;
    prevUserProfile = process.env.USERPROFILE;
    process.env.AGENTSKILLS_ROOT = path.join(tempRoot, 'canonical');
    process.env.HOME = path.join(tempRoot, 'home');
    process.env.USERPROFILE = process.env.HOME;
    fs.ensureDirSync(process.env.HOME);
    ensureConfig();

    const canonical = getCanonicalSkillPath('flutter-architect');
    fs.ensureDirSync(canonical);
    fs.writeFileSync(path.join(canonical, 'SKILL.md'), '# Skill: Flutter Architect\n');
  });

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.AGENTSKILLS_ROOT;
    else process.env.AGENTSKILLS_ROOT = prevRoot;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevUserProfile;
    fs.removeSync(tempRoot);
  });

  it('installs skill via symlink', () => {
    const mode = process.platform === 'win32' ? 'copy' : 'symlink';
    const installed = installSkillToAgent('flutter-architect', 'codex', mode, false);
    const target = getAgentSkillTarget('codex', 'flutter-architect');

    expect(fs.existsSync(target)).toBe(true);
    expect(installed.targetPath).toBe(target);
    expect(detectInstallMode(target)).toBe(mode);
  });

  it('installs skill via copy mode', () => {
    installSkillToAgent('flutter-architect', 'claude', 'copy', false);
    const target = getAgentSkillTarget('claude', 'flutter-architect');
    expect(fs.existsSync(path.join(target, 'SKILL.md'))).toBe(true);
    expect(detectInstallMode(target)).toBe('copy');
  });

  it('refuses conflicting target without force', () => {
    const target = getAgentSkillTarget('opencode', 'flutter-architect');
    fs.ensureDirSync(target);
    fs.writeFileSync(path.join(target, 'SKILL.md'), '# external\n');

    expect(() => installSkillToAgent('flutter-architect', 'opencode', 'copy', false)).toThrow();
  });

  it('overwrites conflicting target with force', () => {
    const target = getAgentSkillTarget('kilocode', 'flutter-architect');
    fs.ensureDirSync(target);
    fs.writeFileSync(path.join(target, 'SKILL.md'), '# external\n');

    expect(() => installSkillToAgent('flutter-architect', 'kilocode', 'copy', true)).not.toThrow();
    expect(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8')).toContain('Flutter Architect');
  });

  it('uninstalls symlink install', () => {
    const mode = process.platform === 'win32' ? 'copy' : 'symlink';
    installSkillToAgent('flutter-architect', 'codex', mode, false);

    const removed = uninstallSkillFromAgent('flutter-architect', 'codex', false);
    expect(removed.removed).toBe(true);
    expect(fs.existsSync(getAgentSkillTarget('codex', 'flutter-architect'))).toBe(false);
  });

  it('refuses uninstall for unmanaged directory without force', () => {
    const target = getAgentSkillTarget('claude', 'flutter-architect');
    fs.ensureDirSync(target);
    fs.writeFileSync(path.join(target, 'SKILL.md'), '# random\n');

    expect(() => uninstallSkillFromAgent('flutter-architect', 'claude', false)).toThrow();
  });
});
