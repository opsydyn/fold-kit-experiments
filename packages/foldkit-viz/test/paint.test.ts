import { expect, it } from 'bun:test';

import { dotPattern, hatchPattern, linearGradient, radialGradient } from '../src/foldkit/paint';
import { renderChart } from './render-chart';
it('renders independently named pattern and gradient definitions using caller colours', async () => {
  const html = await renderChart((h) =>
    h.svg(
      [],
      [
        h.defs(
          [],
          [
            dotPattern(h, { id: 'chart-a-dots', colour: 'var(--coral)', spacing: 8, radius: 1.5 }),
            hatchPattern(h, { id: 'chart-b-hatch', colour: 'currentColor', spacing: 10 }),
            linearGradient(h, {
              id: 'chart-c-linear',
              stops: [
                { offset: 0, colour: 'var(--blue)' },
                { offset: 1, colour: 'var(--mint)', opacity: 0.4 },
              ],
            }),
            radialGradient(h, {
              id: 'chart-d-radial',
              stops: [
                { offset: 0, colour: '#fff' },
                { offset: 1, colour: '#000' },
              ],
            }),
          ],
        ),
      ],
    ),
  );
  expect(html).toContain('id="chart-a-dots"');
  expect(html).toContain('patternUnits="userSpaceOnUse"');
  expect(html).toContain('fill="var(--coral)"');
  expect(html).toContain('stop-color="var(--blue)"');
  expect(html).toContain('stop-opacity="0.4"');
  expect(html).toContain('<radialGradient');
});
it('rejects invalid pattern dimensions, ids and gradient stops', async () => {
  await expect(
    renderChart((h) => dotPattern(h, { id: '', colour: '#fff', spacing: 0 })),
  ).rejects.toThrow();
  await expect(
    renderChart((h) => linearGradient(h, { id: 'a', stops: [{ offset: 2, colour: '#fff' }] })),
  ).rejects.toThrow();
  await expect(
    renderChart((h) => hatchPattern(h, { id: 'a', colour: '#fff', spacing: 8, strokeWidth: -1 })),
  ).rejects.toThrow();
});
