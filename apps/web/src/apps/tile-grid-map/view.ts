import type { Document, HtmlBuilder } from 'foldkit/html';

import * as TG from '../../ui/tile-grid-map';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: TG.Message): Message => Message.GotTGMessage({ message: msg });
export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'US tile grid map — foldkit-viz',
  body: TG.view(
    { model: model.chart, toParentMessage, ariaLabel: 'US state GDP index tile map' },
    h,
  ),
});
