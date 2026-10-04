import type { Return as UpdateReturn } from 'foldkit/update';

import * as Arc from '../../ui/arc-diagram';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedArcMessage: ({ message }) => {
      // SAFETY: The app model and message contracts establish this value before the assertion.
      const { model: chart } = Arc.update(model.chart, message as Arc.Message);
      return { model: { ...model, chart } };
    },
  });
