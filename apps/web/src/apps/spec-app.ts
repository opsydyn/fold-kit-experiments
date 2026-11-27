import type { View } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { plotChart } from '@opsydyn/foldkit-viz/effect-ui/plot';
import { compilePlot, plotTable } from '@opsydyn/foldkit-viz/plot';
import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { Schema } from 'effect';

export const staticChart = (view: (h: Html.H<never>) => View.Content<never>) =>
  Html.component({
    name: 'StaticVizChart',
    model: Schema.Null,
    message: Schema.Never,
  }).make({
    init: () => null,
    update: ($) => $.model,
    view,
  });

export const specApp = (spec: PlotSpec) => {
  const geometry = compilePlot(spec);
  const table = plotTable(spec);
  return staticChart((h) => plotChart(h, geometry, { summary: true, table }));
};
