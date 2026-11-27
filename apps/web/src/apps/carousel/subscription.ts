import { Subscription } from '@effect/ui';
import { Stream } from 'effect';

import { animationFrames } from '../../ui/shared/animation-frames';
import { Message } from './message';
import type { Model } from './model';

export const subscriptions = ({ model }: { readonly model: Model }) => [
  model._tag === 'Loaded' &&
    model.drag._tag === 'Settling' &&
    Subscription.make(
      'CarouselSettleFrames',
      animationFrames.pipe(Stream.map((deltaTimeMs) => Message.TickedSettle({ deltaTimeMs }))),
    ),
];
