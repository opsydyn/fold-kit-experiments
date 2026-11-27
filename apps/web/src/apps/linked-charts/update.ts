import { Option } from 'effect';

import * as PlotPanel from '../../ui/plot-panel/core';
import { updateHistogram, updateScatter } from './fold';
import { Message } from './message';
import { pointsWithExperience, type Model } from './model';

type Transition = Readonly<{ model: Model }>;

export const update = (model: Model, msg: Message): Transition =>
  Message.match(msg, {
    ChangedMinimumExperience: ({ years }) => {
      if (!Number.isFinite(years) || years < 0) return { model };
      const replaced = PlotPanel.Message.ReplacedRows({ rows: pointsWithExperience(years) });
      return {
        model: {
          minimumExperience: years,
          inspection: Option.none(),
          scatter: PlotPanel.update(model.scatter, replaced).model,
          histogram: PlotPanel.update(model.histogram, replaced).model,
        },
      };
    },
    ReceivedScatterMessage: ({ message }) => ({ model: updateScatter(model, message) }),
    ReceivedHistogramMessage: ({ message }) => ({ model: updateHistogram(model, message) }),
  });
