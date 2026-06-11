import { Match } from 'effect';
import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotScatterMessage: ({ inner }) => {
        const scatterMsg = inner as Scatter.Message;
        const [scatter] = Scatter.update(model.scatter, scatterMsg);

        // Cross-wire: hovering a scatter point highlights its salary bin
        if (scatterMsg._tag === 'HoveredPoint') {
          const point = model.scatter.points[scatterMsg.index];
          if (point !== undefined) {
            const binIndex = model.histogram.bins.findIndex(
              (b) => point.y >= b.x0 && point.y < b.x1,
            );
            if (binIndex >= 0) {
              const [histogram] = Histogram.update(
                model.histogram,
                Histogram.HoveredBin({ index: binIndex }),
              );
              return [{ ...model, scatter, histogram }, []];
            }
          }
        }

        // Blur clears histogram too
        if (scatterMsg._tag === 'BlurredPoint') {
          const [histogram] = Histogram.update(model.histogram, Histogram.BlurredBin({}));
          return [{ ...model, scatter, histogram }, []];
        }

        return [{ ...model, scatter }, []];
      },

      GotHistogramMessage: ({ inner }) => {
        const histMsg = inner as Histogram.Message;
        const [histogram] = Histogram.update(model.histogram, histMsg);

        // Cross-wire: hovering a histogram bin highlights scatter points in that range
        if (histMsg._tag === 'HoveredBin') {
          const bin = model.histogram.bins[histMsg.index];
          if (bin !== undefined) {
            // Find first scatter point in this bin's salary range to set as active
            const idx = model.scatter.points.findIndex((p) => p.y >= bin.x0 && p.y < bin.x1);
            if (idx >= 0) {
              const [scatter] = Scatter.update(model.scatter, Scatter.HoveredPoint({ index: idx }));
              return [{ ...model, scatter, histogram }, []];
            }
          }
        }

        if (histMsg._tag === 'BlurredBin') {
          const [scatter] = Scatter.update(model.scatter, Scatter.BlurredPoint({}));
          return [{ ...model, scatter, histogram }, []];
        }

        return [{ ...model, histogram }, []];
      },
    }),
  );
