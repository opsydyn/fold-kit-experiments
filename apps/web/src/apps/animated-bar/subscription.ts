import { allTweensDone } from '@opsydyn/foldkit-viz/math/tween';
import { Subscription } from 'foldkit';

import { Message } from './message';
import { eased, type Model } from './model';

export const subscriptions = Subscription.make<Model, Message>()((_entry) => ({
  animating: Subscription.animationFrameEntry({
    isActive: (model) => !allTweensDone(model.tweens.map(eased)),
    toMessage: (dt) => Message.Ticked({ dt }),
  }),
}));
