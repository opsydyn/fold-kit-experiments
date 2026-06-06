import { Match } from 'effect';
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

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotHistogramMessage: ({ inner }) => {
        const histMsg = inner as Histogram.Message;
        const [histogram] = Histogram.update(model.histogram, histMsg);

        if (BRUSH_TAGS.has(histMsg._tag)) {
          const brushedDomain = Histogram.getBrushDomain(histogram);
          const filteredPoints =
            brushedDomain !== null
              ? model.allPoints.filter(
                  (point) => point.x >= brushedDomain[0] && point.x <= brushedDomain[1],
                )
              : model.allPoints;
          const [scatter] = Scatter.update(
            model.scatter,
            Scatter.UpdatedPoints({ points: filteredPoints }),
          );
          return [{ ...model, histogram, scatter }, []];
        }

        return [{ ...model, histogram }, []];
      },

      GotScatterMessage: ({ inner }) => {
        const scatterMsg = inner as Scatter.Message;
        const [scatter] = Scatter.update(model.scatter, scatterMsg);
        return [{ ...model, scatter }, []];
      },
    }),
  );
