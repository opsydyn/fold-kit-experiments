/**
 * The radar's subscriptions: animation frames while the timeline plays or a relay jump
 * rides an edge, and the reader's reduced-motion preference, so jumps land at once for
 * those who ask.
 */
import { Duration, Option } from 'effect';
import { Dom, Subscription } from 'foldkit';

import { cometMoves } from './comet';
import { konamiCode } from './invaders';
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
  // The Konami code, anywhere but in a text field: the invaders' cue.
  konami: Subscription.persistentEntry(
    Dom.streamFromKeyBindings<Message>({
      bindings: [
        {
          keys: konamiCode,
          preventDefault: false,
          mapEvent: () => Message.EnteredKonamiCode(),
        },
      ],
      sequenceTimeout: Duration.seconds(3),
    }),
  ),
  invasion: Subscription.animationFrameEntry({
    isActive: (model) => Option.isSome(model.invasion),
    toMessage: (deltaTimeMs) => Message.AdvancedInvasion({ deltaTimeMs }),
  }),
  comet: Subscription.animationFrameEntry({
    isActive: cometMoves,
    toMessage: (deltaTimeMs) => Message.AdvancedComet({ deltaTimeMs }),
  }),
  reducedMotion: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(prefers-reduced-motion: reduce)',
      mapMatches: (isReducedMotion) => Message.ChangedReducedMotion({ isReducedMotion }),
    }),
  ),
}));
