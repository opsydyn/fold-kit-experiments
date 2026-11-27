import { describe, expect, it } from 'vitest';

import { Message } from './message';
import { cloud, init, observations, users, walk } from './model';
import { update } from './update';

describe('data science datasets', () => {
  it('are the documented sizes', () => {
    expect([users.length, observations.length, walk.length, cloud.length]).toEqual([
      550, 120, 100_000, 20_000,
    ]);
  });

  it('suit their axes: positive users for a log scale, x in order for downsampling', () => {
    expect(users.every((p) => p.y > 0)).toBe(true);
    expect(walk.every((p, i) => i === 0 || p.x > (walk[i - 1]?.x ?? -1))).toBe(true);
    expect(users[0]?.x).toBe(Date.UTC(2025, 4, 1));
  });
});

describe('data science update', () => {
  const model = init;

  it('starts on M4 and a straight-line fit', () => {
    expect(model).toEqual({ downsampler: 'm4', fit: 'linear' });
  });

  it('switches the downsampler and the fit', () => {
    expect(update(model, Message.ChoseDownsampler({ downsampler: 'lttb' })).downsampler).toBe(
      'lttb',
    );
    expect(update(model, Message.ChoseFit({ fit: 'loess' })).fit).toBe('loess');
  });
});
