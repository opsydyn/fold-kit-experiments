import { expect, it } from 'bun:test';

import { orbitGeometry } from '../src/chart/orbit.js';
import { orbitChart } from '../src/foldkit/orbit.js';
import type { OrbitChartOptions } from '../src/foldkit/orbit.js';
import { renderChart } from './render-chart.js';

type Module = Readonly<{ id: string; label: string; risk: number; integration: string }>;
const data: ReadonlyArray<Module> = [
  { id: 'api', label: 'API <gateway>', risk: 9.2, integration: 'intrusive' },
  { id: 'web', label: 'Web', risk: 3, integration: 'contract' },
  { id: 'jobs', label: 'Jobs', risk: 6, integration: 'contract' },
];
const geometry = orbitGeometry(
  data,
  { key: (d) => d.id, value: (d) => d.risk, halo: (d) => d.integration },
  { size: 240 },
);
type Message =
  | Readonly<{ _tag: 'Inspected'; key: string | null }>
  | Readonly<{ _tag: 'Selected'; key: string }>;
const base: OrbitChartOptions<Module, Message> = {
  geometry,
  title: 'Complexity field',
  description: 'Modules by systemic risk',
  coreFill: 'url(#mud)',
  haloColour: (key) => `var(--halo-${key})`,
  nodeStyle: (node) => ({ fill: 'var(--fill)', stroke: node.value > 8 ? 'red' : 'green' }),
  labelFor: (d) => `${d.label}: risk ${d.risk}`,
};
const count = (html: string, pattern: string): number => html.split(pattern).length - 1;

it('renders the halo, the core, the centre text and a titled node per datum', async () => {
  const html = await renderChart<Message>((h) =>
    orbitChart(h, {
      ...base,
      centre: [
        { text: 'MOD 5.3', colour: 'currentColor' },
        { text: 'RISK 4.6', colour: 'red', size: 12 },
      ],
      pulse: { radius: geometry.core.radius + 6, colour: 'red' },
    }),
  );
  expect(html).toContain('viewBox="0 0 240 240"');
  expect(html).toContain('role="img"');
  expect(count(html, 'class="chart-orbit-halo"')).toBe(2);
  expect(html).toContain('fill="var(--halo-intrusive)"');
  expect(html).toContain('<title>intrusive: 1</title>');
  expect(count(html, 'class="chart-orbit-core"')).toBe(1);
  expect(html).toContain('fill="url(#mud)"');
  expect(count(html, 'class="chart-orbit-pulse"')).toBe(1);
  expect(html).toContain('MOD 5.3');
  expect(count(html, 'class="chart-orbit-node"')).toBe(3);
  expect(html).toContain('<title>API &lt;gateway&gt;: risk 9.2</title>');
  expect(html).not.toContain('tabindex');
});

it('makes nodes keyboard-reachable buttons when the parent handles selection', async () => {
  const html = await renderChart<Message>((h) =>
    orbitChart(h, {
      ...base,
      selectedKey: 'web',
      onSelect: (key) => ({ _tag: 'Selected' as const, key }),
      onInspect: (key) => ({ _tag: 'Inspected' as const, key }),
    }),
  );
  expect(html).toContain('role="group"');
  expect(count(html, 'tabindex="0"')).toBe(3);
  expect(count(html, 'role="button"')).toBe(3);
  expect(count(html, 'aria-pressed="true"')).toBe(1);
  expect(count(html, 'aria-pressed="false"')).toBe(2);
});

it('draws the selected and inspected nodes with a wider outline', async () => {
  const html = await renderChart<Message>((h) =>
    orbitChart(h, { ...base, selectedKey: 'web', activeKey: 'jobs' }),
  );
  const outlines = [...html.matchAll(/<circle([^>]*)>/g)]
    .map((match) => match[1] ?? '')
    .filter((attributes) => attributes.includes('class="chart-orbit-outline"'))
    .map((attributes) => attributes.match(/stroke-width="([\d.]+)"/)?.[1]);
  expect(outlines).toEqual(['1', '2', '2']);
});
