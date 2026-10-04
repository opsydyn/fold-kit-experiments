import type { Return as UpdateReturn } from 'foldkit/update';

import * as DivBar from '../../ui/diverging-bar-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedDivBarMessage: ({ message }) => {
      // SAFETY: The app model and message contracts establish this value before the assertion.
      const { model: chart } = DivBar.update(model.chart, message as DivBar.Message);
      return { model: { ...model, chart } };
    },
  });
