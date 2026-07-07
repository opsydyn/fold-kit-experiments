import type { Document } from 'foldkit/html';
import * as MapProjections from '../../ui/map-projections-chart';
import type { Message } from './message';
import { GotMapMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: MapProjections.Message): Message => GotMapMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Map projections — foldkit-viz',
  body: MapProjections.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Side-by-side equirectangular and Mercator map projections',
  }),
});
