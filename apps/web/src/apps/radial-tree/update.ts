import type { Return as UpdateReturn } from 'foldkit/update';

import * as RadialTree from '../../ui/radial-tree-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotRadialMessage: ({ message }) => {
      const { model: chart } = RadialTree.update(model.chart, message as RadialTree.Message);
      return { model: { ...model, chart } };
    },
  });
