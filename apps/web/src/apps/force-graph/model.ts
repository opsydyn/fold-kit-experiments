import { runForceLayout } from '@opsydyn/foldkit-viz/simulation';
import { Schema } from 'effect';

import * as ForceGraph from '../../ui/force-graph';

export const Model = Schema.Struct({ graph: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'graph'> & { readonly graph: ForceGraph.Model };

const NODES: ReadonlyArray<ForceGraph.Node> = [
  { id: 'js', label: 'JavaScript' },
  { id: 'ts', label: 'TypeScript' },
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
  { id: 'angular', label: 'Angular' },
  { id: 'node', label: 'Node' },
  { id: 'deno', label: 'Deno' },
  { id: 'bun', label: 'Bun' },
  { id: 'vite', label: 'Vite' },
  { id: 'express', label: 'Express' },
  { id: 'webpack', label: 'Webpack' },
  { id: 'eslint', label: 'ESLint' },
];

const LINKS: ReadonlyArray<ForceGraph.Link> = [
  { source: 'js', target: 'ts' },
  { source: 'js', target: 'react' },
  { source: 'js', target: 'vue' },
  { source: 'js', target: 'angular' },
  { source: 'js', target: 'node' },
  { source: 'ts', target: 'angular' },
  { source: 'ts', target: 'deno' },
  { source: 'node', target: 'express' },
  { source: 'node', target: 'deno' },
  { source: 'node', target: 'bun' },
  { source: 'node', target: 'vite' },
  { source: 'node', target: 'webpack' },
  { source: 'node', target: 'eslint' },
  { source: 'react', target: 'vite' },
  { source: 'vue', target: 'vite' },
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const layout = runForceLayout({
    nodes: NODES,
    links: LINKS,
    width: 440,
    height: 240,
    strength: -120,
    linkDistance: 70,
    collideRadius: 22,
  });

  const [graph] = ForceGraph.init({
    layout,
    nodeMeta: NODES,
    links: LINKS,
  });

  return [{ graph }, []];
};
