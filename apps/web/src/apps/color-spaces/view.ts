import type { Document } from 'foldkit/html';
import * as ColorSpaces from '../../ui/color-spaces-chart';
import type { Message } from './message';
import { GotColorSpacesMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: ColorSpaces.Message): Message =>
  GotColorSpacesMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Color space interpolation — foldkit-viz',
  body: ColorSpaces.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Red to blue gradient shown in RGB, HSL, and Lab color spaces',
  }),
});
