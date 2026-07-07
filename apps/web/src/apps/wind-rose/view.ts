import type { Document } from 'foldkit/html';

import * as WR from '../../ui/wind-rose-chart';
import type { Message } from './message';
import { GotWRMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: WR.Message): Message => GotWRMessage({ message: msg });
export const view = (model: Model): Document => ({
  title: 'Wind rose — foldkit-viz',
  body: WR.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Wind rose — directional frequency',
  }),
});
