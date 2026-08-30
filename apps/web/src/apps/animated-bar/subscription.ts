import { allTweensDone } from '@opsydyn/foldkit-viz/math/tween';
import { Subscription } from 'foldkit';

import { Message } from './message';
import type { Model } from './model';

export const subscriptions = Subscription.make<Model, Message>()((_entry) => ({
  animating: Subscription.animationFrame({
    isActive: (model) => !allTweensDone(model.tweens),
    toMessage: (dt) => Message.Ticked({ dt }),
  }),
}));
