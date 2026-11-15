import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

// Typical pairwise correlations of daily returns, 2020 to 2024.
const ASSETS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'BRK-B', 'BTC'];
const MATRIX = [
  [1.0, 0.89, 0.83, 0.76, 0.71, 0.74, 0.62, 0.38],
  [0.89, 1.0, 0.86, 0.79, 0.75, 0.76, 0.64, 0.35],
  [0.83, 0.86, 1.0, 0.82, 0.72, 0.79, 0.58, 0.33],
  [0.76, 0.79, 0.82, 1.0, 0.68, 0.77, 0.55, 0.3],
  [0.71, 0.75, 0.72, 0.68, 1.0, 0.69, 0.5, 0.44],
  [0.74, 0.76, 0.79, 0.77, 0.69, 1.0, 0.52, 0.36],
  [0.62, 0.64, 0.58, 0.55, 0.5, 0.52, 1.0, 0.18],
  [0.38, 0.35, 0.33, 0.3, 0.44, 0.36, 0.18, 1.0],
];

const pairs: ReadonlyArray<Row> = ASSETS.flatMap((a, i) =>
  ASSETS.map((b, j) => {
    const r = MATRIX[i]?.[j] ?? 0;
    return { a, b, r, label: `${a} and ${b}: ${r.toFixed(2)}`, text: r.toFixed(1) };
  }),
);

export const spec: PlotSpec = {
  width: 440,
  height: 380,
  title: 'Correlation of returns',
  description: 'Pairwise correlation of daily returns for seven stocks and bitcoin.',
  margins: { left: 56 },
  data: pairs,
  x: { label: '', padding: 0.04 },
  y: { label: '', padding: 0.04, domain: ASSETS },
  color: { type: 'diverging', scheme: 'rdBu', domain: [-1, 1], label: 'Correlation' },
  marks: [
    { mark: 'cell', x: 'a', y: 'b', fill: 'r', title: 'label' },
    { mark: 'text', x: 'a', y: 'b', text: 'text', fill: { value: '#111827' }, dy: 4 },
  ],
};
