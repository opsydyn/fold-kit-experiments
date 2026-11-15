import { Option } from 'effect';
import { describe, expect, it } from 'vitest';

import * as PlotPanel from '../../ui/plot-panel';
import { Message } from './message';
import { initModel, samplePoints } from './model';
import type { Model } from './model';
import { update } from './update';

const ready = update(initModel, Message.LoadedMetrics({ points: samplePoints })).model;
const plot = Option.getOrThrow(Option.fromNullishOr(PlotPanel.targetsOf(ready.histogram)[0]));
const bins = PlotPanel.targetsOf(ready.histogram);
const left = bins[0]?.left ?? 0,
  right = bins.at(-1)?.right ?? 0;
const at = (share: number) => left + (right - left) * share;

const brush = (model: Model, message: PlotPanel.Message) =>
  update(model, Message.ReceivedHistogramMessage({ message }));

const started = brush(ready, PlotPanel.Message.PressedPointer({ x: at(0.2), y: plot.cy }));
const moved = brush(started.model, PlotPanel.Message.MovedPointer({ x: at(0.6), y: plot.cy }));
const released = brush(moved.model, PlotPanel.Message.ReleasedPointer());

const xs = (points: ReadonlyArray<{ readonly x: number }>) => points.map(({ x }) => x);
const scatterXs = (model: Model) =>
  xs((model.scatter.spec.data ?? []).map((row) => ({ x: Number(row.x) })));

// These tests catch a histogram brush that no longer reaches the machine, or a selection that
// filters the wrong points or leaves the scatter showing every point.
describe('request diagnostics histogram brush', () => {
  it('starts a selection when a brush starts', () => {
    expect(started.model.explorer._tag).toBe('Selecting');
    expect(started.model.lastTransition).toBe('Ready -> Selecting on StartedSelection');
  });

  it('filters the points and the scatter to the brushed range', () => {
    expect(released.model.explorer._tag).toBe('Filtered');
    const domain =
      released.model.explorer._tag === 'Filtered' ? released.model.explorer.domain : [0, 0];
    const inside = samplePoints.filter((p) => p.x >= domain[0] && p.x <= domain[1]).map((p) => p.x);
    expect(inside.length).toBeGreaterThan(2);
    expect(inside.length).toBeLessThan(samplePoints.length);
    expect(
      xs(released.model.explorer._tag === 'Filtered' ? released.model.explorer.points : []),
    ).toEqual(inside);
    expect(scatterXs(released.model)).toEqual(inside);
  });

  it('restores every point when a click clears the brush', () => {
    const pressed = brush(
      released.model,
      PlotPanel.Message.PressedPointer({ x: at(0.5), y: plot.cy }),
    );
    const cleared = brush(pressed.model, PlotPanel.Message.ReleasedPointer());

    expect(cleared.model.explorer).toEqual({ _tag: 'Ready', points: samplePoints });
    expect(scatterXs(cleared.model)).toEqual(xs(samplePoints));
    expect(cleared.model.lastTransition).toBe('Filtered -> Ready on ClearedSelection');
  });

  it('leaves the machine alone for histogram messages that are not a selection', () => {
    const hovered = brush(ready, PlotPanel.Message.HoveredTarget({ index: 2 }));

    expect(hovered.model.explorer).toBe(ready.explorer);
    expect(hovered.model.lastTransition).toBe(ready.lastTransition);
    expect(hovered.commands ?? []).toEqual([]);
  });
});
