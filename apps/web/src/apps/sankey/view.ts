import type { Document } from 'foldkit/html';
import * as SankeyChart from '../../ui/sankey-chart';
import type { Message } from './message';
import { GotSankeyMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: SankeyChart.Message): Message => GotSankeyMessage({ inner: msg });

export const view = (model: Model): Document => ({
  title: 'Sankey — foldkit-viz',
  body: SankeyChart.view({
    model: model.sankey,
    toParentMessage,
    ariaLabel: 'UK energy flow sankey diagram',
  }),
});
