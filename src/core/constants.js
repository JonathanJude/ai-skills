const AGENT_KEYS = ['codex', 'claude', 'opencode', 'kilocode'];

const AGENT_LABELS = {
  codex: 'Codex',
  claude: 'Claude Code',
  opencode: 'OpenCode',
  kilocode: 'Kilo Code',
};

const DEFAULT_CANONICAL_ROOT = '~/agent-skills';
const DEFAULT_SKILLS_DIR_NAME = 'skills';

const DEFAULT_AGENT_SKILLS_DIRS = {
  codex: '~/.codex/skills',
  claude: '~/.claude/skills',
  opencode: '~/.config/opencode/skills',
  kilocode: '~/.kilocode/skills',
};

const TOOL_NAME = 'agentskills';
const DEFAULT_INSTALL_MODE = process.platform === 'win32' ? 'copy' : 'symlink';

const DEFAULT_CONFIG = {
  canonicalRoot: DEFAULT_CANONICAL_ROOT,
  skillsDirName: DEFAULT_SKILLS_DIR_NAME,
  agents: {
    codex: { enabled: true, skillsDir: DEFAULT_AGENT_SKILLS_DIRS.codex },
    claude: { enabled: true, skillsDir: DEFAULT_AGENT_SKILLS_DIRS.claude },
    opencode: { enabled: true, skillsDir: DEFAULT_AGENT_SKILLS_DIRS.opencode },
    kilocode: { enabled: true, skillsDir: DEFAULT_AGENT_SKILLS_DIRS.kilocode },
  },
  defaults: {
    installAgents: [...AGENT_KEYS],
    installMode: DEFAULT_INSTALL_MODE,
  },
};

const EXIT_CODES = {
  OK: 0,
  ERROR: 1,
  USAGE: 2,
  PARTIAL: 3,
};

module.exports = {
  AGENT_KEYS,
  AGENT_LABELS,
  DEFAULT_CANONICAL_ROOT,
  DEFAULT_SKILLS_DIR_NAME,
  DEFAULT_AGENT_SKILLS_DIRS,
  TOOL_NAME,
  DEFAULT_INSTALL_MODE,
  DEFAULT_CONFIG,
  EXIT_CODES,
};
