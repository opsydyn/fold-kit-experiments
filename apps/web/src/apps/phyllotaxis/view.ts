import type { Document } from 'foldkit/html';
import * as PhyllotaxisChart from '../../ui/phyllotaxis-chart';
import type { Message } from './message';
import { GotPhyllotaxisMessage } from './message';
import type { Model } from './model';

type PhyllotaxisMessage = PhyllotaxisChart.Message;

const toParentMessage = (msg: PhyllotaxisMessage): Message =>
  GotPhyllotaxisMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Phyllotaxis — foldkit-viz',
  body: PhyllotaxisChart.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Phyllotaxis zoom and pan',
  }),
});
