import type { Document } from 'foldkit/html';
import * as Voronoi from '../../ui/voronoi-chart';
import type { Message } from './message';
import { GotVoronoiMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: Voronoi.Message): Message =>
  GotVoronoiMessage({ inner: msg });

export const view = (model: Model): Document => ({
  title: 'Voronoi diagram — foldkit-viz',
  body: Voronoi.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Voronoi diagram with Delaunay triangulation',
  }),
});
