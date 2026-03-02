const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { spawnSync } = require('child_process');

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentskills-cli-'));
}

function runCli(args, env) {
  return spawnSync('node', ['bin/agentskills.js', ...args], {
    cwd: path.resolve(__dirname, '..'),
    env,
    encoding: 'utf8',
  });
}

describe('CLI smoke', () => {
  let tempRoot;
  let env;

  beforeEach(() => {
    tempRoot = makeTempRoot();
    const home = path.join(tempRoot, 'home');
    const root = path.join(tempRoot, 'canonical');
    fs.ensureDirSync(home);

    env = {
      ...process.env,
      AGENTSKILLS_ROOT: root,
      HOME: home,
      USERPROFILE: home,
      FORCE_COLOR: '0',
    };
  });

  afterEach(() => {
    fs.removeSync(tempRoot);
  });

  it('new creates skill and list/status --json return data', () => {
    const created = runCli(['new', 'flutter-architect'], env);
    expect(created.status).toBe(0);

    const skillMd = path.join(env.AGENTSKILLS_ROOT, 'skills', 'flutter-architect', 'SKILL.md');
    expect(fs.existsSync(skillMd)).toBe(true);
    const skillMdContent = fs.readFileSync(skillMd, 'utf8');
    expect(skillMdContent.startsWith('---\n')).toBe(true);

    const listed = runCli(['list', '--json'], env);
    expect(listed.status).toBe(0);
    const listJson = JSON.parse(listed.stdout);
    expect(Array.isArray(listJson)).toBe(true);
    expect(listJson[0].skillName).toBe('flutter-architect');

    const status = runCli(['status', 'flutter-architect', '--json'], env);
    expect(status.status).toBe(0);
    const statusJson = JSON.parse(status.stdout);
    expect(statusJson.skillName).toBe('flutter-architect');
  });

  it('add imports a skill folder and syncs by default', () => {
    const sourceSkill = path.join(tempRoot, 'incoming-skill', 'team-reviewer');
    fs.ensureDirSync(sourceSkill);
    fs.writeFileSync(
      path.join(sourceSkill, 'SKILL.md'),
      '---\nname: team-reviewer\ndescription: \"imported\"\n---\n\n# Skill: Team Reviewer\n'
    );

    const added = runCli(['add', sourceSkill], env);
    expect(added.status).toBe(0);

    const canonicalSkill = path.join(env.AGENTSKILLS_ROOT, 'skills', 'team-reviewer', 'SKILL.md');
    expect(fs.existsSync(canonicalSkill)).toBe(true);

    const codexTarget = path.join(env.HOME, '.codex', 'skills', 'team-reviewer');
    expect(fs.existsSync(codexTarget)).toBe(true);
  });

  it('add auto-injects frontmatter for imported skill without YAML', () => {
    const sourceSkill = path.join(tempRoot, 'incoming-skill', 'no-frontmatter');
    fs.ensureDirSync(sourceSkill);
    fs.writeFileSync(
      path.join(sourceSkill, 'SKILL.md'),
      '# Skill: No Frontmatter\n\nplain body\n'
    );

    const added = runCli(['add', sourceSkill, '--no-install'], env);
    expect(added.status).toBe(0);
    expect(added.stderr).toContain('Added a generic frontmatter block automatically');

    const canonicalSkill = path.join(env.AGENTSKILLS_ROOT, 'skills', 'no-frontmatter', 'SKILL.md');
    const content = fs.readFileSync(canonicalSkill, 'utf8');
    expect(content.startsWith('---\n')).toBe(true);
    expect(content).toContain('name: no-frontmatter');
  });

  it('uninstall/install lifecycle works for selected agent', () => {
    expect(runCli(['new', 'flutter-architect'], env).status).toBe(0);

    const uninstallClaude = runCli(['uninstall', 'flutter-architect', '--agents', 'claude'], env);
    expect(uninstallClaude.status).toBe(0);

    const claudeTarget = path.join(env.HOME, '.claude', 'skills', 'flutter-architect');
    expect(fs.existsSync(claudeTarget)).toBe(false);

    const installClaude = runCli(['install', 'flutter-architect', '--agents', 'claude'], env);
    expect(installClaude.status).toBe(0);
    expect(fs.existsSync(claudeTarget)).toBe(true);
  });

  it('delete refuses while installed unless uninstall-first/force', () => {
    expect(runCli(['new', 'flutter-architect'], env).status).toBe(0);

    const blocked = runCli(['delete', 'flutter-architect'], env);
    expect(blocked.status).toBe(1);

    const deleted = runCli(['delete', 'flutter-architect', '--uninstall-first'], env);
    expect(deleted.status).toBe(0);
  });

  it('doctor detects issues and non-interactive --fix refuses mutation', () => {
    expect(runCli(['new', 'flutter-architect', '--no-install'], env).status).toBe(0);

    const doctor = runCli(['doctor', '--json'], env);
    expect(doctor.status).toBe(1);
    const doctorJson = JSON.parse(doctor.stdout);
    expect(Array.isArray(doctorJson.issues)).toBe(true);

    const doctorFix = runCli(['doctor', '--fix', '--json'], env);
    expect(doctorFix.status).toBe(1);
    const fixJson = JSON.parse(doctorFix.stdout);
    expect(fixJson.fixesSkipped.length).toBeGreaterThan(0);
  });

  it('edit opens with explicit editor command', () => {
    if (process.platform === 'win32') {
      return;
    }

    expect(runCli(['new', 'flutter-architect', '--no-install'], env).status).toBe(0);

    const fakeBinDir = path.join(tempRoot, 'bin');
    fs.ensureDirSync(fakeBinDir);
    const fakeEditorPath = path.join(fakeBinDir, 'fake-editor');
    fs.writeFileSync(fakeEditorPath, '#!/bin/sh\nexit 0\n', { mode: 0o755 });

    const editEnv = { ...env, PATH: `${fakeBinDir}:${env.PATH}` };
    const edited = runCli(['edit', 'flutter-architect', '--editor', 'fake-editor'], editEnv);
    expect(edited.status).toBe(0);
  });
});
