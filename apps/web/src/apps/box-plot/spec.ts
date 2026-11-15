import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

/** Salary by level: ten observations per level, in $k. */
const salaries: ReadonlyArray<Row> = [
  {
    level: 'IC1',
    pay: 42,
  },
  {
    level: 'IC1',
    pay: 45,
  },
  {
    level: 'IC1',
    pay: 47,
  },
  {
    level: 'IC1',
    pay: 48,
  },
  {
    level: 'IC1',
    pay: 50,
  },
  {
    level: 'IC1',
    pay: 52,
  },
  {
    level: 'IC1',
    pay: 55,
  },
  {
    level: 'IC1',
    pay: 58,
  },
  {
    level: 'IC1',
    pay: 60,
  },
  {
    level: 'IC1',
    pay: 65,
  },
  {
    level: 'IC2',
    pay: 65,
  },
  {
    level: 'IC2',
    pay: 68,
  },
  {
    level: 'IC2',
    pay: 70,
  },
  {
    level: 'IC2',
    pay: 72,
  },
  {
    level: 'IC2',
    pay: 75,
  },
  {
    level: 'IC2',
    pay: 78,
  },
  {
    level: 'IC2',
    pay: 80,
  },
  {
    level: 'IC2',
    pay: 82,
  },
  {
    level: 'IC2',
    pay: 88,
  },
  {
    level: 'IC2',
    pay: 92,
  },
  {
    level: 'IC3',
    pay: 88,
  },
  {
    level: 'IC3',
    pay: 90,
  },
  {
    level: 'IC3',
    pay: 95,
  },
  {
    level: 'IC3',
    pay: 98,
  },
  {
    level: 'IC3',
    pay: 100,
  },
  {
    level: 'IC3',
    pay: 105,
  },
  {
    level: 'IC3',
    pay: 108,
  },
  {
    level: 'IC3',
    pay: 110,
  },
  {
    level: 'IC3',
    pay: 115,
  },
  {
    level: 'IC3',
    pay: 120,
  },
  {
    level: 'IC4',
    pay: 125,
  },
  {
    level: 'IC4',
    pay: 128,
  },
  {
    level: 'IC4',
    pay: 130,
  },
  {
    level: 'IC4',
    pay: 132,
  },
  {
    level: 'IC4',
    pay: 135,
  },
  {
    level: 'IC4',
    pay: 138,
  },
  {
    level: 'IC4',
    pay: 140,
  },
  {
    level: 'IC4',
    pay: 142,
  },
  {
    level: 'IC4',
    pay: 145,
  },
  {
    level: 'IC4',
    pay: 150,
  },
  {
    level: 'IC5',
    pay: 160,
  },
  {
    level: 'IC5',
    pay: 165,
  },
  {
    level: 'IC5',
    pay: 168,
  },
  {
    level: 'IC5',
    pay: 170,
  },
  {
    level: 'IC5',
    pay: 172,
  },
  {
    level: 'IC5',
    pay: 175,
  },
  {
    level: 'IC5',
    pay: 178,
  },
  {
    level: 'IC5',
    pay: 180,
  },
  {
    level: 'IC5',
    pay: 185,
  },
  {
    level: 'IC5',
    pay: 190,
  },
];

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Salary by level',
  description: 'Spread of salaries at each level, in thousands of dollars.',
  data: salaries,
  x: { label: '' },
  y: { label: '$k' },
  marks: [{ mark: 'box', x: 'level', y: 'pay', fill: { value: '#6366f1' } }],
};
