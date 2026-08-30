import type { Document, HtmlBuilder } from 'foldkit/html';

import * as DensityContour from '../../ui/density-contour-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: DensityContour.Message): Message =>
  Message.GotDensityContourMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Density contour — foldkit-viz',
  body: DensityContour.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel: 'Bivariate density contour chart with scatter overlay',
    },
    h,
  ),
});
