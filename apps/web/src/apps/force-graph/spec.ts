import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

const LINKS: ReadonlyArray<readonly [string, string]> = [
  ['JavaScript', 'TypeScript'],
  ['JavaScript', 'React'],
  ['JavaScript', 'Vue'],
  ['JavaScript', 'Angular'],
  ['JavaScript', 'Node'],
  ['TypeScript', 'Angular'],
  ['TypeScript', 'Deno'],
  ['Node', 'Express'],
  ['Node', 'Deno'],
  ['Node', 'Bun'],
  ['Node', 'Vite'],
  ['Node', 'Webpack'],
  ['Node', 'ESLint'],
  ['React', 'Vite'],
  ['Vue', 'Vite'],
];

export const spec: PlotSpec = {
  width: 440,
  height: 260,
  title: 'JavaScript ecosystem',
  description: 'Languages, runtimes and tools linked where one builds on another.',
  margins: { top: 8, right: 8, bottom: 8, left: 8 },
  data: LINKS.map(([from, to]) => ({ from, to })),
  marks: [
    {
      mark: 'force',
      source: 'from',
      target: 'to',
      fill: { value: '#6366f1' },
      distance: 70,
      strength: -140,
    },
  ],
};
