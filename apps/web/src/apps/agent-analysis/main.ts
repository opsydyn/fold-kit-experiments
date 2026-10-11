import type { Return } from 'foldkit/update';

import { Message } from './message';
import { initModel, Model } from './model';
import { NavigationPort, toNavigationValue } from './navigation';
import { subscriptionsFor } from './subscription';
import { update } from './update';
import { view } from './view';

export { Model, Message, update, view };
export const ports = { inbound: { navigation: NavigationPort } };
export const navigation = { port: 'navigation', map: toNavigationValue };
// Native browser fetch requires its global receiver, not the transport options record.
export const subscriptions = subscriptionsFor({
  endpoint: '/api/agent-analysis',
  fetch: (input, init) => globalThis.fetch(input, init),
});
export const init = (): Return<Model, Message> => ({ model: initModel });
