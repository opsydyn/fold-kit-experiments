import { Option } from 'effect';
import { expect, it } from 'vitest';

import { renderChart } from '../../ui/shared/render-chart.test-helper';
import type { Message } from './message';
import { Linking, init } from './model';
import type { Model } from './model';
import { body } from './view';

async function rendered(model: Model) {
  const node = document.createElement('div');
  node.innerHTML = await renderChart<Message>((h) => body(model, h));
  return node;
}

it('renders every linked match, a separate local tooltip and both data alternatives', async () => {
  const initial = init().model;
  const model: Model = {
    ...initial,
    panels: initial.panels.map((panel) =>
      panel._tag === 'Scatter'
        ? { ...panel, chart: { ...panel.chart, activeIndex: Option.some(29) } }
        : panel,
    ),
    linking: Linking.Linked({
      inspection: Option.some({
        sourceId: 2,
        value: { _tag: 'Range', lower: 55000, upper: 68000, includeEnd: false },
      }),
    }),
  };
  const node = await rendered(model);
  expect(node.querySelectorAll('circle[data-linked-highlight]')).toHaveLength(3);
  expect(node.textContent).toContain('3 matching points');
  expect(node.textContent).toContain('20yr (20, 175000)');
  expect(node.querySelectorAll('table')).toHaveLength(2);
  const empty = await rendered({
    ...model,
    linking: Linking.Linked({
      inspection: Option.some({
        sourceId: 2,
        value: { _tag: 'Range', lower: 1, upper: 2, includeEnd: false },
      }),
    }),
  });
  expect(empty.querySelectorAll('[data-linked-highlight]')).toHaveLength(0);
  expect(empty.textContent).toContain('0 matching points');
});

it('keeps stable headings, native linking, named controls and disabled add boundaries', async () => {
  const initial = init().model;
  const node = await rendered(initial);
  expect(node.querySelector('#comparison-panel-1[tabindex="-1"]')?.textContent).toContain(
    'Scatter 1',
  );
  expect(node.querySelector('#comparison-panel-2[tabindex="-1"]')?.textContent).toContain(
    'Histogram 2',
  );
  expect(node.querySelector('input[type="checkbox"]')).not.toBeNull();
  expect(
    node
      .querySelector('button[aria-label="Move Scatter 1 earlier"]')
      ?.getAttribute('aria-disabled'),
  ).toBe('true');
  expect(
    node
      .querySelector('button[aria-label="Move Histogram 2 later"]')
      ?.getAttribute('aria-disabled'),
  ).toBe('true');
  for (const model of [
    { ...initial, nextPanelId: Number.MAX_SAFE_INTEGER },
    init({
      panels: [1, 2, 3, 4].map((id) => ({ id, kind: 'scatter' as const })),
      nextPanelId: 5,
      linkInspections: true,
    }).model,
  ]) {
    const capped = await rendered(model);
    expect(capped.querySelector('#comparison-add-scatter')?.hasAttribute('disabled')).toBe(true);
    expect(capped.querySelector('#comparison-add-histogram')?.hasAttribute('disabled')).toBe(true);
  }
  const empty = await rendered({ ...initial, panels: [] });
  expect(empty.textContent).toContain('No panels');
  expect(empty.querySelectorAll('button')).toHaveLength(2);
});
