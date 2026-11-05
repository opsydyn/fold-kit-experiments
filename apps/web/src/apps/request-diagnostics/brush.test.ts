import { Option } from 'effect';
import { describe, expect, it } from 'vitest';

import * as Histogram from '../../ui/histogram-chart';
import { Message } from './message';
import { initModel, samplePoints } from './model';
import type { Model } from './model';
import { update } from './update';

const ready = update(initModel, Message.LoadedMetrics({ points: samplePoints })).model;
const width = ready.histogram.layout.pw;
const bounds = { clientLeft: 0, renderedPW: width };

const brush = (model: Model, message: Histogram.Message) =>
  update(model, Message.ReceivedHistogramMessage({ message }));

const started = brush(
  ready,
  Histogram.Message.StartedHistogramBrush({ screenX: width * 0.2, clientX: width * 0.2, bounds }),
);
const moved = brush(
  started.model,
  Histogram.Message.MovedHistogramBrush({ screenX: width * 0.6, bounds }),
);

const xs = (points: ReadonlyArray<{ readonly x: number }>) => points.map(({ x }) => x);

// These tests catch a histogram brush that no longer reaches the machine, or a selection that
// filters the wrong points or leaves the scatter showing every point.
describe('request diagnostics histogram brush', () => {
  it('starts a selection when a brush starts', () => {
    expect(started.model.explorer._tag).toBe('Selecting');
    expect(started.model.lastTransition).toBe('Ready -> Selecting on StartedSelection');
  });

  it('filters the points and the scatter to the brushed range', () => {
    const domain = Option.getOrThrow(Histogram.getBrushDomain(moved.model.histogram));

    expect(moved.model.explorer).toMatchObject({ _tag: 'Filtered', domain });
    // The brush covers about 149 ms to 402 ms: five of the samples, the ends excluded.
    expect(xs(moved.model.explorer._tag === 'Filtered' ? moved.model.explorer.points : [])).toEqual(
      [175, 217, 260, 306, 350],
    );
    expect(xs(moved.model.scatter.points)).toEqual([175, 217, 260, 306, 350]);
  });

  it('restores every point when the brush is cleared', () => {
    const cleared = brush(moved.model, Histogram.Message.ClearedHistogramBrush());

    expect(cleared.model.explorer).toEqual({ _tag: 'Ready', points: samplePoints });
    expect(xs(cleared.model.scatter.points)).toEqual(xs(samplePoints));
    expect(cleared.model.lastTransition).toBe('Filtered -> Ready on ClearedSelection');
  });

  it('leaves the machine alone for histogram messages that are not a selection', () => {
    const hovered = brush(ready, Histogram.Message.HoveredBin({ index: 2 }));

    expect(hovered.model.explorer).toBe(ready.explorer);
    expect(hovered.model.lastTransition).toBe(ready.lastTransition);
    expect(hovered.commands ?? []).toEqual([]);
  });
});
