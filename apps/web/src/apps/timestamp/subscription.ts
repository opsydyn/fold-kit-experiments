import { Schema } from 'effect';
import { Subscription } from 'foldkit';

import { Ticked } from './message';
import type { Message } from './message';
import type { Model } from './model';

export const subscriptions = Subscription.makeSubscriptions(
  Schema.Struct({ active: Schema.Boolean }),
)<Model, Message>({
  active: Subscription.animationFrame({
    isActive: () => true,
    toMessage: (deltaTimeMs) => Ticked({ deltaTimeMs }),
  }),
});
