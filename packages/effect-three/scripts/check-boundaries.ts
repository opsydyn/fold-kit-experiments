// Enforces the package layering from ADR-003:
// - src/** never imports foldkit, react or browser platform packages.
// - src/kernel/** never imports effect (hot path, import-gated lint rules do not apply).
import { Glob } from 'bun';

type Rule = {
  readonly glob: string;
  readonly forbidden: ReadonlyArray<RegExp>;
  readonly why: string;
  /** Text the files must not contain at all, beyond imports. */
  readonly forbiddenText?: ReadonlyArray<RegExp>;
};

const rules: ReadonlyArray<Rule> = [
  {
    glob: 'src/**/*.ts',
    forbidden: [/^foldkit(\/|$)/, /^react(-dom)?(\/|$)/, /^@effect\/platform-browser(\/|$)/],
    why: 'core must stay independent of Foldkit, React and the DOM',
  },
  {
    glob: 'src/kernel/**/*.ts',
    forbidden: [/^effect(\/|$)/, /^@effect\//],
    why: 'kernel is the non-Effect hot path (ADR-003)',
  },
  {
    glob: 'src/kernel/**/*.ts',
    forbidden: [/^three\/addons\/(shaders|postprocessing)\//, /^three\/addons\/objects\/Sky/],
    forbiddenText: [/\bShaderMaterial\b/, /\bonBeforeCompile\b/, /\bglsl\b/],
    why: 'kernel is renderer-neutral: shaded parts belong to a render kit (src/webgl)',
  },
];

const importPattern =
  /(?:^|\n)\s*(?:import|export)[^'"]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

const violations: Array<string> = [];
for (const rule of rules) {
  for await (const file of new Glob(rule.glob).scan('.')) {
    const source = await Bun.file(file).text();
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2] ?? '';
      if (rule.forbidden.some((re) => re.test(specifier))) {
        violations.push(`${file}: imports "${specifier}" (${rule.why})`);
      }
    }
    for (const re of rule.forbiddenText ?? []) {
      const found = re.exec(source);
      if (found !== null) violations.push(`${file}: contains "${found[0]}" (${rule.why})`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('boundaries ok');
