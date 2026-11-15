import { plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';
import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import type { Document, HtmlBuilder } from 'foldkit/html';
import type { Return } from 'foldkit/update';

import { SpecMessage, SpecModel } from '../spec-app';
import type { AppInitProps } from '../types';
import { specs } from './spec';

/** Two projections of the same cities side by side; static, so it ships no JavaScript. */
const geometries = specs.map(compilePlot);

export const Model = SpecModel;
export const Message = SpecMessage;
export const init = (_props: AppInitProps): Return<SpecModel, SpecMessage> => ({ model: {} });
export const update = (model: SpecModel): Return<SpecModel, SpecMessage> => ({ model });
export const view = (_model: SpecModel, h: HtmlBuilder<SpecMessage>): Document => ({
  title: 'Map projections — foldkit-viz',
  body: h.div(
    [h.Style({ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '0.5rem' })],
    geometries.map((geometry) => plotChart(h, geometry, { legend: false })),
  ),
});
