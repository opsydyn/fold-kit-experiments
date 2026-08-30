import type { Document, HtmlBuilder } from 'foldkit/html';

import * as LogScatter from '../../ui/log-scatter-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: LogScatter.Message): Message =>
  Message.GotLogScatterMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'npm packages — log scatter — foldkit-viz',
  body: LogScatter.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel: 'Log-scale scatter of npm packages by downloads and GitHub stars',
    },
    h,
  ),
});
