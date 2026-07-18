import {
  intervalSelection,
  SELECTION_NONE,
  selectionContainsValue,
  type Selection,
} from '@opsydyn/foldkit-viz/interaction/selection';
import { Match, Option } from 'effect';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

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
  const [scatter] = Scatter.update(
    model.scatter,
    Scatter.UpdatedPoints({ points: pointsForSelection(model.allPoints, selection) }),
  );
  return [{ ...model, histogram, scatter, selection }, []];
};

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotHistogramMessage: ({ message }) => {
        const histMsg = message as Histogram.Message;
        const [histogram] = Histogram.update(model.histogram, histMsg);
        if (BRUSH_TAGS.has(histMsg._tag)) {
          return applyBrushSelection(model, histogram);
        }
        return [{ ...model, histogram }, []];
      },

      GotScatterMessage: ({ message }) => {
        const scatterMsg = message as Scatter.Message;
        const [scatter] = Scatter.update(model.scatter, scatterMsg);
        return [{ ...model, scatter }, []];
      },
    }),
  );
