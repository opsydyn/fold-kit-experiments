import type { Return as UpdateReturn } from 'foldkit/update';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotScatterMessage: ({ message }) => {
      const scatterMsg = message as Scatter.Message;
      const { model: scatter } = Scatter.update(model.scatter, scatterMsg);

      // Cross-wire: hovering a scatter point highlights its salary bin
      if (scatterMsg._tag === 'HoveredPoint') {
        const point = model.scatter.points[scatterMsg.index];
        if (point !== undefined) {
          const binIndex = model.histogram.bins.findIndex((b) => point.y >= b.x0 && point.y < b.x1);
          if (binIndex >= 0) {
            const { model: histogram } = Histogram.update(
              model.histogram,
              Histogram.Message.HoveredBin({ index: binIndex }),
            );
            return { model: { ...model, scatter, histogram } };
          }
        }
      }

      // Blur clears histogram too
      if (scatterMsg._tag === 'BlurredPoint') {
        const { model: histogram } = Histogram.update(
          model.histogram,
          Histogram.Message.BlurredBin(),
        );
        return { model: { ...model, scatter, histogram } };
      }

      return { model: { ...model, scatter } };
    },

    GotHistogramMessage: ({ message }) => {
      const histMsg = message as Histogram.Message;
      const { model: histogram } = Histogram.update(model.histogram, histMsg);

      // Cross-wire: hovering a histogram bin highlights scatter points in that range
      if (histMsg._tag === 'HoveredBin') {
        const bin = model.histogram.bins[histMsg.index];
        if (bin !== undefined) {
          // Find first scatter point in this bin's salary range to set as active
          const idx = model.scatter.points.findIndex((p) => p.y >= bin.x0 && p.y < bin.x1);
          if (idx >= 0) {
            const { model: scatter } = Scatter.update(
              model.scatter,
              Scatter.Message.HoveredPoint({ index: idx }),
            );
            return { model: { ...model, scatter, histogram } };
          }
        }
      }

      if (histMsg._tag === 'BlurredBin') {
        const { model: scatter } = Scatter.update(model.scatter, Scatter.Message.BlurredPoint());
        return { model: { ...model, scatter, histogram } };
      }

      return { model: { ...model, histogram } };
    },
  });
