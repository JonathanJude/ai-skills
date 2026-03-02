const { normalizeSkillName, validateSkillName } = require('../src/core/validation');

describe('validation', () => {
  it('normalizes spaces and uppercase', () => {
    const result = normalizeSkillName('Flutter Architect');
    expect(result.normalized).toBe('flutter-architect');
    expect(result.changed).toBe(true);
  });

  it('accepts valid normalized names', () => {
    expect(() => validateSkillName('flutter_architect-2')).not.toThrow();
  });

  it('rejects path traversal-like separators', () => {
    expect(() => validateSkillName('../bad')).toThrow();
    expect(() => validateSkillName('bad/name')).toThrow();
  });

  it('rejects invalid characters', () => {
    expect(() => validateSkillName('bad!name')).toThrow();
  });
});
