import { Subscription } from '@effect/ui';
import { allTweensDone } from '@opsydyn/foldkit-viz/math/tween';
import { Stream } from 'effect';

import { animationFrames } from '../../ui/shared/animation-frames';
import { Message } from './message';
import { eased, type Model } from './model';

export const subscriptions = ({ model }: { readonly model: Model }) => [
  !allTweensDone(model.tweens.map(eased)) &&
    Subscription.make(
      'AnimatedBarFrames',
      animationFrames.pipe(Stream.map((dt) => Message.Ticked({ dt }))),
    ),
];
