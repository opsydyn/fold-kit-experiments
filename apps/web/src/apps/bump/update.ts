import type { Return as UpdateReturn } from 'foldkit/update';

import * as Bump from '../../ui/bump-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotBumpMessage: ({ message }) => {
      const { model: chart } = Bump.update(model.chart, message as Bump.Message);
      return { model: { ...model, chart } };
    },
  });
