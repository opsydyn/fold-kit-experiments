import { Port, Subscription } from 'foldkit';

import { Message } from './message';
import type { Model } from './model';
import { NavigationPort } from './navigation';

export const makeSubscriptions = () =>
  Subscription.make<Model, Message>()(() => ({
    navigation: Port.subscription(NavigationPort, (value) => Message.Navigated(value)),
  }));
