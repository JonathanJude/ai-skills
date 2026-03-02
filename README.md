# aiskill 🧠🔗

`aiskill` is a Node.js CLI for managing one canonical skills library and syncing it to multiple AI coding agents.

Supported agents:
- Codex
- Claude Code
- OpenCode
- Kilo Code

Default behavior:
- Canonical source of truth in `~/ai-skills`
- Install to agent skill directories via symlink
- Copy mode available when symlink is not ideal

## Why use it? 🚀
- Keep skills in one place, reuse everywhere
- Avoid manual copying across agent folders
- Run health checks (`doctor`) to catch broken/orphaned installs
- Safe defaults for conflict handling and uninstall flows

## Requirements
- Node.js `20+`
- macOS/Linux recommended for default symlink flow
- Windows supported (copy mode default is recommended)

## Quick Start
```bash
npm install
npm link
aiskill --help
```

Create and auto-install a skill:
```bash
aiskill new flutter-architect
aiskill list
```

## Canonical Layout
Default canonical root:
- `~/ai-skills`
- Skill path: `~/ai-skills/skills/<skillName>/SKILL.md`

Override root:
```bash
export AISkill_ROOT="~/my-skills-root"
```

## What a skill looks like
```text
<skill-name>/
  SKILL.md
  references/   (optional)
  scripts/      (optional)
```

`SKILL.md` includes YAML frontmatter for compatibility:
```yaml
---
name: your-skill-name
description: "Short summary of what the skill does"
---
```

## Configuration ⚙️
Generated automatically on first run:
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

Tip:
- If one agent does not pick up symlinks, set `"installMode": "copy"` or use `--mode copy`.

## Commands

### `new` (create skill)
```bash
aiskill new flutter-architect
aiskill new my-skill --template flutter --agents codex,claude
aiskill new test-skill --no-install --with-references --with-scripts
```

### `add` (import existing skill from folder/zip) 📥
```bash
# Import from a folder
aiskill add ./my-existing-skill

# Import from a zip and sync only to selected agents
aiskill add ./my-existing-skill.zip --agents codex,claude

# Override imported name and force replace
aiskill add ./skills/legacy-reviewer --name reviewer-v2 --force
```

Note:
- If imported `SKILL.md` has no YAML frontmatter, `aiskill` auto-injects a generic frontmatter block and prints a warning so you can review/edit it.

### `install` / `uninstall`
```bash
aiskill install flutter-architect
aiskill install flutter-architect --agents claude --mode copy --force
aiskill uninstall flutter-architect --agents claude
```

### `delete` (canonical delete)
```bash
aiskill delete flutter-architect
aiskill delete flutter-architect --uninstall-first
aiskill delete flutter-architect --force
```

### `list` / `status`
```bash
aiskill list
aiskill list --json
aiskill status flutter-architect
aiskill status flutter-architect --json
```

### `doctor` 🩺
```bash
aiskill doctor
aiskill doctor --fix
aiskill doctor --json
```

### `edit` ✏️
```bash
aiskill edit flutter-architect
aiskill edit flutter-architect --file SKILL.md --editor code
```

## Typical Workflow
```bash
# 1) Create a new skill
aiskill new api-reviewer

# 2) Import an existing skill from another repo/archive
aiskill add ./downloaded-skills/security-audit.zip

# 3) Verify coverage
aiskill list

# 4) Update skill content
aiskill edit api-reviewer

# 5) Run health checks
aiskill doctor
```

## Editor resolution order
1. `--editor`
2. `$AISkill_EDITOR`
3. `$EDITOR`
4. `code`
5. `cursor`
6. `nano`
7. `vi`

## Safety Rules
- Never deletes canonical skill on `uninstall`
- Refuses unknown/non-managed target removal unless `--force`
- `doctor --fix` requires interactive confirmations
- Non-interactive `doctor --fix` refuses mutations

## Troubleshooting

### Codex says SKILL.md frontmatter is missing
Make sure `SKILL.md` starts with:
```yaml
---
name: skill-name
description: "..."
---
```

If you imported with `aiskill add`, missing frontmatter is auto-added for you. Review it with:
```bash
aiskill edit your-skill
```

### OpenCode/KiloCode do not show a skill
- Check install status:
```bash
aiskill status your-skill
```
- Reinstall in copy mode:
```bash
aiskill uninstall your-skill --agents opencode,kilocode
aiskill install your-skill --agents opencode,kilocode --mode copy --force
```

### Import from zip/folder fails
- Verify source contains exactly one valid skill root with `SKILL.md`
- Try explicit naming if folder names are messy:
```bash
aiskill add ./incoming/archive.zip --name clean-skill-name
```

### Broken links or orphaned installs
```bash
aiskill doctor
aiskill doctor --fix
```

## Exit Codes
- `0` success
- `1` operational failure
- `2` invalid usage
- `3` partial success

## Local Testing
```bash
npm test
```

## Publish Prep 📦
Basic checklist before publishing:
- Confirm package name availability (or use a scope like `@you/aiskill`)
- Run tests: `npm test`
- Check package contents: `npm pack --dry-run`
- Publish: `npm publish --access public`
