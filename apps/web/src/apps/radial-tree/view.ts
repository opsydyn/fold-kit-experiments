import type { Document, HtmlBuilder } from 'foldkit/html';

import * as RadialTree from '../../ui/radial-tree-chart';
import type { Message } from './message';
import { GotRadialMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: RadialTree.Message): Message => GotRadialMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Indo-European language tree — foldkit-viz',
  body: RadialTree.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel: 'Indo-European language family radial tree',
    },
    h,
  ),
});
