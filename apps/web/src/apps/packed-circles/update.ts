import type { Return as UpdateReturn } from 'foldkit/update';

import * as PackedChart from '../../ui/packed-circles-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotPackedMessage: ({ message }) => {
      const { model: packed } = PackedChart.update(model.packed, message as PackedChart.Message);
      return { model: { ...model, packed } };
    },
  });
