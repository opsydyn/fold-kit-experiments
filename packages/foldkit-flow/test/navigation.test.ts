import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { flowView, flowViewportControl, flowMinimap, viewportControlActions } from '../src/foldkit';
import { createEditor, updateEditor, type EditorEvent } from '../src/index';

const initial = createEditor({
  nodes: [
    { id: 'a', label: 'A', position: { x: 0, y: 0 }, size: { width: 100, height: 80 }, ports: [] },
  ],
  edges: [],
});
const state = updateEditor(initial, { type: 'SurfaceMeasured', size: { width: 800, height: 440 } });

test('navigation actions retain Model guards, read-only inspection and current center', () => {
  expect(viewportControlActions(initial).zoomIn.disabled).toBe(true);
  const actions = viewportControlActions({ ...state, readOnly: true });
  expect(actions.zoomIn.event).toEqual({ type: 'Zoomed', point: { x: 400, y: 220 }, factor: 1.25 });
  expect(actions.fitView.disabled).toBe(false);
  expect(
    viewportControlActions({ ...state, viewport: { x: 0, y: 0, zoom: 4 } }).zoomIn.disabled,
  ).toBe(true);
  const nudged = updateEditor(
    { ...state, readOnly: true },
    { type: 'ViewportNudged', delta: { x: -20, y: 0 } },
  );
  expect(nudged.viewport.x).toBe(-20);
  expect(nudged.graph).toBe(state.graph);
  expect(nudged.past).toHaveLength(0);
  const busy = updateEditor(state, { type: 'PanStarted', pointer: 1, point: { x: 0, y: 0 } });
  expect(Object.values(viewportControlActions(busy)).every((action) => action.disabled)).toBe(true);
  expect(updateEditor(busy, { type: 'ViewportNudged', delta: { x: 20, y: 0 } })).toBe(busy);
});

test('custom navigation shells compose public primitives with the host builder and honor feature gates', async () => {
  const render = async (minimalMode = false) => {
    const result = await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model: state }),
          view: (model, h: HtmlBuilder<EditorEvent>) => ({
            title: 'Navigation',
            body: flowView(h, model, {
              id: 'nav',
              label: 'Navigation',
              onEvent: (event) => event,
              viewportControls: true,
              minimap: true,
              minimalMode,
              renderViewportControls: (context, builder) =>
                builder.nav(
                  [builder.AriaLabel('Custom navigation')],
                  [
                    flowViewportControl(
                      builder,
                      { ...context.actions.fitView, label: 'Frame graph' },
                      (event) => event,
                      [builder.Class('custom-fit')],
                      ['Frame graph'],
                    ),
                  ],
                ),
              renderMinimap: (context, builder) =>
                flowMinimap(
                  builder,
                  context,
                  (event) => event,
                  [
                    builder.Style({
                      width: '210px',
                      height: '130px',
                      border: '8px solid red',
                      padding: '12px',
                    }),
                  ],
                  context.nodes.map((node) =>
                    builder.rect(
                      [
                        builder.X(String(node.position.x)),
                        builder.Y(String(node.position.y)),
                        builder.Width(String(node.size.width)),
                        builder.Height(String(node.size.height)),
                      ],
                      [],
                    ),
                  ),
                ),
            }),
          }),
        },
        { flags: {}, isHydratable: false },
      ),
    );
    const window = new Window();
    window.document.body.innerHTML = result.html;
    return window.document;
  };
  const document = await render();
  expect(document.querySelector('[aria-label="Custom navigation"]')?.textContent).toBe(
    'Frame graph',
  );
  expect(document.querySelector('.custom-fit')?.getAttribute('type')).toBe('button');
  const map = document.querySelector('[data-flow-minimap]');
  expect(map?.getAttribute('preserveAspectRatio')).toBe('none');
  expect(map?.querySelector('[data-flow-minimap-viewport]')).toBeNull();
  expect(map?.parentElement?.getAttribute('aria-label')).toBe('Diagram overview');
  expect(map?.parentElement?.getAttribute('style')).toContain('border: 8px solid red');
  expect((await render(true)).querySelector('[data-flow-minimap]')).toBeNull();
});
