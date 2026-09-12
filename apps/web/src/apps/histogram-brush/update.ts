import {
  intervalSelection,
  SELECTION_NONE,
  selectionContainsValue,
  type Selection,
} from '@opsydyn/foldkit-viz/interaction/selection';
import { Match, Option } from 'effect';
import type { Return as UpdateReturn } from 'foldkit/update';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

const BRUSH_TAGS = new Set([
  'StartedHistogramBrush',
  'MovedHistogramBrush',
  'EndedHistogramBrush',
  'ClearedHistogramBrush',
  'RecordedSvgBounds',
]);

const selectionFromHistogram = (histogram: Histogram.Model): Selection =>
  Option.match(Histogram.getBrushDomain(histogram), {
    onNone: () => SELECTION_NONE,
    onSome: (domain) => intervalSelection('x', domain),
  });

const pointsForSelection = (
  allPoints: ReadonlyArray<Scatter.Point>,
  selection: Selection,
): ReadonlyArray<Scatter.Point> =>
  Match.value(selection).pipe(
    Match.tags({
      Interval: (selection) =>
        allPoints.filter((point) => selectionContainsValue(selection, 'x', point.x)),
      Keys: () => allPoints,
      None: () => allPoints,
    }),
    Match.exhaustive,
  );

const applyBrushSelection = (model: Model, histogram: Histogram.Model): Return => {
  const selection = selectionFromHistogram(histogram);
  const { model: scatter } = Scatter.update(
    model.scatter,
    Scatter.Message.UpdatedPoints({ points: pointsForSelection(model.allPoints, selection) }),
  );
  return { model: { ...model, histogram, scatter, selection } };
};

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotHistogramMessage: ({ message }) => {
      const histMsg = message as Histogram.Message;
      const { model: histogram } = Histogram.update(model.histogram, histMsg);
      if (BRUSH_TAGS.has(histMsg._tag)) {
        return applyBrushSelection(model, histogram);
      }
      return { model: { ...model, histogram } };
    },

    GotScatterMessage: ({ message }) => {
      const scatterMsg = message as Scatter.Message;
      const { model: scatter } = Scatter.update(model.scatter, scatterMsg);
      return { model: { ...model, scatter } };
    },
  });
