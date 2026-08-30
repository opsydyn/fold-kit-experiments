import type { Document, HtmlBuilder } from 'foldkit/html';

import * as ForceGraph from '../../ui/force-graph';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: ForceGraph.Message): Message => Message.GotGraphMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Force Graph — foldkit-viz',
  body: ForceGraph.view(
    {
      model: model.graph,
      toParentMessage,
      ariaLabel: 'JavaScript ecosystem force-directed graph',
    },
    h,
  ),
});
