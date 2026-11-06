import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { flowView, flowWorldOverlayItem, type FlowViewOptions } from '../src/foldkit';
import { createEditor, updateEditor, type EditorEvent } from '../src/index';

const initial = createEditor(
  {
    nodes: [
      {
        id: 'g',
        kind: 'group',
        label: 'Group',
        position: { x: 0, y: 0 },
        size: { width: 400, height: 300 },
        ports: [],
      },
      {
        id: 'a',
        parentId: 'g',
        label: 'Child',
        position: { x: 30, y: 60 },
        size: { width: 100, height: 80 },
        ports: [],
      },
    ],
    edges: [],
  },
  { viewport: { x: 35, y: 20, zoom: 2 }, readOnly: true },
);
const state = updateEditor(
  updateEditor(initial, { type: 'SurfaceMeasured', size: { width: 800, height: 440 } }),
  { type: 'GroupCollapseToggled', id: 'g' },
);

async function render(renderWorldOverlay?: FlowViewOptions<EditorEvent>['renderWorldOverlay']) {
  const defaults: FlowViewOptions<EditorEvent> = {
    id: 'diagram',
    label: 'Diagram',
    onEvent: (event) => event,
    minimalMode: true,
  };
  const options = renderWorldOverlay ? { ...defaults, renderWorldOverlay } : defaults;
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'World overlay',
          body: flowView(h, model, options),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}

test('world overlay shares the visible graph transform and receives resolved presentation', async () => {
  const document = await render((context, h) => {
    expect(context.nodes.map((node) => node.id)).toEqual(['g']);
    expect(context.nodes[0]?.size).toEqual({ width: 224, height: 56 });
    expect(context.surface).toEqual({ width: 800, height: 440 });
    expect(context.viewport).toBe(state.viewport);
    expect(context.readOnly).toBe(true);
    return flowWorldOverlayItem(
      h,
      { position: { x: 24, y: 72 }, interactive: true },
      [h.Style({ color: 'red' })],
      [h.button([h.Type('button')], ['Domain annotation'])],
    );
  });
  const overlay = document.querySelector('[data-flow-world-overlay]');
  const group = document.querySelector('[data-flow-group="g"]');
  expect(overlay?.textContent).toBe('Domain annotation');
  expect(overlay?.parentElement).toBe(group?.parentElement);
  expect(overlay?.parentElement?.getAttribute('style')).toContain('translate(35px, 20px) scale(2)');
  expect(overlay?.getAttribute('style')).toContain('pointer-events: none');
  const item = overlay?.querySelector('[data-flow-world-overlay-item]');
  expect(item?.getAttribute('style')).toContain('left: 24px');
  expect(item?.getAttribute('style')).toContain('top: 72px');
  expect(item?.getAttribute('style')).toContain('color: red');
  expect(item?.getAttribute('style')).toContain('pointer-events: auto');
  expect(item?.hasAttribute('data-flow-no-drag')).toBe(true);
});

test('omitting the hook or returning null leaves the world layer free of overlays', async () => {
  expect((await render()).querySelector('[data-flow-world-overlay]')).toBeNull();
  expect((await render(() => null)).querySelector('[data-flow-world-overlay]')).toBeNull();
});
