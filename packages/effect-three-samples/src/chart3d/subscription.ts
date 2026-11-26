import { Subscription } from '@effect/ui';
import { Stream } from 'effect';

import { pageThemeChanges } from '../pageTheme';
import { Message } from './message';

export const subscriptions = () => [
  Subscription.make(
    'theme',
    Stream.map(pageThemeChanges, (theme) => Message.ChangedTheme({ theme })),
  ),
];
