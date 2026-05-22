import { Schema } from 'effect';
import * as LogScatter from '../../ui/log-scatter-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: LogScatter.Model;
};

const CATEGORIES = [
  { name: 'Framework', color: '#6366f1' },
  { name: 'Build tool', color: '#f59e0b' },
  { name: 'Utility', color: '#10b981' },
  { name: 'Testing', color: '#ef4444' },
] as const;

// npm weekly downloads (approx) vs GitHub stars (approx)
const PACKAGES: ReadonlyArray<LogScatter.Point> = [
  { label: 'react', x: 20_000_000, y: 230_000, category: 'Framework' },
  { label: 'vue', x: 5_000_000, y: 48_000, category: 'Framework' },
  { label: 'angular', x: 3_200_000, y: 97_000, category: 'Framework' },
  { label: 'next.js', x: 7_500_000, y: 130_000, category: 'Framework' },
  { label: 'svelte', x: 1_400_000, y: 82_000, category: 'Framework' },
  { label: 'webpack', x: 26_000_000, y: 65_000, category: 'Build tool' },
  { label: 'vite', x: 12_000_000, y: 70_000, category: 'Build tool' },
  { label: 'esbuild', x: 8_000_000, y: 39_000, category: 'Build tool' },
  { label: 'rollup', x: 9_000_000, y: 25_000, category: 'Build tool' },
  { label: 'prettier', x: 44_000_000, y: 50_000, category: 'Utility' },
  { label: 'eslint', x: 38_000_000, y: 26_000, category: 'Utility' },
  { label: 'lodash', x: 47_000_000, y: 60_000, category: 'Utility' },
  { label: 'axios', x: 50_000_000, y: 106_000, category: 'Utility' },
  { label: 'typescript', x: 54_000_000, y: 103_000, category: 'Utility' },
  { label: 'jest', x: 22_000_000, y: 44_000, category: 'Testing' },
  { label: 'vitest', x: 9_500_000, y: 14_000, category: 'Testing' },
  { label: 'mocha', x: 6_000_000, y: 22_000, category: 'Testing' },
  { label: 'cypress', x: 4_500_000, y: 48_000, category: 'Testing' },
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = LogScatter.init({
    points: PACKAGES,
    categories: [...CATEGORIES],
    xLabel: 'Weekly downloads',
    yLabel: 'GitHub stars',
  });
  return [{ chart }, []];
};
