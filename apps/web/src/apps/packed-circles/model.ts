import { Schema } from 'effect';

import * as PackedChart from '../../ui/packed-circles-chart';

export const Model = Schema.Struct({ packed: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'packed'> & {
  readonly packed: PackedChart.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [packed] = PackedChart.init({
    root: {
      name: 'Languages',
      children: [
        {
          name: 'Systems',
          color: '#f97316',
          children: [
            { name: 'C', value: 18 },
            { name: 'C++', value: 15 },
            { name: 'Go', value: 12 },
            { name: 'Rust', value: 8 },
            { name: 'Zig', value: 3 },
          ],
        },
        {
          name: 'General',
          color: '#14b8a6',
          children: [
            { name: 'Python', value: 28 },
            { name: 'Java', value: 20 },
            { name: 'C#', value: 16 },
            { name: 'Kotlin', value: 9 },
            { name: 'Swift', value: 8 },
          ],
        },
        {
          name: 'Web',
          color: '#3b82f6',
          children: [
            { name: 'JS', value: 30 },
            { name: 'TS', value: 22 },
            { name: 'PHP', value: 10 },
            { name: 'Ruby', value: 8 },
          ],
        },
        {
          name: 'Functional',
          color: '#8b5cf6',
          children: [
            { name: 'Elixir', value: 6 },
            { name: 'Erlang', value: 5 },
            { name: 'Haskell', value: 4 },
            { name: 'OCaml', value: 3 },
            { name: 'F#', value: 3 },
          ],
        },
        {
          name: 'Query',
          color: '#ec4899',
          children: [
            { name: 'SQL', value: 25 },
            { name: 'GraphQL', value: 8 },
            { name: 'HQL', value: 4 },
          ],
        },
      ],
    },
  });
  return [{ packed }, []];
};
