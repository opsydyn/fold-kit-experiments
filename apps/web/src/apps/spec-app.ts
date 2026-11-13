import { plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';
import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import type { Return } from 'foldkit/update';

import type { AppInitProps } from './types';

/**
 * A FoldKit app that draws one plot spec and holds no state. Pre-rendered with
 * no client directive, it ships as static HTML.
 */
export const SpecModel = Schema.Struct({});
export type SpecModel = typeof SpecModel.Type;
/**
 * Static charts send nothing. The union still declares one message so the app
 * fits hosts typed for message-sending apps, such as the Storybook mount.
 */
export const SpecMessage = defineMessageUnion({ Unused: {} });
export type SpecMessage = typeof SpecMessage.Type;

export const specApp = (spec: PlotSpec) => {
  const geometry = compilePlot(spec);
  return {
    Model: SpecModel,
    Message: SpecMessage,
    init: (_props: AppInitProps): Return<SpecModel, SpecMessage> => ({ model: {} }),
    update: (model: SpecModel): Return<SpecModel, SpecMessage> => ({ model }),
    view: (_model: SpecModel, h: HtmlBuilder<SpecMessage>): Document => ({
      title: spec.title ?? 'Chart',
      body: plotChart(h, geometry),
    }),
  };
};
