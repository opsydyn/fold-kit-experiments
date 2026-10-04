import { describe, expect, it } from 'vitest';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { Message } from './message';
import { init } from './model';
import { update } from './update';

const seedBounds = (model: ReturnType<typeof init>['model']) =>
  update(
    model,
    Message.ReceivedHistogramMessage({
      message: Histogram.Message.RecordedSvgBounds({
        clientLeft: 0,
        renderedPW: model.histogram.layout.pw,
      }),
    }),
  ).model;

const selectedModel = () => {
  const initial = seedBounds(init({}).model);
  const started = update(
    initial,
    Message.ReceivedHistogramMessage({
      message: Histogram.Message.StartedHistogramBrush({ screenX: 40, clientX: 40 }),
    }),
  ).model;
  const moved = update(
    started,
    Message.ReceivedHistogramMessage({
      message: Histogram.Message.MovedHistogramBrush({ screenX: 180 }),
    }),
  ).model;
  return update(
    moved,
    Message.ReceivedHistogramMessage({
      message: Histogram.Message.EndedHistogramBrush({ screenX: 180 }),
    }),
  ).model;
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
      Message.ReceivedHistogramMessage({ message: Histogram.Message.ClearedHistogramBrush() }),
    ).model;
    expect(model.selection).toEqual({ _tag: 'None' });
    expect(model.scatter.points).toEqual(model.allPoints);
  });

  it('does not replace the parent selection for a local scatter message', () => {
    const selected = selectedModel();
    const model = update(
      selected,
      Message.ReceivedScatterMessage({ message: Scatter.Message.HoveredPoint({ index: 0 }) }),
    ).model;
    expect(model.selection).toBe(selected.selection);
  });
});
