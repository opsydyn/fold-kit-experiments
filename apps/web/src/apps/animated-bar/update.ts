import { allTweensDone, tweenStep } from '@opsydyn/foldkit-viz/math/tween';
import { Option } from 'effect';
import type { Return as UpdateReturn } from 'foldkit/update';

import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    Ticked: ({ dt }) => {
      if (allTweensDone(model.tweens)) return { model: model };
      const tweens = model.tweens.map((tween, i) => {
        // Stagger: bar i starts animating after i * 60ms have elapsed globally
        const delay = i * 60;
        const elapsed0 = model.tweens[0]?.elapsed ?? 0;
        return elapsed0 >= delay ? tweenStep(tween, dt) : tween;
      });
      return { model: { ...model, tweens } };
    },
    HoveredBar: ({ index }) => ({ model: { ...model, activeIndex: Option.some(index) } }),
    BlurredBar: () => ({ model: { ...model, activeIndex: Option.none() } }),
  });
