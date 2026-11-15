import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

const ENDPOINTS = [
  { endpoint: 'GET /api/users', ms: 42 },
  { endpoint: 'GET /api/products', ms: 88 },
  { endpoint: 'POST /api/search', ms: 215 },
  { endpoint: 'GET /api/orders', ms: 340 },
  { endpoint: 'POST /api/reports', ms: 490 },
  { endpoint: 'GET /api/analytics', ms: 680 },
  { endpoint: 'POST /api/export', ms: 920 },
  { endpoint: 'GET /api/full-dump', ms: 1240 },
];
const status = (ms: number) => (ms < 200 ? 'fast' : ms < 500 ? 'acceptable' : 'slow');

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Endpoint latency',
  description: 'p95 latency per endpoint against the 200 ms and 500 ms thresholds.',
  margins: { left: 132 },
  data: ENDPOINTS.map((e) => ({ ...e, status: status(e.ms), label: `${e.endpoint}: ${e.ms} ms` })),
  x: { label: 'p95 latency (ms)' },
  y: { label: '' },
  color: { domain: ['fast', 'acceptable', 'slow'], range: ['#10b981', '#f59e0b', '#ef4444'] },
  marks: [
    { mark: 'bar', x: 'ms', y: 'endpoint', fill: 'status', title: 'label' },
    { mark: 'rule', x: { value: 200 }, stroke: { value: '#f59e0b' } },
    { mark: 'rule', x: { value: 500 }, stroke: { value: '#ef4444' } },
  ],
};
