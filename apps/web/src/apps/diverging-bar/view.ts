import type { Document } from 'foldkit/html';
import * as DivBar from '../../ui/diverging-bar-chart';
import type { Message } from './message';
import { GotDivBarMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: DivBar.Message): Message => GotDivBarMessage({ inner: msg });

export const view = (model: Model): Document => ({
  title: 'Revenue growth — diverging bar — foldkit-viz',
  body: DivBar.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Monthly year-over-year revenue growth, diverging bar chart',
  }),
});
