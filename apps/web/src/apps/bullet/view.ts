import type { Document, HtmlBuilder } from 'foldkit/html';

import * as Bullet from '../../ui/bullet-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: Bullet.Message): Message => Message.GotBulletMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Bullet chart — foldkit-viz',
  body: Bullet.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel: 'Bullet chart — KPI performance vs targets',
    },
    h,
  ),
});
