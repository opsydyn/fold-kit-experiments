import type { Return as UpdateReturn } from 'foldkit/update';

import * as ScatterChart from '../../ui/scatter-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedScatterMessage: ({ message }) => {
      const { model: scatter } = ScatterChart.update(
        model.scatter,
        // SAFETY: The app model and message contracts establish this value before the assertion.
        message as ScatterChart.Message,
      );
      return { model: { ...model, scatter } };
    },
  });
