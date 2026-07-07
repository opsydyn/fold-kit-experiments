import type { Document } from 'foldkit/html';

import * as EasingCurves from '../../ui/easing-curves-chart';
import type { Message } from './message';
import { GotEasingMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: EasingCurves.Message): Message => GotEasingMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Easing functions — foldkit-viz',
  body: EasingCurves.view({
    model: model.chart,
    toParentMessage,
    ariaLabel:
      'Comparison of 6 easing functions: linear, sinOut, cubicOut, backOut, elasticOut, bounceOut',
  }),
});
