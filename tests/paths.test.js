const os = require('os');
const path = require('path');
const { expandHome, resolveCanonicalRoot, getCanonicalSkillPath, getAgentSkillTarget } = require('../src/core/paths');

const originalRoot = process.env.AGENTSKILLS_ROOT;

describe('paths helpers', () => {
  beforeEach(() => {
    delete process.env.AGENTSKILLS_ROOT;
  });

  afterEach(() => {
    if (originalRoot === undefined) {
      delete process.env.AGENTSKILLS_ROOT;
    } else {
      process.env.AGENTSKILLS_ROOT = originalRoot;
    }
  });

  it('expandHome resolves ~ prefix', () => {
    const output = expandHome('~/agent-skills');
    expect(output).toBe(path.join(os.homedir(), 'agent-skills'));
  });

  it('resolveCanonicalRoot uses env override', () => {
    process.env.AGENTSKILLS_ROOT = '~/custom-agent-skills';
    const root = resolveCanonicalRoot();
    expect(root).toBe(path.resolve(path.join(os.homedir(), 'custom-agent-skills')));
  });

  it('builds canonical and agent target paths', () => {
    const skillPath = getCanonicalSkillPath('flutter-architect');
    expect(skillPath.endsWith(path.join('skills', 'flutter-architect'))).toBe(true);

    const target = getAgentSkillTarget('codex', 'flutter-architect');
    expect(target.endsWith(path.join('.codex', 'skills', 'flutter-architect'))).toBe(true);
  });
});
