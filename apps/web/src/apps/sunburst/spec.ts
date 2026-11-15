import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

/** Tech Market Cap: one row per company, its path naming its segment. */
const rows: ReadonlyArray<Row> = [
  {
    path: 'Cloud & SaaS/Microsoft',
    value: 310,
    group: 'Cloud & SaaS',
  },
  {
    path: 'Cloud & SaaS/Salesforce',
    value: 30,
    group: 'Cloud & SaaS',
  },
  {
    path: 'Cloud & SaaS/ServiceNow',
    value: 20,
    group: 'Cloud & SaaS',
  },
  {
    path: 'Cloud & SaaS/Workday',
    value: 7,
    group: 'Cloud & SaaS',
  },
  {
    path: 'Consumer/Apple',
    value: 300,
    group: 'Consumer',
  },
  {
    path: 'Consumer/Google',
    value: 190,
    group: 'Consumer',
  },
  {
    path: 'Consumer/Meta',
    value: 130,
    group: 'Consumer',
  },
  {
    path: 'E-Commerce/Amazon',
    value: 190,
    group: 'E-Commerce',
  },
  {
    path: 'E-Commerce/Alibaba',
    value: 22,
    group: 'E-Commerce',
  },
  {
    path: 'E-Commerce/Shopify',
    value: 9,
    group: 'E-Commerce',
  },
  {
    path: 'Chips/Nvidia',
    value: 230,
    group: 'Chips',
  },
  {
    path: 'Chips/TSMC',
    value: 70,
    group: 'Chips',
  },
  {
    path: 'Chips/AMD',
    value: 25,
    group: 'Chips',
  },
  {
    path: 'Chips/Qualcomm',
    value: 18,
    group: 'Chips',
  },
];

export const spec: PlotSpec = {
  width: 440,
  height: 320,
  margins: { top: 8, right: 8, bottom: 8, left: 8 },
  title: 'Tech market cap by sector',
  description: 'Tech Market Cap, by sector and company.',
  data: rows,
  color: {
    domain: ['Cloud & SaaS', 'Consumer', 'E-Commerce', 'Chips'],
    range: ['#3b82f6', '#8b5cf6', '#f97316', '#10b981'],
    label: '',
  },
  marks: [{ mark: 'sunburst', path: 'path', value: 'value', fill: 'group' }],
};
