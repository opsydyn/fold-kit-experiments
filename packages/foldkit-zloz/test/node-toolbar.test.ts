import { expect, test } from 'bun:test';

import { Window } from 'happy-dom';

import type { GraphSurfaceOptions } from '../src/effect-ui';
import { createEditor, updateEditor, type EditorState } from '../src/index';
import { renderCanvas } from './render-effect-ui';

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

async function render(state: EditorState, options: Partial<GraphSurfaceOptions<string>> = {}) {
  const result = await renderCanvas(state, options);
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document.querySelector('[data-flow-node-toolbar]');
}

test('the node toolbar follows presented bounds in screen space and uses the shared deletion policy', async () => {
  const toolbar = await render(selected, {
    policy: { canDelete: () => 'A is required' },
    nodeToolbar: {
      placement: 'right',
      offset: 12,
      onEvent: ({ type }) => type,
      render: (context, h) => {
        expect(context.anchor).toEqual({ x: 330, y: 260 });
        expect(context.actions.duplicate.event).toEqual({ type: 'DuplicatePressed' });
        expect(context.actions.deleteNode.disabledReason).toBe('A is required');
        return h.span.children('Host actions');
      },
    },
  });
  expect(toolbar?.textContent).toBe('Host actions');
  expect(toolbar?.getAttribute('aria-label')).toBe('Actions for A');
  expect(toolbar?.getAttribute('style')).toContain('left:342px');
  expect(toolbar?.getAttribute('style')).toContain('top:260px');
  expect(toolbar?.closest('[data-flow-surface]')).toBe(toolbar?.parentElement);
  expect(toolbar?.hasAttribute('data-flow-no-drag')).toBe(true);

  const fallback = await render(selected, {
    nodeToolbar: { onEvent: ({ type }) => type },
    policy: { canDelete: () => 'A is required' },
  });
  expect(fallback?.querySelector('button[title="A is required"]')?.hasAttribute('disabled')).toBe(
    true,
  );
});

test('the toolbar requires one visible node and respects explicit suppression', async () => {
  expect(await render(selected)).toBeNull();
  expect(
    await render({ ...selected, readOnly: true }, { nodeToolbar: { onEvent: ({ type }) => type } }),
  ).toBeNull();
  expect(
    await render(
      { ...selected, selectedNodes: ['a', 'group'] },
      { nodeToolbar: { onEvent: ({ type }) => type } },
    ),
  ).toBeNull();
  expect(
    await render(
      { ...selected, collapsedGroups: ['group'] },
      { nodeToolbar: { onEvent: ({ type }) => type } },
    ),
  ).toBeNull();
  expect(
    await render(selected, { nodeToolbar: { onEvent: ({ type }) => type, render: () => null } }),
  ).toBeNull();
  const collapsed = await render(
    { ...selected, selectedNodes: ['group'], collapsedGroups: ['group'] },
    { nodeToolbar: { placement: 'bottom', onEvent: ({ type }) => type } },
  );
  expect(collapsed?.getAttribute('style')).toContain('top:200px');
});
