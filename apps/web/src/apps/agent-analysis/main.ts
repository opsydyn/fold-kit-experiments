import { Html } from '@effect/ui/html';

import { Message } from './message';
import { initModel, Model } from './model';
import { subscriptionsFor } from './subscription';
import { update } from './update';
import { view } from './view';

export const AgentAnalysis = Html.component({
  name: 'ServiceIncidentLab',
  model: Model,
  message: Message,
}).make({
  init: () => initModel,
  update: ($, message) => update($.model, message).model,
  subscriptions: subscriptionsFor({
    endpoint: '/api/agent-analysis',
    fetch: (input, init) => globalThis.fetch(input, init),
  }),
  view,
});
