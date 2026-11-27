import { Subscription } from '@effect/ui';
import { Stream } from 'effect';

import { animationFrames } from '../../ui/shared/animation-frames';
import { Message } from './message';
import { Model } from './model';

export const subscriptions = ({ model }: { readonly model: Model }) => [
  Model.is('Loaded')(model) &&
    Subscription.make(
      'HealthFrames',
      animationFrames.pipe(Stream.map((deltaTimeMs) => Message.TickedFrame({ deltaTimeMs }))),
    ),
];
