import { highlightingResources } from '@opsydyn/dataset-explorer/highlighting';
import { sourceLineSubscriptions } from '@opsydyn/dataset-explorer/source-lines';

import { Message } from './message';
import type { Model } from './model';
export { Model, init } from './model';
export { Message } from './message';
export { update } from './update';
export { view } from './view';
export const managedResources = highlightingResources<Model, Message>({
  acquired: Message.AcquiredHighlighter,
  failed: Message.FailedHighlighter,
  released: Message.ReleasedHighlighter,
});

export const subscriptions = sourceLineSubscriptions<Model, Message>(Message.NavigatedSourceLine);
