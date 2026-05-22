import { Schema } from 'effect';
import * as RadialTree from '../../ui/radial-tree-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: RadialTree.Model;
};

const IE_TREE: RadialTree.TreeDatum = {
  name: 'Indo-European',
  children: [
    {
      name: 'Germanic',
      children: [{ name: 'English' }, { name: 'German' }, { name: 'Dutch' }, { name: 'Swedish' }],
    },
    {
      name: 'Romance',
      children: [
        { name: 'Spanish' },
        { name: 'French' },
        { name: 'Italian' },
        { name: 'Romanian' },
      ],
    },
    {
      name: 'Slavic',
      children: [{ name: 'Russian' }, { name: 'Polish' }, { name: 'Serbian' }],
    },
    {
      name: 'Indo-Iranian',
      children: [{ name: 'Hindi' }, { name: 'Persian' }, { name: 'Bengali' }],
    },
    {
      name: 'Hellenic',
      children: [{ name: 'Greek' }],
    },
    {
      name: 'Celtic',
      children: [{ name: 'Welsh' }, { name: 'Irish' }],
    },
  ],
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = RadialTree.init({ data: IE_TREE });
  return [{ chart }, []];
};
