import type { Return as UpdateReturn } from 'foldkit/update';

import * as Bullet from '../../ui/bullet-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotBulletMessage: ({ message }) => {
      const { model: chart } = Bullet.update(model.chart, message as Bullet.Message);
      return { model: { ...model, chart } };
    },
  });
