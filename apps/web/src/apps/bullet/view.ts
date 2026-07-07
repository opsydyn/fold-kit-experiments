import type { Document } from 'foldkit/html';

import * as Bullet from '../../ui/bullet-chart';
import type { Message } from './message';
import { GotBulletMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: Bullet.Message): Message => GotBulletMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Bullet chart — foldkit-viz',
  body: Bullet.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Bullet chart — KPI performance vs targets',
  }),
});
