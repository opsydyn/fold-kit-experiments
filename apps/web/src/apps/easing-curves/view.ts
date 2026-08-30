import type { Document, HtmlBuilder } from 'foldkit/html';

import * as EasingCurves from '../../ui/easing-curves-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: EasingCurves.Message): Message => Message.GotEasingMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Easing functions — foldkit-viz',
  body: EasingCurves.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel:
        'Comparison of 6 easing functions: linear, sinOut, cubicOut, backOut, elasticOut, bounceOut',
    },
    h,
  ),
});
