const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { ensureConfig } = require('../src/core/config');
const { getCanonicalSkillPath, getAgentSkillsDir, getAgentSkillTarget } = require('../src/core/paths');
const { doctor, collectDoctorReport } = require('../src/core/doctor');

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aiskill-doctor-'));
}

describe('doctor', () => {
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

    const canonical = getCanonicalSkillPath('flutter-architect');
    fs.ensureDirSync(canonical);
    fs.writeFileSync(path.join(canonical, 'SKILL.md'), '# Skill\n');
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

  it('detects broken symlink and missing dirs', () => {
    const codexDir = getAgentSkillsDir('codex');
    fs.ensureDirSync(codexDir);

    const target = getAgentSkillTarget('codex', 'flutter-architect');
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(path.join(tempRoot, 'missing-target'), target, linkType);

    const report = collectDoctorReport();
    const types = report.issues.map((item) => item.type);
    expect(types).toContain('broken_symlink');
    expect(types).toContain('missing_agent_dir');
  });

  it('refuses non-interactive fix mode mutations', async () => {
    const report = await doctor({ fix: true, nonInteractive: true });
    expect(report.fixesSkipped.length).toBeGreaterThan(0);
  });

  it('applies fix actions when confirmed', async () => {
    const report = await doctor({
      fix: true,
      nonInteractive: false,
      confirmFix: async (item) => ['missing_agent_dir', 'missing_install'].includes(item.type),
    });

    expect(report.fixesApplied.length).toBeGreaterThan(0);
  });
});
