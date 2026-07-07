import { Schema } from 'effect';

import * as StreamgraphChart from '../../ui/streamgraph-chart';

export const Model = Schema.Struct({ streamgraph: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'streamgraph'> & {
  readonly streamgraph: StreamgraphChart.Model;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Illustrative npm weekly downloads (millions) for JS frameworks, 2024
const DATA: Array<Record<string, number>> = [
  { react: 18.2, vue: 4.5, angular: 3.8, svelte: 0.9, solid: 0.3 },
  { react: 18.6, vue: 4.6, angular: 3.9, svelte: 1.0, solid: 0.35 },
  { react: 19.1, vue: 4.7, angular: 3.9, svelte: 1.1, solid: 0.42 },
  { react: 19.4, vue: 4.8, angular: 4.0, svelte: 1.2, solid: 0.48 },
  { react: 19.8, vue: 4.9, angular: 4.0, svelte: 1.3, solid: 0.55 },
  { react: 20.3, vue: 5.0, angular: 4.1, svelte: 1.4, solid: 0.62 },
  { react: 20.8, vue: 5.1, angular: 4.1, svelte: 1.5, solid: 0.68 },
  { react: 21.2, vue: 5.2, angular: 4.2, svelte: 1.6, solid: 0.75 },
  { react: 21.7, vue: 5.3, angular: 4.2, svelte: 1.7, solid: 0.82 },
  { react: 22.1, vue: 5.4, angular: 4.3, svelte: 1.8, solid: 0.88 },
  { react: 22.6, vue: 5.5, angular: 4.3, svelte: 1.9, solid: 0.95 },
  { react: 23.1, vue: 5.6, angular: 4.4, svelte: 2.0, solid: 1.02 },
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [streamgraph] = StreamgraphChart.init({
    data: DATA,
    xLabels: MONTHS,
    series: [
      { key: 'react', label: 'React', color: '#38bdf8' },
      { key: 'vue', label: 'Vue', color: '#4ade80' },
      { key: 'angular', label: 'Angular', color: '#f87171' },
      { key: 'svelte', label: 'Svelte', color: '#fb923c' },
      { key: 'solid', label: 'Solid', color: '#c084fc' },
    ],
  });
  return [{ streamgraph }, []];
};
