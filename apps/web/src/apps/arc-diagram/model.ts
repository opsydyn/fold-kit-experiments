import { Schema } from 'effect';

import * as Arc from '../../ui/arc-diagram';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & { readonly chart: Arc.Model };

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const nodes: ReadonlyArray<Arc.ArcNode> = [
    { id: 'ts', label: 'TS' },
    { id: 'react', label: 'React' },
    { id: 'vite', label: 'Vite' },
    { id: 'astro', label: 'Astro' },
    { id: 'effect', label: 'Effect' },
    { id: 'fk', label: 'Foldkit' },
    { id: 'vitest', label: 'Vitest' },
    { id: 'biome', label: 'Biome' },
    { id: 've', label: 'VE-css' },
    { id: 'bun', label: 'Bun' },
  ];

  const links: ReadonlyArray<Arc.ArcLink> = [
    { source: 'ts', target: 'react', weight: 0.9 },
    { source: 'ts', target: 'effect', weight: 0.9 },
    { source: 'ts', target: 'fk', weight: 0.9 },
    { source: 'vite', target: 'astro', weight: 0.8 },
    { source: 'vite', target: 'react', weight: 0.7 },
    { source: 'vite', target: 've', weight: 0.6 },
    { source: 'effect', target: 'fk', weight: 0.9 },
    { source: 'astro', target: 'fk', weight: 0.8 },
    { source: 'astro', target: 'react', weight: 0.6 },
    { source: 'vitest', target: 'vite', weight: 0.7 },
    { source: 'bun', target: 'vitest', weight: 0.5 },
    { source: 'bun', target: 'ts', weight: 0.6 },
    { source: 'biome', target: 'ts', weight: 0.5 },
  ];

  const [chart] = Arc.init({ nodes, links, color: '#6366f1' });
  return [{ chart }, []];
};
