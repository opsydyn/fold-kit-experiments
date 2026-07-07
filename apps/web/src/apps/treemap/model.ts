import { Schema } from 'effect';

import * as TreemapChart from '../../ui/treemap-chart';

export const Model = Schema.Struct({ treemap: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'treemap'> & {
  readonly treemap: TreemapChart.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [treemap] = TreemapChart.init({
    root: {
      name: 'Tech Revenue',
      children: [
        {
          name: 'Cloud',
          color: '#3b82f6',
          children: [
            { name: 'AWS', value: 91 },
            { name: 'Azure', value: 75 },
            { name: 'GCP', value: 34 },
            { name: 'Alibaba', value: 12 },
          ],
        },
        {
          name: 'Software',
          color: '#8b5cf6',
          children: [
            { name: 'Microsoft', value: 62 },
            { name: 'Oracle', value: 29 },
            { name: 'SAP', value: 17 },
            { name: 'Salesforce', value: 15 },
          ],
        },
        {
          name: 'Devices',
          color: '#f97316',
          children: [
            { name: 'Apple', value: 97 },
            { name: 'Samsung', value: 54 },
            { name: 'Lenovo', value: 18 },
            { name: 'Dell', value: 22 },
          ],
        },
        {
          name: 'Social',
          color: '#ec4899',
          children: [
            { name: 'Meta', value: 39 },
            { name: 'TikTok', value: 18 },
            { name: 'Snap', value: 5 },
            { name: 'Pinterest', value: 4 },
          ],
        },
      ],
    },
  });
  return [{ treemap }, []];
};
