import type { Return as UpdateReturn } from 'foldkit/update';

import * as ParallelCoordsChart from '../../ui/parallel-coords-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotParallelCoordsMessage: ({ message }) => {
      const { model: parallelCoords } = ParallelCoordsChart.update(
        model.parallelCoords,
        message as ParallelCoordsChart.Message,
      );
      return { model: { ...model, parallelCoords } };
    },
  });
