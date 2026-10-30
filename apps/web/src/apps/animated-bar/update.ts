import { allTweensDone, tweenStep } from '@opsydyn/foldkit-viz/math/tween';
import { Match, Option } from 'effect';
import type { Return as UpdateReturn } from 'foldkit/update';

import { Message } from './message';
import { eased, type Model, settled } from './model';

type Return = UpdateReturn<Model, Message>;

const stepTween = (model: Model, tween: Model['tweens'][number], index: number, dt: number) => {
  const delay = index * 60;
  const elapsed0 = model.tweens[0]?.elapsed ?? 0;
  return Match.value(elapsed0 >= delay).pipe(
    Match.when(true, () => settled(tweenStep(eased(tween), dt))),
    Match.orElse(() => tween),
  );
};

const tick = (model: Model, dt: number): Return =>
  Match.value(allTweensDone(model.tweens.map(eased))).pipe(
    Match.when(true, () => ({ model })),
    Match.orElse(() => ({
      model: {
        ...model,
        tweens: model.tweens.map((tween, index) => stepTween(model, tween, index, dt)),
      },
    })),
  );

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    Ticked: ({ dt }) => tick(model, dt),
    HoveredBar: ({ index }) => ({ model: { ...model, activeIndex: Option.some(index) } }),
    BlurredBar: () => ({ model: { ...model, activeIndex: Option.none() } }),
  });
