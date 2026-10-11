import { Match, Schema, Stream } from 'effect';
import { Port, Subscription } from 'foldkit';
import { streamFromMediaQuery } from 'foldkit/dom';

import { RunRequest } from './contract';
import { Message } from './message';
import { activeRun } from './model';
import type { Model } from './model';
import { NavigationPort } from './navigation';
import { agentStream } from './transport';
import type { AgentTransportOptions } from './transport';

const streamFor = (request: RunRequest | null, options?: AgentTransportOptions) =>
  Match.value(request).pipe(
    Match.when(Match.null, () => Stream.empty),
    Match.orElse((request) => agentStream(request, options)),
  );

export const subscriptionsFor = (
  options?: AgentTransportOptions,
): Subscription.Subscriptions<Model, Message> =>
  Subscription.make<Model, Message>()((entry) => ({
    agent: entry(
      { request: Schema.NullOr(RunRequest) },
      {
        modelToDependencies: (model) => ({ request: activeRun(model) }),
        dependenciesToStream: ({ request }) => streamFor(request, options),
      },
    ),
    navigation: Port.subscriptionEntry(NavigationPort, (value) => Message.Navigated(value)),
    compactView: Subscription.persistentEntry(
      streamFromMediaQuery({
        query: '(max-width: 700px)',
        mapMatches: (isCompact) => Message.ChangedCompactView({ isCompact }),
      }),
    ),
  }));
