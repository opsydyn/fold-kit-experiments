import { Subscription } from 'foldkit';

import { Message } from './message';
import type { Model } from './model';

export const subscriptions = Subscription.make<Model, Message>()((_entry) => ({
  active: Subscription.animationFrame({
    isActive: () => true,
    toMessage: (deltaTimeMs) => Message.Ticked({ deltaTimeMs }),
  }),
}));
