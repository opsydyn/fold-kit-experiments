import type { Document } from 'foldkit/html';
import * as StreamgraphChart from '../../ui/streamgraph-chart';
import type { Message } from './message';
import { GotStreamgraphMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: StreamgraphChart.Message): Message =>
  GotStreamgraphMessage({ inner: msg });

export const view = (model: Model): Document => ({
  title: 'Streamgraph — foldkit-viz',
  body: StreamgraphChart.view({
    model: model.streamgraph,
    toParentMessage,
    ariaLabel: 'JS framework download trends streamgraph',
  }),
});
