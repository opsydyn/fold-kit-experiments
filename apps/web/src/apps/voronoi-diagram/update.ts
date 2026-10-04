import type { Return as UpdateReturn } from 'foldkit/update';

import * as Voronoi from '../../ui/voronoi-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedVoronoiMessage: ({ message }) => {
      // SAFETY: The app model and message contracts establish this value before the assertion.
      const { model: chart } = Voronoi.update(model.chart, message as Voronoi.Message);
      return { model: { ...model, chart } };
    },
  });
