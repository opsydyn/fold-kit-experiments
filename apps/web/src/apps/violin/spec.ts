import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

// Salary by level — 50 synthetic values per group via LCG + Box-Muller
const generateSalaries = (): ReadonlyArray<Row> => {
  let s = 0xfeed1234;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const normal = (mean: number, sd: number): number => {
    const u = Math.max(1e-9, next());
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  const group = (level: string, mean: number, sd: number, n: number): ReadonlyArray<Row> =>
    Array.from({ length: n }, () => ({ level, pay: Math.round(normal(mean, sd)) }));
  return [
    ...group('IC1', 52, 4, 50),
    ...group('IC2', 76, 6, 50),
    ...group('IC3', 102, 8, 50),
    ...group('IC4', 136, 10, 50),
    ...group('IC5', 170, 12, 50),
  ];
};

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Salary by level',
  description: 'Distribution of 50 salaries at each level, in thousands of dollars.',
  data: generateSalaries(),
  x: { label: '' },
  y: { label: '$k' },
  marks: [{ mark: 'violin', x: 'level', y: 'pay', fill: { value: '#8b5cf6' } }],
};
