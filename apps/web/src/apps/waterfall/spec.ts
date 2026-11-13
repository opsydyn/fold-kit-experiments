import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

const ENTRIES: ReadonlyArray<readonly [string, number, 'total' | 'delta']> = [
  ['Revenue', 850, 'total'],
  ['COGS', -320, 'delta'],
  ['Gross', 530, 'total'],
  ['R&D', -85, 'delta'],
  ['S&M', -75, 'delta'],
  ['G&A', -20, 'delta'],
  ['EBITDA', 350, 'total'],
  ['D&A', -45, 'delta'],
  ['EBIT', 305, 'total'],
  ['Int.', -25, 'delta'],
  ['Tax', -68, 'delta'],
  ['Net', 212, 'total'],
];

/** Each step as an interval bar: totals from zero, changes from the running total. */
function steps(): ReadonlyArray<Row> {
  let running = 0;
  return ENTRIES.map(([item, value, type]) => {
    const from = type === 'total' ? 0 : running;
    const to = type === 'total' ? value : running + value;
    running = to;
    const kind = type === 'total' ? 'total' : value < 0 ? 'decrease' : 'increase';
    return {
      item,
      from,
      to,
      kind,
      label: `${item}: ${value > 0 && type === 'delta' ? '+' : ''}${value}`,
    };
  });
}

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Revenue to net income',
  description: 'How revenue becomes net income: totals in blue, deductions in red.',
  data: steps(),
  x: { label: '' },
  y: { label: '$k', zero: true },
  color: { domain: ['total', 'increase', 'decrease'], range: ['#6366f1', '#10b981', '#ef4444'] },
  marks: [{ mark: 'bar', x: 'item', y: 'to', y0: 'from', fill: 'kind', title: 'label' }],
};
