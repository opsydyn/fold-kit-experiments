import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';

import { flowView } from '../src/foldkit';
import {
  createEditor,
  serializeGraph,
  updateEditor,
  type EditorEvent,
  type EditorState,
} from '../src/index';

async function renderReadout(state: EditorState, resizeReadout = true) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Readout',
          body: flowView(h, model, {
            id: 'readout-test',
            label: 'Resize',
            onEvent: (event) => event,
            resizeHandles: true,
            resizeReadout,
          }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  return result.html;
}

const graph = {
  nodes: [
    {
      id: 'g',
      label: 'Group',
      kind: 'group' as const,
      ports: [],
      position: { x: 0, y: 0 },
      size: { width: 400, height: 200 },
      keepAspectRatio: true,
      resizeLimits: { maxWidth: 450 },
    },
  ],
  edges: [],
};

test('readout shows constrained Model dimensions and restores them on cancellation', async () => {
  const initial = createEditor(graph);
  expect(await renderReadout(initial)).not.toContain('data-flow-resize-readout=');
  const selected = updateEditor(initial, { type: 'NodeSelected', id: 'g', additive: false });
  expect(await renderReadout(selected)).toContain('400 × 200');
  expect(
    await renderReadout(updateEditor(selected, { type: 'GroupCollapseToggled', id: 'g' })),
  ).not.toContain('data-flow-resize-readout=');
  const start = updateEditor(selected, {
    type: 'NodeResizeStarted',
    id: 'g',
    handle: 'right',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const preview = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 200, y: 0 },
  });
  const before = serializeGraph(preview.graph);
  const html = await renderReadout(preview);
  expect(html).toContain('data-flow-resize-readout="g"');
  expect(html).toContain('450 × 225');
  expect(serializeGraph(preview.graph)).toBe(before);
  expect(await renderReadout(updateEditor(preview, { type: 'GestureCancelled' }))).toContain(
    '400 × 200',
  );
  expect(await renderReadout(preview, false)).not.toContain('data-flow-resize-readout=');
  expect(await renderReadout({ ...preview, readOnly: true })).not.toContain(
    'data-flow-resize-readout=',
  );
});

test('keyboard size readout rounds presentation without changing geometry and clears with selection', async () => {
  const selected = updateEditor(createEditor(graph), {
    type: 'NodeSelected',
    id: 'g',
    additive: false,
  });
  const resized = updateEditor(selected, {
    type: 'GroupResizeNudged',
    id: 'g',
    handle: 'right',
    delta: { x: 1.25, y: 0 },
  });
  expect(await renderReadout(resized)).toContain('401.25 × 200.63');
  expect(resized.graph.nodes[0]?.size.height).toBe(200.625);
  expect(await renderReadout(updateEditor(resized, { type: 'SelectionCleared' }))).not.toContain(
    'data-flow-resize-readout=',
  );
});

test('card resize readout is transient and follows the actual width', async () => {
  const initial = createEditor({
    nodes: [
      {
        id: 'card',
        label: 'Card',
        ports: [],
        position: { x: 0, y: 0 },
        size: { width: 180, height: 90 },
      },
    ],
    edges: [],
  });
  const start = updateEditor(initial, {
    type: 'NodeResizeStarted',
    id: 'card',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const preview = updateEditor(start, { type: 'PointerMoved', pointer: 1, point: { x: 20, y: 0 } });
  expect(await renderReadout(preview)).toContain('200 × 90');
  expect(
    await renderReadout(updateEditor(preview, { type: 'PointerReleased', pointer: 1 })),
  ).not.toContain('data-flow-resize-readout=');
});
