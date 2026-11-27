import { createEditor, updateEditor, type EditorState } from '@opsydyn/foldkit-zloz';
import { Effect } from 'effect';
import { expect, test } from 'vitest';

import { init } from '../src/editor/model';
import { view } from '../src/editor/view';
import { renderNativeReview } from './render-native-review';

const initial = createEditor({
  nodes: [
    {
      id: 'g',
      kind: 'group',
      label: 'Group',
      position: { x: 0, y: 0 },
      size: { width: 500, height: 300 },
      ports: [],
    },
    ...['a', 'b'].map((id, i) => ({
      id,
      label: id.toUpperCase(),
      position: { x: 30 + i * 220, y: 60 },
      size: { width: 150, height: 150 },
      parentId: 'g',
      ports: [
        { id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 },
        { id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 },
      ],
    })),
  ],
  edges: [],
});
async function render(editor: EditorState) {
  const model = {
    ...init().model,
    editor,
    nodeDesign: 'orbits' as const,
    themePreference: 'light' as const,
    retainNodeViews: true,
  };
  const result = await Effect.runPromise(renderNativeReview(model, view));
  return result.html;
}

test('active source changes native socket state while Orbit artwork stays visible', async () => {
  const first = await render(initial);
  const source = { ...initial, connection: { node: 'a', port: 'out' } };
  const second = await render(source);
  expect(first).toContain('data-orbit-body="a"');
  expect(second).toContain('data-orbit-body="a"');
  expect(second).toContain('data-flow-port="out"');
  expect(second).toContain('aria-pressed="true"');
});

test('Orbit selection and marquee decoration refresh independently of native selected state', async () => {
  const unselected = await render(initial);
  expect(unselected).not.toContain('stroke="#f97316"');
  const selected = await render({ ...initial, selectedNodes: ['a'] });
  expect(selected).toContain('stroke="#f97316"');
  const start = updateEditor(initial, {
    type: 'BoxSelectionStarted',
    pointer: 1,
    point: { x: 20, y: 50 },
  });
  const preview = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 190, y: 220 },
  });
  const html = await render(preview);
  expect(html).toContain('stroke="#5eead4"');
});

test('Orbit group collapse and read-only controls update outside retained labels', async () => {
  const expanded = await render(initial);
  expect(expanded).toContain('aria-label="Collapse Group"');
  const collapsed = await render(updateEditor(initial, { type: 'GroupCollapseToggled', id: 'g' }));
  expect(collapsed).toContain('aria-label="Expand Group"');
  expect(collapsed).not.toContain('data-orbit-body="a"');
  const readonly = await render({ ...initial, readOnly: true });
  expect(readonly).not.toContain('aria-label="Resize A"');
  expect(readonly).toContain('disabled');
});
