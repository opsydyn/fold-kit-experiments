import type { Document } from 'foldkit/html';
import * as ParallelCoordsChart from '../../ui/parallel-coords-chart';
import type { Message } from './message';
import { GotParallelCoordsMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: ParallelCoordsChart.Message): Message =>
  GotParallelCoordsMessage({ inner: msg });

export const view = (model: Model): Document => ({
  title: 'Parallel Coordinates — foldkit-viz',
  body: ParallelCoordsChart.view({
    model: model.parallelCoords,
    toParentMessage,
    ariaLabel: 'Car comparison parallel coordinates chart',
  }),
});
