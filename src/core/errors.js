class AISkillError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AISkillError';
    this.code = options.code || 'AISKILL_ERROR';
    this.exitCode = options.exitCode || 1;
    this.details = options.details;
  }
}

function usageError(message, details) {
  return new AISkillError(message, { code: 'INVALID_USAGE', exitCode: 2, details });
}

module.exports = {
  AISkillError,
  usageError,
};
