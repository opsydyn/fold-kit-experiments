import { Match } from 'effect';
import * as Bullet from '../../ui/bullet-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotBulletMessage: ({ message }) => {
        const [chart] = Bullet.update(model.chart, message as Bullet.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
