import type { Return as UpdateReturn } from 'foldkit/update';

import * as MapProjections from '../../ui/map-projections-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotMapMessage: ({ message }) => {
      const { model: chart } = MapProjections.update(
        model.chart,
        message as MapProjections.Message,
      );
      return { model: { ...model, chart } };
    },
  });
