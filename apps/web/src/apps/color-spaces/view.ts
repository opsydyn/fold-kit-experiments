import type { Document, HtmlBuilder } from 'foldkit/html';

import * as ColorSpaces from '../../ui/color-spaces-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: ColorSpaces.Message): Message =>
  Message.GotColorSpacesMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Color space interpolation — foldkit-viz',
  body: ColorSpaces.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel: 'Red to blue gradient shown in RGB, HSL, and Lab color spaces',
    },
    h,
  ),
});
