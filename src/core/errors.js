class AgentSkillsError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AgentSkillsError';
    this.code = options.code || 'AGENTSKILLS_ERROR';
    this.exitCode = options.exitCode || 1;
    this.details = options.details;
  }
}

function usageError(message, details) {
  return new AgentSkillsError(message, { code: 'INVALID_USAGE', exitCode: 2, details });
}

module.exports = {
  AgentSkillsError,
  usageError,
};
