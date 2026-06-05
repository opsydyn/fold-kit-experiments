import { allTweensDone, tweenStep } from '@opsydyn/foldkit-viz/math/tween';
import { Match, Option } from 'effect';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      Ticked: ({ dt }) => {
        if (allTweensDone(model.tweens)) return [model, []];
        const tweens = model.tweens.map((tween, i) => {
          // Stagger: bar i starts animating after i * 60ms have elapsed globally
          const delay = i * 60;
          const elapsed0 = model.tweens[0]?.elapsed ?? 0;
          return elapsed0 >= delay ? tweenStep(tween, dt) : tween;
        });
        return [{ ...model, tweens }, []];
      },
      HoveredBar: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      BlurredBar: () => [{ ...model, activeIndex: Option.none() }, []],
    }),
  );
