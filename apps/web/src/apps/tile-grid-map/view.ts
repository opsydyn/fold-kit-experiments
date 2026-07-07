import type { Document } from 'foldkit/html';

import * as TG from '../../ui/tile-grid-map';
import type { Message } from './message';
import { GotTGMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: TG.Message): Message => GotTGMessage({ message: msg });
export const view = (model: Model): Document => ({
  title: 'US tile grid map — foldkit-viz',
  body: TG.view({ model: model.chart, toParentMessage, ariaLabel: 'US state GDP index tile map' }),
});
