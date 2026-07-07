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

const applyBrushFilter = (
  model: Model,
  histogram: Histogram.Model,
): Return => {
  const brushedDomainOpt = Histogram.getBrushDomain(histogram);
  const filteredPoints = Option.isSome(brushedDomainOpt)
    ? model.allPoints.filter(
        (point) =>
          point.x >= brushedDomainOpt.value[0] && point.x <= brushedDomainOpt.value[1],
      )
    : model.allPoints;
  const [scatter] = Scatter.update(
    model.scatter,
    Scatter.UpdatedPoints({ points: filteredPoints }),
  );
  return [{ ...model, histogram, scatter }, []];
};

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotHistogramMessage: ({ message }) => {
        const histMsg = message as Histogram.Message;
        const [histogram] = Histogram.update(model.histogram, histMsg);
        if (BRUSH_TAGS.has(histMsg._tag)) {
          return applyBrushFilter(model, histogram);
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
