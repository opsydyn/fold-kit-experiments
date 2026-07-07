import type { Document } from 'foldkit/html';
import * as Arc from '../../ui/arc-diagram';
import type { Message } from './message';
import { GotArcMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: Arc.Message): Message => GotArcMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Arc diagram — foldkit-viz',
  body: Arc.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Arc diagram — JS tooling dependency network',
  }),
});
