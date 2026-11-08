import { afterEach, expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  flowView,
  flowNodeFrame,
  flowGroupFrame,
  flowDragHandle,
  flowPort,
  flowResizeHandle,
} from '../src/foldkit';
import { createEditor, updateEditor, type EditorEvent } from '../src/index';
import { bindInput } from '../src/input';

const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const previousKeyboardEvent = Object.getOwnPropertyDescriptor(globalThis, 'KeyboardEvent');
afterEach(() => {
  if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
  else Reflect.deleteProperty(globalThis, 'document');
  if (previousKeyboardEvent)
    Object.defineProperty(globalThis, 'KeyboardEvent', previousKeyboardEvent);
  else Reflect.deleteProperty(globalThis, 'KeyboardEvent');
});

test('full shells replace chrome while retaining public interaction and geometry contracts', async () => {
  const state = createEditor({
    nodes: [
      {
        id: 'g',
        kind: 'group',
        label: 'Boundary',
        position: { x: 10, y: 20 },
        size: { width: 400, height: 250 },
        ports: [],
      },
      {
        id: 'n',
        parentId: 'g',
        label: 'Orbit',
        position: { x: 50, y: 70 },
        size: { width: 160, height: 160 },
        ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
      },
    ],
    edges: [],
  });
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Composition',
          body: flowView(h, model, {
            id: 'compose',
            label: 'Custom shells',
            onEvent: (event) => event,
            renderGroupShell: (context, builder) =>
              flowGroupFrame(
                builder,
                context,
                [builder.Class('boundary-design')],
                [flowDragHandle(builder, context, [], ['Custom boundary'])],
              ),
            renderNodeShell: (context, builder) =>
              flowNodeFrame(
                builder,
                context,
                [
                  builder.Class('orbit-design'),
                  builder.Style({ 'border-radius': '50%', height: '160px' }),
                ],
                [
                  flowDragHandle(builder, context, [], ['Custom orbit']),
                  flowResizeHandle(builder, context, 'right', [], ['Resize']),
                  ...context.node.ports.map((port) =>
                    flowPort(
                      builder,
                      context,
                      port,
                      [builder.Style({ background: 'purple', width: '32px', height: '32px' })],
                      ['→'],
                    ),
                  ),
                ],
              ),
            renderNode: () => h.span([], ['Legacy content must not leak']),
          }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  expect(result.html).toContain('Custom boundary');
  expect(result.html).toContain('Custom orbit');
  expect(result.html).not.toContain('Legacy content must not leak');
  expect(result.html).toContain('data-flow-node="n"');
  expect(result.html).toContain('data-flow-group="g"');
  expect(result.html).toContain('aria-label="Select Orbit"');
  expect(result.html).toContain('aria-label="Connect from Orbit: out"');
  expect(result.html).toContain('data-flow-owner="n"');
  expect(result.html).toContain('border-radius: 50%');
  expect(result.html).toContain('translate(-50%, -50%)');
  const window = new Window();
  Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
  Object.defineProperty(globalThis, 'KeyboardEvent', {
    value: window.KeyboardEvent,
    configurable: true,
  });
  document.body.innerHTML = result.html;
  const surface = document.querySelector<HTMLElement>('[data-flow-surface]');
  expect(surface).not.toBeNull();
  if (!surface) return;
  let edited = state;
  using _input = {
    [Symbol.dispose]: bindInput(surface, (event) => {
      edited = updateEditor(edited, event);
    }),
  };
  document
    .querySelector('[aria-label="Select Orbit"]')
    ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(edited.graph.nodes.find((node) => node.id === 'n')?.position.x).toBe(55);
  expect(edited.selectedNodes).toEqual(['n']);
  document.querySelector<HTMLButtonElement>('[aria-label="Connect from Orbit: out"]')?.click();
  expect(edited.connection).toEqual({ node: 'n', port: 'out' });
  surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(edited.connection).toBeNull();
  edited = updateEditor(edited, { type: 'UndoPressed' });
  expect(edited.graph).toEqual(state.graph);
  document
    .querySelector('[aria-label="Resize Orbit"]')
    ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(edited.graph.nodes.find((node) => node.id === 'n')?.size.width).toBe(165);
});

test('public width resize control nudges Model with constraints, one undo step and read-only protection', () => {
  const state = createEditor({
    nodes: [
      {
        id: 'n',
        label: 'Node',
        position: { x: 0, y: 0 },
        size: { width: 160, height: 100 },
        ports: [],
        resizeLimits: { maxWidth: 165 },
      },
    ],
    edges: [],
  });
  const resized = updateEditor(state, { type: 'NodeResizeNudged', id: 'n', delta: 20 });
  expect(resized.graph.nodes[0]?.size.width).toBe(165);
  expect(resized.past).toHaveLength(1);
  expect(updateEditor(resized, { type: 'UndoPressed' }).graph).toEqual(state.graph);
  expect(
    updateEditor({ ...state, readOnly: true }, { type: 'NodeResizeNudged', id: 'n', delta: 20 }),
  ).toEqual({ ...state, readOnly: true });
});
