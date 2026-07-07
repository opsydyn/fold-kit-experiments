import { Schema } from 'effect';

import * as TidyTree from '../../ui/tidy-tree-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: TidyTree.Model;
};

// Frontend tech-stack dependency tree
const TECH_TREE: TidyTree.TreeDatum = {
  name: 'App',
  children: [
    {
      name: 'UI',
      children: [
        {
          name: 'React',
          children: [{ name: 'jsx-runtime' }, { name: 'reconciler' }],
        },
        {
          name: 'Styles',
          children: [{ name: 'CSS Modules' }, { name: 'Tailwind' }],
        },
      ],
    },
    {
      name: 'Data',
      children: [
        {
          name: 'State',
          children: [{ name: 'Zustand' }, { name: 'React Query' }],
        },
        {
          name: 'API',
          children: [{ name: 'tRPC' }, { name: 'Zod' }],
        },
      ],
    },
    {
      name: 'Build',
      children: [{ name: 'Vite' }, { name: 'TypeScript' }, { name: 'Bun' }],
    },
  ],
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = TidyTree.init({
    data: TECH_TREE,
  });
  return [{ chart }, []];
};
