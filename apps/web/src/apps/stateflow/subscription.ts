import { Port, Subscription } from 'foldkit';

import { fixture } from './fixture';
import { Message } from './message';
import type { Model } from './model';
import { ReplayEventPort } from './ports';

export const subscriptions = Subscription.make<Model, Message>()(() => ({
  replay: Port.subscription(ReplayEventPort, (event) => Message.ReceivedReplayEvent({ event })),
  reducedMotion: Subscription.persistent(
    Subscription.fromMediaQuery({
      query: '(prefers-reduced-motion: reduce)',
      mapMatches: (isReducedMotion) => Message.ChangedReducedMotion({ isReducedMotion }),
    }),
  ),
  frame: Subscription.animationFrame({
    isActive: (model) => model.playback === 'playing' && model.replayIndex < fixture.length,
    toMessage: (deltaTimeMs) => Message.AdvancedReplay({ deltaTimeMs }),
  }),
}));
