import type { Return as UpdateReturn } from 'foldkit/update';

import * as TG from '../../ui/tile-grid-map';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;
export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotTGMessage: ({ message }) => {
      const { model: chart } = TG.update(model.chart, message as TG.Message);
      return { model: { ...model, chart } };
    },
  });
