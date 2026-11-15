import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

/** UK energy flow (simplified): sources to carriers to end uses, one row per flow. */
const flows: ReadonlyArray<Row> = [
  {
    source: 'Coal',
    target: 'Electricity',
    value: 50,
  },
  {
    source: 'Coal',
    target: 'Heating',
    value: 20,
  },
  {
    source: 'Gas',
    target: 'Electricity',
    value: 75,
  },
  {
    source: 'Gas',
    target: 'Heating',
    value: 25,
  },
  {
    source: 'Nuclear',
    target: 'Electricity',
    value: 70,
  },
  {
    source: 'Renewables',
    target: 'Electricity',
    value: 45,
  },
  {
    source: 'Renewables',
    target: 'Heating',
    value: 15,
  },
  {
    source: 'Electricity',
    target: 'Residential',
    value: 70,
  },
  {
    source: 'Electricity',
    target: 'Commercial',
    value: 60,
  },
  {
    source: 'Electricity',
    target: 'Industrial',
    value: 70,
  },
  {
    source: 'Electricity',
    target: 'Losses',
    value: 40,
  },
  {
    source: 'Heating',
    target: 'Residential',
    value: 30,
  },
  {
    source: 'Heating',
    target: 'Commercial',
    value: 20,
  },
  {
    source: 'Heating',
    target: 'Industrial',
    value: 10,
  },
];

export const spec: PlotSpec = {
  width: 440,
  height: 320,
  margins: { top: 8, right: 8, bottom: 8, left: 8 },
  title: 'UK energy flow',
  description: 'Energy from sources through carriers to end uses.',
  data: flows,
  color: {
    domain: [
      'Coal',
      'Gas',
      'Nuclear',
      'Renewables',
      'Electricity',
      'Heating',
      'Residential',
      'Commercial',
      'Industrial',
      'Losses',
    ],
    range: [
      '#78716c',
      '#f97316',
      '#8b5cf6',
      '#14b8a6',
      '#3b82f6',
      '#ef4444',
      '#22c55e',
      '#a855f7',
      '#f59e0b',
      '#94a3b8',
    ],
    legend: false,
  },
  marks: [{ mark: 'sankey', source: 'source', target: 'target', value: 'value' }],
};
