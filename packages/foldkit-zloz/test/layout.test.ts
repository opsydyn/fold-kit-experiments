import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import { Window } from 'happy-dom';

import { zlozView } from '../src/foldkit';
import { createEditor, updateEditor } from '../src/index';
const state = updateEditor(
  createEditor({
    nodes: [
      {
        id: 'a',
        label: 'A',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 80 },
        ports: [],
      },
    ],
    edges: [],
  }),
  { type: 'SurfaceMeasured', size: { width: 800, height: 440 } },
);

test('public layout moves native chrome without duplicating the canvas and fill has a bounded sizing contract', async () => {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h) => ({
          title: 'Layout',
          body: zlozView(h, model, {
            id: 'layout',
            label: 'Canvas',
            onEvent: (event) => event,
            height: 'fill',
            viewportControls: true,
            connectionCreation: true,
            minimap: true,
            renderLayout: (parts, builder) =>
              builder.div(
                [builder.Class('custom-layout')],
                [
                  builder.aside(
                    [builder.AriaLabel('Tools')],
                    [
                      parts.help,
                      ...(parts.controls ? [parts.controls] : []),
                      ...(parts.creation ? [parts.creation] : []),
                      ...(parts.minimap ? [parts.minimap] : []),
                      parts.connections,
                      parts.status,
                    ],
                  ),
                  builder.main([], [parts.canvas]),
                ],
              ),
          }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  expect(window.document.querySelectorAll('[data-flow-surface]')).toHaveLength(1);
  expect(
    window.document.querySelector('main [data-flow-surface]')?.getAttribute('style'),
  ).toContain('height: 100%');
  expect(window.document.querySelector('.foldkit-flow')?.getAttribute('style')).toContain(
    'height: 100%',
  );
  expect(window.document.querySelector('main [data-flow-surface]')?.id).toBe('layout-surface');
  expect(window.document.querySelectorAll('[data-flow-minimap]')).toHaveLength(1);
  expect(window.document.querySelector('aside [data-flow-minimap]')).not.toBeNull();
  expect(window.document.querySelector('main [data-flow-minimap]')).toBeNull();
  expect(window.document.querySelector('aside [data-flow-surface]')).toBeNull();
  expect(window.document.querySelector('aside [aria-label="Viewport controls"]')).not.toBeNull();
  expect(window.document.querySelector('aside [data-flow-connections]')).not.toBeNull();
});
