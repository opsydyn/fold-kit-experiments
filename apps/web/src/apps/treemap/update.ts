import type { Return as UpdateReturn } from 'foldkit/update';

import * as TreemapChart from '../../ui/treemap-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotTreemapMessage: ({ message }) => {
      const { model: treemap } = TreemapChart.update(
        model.treemap,
        message as TreemapChart.Message,
      );
      return { model: { ...model, treemap } };
    },
  });
