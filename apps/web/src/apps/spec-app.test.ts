import { Component } from '@effect/ui';
import { describe, expect, it } from 'vitest';

const mains = import.meta.glob<string>('./*/main.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const apps = import.meta.glob<{ default: unknown }>('./*/app.ts');
const staticEntries = Object.entries(mains)
  .filter(([, source]) => source.includes("from '../spec-app'"))
  .map(([path]) => path.replace('/main.ts', '/app.ts'));

describe('static gallery entry points', () => {
  it('includes all maintained single-spec charts and the map pair', () => {
    expect(staticEntries.length).toBeGreaterThanOrEqual(42);
    expect(staticEntries).toContain('./map-projections/app.ts');
  });

  it.each(staticEntries)('%s uses the Effect UI renderer', async (path) => {
    const load = apps[path];
    if (load === undefined) throw new Error('Missing static chart entry ' + path);
    expect(Component.isComponent((await load()).default)).toBe(true);
  });
});
