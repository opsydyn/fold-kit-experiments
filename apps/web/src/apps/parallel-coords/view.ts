import type { Document, HtmlBuilder } from 'foldkit/html';

import * as ParallelCoordsChart from '../../ui/parallel-coords-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: ParallelCoordsChart.Message): Message =>
  Message.GotParallelCoordsMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Parallel Coordinates — foldkit-viz',
  body: ParallelCoordsChart.view(
    {
      model: model.parallelCoords,
      toParentMessage,
      ariaLabel: 'Car comparison parallel coordinates chart',
    },
    h,
  ),
});
