import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

// A front-end stack as a dependency tree, one row per leaf.
const LEAVES = [
  'App/UI/React/jsx-runtime',
  'App/UI/React/reconciler',
  'App/UI/Styles/CSS Modules',
  'App/UI/Styles/Tailwind',
  'App/Data/State/Zustand',
  'App/Data/State/React Query',
  'App/Data/API/tRPC',
  'App/Data/API/Zod',
  'App/Build/Vite',
  'App/Build/TypeScript',
  'App/Build/Bun',
];

export const spec: PlotSpec = {
  width: 440,
  height: 320,
  title: 'Front-end stack',
  description: 'An application’s dependencies as a tidy tree, from the app to each library.',
  margins: { top: 4, right: 4, bottom: 4, left: 4 },
  data: LEAVES.map((path) => ({ path })),
  marks: [{ mark: 'tree', path: 'path', stroke: { value: '#94a3b8' } }],
};
