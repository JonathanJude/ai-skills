const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { spawnSync } = require('child_process');

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aiskill-cli-'));
}

function runCli(args, env) {
  return spawnSync('node', ['bin/aiskill.js', ...args], {
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
      AISkill_ROOT: root,
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

    const skillMd = path.join(env.AISkill_ROOT, 'skills', 'flutter-architect', 'SKILL.md');
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
