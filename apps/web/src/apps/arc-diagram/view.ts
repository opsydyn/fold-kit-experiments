import type { Document, HtmlBuilder } from 'foldkit/html';

import * as Arc from '../../ui/arc-diagram';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: Arc.Message): Message => Message.GotArcMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Arc diagram — foldkit-viz',
  body: Arc.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel: 'Arc diagram — JS tooling dependency network',
    },
    h,
  ),
});
