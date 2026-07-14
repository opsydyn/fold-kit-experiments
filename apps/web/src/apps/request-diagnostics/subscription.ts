import { Port, Subscription } from 'foldkit';

import { Navigated } from './message';
import type { Message } from './message';
import type { Model } from './model';
import { NavigationPort } from './navigation';

export const makeSubscriptions = () =>
  Subscription.make<Model, Message>()(() => ({
    navigation: Port.subscription(NavigationPort, (value) => Navigated(value)),
  }));
