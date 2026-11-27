import { Subscription } from '@effect/ui';
import { Stream } from 'effect';

import { animationFrames } from '../../ui/shared/animation-frames';
import { Message } from './message';
import type { Model } from './model';
import { Milliseconds } from './types';

export const subscriptions = ({ model }: { readonly model: Model }) => [
  model.particles.length > 0 &&
    Subscription.make(
      'CounterFrames',
      animationFrames.pipe(
        Stream.map((deltaTimeMs) =>
          Message.TickedFrame({ deltaTimeMs: Milliseconds(deltaTimeMs) }),
        ),
      ),
    ),
];
