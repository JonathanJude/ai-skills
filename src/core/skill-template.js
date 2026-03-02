function singleLine(value) {
  return String(value || '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toYamlString(value) {
  const escaped = String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function buildFrontmatter(data, fallbackTitle) {
  const derivedName = String(data.skillName || fallbackTitle || 'unnamed-skill')
    .toLowerCase()
    .replace(/\s+/g, '-');
  const description = singleLine(data.purpose || 'Skill description');

  return [
    '---',
    `name: ${derivedName}`,
    `description: ${toYamlString(description)}`,
    '---',
    '',
  ].join('\n');
}

function createPortableTemplate(data) {
  const title = data.title || 'Untitled Skill';
  const purpose = data.purpose || 'Describe what this skill is for.';
  const whenToUse = data.whenToUse && data.whenToUse.length > 0
    ? data.whenToUse
    : ['Use this skill when the request matches its purpose.', 'Use this skill when consistency is required.'];
  const rules = data.rules && data.rules.length > 0
    ? data.rules
    : ['Follow the project constraints.', 'Prefer explicit and deterministic outputs.'];
  const outputContract = data.outputContract && data.outputContract.length > 0
    ? data.outputContract
    : ['Understand the request context.', 'Produce a concrete solution.', 'Summarize decisions and results.'];

  return [
    buildFrontmatter(data, title),
    `# Skill: ${title}`,
    '',
    '## Purpose',
    purpose,
    '',
    '## When to use',
    ...whenToUse.map((item) => `- ${item}`),
    '',
    '## Rules',
    ...rules.map((item) => `- ${item}`),
    '',
    '## Output contract',
    ...outputContract.map((item, index) => `${index + 1}) ${item}`),
    '',
    '## Notes',
    '- Keep responses structured and actionable.',
    '- Prefer minimal magic strings; use constants/enums where applicable.',
    '',
  ].join('\n');
}

function createFlutterTemplate(data) {
  const purpose = data.purpose || 'Drive production-grade Flutter architecture decisions with clear boundaries and quality gates.';
  return [
    buildFrontmatter(data, data.title || 'flutter-architect'),
    `# Skill: ${data.title || 'Flutter Architect'}`,
    '',
    '## Purpose',
    purpose,
    '',
    '## When to use',
    '- New Flutter app architecture setup or major refactor.',
    '- Defining domain/data/presentation boundaries with repository abstractions.',
    '- Introducing backend swappability without presentation/domain breakage.',
    '',
    '## Rules',
    '- Use Clean Architecture with explicit feature boundaries.',
    '- Use Riverpod for dependency injection and state management.',
    '- Enforce typed failures and deterministic error mapping.',
    '- Keep external provider integrations behind data-source interfaces.',
    '',
    '## Output contract',
    '1) Identify architectural impact and target layers.',
    '2) Produce concrete module/file changes with interfaces.',
    '3) Include tests, failure handling paths, and migration notes.',
    '',
    '## Notes',
    '- Prefer immutable models and explicit contracts.',
    '- Keep generated guidance implementation-ready.',
    '',
  ].join('\n');
}

function renderSkillTemplate(templateName, data) {
  if (templateName === 'flutter') {
    return createFlutterTemplate(data);
  }

  return createPortableTemplate(data);
}

module.exports = {
  renderSkillTemplate,
};
