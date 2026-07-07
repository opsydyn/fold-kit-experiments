import type { Document } from 'foldkit/html';
import * as Corr from '../../ui/correlation-matrix';
import type { Message } from './message';
import { GotCorrMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: Corr.Message): Message => GotCorrMessage({ message: msg });
export const view = (model: Model): Document => ({
  title: 'Correlation matrix — foldkit-viz',
  body: Corr.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Tech stock return correlation matrix 2020–2024',
  }),
});
