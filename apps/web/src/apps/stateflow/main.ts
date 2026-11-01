import { highlightingResources } from '@opsydyn/dataset-explorer/highlighting';
import { Schema } from 'effect';

import { Message } from './message';
import { initModel, Model } from './model';
import { ReplayEventPort, TransitionTelemetryPort } from './ports';
import { SharedSession } from './share';
import { subscriptions } from './subscription';
import { update, withSession } from './update';

export { Message, Model, subscriptions, update };

export const ports = {
  inbound: { replay: ReplayEventPort },
  outbound: { transitionTelemetry: TransitionTelemetryPort },
};

/** The session a shared link carries, decoded on the server from the page's address. */
export const Flags = Schema.Struct({ session: Schema.NullOr(SharedSession) });

export const init = (flags: typeof Flags.Type) => ({
  model: withSession(initModel, flags.session),
});
export const managedResources = highlightingResources<Model, Message>({
  acquired: Message.AcquiredHighlighter,
  failed: Message.FailedHighlighter,
  released: Message.ReleasedHighlighter,
});

export { view } from './view';
