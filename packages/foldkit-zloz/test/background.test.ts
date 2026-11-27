import { expect, test } from 'bun:test';

import { backgroundPaint } from '../src/canvas-decoration';
import type { NativeBackground } from '../src/effect-ui';
import { createEditor } from '../src/index';
import { renderCanvas } from './render-effect-ui';

async function render(background: NativeBackground<string> = { type: 'dots' }, gridSpacing = 20) {
  const state = createEditor(
    { nodes: [], edges: [] },
    { viewport: { x: 30, y: 50, zoom: 2 }, gridSpacing },
  );
  return (await renderCanvas(state, { id: 'grid-test', background })).html;
}

test('dots and squares use viewport dimensions and can be disabled', async () => {
  const dots = await render();
  expect(dots).toContain('data-flow-background="dots"');
  expect(dots).toContain('radial-gradient');
  const squares = await render({ type: 'squares', gap: 40, size: 2, color: 'red' });
  expect(squares).toContain('data-flow-background="squares"');
  expect(squares).toContain('linear-gradient');
  expect(squares).toContain('80px 80px');
  expect(await render({ type: 'none' })).not.toContain('data-flow-background=');
});

test('custom backgrounds receive the viewport, grid spacing and host Effect UI builder', async () => {
  const result = await render({
    type: 'custom',
    render: (context, h) =>
      h.div
        .attr('data-custom-grid', context.id)
        .children(`${context.spacing}:${context.viewport.x}:${context.viewport.zoom}`),
  });
  expect(result).toContain('data-flow-background="custom"');
  expect(result).toContain('data-custom-grid="grid-test"');
  expect(result).toContain('20:30:2');
});

test('invalid built-in background dimensions are rejected', () => {
  const state = createEditor({ nodes: [], edges: [] });
  for (const gap of [0, -1, Infinity]) {
    expect(() => backgroundPaint(state, { type: 'dots', gap })).toThrow('Background');
  }
  expect(() => backgroundPaint(state, { type: 'squares', size: 0 })).toThrow('Background');
});

test('default and custom backgrounds share editor spacing while explicit gaps override visuals', async () => {
  expect(await render({ type: 'squares' }, 32)).toContain('64px 64px');
  expect(await render({ type: 'dots' }, 12.5)).toContain('25px 25px');
  expect(await render({ type: 'squares', gap: 40 }, 32)).toContain('80px 80px');
  const custom = await render(
    {
      type: 'custom',
      render: ({ spacing }, h) => h.div.attr('data-shared-spacing', String(spacing)).children(),
    },
    32,
  );
  expect(custom).toContain('data-shared-spacing="32"');
});
