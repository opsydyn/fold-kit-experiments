import { allTweensDone } from '@opsydyn/foldkit-viz/math/tween';
import { Subscription } from 'foldkit';
import { Ticked } from './message';
import type { Model } from './model';
import type { Message } from './message';

export const subscriptions = Subscription.make<Model, Message>()((_entry) => ({
  animating: Subscription.animationFrame({
    isActive: (model) => !allTweensDone(model.tweens),
    toMessage: (dt) => Ticked({ dt }),
  }),
}));
