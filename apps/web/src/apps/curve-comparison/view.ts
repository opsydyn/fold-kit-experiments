import type { Document } from 'foldkit/html';
import * as CurveComparison from '../../ui/curve-comparison-chart';
import type { Message } from './message';
import { GotCurveMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: CurveComparison.Message): Message => GotCurveMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Curve interpolation — foldkit-viz',
  body: CurveComparison.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Comparison of 5 interpolation curve types',
  }),
});
