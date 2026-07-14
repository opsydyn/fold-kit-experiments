import { Port, Subscription } from 'foldkit';

import { Navigated } from './message';
import type { Message } from './message';
import type { Model } from './model';
import type { NavigationValue } from './navigation';

export const makeSubscriptions = (navigation: Port.Inbound<NavigationValue, NavigationValue>) =>
  Subscription.make<Model, Message>()(() => ({
    navigation: Port.subscription(navigation, (value) => Navigated(value)),
  }));
