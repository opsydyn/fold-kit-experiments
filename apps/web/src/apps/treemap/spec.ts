import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

/** Tech Revenue: one row per company, its path naming its segment. */
const rows: ReadonlyArray<Row> = [
  {
    path: 'Cloud/AWS',
    value: 91,
    group: 'Cloud',
  },
  {
    path: 'Cloud/Azure',
    value: 75,
    group: 'Cloud',
  },
  {
    path: 'Cloud/GCP',
    value: 34,
    group: 'Cloud',
  },
  {
    path: 'Cloud/Alibaba',
    value: 12,
    group: 'Cloud',
  },
  {
    path: 'Software/Microsoft',
    value: 62,
    group: 'Software',
  },
  {
    path: 'Software/Oracle',
    value: 29,
    group: 'Software',
  },
  {
    path: 'Software/SAP',
    value: 17,
    group: 'Software',
  },
  {
    path: 'Software/Salesforce',
    value: 15,
    group: 'Software',
  },
  {
    path: 'Devices/Apple',
    value: 97,
    group: 'Devices',
  },
  {
    path: 'Devices/Samsung',
    value: 54,
    group: 'Devices',
  },
  {
    path: 'Devices/Lenovo',
    value: 18,
    group: 'Devices',
  },
  {
    path: 'Devices/Dell',
    value: 22,
    group: 'Devices',
  },
  {
    path: 'Social/Meta',
    value: 39,
    group: 'Social',
  },
  {
    path: 'Social/TikTok',
    value: 18,
    group: 'Social',
  },
  {
    path: 'Social/Snap',
    value: 5,
    group: 'Social',
  },
  {
    path: 'Social/Pinterest',
    value: 4,
    group: 'Social',
  },
];

export const spec: PlotSpec = {
  width: 440,
  height: 320,
  margins: { top: 8, right: 8, bottom: 8, left: 8 },
  title: 'Tech revenue by segment',
  description: 'Tech Revenue, by segment and company.',
  data: rows,
  color: {
    domain: ['Cloud', 'Software', 'Devices', 'Social'],
    range: ['#3b82f6', '#8b5cf6', '#f97316', '#ec4899'],
    label: '',
  },
  marks: [{ mark: 'treemap', path: 'path', value: 'value', fill: 'group' }],
};
