import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

const BUDGET = [
  { team: 'Design', share: 42, color: '#6366f1' },
  { team: 'Development', share: 38, color: '#8b5cf6' },
  { team: 'Marketing', share: 15, color: '#a78bfa' },
  { team: 'Operations', share: 5, color: '#c4b5fd' },
];

export const spec: PlotSpec = {
  width: 300,
  height: 240,
  title: 'Budget breakdown',
  description: 'Share of the budget for each of four teams, adding to 100.',
  data: BUDGET.map((b) => ({ ...b, label: `${b.team}: ${b.share}%` })),
  color: { domain: BUDGET.map((b) => b.team), range: BUDGET.map((b) => b.color) },
  marks: [
    {
      mark: 'arc',
      value: 'share',
      fill: 'team',
      inner: 0.62,
      padAngle: 1,
      labels: true,
      text: { value: '100%' },
      title: 'label',
    },
  ],
};
