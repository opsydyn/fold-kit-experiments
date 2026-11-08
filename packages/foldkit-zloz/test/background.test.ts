import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';

import { zlozView, type ZlozBackground } from '../src/foldkit';
import { createEditor, type EditorEvent } from '../src/index';

async function render(background?: ZlozBackground<EditorEvent>, gridSpacing = 20) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({
          model: createEditor(
            { nodes: [], edges: [] },
            { viewport: { x: 30, y: 50, zoom: 2 }, gridSpacing },
          ),
        }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Grid',
          body: zlozView(h, model, {
            id: 'grid-test',
            label: 'Grid',
            onEvent: (event) => event,
            background,
          }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  return result.html;
}

test('dots are the default backdrop independently of snapping; squares and none are explicit', async () => {
  const dots = await render();
  expect(dots).toContain('data-flow-background="dots"');
  expect(dots).toContain('radial-gradient');
  const squares = await render({ type: 'squares', gap: 40, size: 2, color: 'red' });
  expect(squares).toContain('data-flow-background="squares"');
  expect(squares).toContain('linear-gradient');
  expect(squares).toContain('80px 80px');
  expect(await render({ type: 'none' })).not.toContain('data-flow-background=');
});

test('custom backgrounds receive the viewport, grid spacing and host FoldKit builder', async () => {
  const result = await render({
    type: 'custom',
    render: (context, h) =>
      h.div(
        [h.DataAttribute('custom-grid', context.id)],
        [`${context.spacing}:${context.viewport.x}:${context.viewport.zoom}`],
      ),
  });
  expect(result).toContain('data-flow-background="custom"');
  expect(result).toContain('data-custom-grid="grid-test"');
  expect(result).toContain('20:30:2');
});

test('invalid built-in background dimensions are rejected', async () => {
  for (const gap of [0, -1, Infinity])
    await expect(render({ type: 'dots', gap })).rejects.toThrow('Background');
  await expect(render({ type: 'squares', size: 0 })).rejects.toThrow('Background');
});

test('default and custom backgrounds share editor spacing while explicit gaps override visuals', async () => {
  expect(await render({ type: 'squares' }, 32)).toContain('64px 64px');
  expect(await render({ type: 'dots' }, 12.5)).toContain('25px 25px');
  expect(await render({ type: 'squares', gap: 40 }, 32)).toContain('80px 80px');
  const custom = await render(
    {
      type: 'custom',
      render: ({ spacing }, h) => h.div([h.DataAttribute('shared-spacing', String(spacing))], []),
    },
    32,
  );
  expect(custom).toContain('data-shared-spacing="32"');
});
