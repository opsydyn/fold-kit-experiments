import { highlightingResources } from '@opsydyn/dataset-explorer/highlighting';
import { Schema } from 'effect';

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

export const Flags = Schema.Struct({});

export const init = (_flags: typeof Flags.Type) => ({ model: initModel });
export const managedResources = highlightingResources<Model, Message>({
  acquired: Message.AcquiredHighlighter,
  failed: Message.FailedHighlighter,
  released: Message.ReleasedHighlighter,
});

export { view } from './view';
