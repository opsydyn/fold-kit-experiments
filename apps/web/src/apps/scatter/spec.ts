import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Experience and salary',
  description: 'Fifteen people by years of experience and salary, with a least-squares fit.',
  data: [
    { name: 'Alice', years: 2, salary: 52 },
    { name: 'Bob', years: 5, salary: 68 },
    { name: 'Carol', years: 8, salary: 85 },
    { name: 'Dave', years: 1, salary: 46 },
    { name: 'Eve', years: 12, salary: 105 },
    { name: 'Frank', years: 4, salary: 62 },
    { name: 'Grace', years: 7, salary: 80 },
    { name: 'Hank', years: 3, salary: 57 },
    { name: 'Iris', years: 10, salary: 96 },
    { name: 'Jack', years: 6, salary: 74 },
    { name: 'Kim', years: 15, salary: 122 },
    { name: 'Leo', years: 9, salary: 90 },
    { name: 'Mia', years: 11, salary: 99 },
    { name: 'Nick', years: 14, salary: 116 },
    { name: 'Olivia', years: 13, salary: 110 },
  ],
  x: { label: 'Experience (years)' },
  y: { label: 'Salary ($k)' },
  marks: [
    {
      mark: 'line',
      x: 'years',
      y: 'salary',
      stroke: { value: '#94a3b8' },
      transform: { type: 'regression' },
    },
    {
      mark: 'dot',
      x: 'years',
      y: 'salary',
      fill: { value: '#6366f1' },
      r: { value: 5 },
      title: 'name',
    },
  ],
};
