import { Option } from 'effect';
import { expect, it } from 'vitest';

import { renderChart } from '../shared/render-chart.test-helper';
import { init, Message, update, view } from './index';

const points = [
  { id: 'a', x: 1, y: 10, label: 'same' },
  { id: 'b', x: 1, y: 10, label: 'same' },
  { id: 'c', x: 3, y: 30, label: 'third' },
];

it('renders two linked marks while retaining the independent active point and tooltip', async () => {
  const model = update(init({ points }).model, Message.HoveredPoint({ index: 2 })).model;
  const node = document.createElement('div');
  node.innerHTML = await renderChart((h) =>
    view(
      {
        model,
        highlightedKeys: ['a', 'b'],
        toParentMessage: (message) => message,
      },
      h,
    ),
  );
  const marks = node.querySelectorAll('circle[data-linked-highlight="true"]');
  expect(marks).toHaveLength(2);
  expect(Array.from(marks).every((mark) => mark.getAttribute('stroke-dasharray') !== null)).toBe(
    true,
  );
  expect(node.querySelectorAll(`circle[fill="${model.config.activeColor}"]`)).toHaveLength(1);
  expect(node.textContent).toContain('third (3, 30)');
  expect(model.activeIndex).toEqual(Option.some(2));
});

it('uses the stable ID for point inspection', () => {
  expect(update(init({ points }).model, Message.HoveredPoint({ index: 1 })).outMessage).toEqual({
    _tag: 'InspectedPoint',
    key: 'b',
    x: 1,
    y: 10,
  });
});

it('preserves legacy label keys and a single active point without an overlay', async () => {
  const legacy = points.map(({ x, y, label }) => ({ x, y, label }));
  const result = update(init({ points: legacy }).model, Message.HoveredPoint({ index: 1 }));
  expect(result.outMessage).toEqual({ _tag: 'InspectedPoint', key: 'same', x: 1, y: 10 });
  const config = { model: result.model, toParentMessage: (message: Message) => message };
  const markup = await renderChart((h) => view(config, h));
  expect(await renderChart((h) => view({ ...config, highlightedKeys: [] }, h))).toBe(markup);
  const node = document.createElement('div');
  node.innerHTML = markup;
  expect(node.querySelectorAll('[data-linked-highlight]')).toHaveLength(0);
  expect(node.querySelectorAll('circle')).toHaveLength(3);
  expect(node.querySelectorAll(`circle[fill="${result.model.config.activeColor}"]`)).toHaveLength(
    1,
  );
  expect(node.textContent).toContain('same (1, 10)');
});
