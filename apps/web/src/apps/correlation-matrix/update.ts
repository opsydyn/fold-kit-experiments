import type { Return as UpdateReturn } from 'foldkit/update';

import * as Corr from '../../ui/correlation-matrix';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;
export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedCorrMessage: ({ message }) => {
      // SAFETY: The app model and message contracts establish this value before the assertion.
      const { model: chart } = Corr.update(model.chart, message as Corr.Message);
      return { model: { ...model, chart } };
    },
  });
