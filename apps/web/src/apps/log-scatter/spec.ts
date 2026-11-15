import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

const CATEGORIES = [
  { name: 'Framework', color: '#6366f1' },
  { name: 'Build tool', color: '#f59e0b' },
  { name: 'Utility', color: '#10b981' },
  { name: 'Testing', color: '#ef4444' },
];

// Approximate npm weekly downloads against GitHub stars.
export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Downloads and stars',
  description: 'npm packages by weekly downloads and GitHub stars, both on log axes.',
  data: [
    { name: 'react', downloads: 20_000_000, stars: 230_000, kind: 'Framework' },
    { name: 'vue', downloads: 5_000_000, stars: 48_000, kind: 'Framework' },
    { name: 'angular', downloads: 3_200_000, stars: 97_000, kind: 'Framework' },
    { name: 'next.js', downloads: 7_500_000, stars: 130_000, kind: 'Framework' },
    { name: 'svelte', downloads: 1_400_000, stars: 82_000, kind: 'Framework' },
    { name: 'webpack', downloads: 26_000_000, stars: 65_000, kind: 'Build tool' },
    { name: 'vite', downloads: 12_000_000, stars: 70_000, kind: 'Build tool' },
    { name: 'esbuild', downloads: 8_000_000, stars: 39_000, kind: 'Build tool' },
    { name: 'rollup', downloads: 9_000_000, stars: 25_000, kind: 'Build tool' },
    { name: 'prettier', downloads: 44_000_000, stars: 50_000, kind: 'Utility' },
    { name: 'eslint', downloads: 38_000_000, stars: 26_000, kind: 'Utility' },
    { name: 'lodash', downloads: 47_000_000, stars: 60_000, kind: 'Utility' },
    { name: 'axios', downloads: 50_000_000, stars: 106_000, kind: 'Utility' },
    { name: 'typescript', downloads: 54_000_000, stars: 103_000, kind: 'Utility' },
    { name: 'jest', downloads: 22_000_000, stars: 44_000, kind: 'Testing' },
    { name: 'vitest', downloads: 9_500_000, stars: 14_000, kind: 'Testing' },
    { name: 'mocha', downloads: 6_000_000, stars: 22_000, kind: 'Testing' },
    { name: 'cypress', downloads: 4_500_000, stars: 48_000, kind: 'Testing' },
  ],
  x: { type: 'log', label: 'Weekly downloads' },
  y: { type: 'log', label: 'GitHub stars' },
  color: { domain: CATEGORIES.map((c) => c.name), range: CATEGORIES.map((c) => c.color) },
  marks: [
    { mark: 'dot', x: 'downloads', y: 'stars', fill: 'kind', r: { value: 5 }, title: 'name' },
  ],
};
