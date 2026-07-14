import { FetchMetrics } from './command';
import { Message } from './message';
import { initModel, Model } from './model';
import { NavigationPort, toNavigationValue } from './navigation';
import { makeSubscriptions } from './subscription';
import { update } from './update';
import { view } from './view';

export { Model, Message, update, view };

export const ports = {
  inbound: { navigation: NavigationPort },
};

export const navigation = { port: 'navigation', map: toNavigationValue };
export const subscriptions = makeSubscriptions();

export const init = () => [initModel, [FetchMetrics()]] as const;
