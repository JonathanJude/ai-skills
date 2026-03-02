# aiskill

`aiskill` is a Node.js CLI that keeps a canonical local skills library and syncs skills into global skill directories for:
- Codex
- Claude Code
- OpenCode
- Kilo Code

By default it installs skills as symlinks (copy mode fallback supported).

## Requirements
- Node.js 20+
- macOS or Linux for default symlink flow (Windows supported with copy-mode default)

## Local install
```bash
npm install
npm link
aiskill --help
```

## Canonical layout
Default canonical root:
- `~/ai-skills`
- skills at `~/ai-skills/skills/<skillName>/SKILL.md`

Override root with env var:
```bash
export AISkill_ROOT="~/my-skills-root"
```

## Config
Generated automatically on first run at:
- `~/ai-skills/config.json` (or `<AISkill_ROOT>/config.json`)

Example:
```json
{
  "canonicalRoot": "~/ai-skills",
  "skillsDirName": "skills",
  "agents": {
    "codex": { "enabled": true, "skillsDir": "~/.codex/skills" },
    "claude": { "enabled": true, "skillsDir": "~/.claude/skills" },
    "opencode": { "enabled": true, "skillsDir": "~/.config/opencode/skills" },
    "kilocode": { "enabled": true, "skillsDir": "~/.kilocode/skills" }
  },
  "defaults": {
    "installAgents": ["codex", "claude", "opencode", "kilocode"],
    "installMode": "symlink"
  }
}
```

## Commands

### Create
```bash
aiskill new flutter-architect
aiskill new my-skill --template flutter --agents codex,claude
aiskill new test-skill --no-install --with-references --with-scripts
```

### Install / uninstall
```bash
aiskill install flutter-architect
aiskill install flutter-architect --agents claude --mode copy --force
aiskill uninstall flutter-architect --agents claude
```

### Delete canonical skill
```bash
aiskill delete flutter-architect
aiskill delete flutter-architect --uninstall-first
aiskill delete flutter-architect --force
```

### Inspect
```bash
aiskill list
aiskill list --json
aiskill status flutter-architect
aiskill status flutter-architect --json
```

### Doctor
```bash
aiskill doctor
aiskill doctor --fix
aiskill doctor --json
```

### Edit
```bash
aiskill edit flutter-architect
aiskill edit flutter-architect --file SKILL.md --editor code
```

## Editor resolution order
1. `--editor`
2. `$AISkill_EDITOR`
3. `$EDITOR`
4. `code`
5. `cursor`
6. `nano`
7. `vi`

## Safety behavior
- Never deletes canonical skill on uninstall.
- Refuses to remove unknown/non-managed targets unless `--force`.
- `doctor --fix` requires interactive confirmations; non-interactive `--fix` refuses mutations.

## Exit codes
- `0` success
- `1` operational failure
- `2` invalid usage
- `3` partial success

## Test
```bash
npm test
```
