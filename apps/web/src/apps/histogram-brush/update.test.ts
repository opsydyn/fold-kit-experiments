import { describe, expect, it } from 'vitest';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { GotHistogramMessage, GotScatterMessage } from './message';
import { init } from './model';
import { update } from './update';

const seedBounds = (model: ReturnType<typeof init>[0]) =>
  update(
    model,
    GotHistogramMessage({
      message: Histogram.RecordedSvgBounds({
        clientLeft: 0,
        renderedPW: model.histogram.layout.pw,
      }),
    }),
  )[0];

const selectedModel = () => {
  const initial = seedBounds(init(undefined)[0]);
  const started = update(
    initial,
    GotHistogramMessage({
      message: Histogram.StartedHistogramBrush({ screenX: 40, clientX: 40 }),
    }),
  )[0];
  const moved = update(
    started,
    GotHistogramMessage({ message: Histogram.MovedHistogramBrush({ screenX: 180 }) }),
  )[0];
  return update(
    moved,
    GotHistogramMessage({ message: Histogram.EndedHistogramBrush({ screenX: 180 }) }),
  )[0];
};

describe('histogram brush selection', () => {
  it('stores a parent interval and derives filtered scatter points from it', () => {
    const model = selectedModel();
    expect(model.selection._tag).toBe('Interval');
    expect(model.scatter.points).not.toEqual(model.allPoints);
  });

  it('clears the parent selection and restores every point', () => {
    const model = update(
      selectedModel(),
      GotHistogramMessage({ message: Histogram.ClearedHistogramBrush() }),
    )[0];
    expect(model.selection).toEqual({ _tag: 'None' });
    expect(model.scatter.points).toEqual(model.allPoints);
  });

  it('does not replace the parent selection for a local scatter message', () => {
    const selected = selectedModel();
    const model = update(
      selected,
      GotScatterMessage({ message: Scatter.HoveredPoint({ index: 0 }) }),
    )[0];
    expect(model.selection).toBe(selected.selection);
  });
});
