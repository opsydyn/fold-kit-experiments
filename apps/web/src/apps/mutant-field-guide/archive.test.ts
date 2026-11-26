import { describe, expect, it } from 'vitest';

import seed from './advisory-seed.json';
import { loadGuide } from './archive';

describe('field guide advisory history', () => {
  it('joins repeats by mutant ID and keeps the original outcome when a later attempt catches it', async () => {
    const original = seed[0]!;
    const first = original.entries[0]!;
    const discovered = {
      ...first,
      id: '1234567890abcdef12345678',
      fn: 'layout',
      outcome: 'missed',
    };
    const replay = {
      ...original,
      attempt: 2,
      entries: [{ ...first, outcome: 'caught' }, discovered],
    };
    const { records, offline } = await loadGuide(async () => Response.json([replay, original]));
    expect(offline).toBe(false);
    expect(records.size).toBe(12);
    expect(records.get(discovered.id)?.observations).toMatchObject([{ outcome: 'missed' }]);
    expect(records.get(first.id)?.observations.map((item) => item.outcome)).toEqual([
      'untested',
      'caught',
    ]);
  });

  it('shows the bundled archive when the remote archive cannot be decoded', async () => {
    const { records, offline } = await loadGuide(async () => Response.json({ invalid: true }));
    expect(offline).toBe(true);
    expect(records.size).toBe(11);
  });
});

it('keeps a legacy web specimen and the same Zloz ID independently addressable', async () => {
  const [web] = seed;
  const [entry] = web!.entries;
  const workspace = 'apps/zloz-demo';
  const zloz = { ...web, workspace, entries: [{ ...entry, outcome: 'caught' }] };
  const empty = { ...zloz, attempt: 2, selected: 0, entries: [] };
  const { records, latestRuns, offline } = await loadGuide(async () =>
    Response.json([empty, zloz]),
  );
  expect(offline).toBe(false);
  expect(records.get(entry!.id)?.observations.map((item) => item.outcome)).toEqual(['untested']);
  expect(
    records.get(workspace + '/' + entry!.id)?.observations.map((item) => item.outcome),
  ).toEqual(['caught']);
  expect(latestRuns.get(workspace)).toMatchObject({ attempt: 2, selected: 0, entries: [] });
  expect(latestRuns.get('apps/web')?.run).toBe(web!.run);
  expect(latestRuns.has('packages/foldkit-viz')).toBe(false);
});
