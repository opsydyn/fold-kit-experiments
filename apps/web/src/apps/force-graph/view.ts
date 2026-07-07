import type { Document } from 'foldkit/html';
import * as ForceGraph from '../../ui/force-graph';
import type { Message } from './message';
import { GotGraphMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: ForceGraph.Message): Message => GotGraphMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Force Graph — foldkit-viz',
  body: ForceGraph.view({
    model: model.graph,
    toParentMessage,
    ariaLabel: 'JavaScript ecosystem force-directed graph',
  }),
});
