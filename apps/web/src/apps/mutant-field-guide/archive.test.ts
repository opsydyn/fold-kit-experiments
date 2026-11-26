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
