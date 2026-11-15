import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

// How closely tools in a TypeScript stack depend on each other, from 0 to 1.
const LINKS: ReadonlyArray<readonly [string, string, number]> = [
  ['TS', 'React', 0.9],
  ['TS', 'Effect', 0.9],
  ['TS', 'Foldkit', 0.9],
  ['Vite', 'Astro', 0.8],
  ['Vite', 'React', 0.7],
  ['Vite', 'VE-css', 0.6],
  ['Effect', 'Foldkit', 0.9],
  ['Astro', 'Foldkit', 0.8],
  ['Astro', 'React', 0.6],
  ['Vitest', 'Vite', 0.7],
  ['Bun', 'Vitest', 0.5],
  ['Bun', 'TS', 0.6],
  ['Biome', 'TS', 0.5],
];

export const spec: PlotSpec = {
  width: 440,
  height: 220,
  title: 'TypeScript tooling dependencies',
  description: 'Tools along a line, with an arc for each dependency, wider where it is closer.',
  margins: { top: 8, right: 8, bottom: 4, left: 8 },
  data: LINKS.map(([from, to, weight]) => ({ from, to, weight, label: `${from} and ${to}` })),
  marks: [
    {
      mark: 'arc-diagram',
      source: 'from',
      target: 'to',
      value: 'weight',
      fill: { value: '#6366f1' },
      stroke: { value: '#6366f1' },
      title: 'label',
    },
  ],
};
