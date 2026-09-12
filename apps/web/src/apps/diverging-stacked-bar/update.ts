import type { Return as UpdateReturn } from 'foldkit/update';

import * as DSB from '../../ui/diverging-stacked-bar';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;
export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotDSBMessage: ({ message }) => {
      const { model: chart } = DSB.update(model.chart, message as DSB.Message);
      return { model: { ...model, chart } };
    },
  });
