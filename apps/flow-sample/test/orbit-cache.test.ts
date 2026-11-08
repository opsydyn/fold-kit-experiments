import { expect, test } from 'bun:test';

import { createEditor, updateEditor, type EditorState, type FlowNode } from '@opsydyn/foldkit-flow';
import {
  flowView,
  type FlowNodeBodyCache,
  type FlowViewOptions,
} from '@opsydyn/foldkit-flow/foldkit';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';

import { Message } from '../src/editor/message';
import { orbitGroup, orbitNode } from '../src/editor/presentation';

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
const onEvent = (message: Parameters<typeof updateEditor>[1]) =>
  Message.ObservedFlowInput({ message });

async function render(
  state: EditorState,
  cache?: FlowNodeBodyCache,
  options: Partial<FlowViewOptions<Message>> = {},
) {
  return (
    await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model: state }),
          view: (model, h: HtmlBuilder<Message>) => ({
            title: 'Orbit cache',
            body: flowView(h, model, {
              id: 'orbits',
              label: 'Orbit diagram',
              onEvent,
              resizeHandles: true,
              renderNodeShell: (context, builder) => orbitNode(context, builder, cache),
              renderGroupShell: (context, builder) => orbitGroup(context, builder, cache),
              ...options,
            }),
          }),
        },
        { flags: {}, isHydratable: false },
      ),
    )
  ).html;
}
function recorder() {
  const calls: Array<{ node: FlowNode; args: readonly unknown[] }> = [];
  const cache: FlowNodeBodyCache = (node, view, args) => {
    calls.push({ node, args });
    return view(...args);
  };
  return { calls, cache };
}

test('Orbit artwork keys ignore source and port policy while sockets and controls remain live', async () => {
  const { calls, cache } = recorder();
  const first = await render(initial, cache, { canConnectPort: () => 'Reserved.' });
  expect(calls).toHaveLength(3);
  expect(first).toContain('title="Reserved."');
  const source = { ...initial, connection: { node: 'a', port: 'out' } };
  const second = await render(source, cache, { canConnectPort: () => null });
  expect(calls).toHaveLength(6);
  for (const call of calls.slice(0, 3)) {
    const next = calls.slice(3).find(({ node }) => node.id === call.node.id)!;
    expect(call.args.every((arg, i) => arg === next.args[i])).toBe(true);
  }
  expect(second).not.toContain('title="Reserved."');
  expect(second).toContain('data-flow-port="out"');
  expect(second).toContain('aria-pressed="true"');
  expect(second).toContain('aria-label="Resize A"');
});

test('Orbit selection and marquee decoration refresh independently of native selected state', async () => {
  const { calls, cache } = recorder();
  await render(initial, cache);
  const selected = await render({ ...initial, selectedNodes: ['a'] }, cache);
  const before = calls.find(({ node }) => node.id === 'a')!;
  const after = calls.slice(3).find(({ node }) => node.id === 'a')!;
  expect(before.args).not.toEqual(after.args);
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
  const html = await render(preview, cache);
  expect(html).toContain('stroke="#5eead4"');
});

test('Orbit group collapse and read-only controls update outside retained labels', async () => {
  const { calls, cache } = recorder();
  const expanded = await render(initial, cache);
  expect(expanded).toContain('aria-label="Collapse Group"');
  const collapsed = await render(
    updateEditor(initial, { type: 'GroupCollapseToggled', id: 'g' }),
    cache,
  );
  expect(collapsed).toContain('aria-label="Expand Group"');
  expect(collapsed).not.toContain('class="orbit-node"');
  const readonly = await render({ ...initial, readOnly: true }, cache);
  expect(readonly).not.toContain('aria-label="Resize A"');
  expect(readonly).toContain('disabled');
  expect(calls.some(({ node }) => node.kind === 'group')).toBe(true);
});
