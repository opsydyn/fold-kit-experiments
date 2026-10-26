/**
 * The radar's subscriptions: animation frames while the timeline plays or a relay jump
 * rides an edge, and the reader's reduced-motion preference, so jumps land at once for
 * those who ask.
 */
import { Option } from 'effect';
import { Dom, Subscription } from 'foldkit';

import { Message } from './message';
import type { Model } from './model';

export const subscriptions = Subscription.make<Model, Message>()(() => ({
  playback: Subscription.animationFrameEntry({
    isActive: (model) => model.playing,
    toMessage: (deltaTimeMs) => Message.AdvancedPlayback({ deltaTimeMs }),
  }),
  relay: Subscription.animationFrameEntry({
    isActive: (model) => Option.isSome(model.journey),
    toMessage: (deltaTimeMs) => Message.AdvancedRelay({ deltaTimeMs }),
  }),
  reducedMotion: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(prefers-reduced-motion: reduce)',
      mapMatches: (isReducedMotion) => Message.ChangedReducedMotion({ isReducedMotion }),
    }),
  ),
}));
