import { describe, expect, it } from 'vitest';

import { binEdges, histogram, pixelOf, scatter } from './charts';
import { Message } from './message';
import { init } from './model';
import { update } from './update';

const model = init;
const axis = histogram(null).facets[0]?.x;
const at = (ms: number): number => (axis === null || axis === undefined ? 0 : pixelOf(axis, ms));

const drag = (from: number, to: number) => {
  const pressed = update(model, Message.PressedPointer({ surface: 'histogram', x: from }));
  const moved = update(pressed, Message.MovedPointer({ surface: 'histogram', x: to }));
  return update(moved, Message.ReleasedPointer());
};

describe('histogram brush', () => {
  it('snaps a drag to the bin edges it touches', () => {
    const brushed = drag(at(160), at(260)).brushed;
    const starts = binEdges.map(([x0]) => x0);
    const ends = binEdges.map(([, x1]) => x1);
    expect(starts).toContain(brushed?.[0]);
    expect(ends).toContain(brushed?.[1]);
    expect(brushed?.[0]).toBeLessThanOrEqual(160);
    expect(brushed?.[1]).toBeGreaterThanOrEqual(260);
  });

  it('dims the requests and bins outside the brushed range', () => {
    const brushed = drag(at(160), at(260)).brushed;
    const dots = scatter(brushed).facets[0]?.marks[0]?.graphics ?? [];
    const bright = dots.filter((g) => g.opacity === 1).length;
    expect(bright).toBeGreaterThan(0);
    expect(bright).toBeLessThan(dots.length);
    const bars = histogram(brushed).facets[0]?.marks[0]?.graphics ?? [];
    expect(bars.some((g) => g.opacity < 1)).toBe(true);
  });

  it('clears on a click and on the clear button', () => {
    expect(drag(100, 101).brushed).toBeNull();
    const brushed = drag(at(160), at(260));
    expect(update(brushed, Message.ClearedBrush()).brushed).toBeNull();
  });

  it('ignores drags that start outside the histogram', () => {
    const pressed = update(model, Message.PressedPointer({ surface: 'outside', x: 50 }));
    expect(pressed.dragFrom).toBeNull();
  });
});
