import type { Return as UpdateReturn } from 'foldkit/update';

import * as TidyTree from '../../ui/tidy-tree-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotTreeMessage: ({ message }) => {
      const { model: chart } = TidyTree.update(model.chart, message as TidyTree.Message);
      return { model: { ...model, chart } };
    },
  });
