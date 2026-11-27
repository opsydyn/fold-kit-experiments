import { Subscription } from '@effect/ui';
import { Effect, Stream } from 'effect';

import { animationFrames } from '../../ui/shared/animation-frames';
import { Message } from './message';
import type { Model } from './model';

const clock = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });

export const subscriptions = ({ model }: { readonly model: Model }) => [
  Subscription.make(
    'Uptime',
    animationFrames.pipe(Stream.map((deltaTimeMs) => Message.Ticked({ deltaTimeMs }))),
  ),
  Subscription.make('LocalStartTime', model.startedAt, (startedAt) =>
    Stream.fromEffect(
      Effect.sync(() =>
        Message.FormattedStart({
          label: clock.format(new Date(startedAt)),
        }),
      ),
    ),
  ),
];
