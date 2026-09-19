import { Port, Subscription } from 'foldkit';

import { fixture } from './fixture';
import { Message } from './message';
import type { Model } from './model';
import { ReplayEventPort } from './ports';

export const subscriptions = Subscription.make<Model, Message>()(() => ({
  replay: Port.subscription(ReplayEventPort, (event) => Message.ReceivedReplayEvent({ event })),
  frame: Subscription.animationFrame({
    isActive: (model) => model.playback === 'playing' && model.replayIndex < fixture.length,
    toMessage: () => Message.AdvancedReplay(),
  }),
}));
