const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { ensureConfig } = require('../src/core/config');
const { getCanonicalSkillPath, getAgentSkillTarget } = require('../src/core/paths');
const { installSkillToAgent } = require('../src/core/installers');
const { getSkillStatus } = require('../src/core/status');

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentskills-status-'));
}

describe('status', () => {
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

  it('reports installed symlink/copy status', () => {
    const mode = process.platform === 'win32' ? 'copy' : 'symlink';
    installSkillToAgent('flutter-architect', 'codex', mode, false);

    const status = getSkillStatus('flutter-architect');
    expect(status.canonicalExists).toBe(true);
    expect(status.hasSkillMd).toBe(true);
    expect(status.agents.codex.installed).toBe(true);
    expect(status.agents.codex.status).toBe('ok');
  });

  it('reports collision when symlink points elsewhere', () => {
    const target = getAgentSkillTarget('claude', 'flutter-architect');
    fs.ensureDirSync(path.dirname(target));

    const external = path.join(tempRoot, 'external-skill');
    fs.ensureDirSync(external);
    fs.writeFileSync(path.join(external, 'SKILL.md'), '# external\n');

    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(external, target, linkType);

    const status = getSkillStatus('flutter-architect');
    expect(status.agents.claude.status).toBe('collision');
    expect(status.agents.claude.ok).toBe(false);
  });

  it('reports orphaned when canonical missing and target exists', () => {
    installSkillToAgent('flutter-architect', 'opencode', 'copy', false);
    fs.removeSync(getCanonicalSkillPath('flutter-architect'));

    const status = getSkillStatus('flutter-architect');
    expect(status.canonicalExists).toBe(false);
    expect(status.agents.opencode.status).toBe('orphaned');
  });
});
