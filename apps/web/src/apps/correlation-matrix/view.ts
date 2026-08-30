import type { Document, HtmlBuilder } from 'foldkit/html';

import * as Corr from '../../ui/correlation-matrix';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: Corr.Message): Message => Message.GotCorrMessage({ message: msg });
export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Correlation matrix — foldkit-viz',
  body: Corr.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel: 'Tech stock return correlation matrix 2020–2024',
    },
    h,
  ),
});
