import { Html } from '@effect/ui/html';
import { plotChart } from '@opsydyn/foldkit-viz/effect-ui/plot';
import { compilePlot, plotTables } from '@opsydyn/foldkit-viz/plot';
import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { Schema } from 'effect';

const morning = { category: 'Morning', requests: 2 };
const evening = { category: 'Evening', requests: 8 };
const samples = {
  MorningOnly: { description: '', data: [morning] },
  FullDay: { description: 'Morning and evening requests', data: [morning, evening] },
};

export const VizChangingPlot = Html.component({
  name: 'VizChangingPlot',
  model: Schema.Literals(['MorningOnly', 'FullDay']),
  message: Schema.Literal('ExpandedPlot'),
}).make({
  init: () => 'MorningOnly',
  update: () => 'FullDay',
  view: (h, range) => {
    const sample = samples[range];
    const spec: PlotSpec = {
      width: 360,
      height: 200,
      title: 'Requests by time of day',
      description: sample.description,
      data: sample.data,
      x: { domain: ['Morning', 'Evening'] },
      y: { domain: [0, 10] },
      marks: [{ mark: 'bar', x: 'category', y: 'requests', title: 'category' }],
    };
    const geometry = compilePlot(spec);
    return h.div(
      h.button.attr('type', 'button').on('click', 'ExpandedPlot').children('Show evening'),
      plotChart(h, geometry, { tables: plotTables(spec, geometry) }),
    );
  },
});
