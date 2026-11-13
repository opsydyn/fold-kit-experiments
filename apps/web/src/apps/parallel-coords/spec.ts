import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

/** Eight cars across five measures. */
const cars: ReadonlyArray<Row> = [
  {
    name: 'Prius',
    MPG: 52,
    HP: 121,
    'Wt (lb)': 3010,
    '0-60s': 9.8,
    Year: 2020,
  },
  {
    name: 'Civic',
    MPG: 36,
    HP: 158,
    'Wt (lb)': 2877,
    '0-60s': 7.8,
    Year: 2023,
  },
  {
    name: 'VW Golf TDI',
    MPG: 43,
    HP: 184,
    'Wt (lb)': 3043,
    '0-60s': 7.5,
    Year: 2019,
  },
  {
    name: 'Mazda CX-5',
    MPG: 28,
    HP: 187,
    'Wt (lb)': 3655,
    '0-60s': 7.4,
    Year: 2023,
  },
  {
    name: 'Silverado',
    MPG: 14,
    HP: 310,
    'Wt (lb)': 4520,
    '0-60s': 7.1,
    Year: 2022,
  },
  {
    name: 'Mustang GT',
    MPG: 18,
    HP: 450,
    'Wt (lb)': 3813,
    '0-60s': 4.2,
    Year: 2021,
  },
  {
    name: 'BMW M3',
    MPG: 20,
    HP: 503,
    'Wt (lb)': 3827,
    '0-60s': 3.8,
    Year: 2023,
  },
  {
    name: 'Charger SRT',
    MPG: 13,
    HP: 797,
    'Wt (lb)': 4586,
    '0-60s': 3.6,
    Year: 2022,
  },
];

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  margins: { top: 8, right: 8, bottom: 8, left: 8 },
  title: 'Car comparison',
  description: 'Eight cars compared on MPG, HP, Wt (lb), 0-60s, Year.',
  data: cars,
  color: {
    domain: [
      'Prius',
      'Civic',
      'VW Golf TDI',
      'Mazda CX-5',
      'Silverado',
      'Mustang GT',
      'BMW M3',
      'Charger SRT',
    ],
    range: ['#10b981', '#3b82f6', '#06b6d4', '#f59e0b', '#6366f1', '#ef4444', '#8b5cf6', '#ec4899'],
    legend: false,
  },
  marks: [
    {
      mark: 'parallel',
      dimensions: ['MPG', 'HP', 'Wt (lb)', '0-60s', 'Year'],
      stroke: 'name',
      title: 'name',
      strokeWidth: 2,
    },
  ],
};
