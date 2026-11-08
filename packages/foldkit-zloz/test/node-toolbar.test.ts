import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozView, type ZlozViewOptions } from '../src/foldkit';
import { createEditor, updateEditor, type EditorEvent, type EditorState } from '../src/index';

const initial = createEditor(
  {
    nodes: [
      {
        id: 'group',
        kind: 'group',
        label: 'Group',
        position: { x: 20, y: 30 },
        size: { width: 300, height: 200 },
        ports: [],
      },
      {
        id: 'a',
        parentId: 'group',
        label: 'A',
        position: { x: 50, y: 80 },
        size: { width: 100, height: 80 },
        ports: [],
      },
    ],
    edges: [],
  },
  { viewport: { x: 30, y: 20, zoom: 2 } },
);
const selected = updateEditor(initial, { type: 'NodeSelected', id: 'a', additive: false });

async function render(state: EditorState, options: Partial<ZlozViewOptions<EditorEvent>> = {}) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Node toolbar',
          body: zlozView(h, model, {
            id: 'diagram',
            label: 'Diagram',
            onEvent: (event) => event,
            ...options,
          }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document.querySelector('[data-flow-node-toolbar]');
}

test('the node toolbar follows presented bounds in screen space and uses the shared deletion policy', async () => {
  const toolbar = await render(selected, {
    nodeToolbar: { placement: 'right', offset: 12 },
    minimalMode: true,
    canDelete: () => 'A is required',
    renderNodeToolbar: (context, h) => {
      expect(context.anchor).toEqual({ x: 330, y: 260 });
      expect(context.actions.duplicate.event).toEqual({ type: 'DuplicatePressed' });
      expect(context.actions.deleteNode.disabledReason).toBe('A is required');
      return h.span([], ['Host actions']);
    },
  });
  expect(toolbar?.textContent).toBe('Host actions');
  expect(toolbar?.getAttribute('aria-label')).toBe('Actions for A');
  expect(toolbar?.getAttribute('style')).toContain('left: 342px');
  expect(toolbar?.getAttribute('style')).toContain('top: 260px');
  expect(toolbar?.closest('[data-flow-surface]')).toBe(toolbar?.parentElement);
  expect(toolbar?.hasAttribute('data-flow-no-drag')).toBe(true);

  const fallback = await render(selected, { nodeToolbar: true, canDelete: () => 'A is required' });
  expect(
    fallback?.querySelector('button[aria-label="Delete node"]')?.hasAttribute('disabled'),
  ).toBe(true);
});

test('the toolbar requires one visible node and respects explicit suppression', async () => {
  expect(await render(selected)).toBeNull();
  expect(await render({ ...selected, readOnly: true }, { nodeToolbar: true })).toBeNull();
  expect(
    await render({ ...selected, selectedNodes: ['a', 'group'] }, { nodeToolbar: true }),
  ).toBeNull();
  expect(
    await render({ ...selected, collapsedGroups: ['group'] }, { nodeToolbar: true }),
  ).toBeNull();
  expect(await render(selected, { nodeToolbar: true, renderNodeToolbar: () => null })).toBeNull();
  const collapsed = await render(
    { ...selected, selectedNodes: ['group'], collapsedGroups: ['group'] },
    { nodeToolbar: { placement: 'bottom' } },
  );
  expect(collapsed?.getAttribute('style')).toContain('top: 200px');
});
