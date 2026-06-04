import type { Document } from 'foldkit/html';
import * as Bump from '../../ui/bump-chart';
import type { Message } from './message';
import { GotBumpMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: Bump.Message): Message => GotBumpMessage({ inner: msg });

export const view = (model: Model): Document => ({
  title: 'Bump chart — foldkit-viz',
  body: Bump.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Bump chart — JS framework popularity rankings 2019–2024',
  }),
});
