import type { Document } from 'foldkit/html';
import * as TidyTree from '../../ui/tidy-tree-chart';
import type { Message } from './message';
import { GotTreeMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: TidyTree.Message): Message => GotTreeMessage({ inner: msg });

export const view = (model: Model): Document => ({
  title: 'Tech stack — foldkit-viz',
  body: TidyTree.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Frontend tech stack dependency tree',
  }),
});
