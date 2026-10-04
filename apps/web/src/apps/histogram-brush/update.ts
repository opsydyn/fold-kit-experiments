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

const updateHistogramMessage = (model: Model, histMsg: Histogram.Message): Return => {
  const { model: histogram } = Histogram.update(model.histogram, histMsg);
  return Match.value(BRUSH_TAGS.has(histMsg._tag)).pipe(
    Match.when(true, () => applyBrushSelection(model, histogram)),
    Match.orElse(() => ({ model: { ...model, histogram } })),
  );
};

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedHistogramMessage: ({ message }) => {
      // SAFETY: The app model and message contracts establish this value before the assertion.
      // oxlint-disable-next-line linteffect/no-model-overlay-cast
      const histMsg = message as Histogram.Message;
      return updateHistogramMessage(model, histMsg);
    },

    ReceivedScatterMessage: ({ message }) => {
      // SAFETY: The app model and message contracts establish this value before the assertion.
      // oxlint-disable-next-line linteffect/no-model-overlay-cast
      const scatterMsg = message as Scatter.Message;
      const { model: scatter } = Scatter.update(model.scatter, scatterMsg);
      return { model: { ...model, scatter } };
    },
  });
