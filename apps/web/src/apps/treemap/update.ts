import type { Return as UpdateReturn } from 'foldkit/update';

import * as TreemapChart from '../../ui/treemap-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedTreemapMessage: ({ message }) => {
      const { model: treemap } = TreemapChart.update(
        model.treemap,
        // SAFETY: The app model and message contracts establish this value before the assertion.
        message as TreemapChart.Message,
      );
      return { model: { ...model, treemap } };
    },
  });
