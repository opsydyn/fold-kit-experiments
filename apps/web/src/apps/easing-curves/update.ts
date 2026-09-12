import type { Return as UpdateReturn } from 'foldkit/update';

import * as EasingCurves from '../../ui/easing-curves-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotEasingMessage: ({ message }) => {
      const { model: chart } = EasingCurves.update(model.chart, message as EasingCurves.Message);
      return { model: { ...model, chart } };
    },
  });
