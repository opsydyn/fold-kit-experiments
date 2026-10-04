import { expect, it } from 'vitest';

import { renderChart } from '../shared/render-chart.test-helper';
import { init, view } from './index';

it('keeps currentColor valid and exposes area opacity separately', async () => {
  const { model } = init({
    points: [
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
    ],
    config: { color: 'currentColor', curve: 'linear' },
  });
  const markup = await renderChart((h) =>
    view({ model, toParentMessage: (message) => message }, h),
  );
  const node = document.createElement('div');
  node.innerHTML = markup;
  const area = Array.from(node.querySelectorAll('path')).find(
    (path) => path.getAttribute('stroke') === 'none',
  );
  expect(area?.getAttribute('fill')).toBe('currentColor');
  expect(Number(area?.getAttribute('fill-opacity'))).toBeCloseTo(2 / 15);
});
