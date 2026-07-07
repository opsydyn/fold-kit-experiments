import type { Document } from 'foldkit/html';

import * as DSB from '../../ui/diverging-stacked-bar';
import type { Message } from './message';
import { GotDSBMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: DSB.Message): Message => GotDSBMessage({ message: msg });
export const view = (model: Model): Document => ({
  title: 'Diverging stacked bar — foldkit-viz',
  body: DSB.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Likert scale survey — developer experience',
  }),
});
