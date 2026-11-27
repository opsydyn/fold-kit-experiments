import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * foldkit-viz keeps its interaction state and math framework-agnostic: only
 * optional adapters under src/foldkit, src/effect and src/effect-ui may import their peers, and no
 * module touches the DOM or installs listeners (the roadmap's deliberate
 * non-goals). This scans the source so a stray import fails here.
 */

const SRC = join(import.meta.dir, '..', 'src');

const sourcesUnder = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourcesUnder(path);
    return path.endsWith('.ts') ? [path] : [];
  });

const outsideAdapters = sourcesUnder(SRC)
  .map((path) => ({ file: relative(SRC, path), text: readFileSync(path, 'utf8') }))
  .filter(({ file }) => !file.startsWith('foldkit/'));

const FOLDKIT_IMPORT = /from\s+['"]foldkit(?:\/[^'"]*)?['"]/;
const EFFECT_IMPORT = /from\s+['"]effect(?:\/[^'"]*)?['"]/;
const EFFECT_UI_IMPORT = /from\s+['"]@effect\/ui(?:\/[^'"]*)?['"]/;
// Globals and APIs that would make a module a DOM or event runtime.
const DOM_USE =
  /\b(document|window|navigator)\.|\baddEventListener\b|\brequestAnimationFrame\b|\bHTMLElement\b/;

describe('framework boundary', () => {
  it('finds the modules it checks', () => {
    expect(outsideAdapters.length).toBeGreaterThan(40);
    expect(outsideAdapters.some(({ file }) => file.startsWith('interaction/'))).toBe(true);
  });

  it('keeps FoldKit and Effect imports inside the optional adapters', () => {
    const offenders = outsideAdapters.filter(
      ({ file, text }) =>
        FOLDKIT_IMPORT.test(text) ||
        (EFFECT_IMPORT.test(text) &&
          !file.startsWith('effect/') &&
          !file.startsWith('effect-ui/')) ||
        (EFFECT_UI_IMPORT.test(text) && !file.startsWith('effect-ui/')),
    );
    expect(offenders.map(({ file }) => file)).toEqual([]);
  });

  it('keeps every other module free of the DOM and event listeners', () => {
    const offenders = outsideAdapters.filter(({ text }) => DOM_USE.test(text));
    expect(offenders.map(({ file }) => file)).toEqual([]);
  });
});
