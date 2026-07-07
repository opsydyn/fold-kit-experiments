import { Schema } from 'effect';

import * as SunburstChart from '../../ui/sunburst-chart';

export const Model = Schema.Struct({ sunburst: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'sunburst'> & {
  readonly sunburst: SunburstChart.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [sunburst] = SunburstChart.init({
    root: {
      name: 'Tech Market Cap',
      children: [
        {
          name: 'Cloud & SaaS',
          color: '#3b82f6',
          children: [
            { name: 'Microsoft', value: 310 },
            { name: 'Salesforce', value: 30 },
            { name: 'ServiceNow', value: 20 },
            { name: 'Workday', value: 7 },
          ],
        },
        {
          name: 'Consumer',
          color: '#8b5cf6',
          children: [
            { name: 'Apple', value: 300 },
            { name: 'Google', value: 190 },
            { name: 'Meta', value: 130 },
          ],
        },
        {
          name: 'E-Commerce',
          color: '#f97316',
          children: [
            { name: 'Amazon', value: 190 },
            { name: 'Alibaba', value: 22 },
            { name: 'Shopify', value: 9 },
          ],
        },
        {
          name: 'Chips',
          color: '#10b981',
          children: [
            { name: 'Nvidia', value: 230 },
            { name: 'TSMC', value: 70 },
            { name: 'AMD', value: 25 },
            { name: 'Qualcomm', value: 18 },
          ],
        },
      ],
    },
  });
  return [{ sunburst }, []];
};
