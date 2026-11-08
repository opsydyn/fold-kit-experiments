import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozView, zlozPort, zlozNodeFrame, type ZlozViewOptions } from '../src/foldkit';
import { createEditor, updateEditor, type EditorEvent, type EditorState } from '../src/index';

const initial = createEditor({
  nodes: [
    {
      id: 'a',
      label: 'Source',
      position: { x: 20, y: 30 },
      size: { width: 160, height: 100 },
      ports: [{ id: 'out', kind: 'output', side: 'right', anchor: { x: 0.8, y: 0.4 } }],
    },
    {
      id: 'b',
      label: 'Target',
      position: { x: 300, y: 50 },
      size: { width: 160, height: 100 },
      ports: [{ id: 'in', label: 'Primary', kind: 'input', side: 'left', offset: 0.5 }],
    },
  ],
  edges: [],
});

async function render(state: EditorState, options: Partial<ZlozViewOptions<EditorEvent>> = {}) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Ports',
          body: zlozView(h, model, {
            id: 'ports',
            label: 'Ports',
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
  return window.document;
}

test('custom port rendering composes the native anchor, button semantics and target feedback', async () => {
  const started = updateEditor(initial, {
    type: 'ConnectionDragStarted',
    endpoint: { node: 'a', port: 'out' },
    pointer: 1,
    point: { x: 148, y: 70 },
  });
  const hovered = updateEditor(started, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 300, y: 100 },
    target: { node: 'b', port: 'in' },
  });
  const document = await render(hovered, {
    renderPort: (context, h) =>
      zlozPort(
        h,
        context,
        context.port,
        [
          h.Class('custom-socket'),
          h.DataAttribute('custom-target', String(context.target)),
          h.Style({ width: '32px', height: '24px', left: '99%', transform: 'rotate(45deg)' }),
        ],
        [context.label],
      ),
  });
  const source = document.querySelector('[data-flow-owner="a"][data-flow-port="out"]');
  const target = document.querySelector('[data-flow-owner="b"][data-flow-port="in"]');
  expect(document.querySelectorAll('.custom-socket')).toHaveLength(2);
  expect(source?.getAttribute('style')).toContain('left: 80%');
  expect(source?.getAttribute('style')).toContain('top: 40%');
  expect(source?.getAttribute('style')).toContain('transform: translate(-50%, -50%)');
  expect(source?.getAttribute('aria-pressed')).toBe('true');
  expect(target?.textContent).toBe('Primary');
  expect(target?.getAttribute('aria-label')).toBe('Connect to Target: Primary');
  expect(target?.getAttribute('data-custom-target')).toBe('true');
});

test('resolved ports reach custom shells and preserve fallback and locked port behavior', async () => {
  const document = await render(initial, {
    canConnectPort: ({ node }) => (node === 'b' ? 'Locked input' : null),
    renderNodeShell: (context, h) =>
      zlozNodeFrame(h, context, [h.Class('custom-shell')], context.ports ?? []),
    renderPort: (context, h) =>
      context.port.kind === 'output'
        ? undefined
        : zlozPort(
            h,
            context,
            context.port,
            [h.Class('locked-socket')],
            [context.disabledReason ?? context.label],
          ),
  });
  expect(document.querySelectorAll('.custom-shell [data-flow-port]')).toHaveLength(2);
  expect(document.querySelector('.locked-socket')?.textContent).toBe('Locked input');
  expect(document.querySelector('.locked-socket')?.hasAttribute('disabled')).toBe(true);
  expect(document.querySelector('.locked-socket')?.hasAttribute('data-flow-port-locked')).toBe(
    true,
  );
  expect(document.querySelector('[data-flow-port="out"]')?.textContent).toBe('+');
});
