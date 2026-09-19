import type { Document, HtmlBuilder } from 'foldkit/html';

import { Message } from './message';
import { initModel, Model } from './model';
import { ReplayEventPort, TransitionTelemetryPort } from './ports';
import { subscriptions } from './subscription';
import { update } from './update';

export { Message, Model, subscriptions, update };

export const ports = {
  inbound: { replay: ReplayEventPort },
  outbound: { transitionTelemetry: TransitionTelemetryPort },
};

export const init = () => ({ model: initModel });

export const view = (model: typeof initModel, h: HtmlBuilder<Message>): Document => ({
  title: 'Stateflow replay',
  body: h.div([], [`Stateflow replay: ${model.explorer._tag}`]),
});
