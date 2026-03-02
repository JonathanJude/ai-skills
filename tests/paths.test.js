const os = require('os');
const path = require('path');
const { expandHome, resolveCanonicalRoot, getCanonicalSkillPath, getAgentSkillTarget } = require('../src/core/paths');

const originalRoot = process.env.AISkill_ROOT;

describe('paths helpers', () => {
  beforeEach(() => {
    delete process.env.AISkill_ROOT;
  });

  afterEach(() => {
    if (originalRoot === undefined) {
      delete process.env.AISkill_ROOT;
    } else {
      process.env.AISkill_ROOT = originalRoot;
    }
  });

  it('expandHome resolves ~ prefix', () => {
    const output = expandHome('~/ai-skills');
    expect(output).toBe(path.join(os.homedir(), 'ai-skills'));
  });

  it('resolveCanonicalRoot uses env override', () => {
    process.env.AISkill_ROOT = '~/custom-ai-skills';
    const root = resolveCanonicalRoot();
    expect(root).toBe(path.resolve(path.join(os.homedir(), 'custom-ai-skills')));
  });

  it('builds canonical and agent target paths', () => {
    const skillPath = getCanonicalSkillPath('flutter-architect');
    expect(skillPath.endsWith(path.join('skills', 'flutter-architect'))).toBe(true);

    const target = getAgentSkillTarget('codex', 'flutter-architect');
    expect(target.endsWith(path.join('.codex', 'skills', 'flutter-architect'))).toBe(true);
  });
});
