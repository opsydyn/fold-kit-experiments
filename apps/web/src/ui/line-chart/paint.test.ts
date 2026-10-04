import { expect, it } from 'vitest';

import { renderChart } from '../shared/render-chart.test-helper';
import { init, view } from './index';

it('honours the configured area colour independently of the line paint', async () => {
  const { model } = init({
    points: [
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
    ],
    config: { color: 'var(--brand)', areaColor: 'rgb(10,20,30)', curve: 'linear' },
  });
  const markup = await renderChart((h) =>
    view({ model, toParentMessage: (message) => message }, h),
  );
  const node = document.createElement('div');
  node.innerHTML = markup;
  const paths = Array.from(node.querySelectorAll('path'));
  expect(paths.find((path) => path.getAttribute('stroke') === 'none')?.getAttribute('fill')).toBe(
    'rgb(10,20,30)',
  );
  expect(paths.find((path) => path.getAttribute('fill') === 'none')?.getAttribute('stroke')).toBe(
    'var(--brand)',
  );
});
