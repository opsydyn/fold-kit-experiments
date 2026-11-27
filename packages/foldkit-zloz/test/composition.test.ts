import { afterEach, expect, test } from 'bun:test';

import { Window } from 'happy-dom';

import { createEditor, updateEditor } from '../src/index';
import { bindInput } from '../src/input';
import { renderCanvas } from './render-effect-ui';

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
  const result = await renderCanvas(state, {
    id: 'compose',
    label: 'Custom shells',
    resizeHandles: true,
    renderGroupShell: () => ({
      className: 'boundary-design',
      title: { content: 'Custom boundary' },
    }),
    renderNodeShell: () => ({
      className: 'orbit-design',
      style: { borderRadius: '50%' },
      title: { content: 'Custom orbit' },
    }),
    renderPort: () => ({
      style: { background: 'purple', width: '32px', height: '32px' },
      content: '→',
    }),
  });
  expect(result.html).toContain('Custom boundary');
  expect(result.html).toContain('Custom orbit');
  expect(result.html).toContain('data-flow-node="n"');
  expect(result.html).toContain('data-flow-group="g"');
  expect(result.html).toContain('aria-label="Select Orbit"');
  expect(result.html).toContain('aria-label="Connect from Orbit: out"');
  expect(result.html).toContain('data-flow-owner="n"');
  expect(result.html).toContain('border-radius:50%');
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
