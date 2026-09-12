import type { Return as UpdateReturn } from 'foldkit/update';

import * as BubbleChart from '../../ui/bubble-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotBubbleMessage: ({ message }) => {
      const { model: bubble } = BubbleChart.update(model.bubble, message as BubbleChart.Message);
      return { model: { ...model, bubble } };
    },
  });
