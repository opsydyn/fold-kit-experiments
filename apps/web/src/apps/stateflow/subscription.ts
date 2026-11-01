import { Schema, Stream } from 'effect';
import { Dom, Port, Subscription } from 'foldkit';

import { liveEnvelopes } from './live';
import { Message } from './message';
import type { Model } from './model';
import { ReplayEventPort } from './ports';

/** Phone width: the graph's ranks run down the page. */
export const narrowQuery = '(max-width: 640px)';

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  replay: Port.subscriptionEntry(ReplayEventPort, (event) =>
    Message.ReceivedReplayEvent({ event }),
  ),
  reducedMotion: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(prefers-reduced-motion: reduce)',
      mapMatches: (isReducedMotion) => Message.ChangedReducedMotion({ isReducedMotion }),
    }),
  ),
  narrow: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: narrowQuery,
      mapMatches: (isNarrow) => Message.ChangedNarrow({ isNarrow }),
    }),
  ),
  frame: Subscription.animationFrameEntry({
    isActive: (model) => model.playback === 'playing' && model.cursor < model.events.length,
    toMessage: (deltaTimeMs) => Message.AdvancedReplay({ deltaTimeMs }),
  }),
  // Listening only while live, so a closed page holds no channel open.
  live: entry(
    { live: Schema.Boolean },
    {
      modelToDependencies: (model) => ({ live: model.live }),
      dependenciesToStream: ({ live }) =>
        live
          ? liveEnvelopes.pipe(
              Stream.map(({ specimen, event }) => Message.ReceivedLiveEvent({ specimen, event })),
            )
          : Stream.empty,
    },
  ),
}));
