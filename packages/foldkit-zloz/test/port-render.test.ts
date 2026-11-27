import { expect, test } from 'bun:test';

import { Window } from 'happy-dom';

import { canvasHelpContext, type GraphSurfaceOptions } from '../src/effect-ui';
import {
  captureConnectionDocument,
  createEditorFromConnectionDocument,
  createEditor,
  updateEditor,
  type EditorState,
} from '../src/index';
import { renderCanvas } from './render-effect-ui';

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

async function render(state: EditorState, options: Partial<GraphSurfaceOptions<string>> = {}) {
  const result = await renderCanvas(state, { id: 'ports', ...options });
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
    renderPort: (context) => ({
      className: 'custom-socket',
      style: { width: '32px', height: '24px', left: '99%', transform: 'rotate(45deg)' },
      content: context.label,
    }),
  });
  const source = document.querySelector('[data-flow-owner="a"][data-flow-port="out"]');
  const target = document.querySelector('[data-flow-owner="b"][data-flow-port="in"]');
  expect(document.querySelectorAll('.custom-socket')).toHaveLength(2);
  expect(source?.getAttribute('style')).toContain('left:80%');
  expect(source?.getAttribute('style')).toContain('top:40%');
  expect(source?.getAttribute('style')).toContain('transform:translate(-50%, -50%)');
  expect(source?.getAttribute('aria-pressed')).toBe('true');
  expect(target?.textContent).toBe('Primary');
  expect(target?.getAttribute('aria-label')).toBe('Connect to Target: Primary');
  expect(target?.getAttribute('data-target')).toBe('true');
});

test('resolved ports reach custom shells and preserve fallback and locked port behavior', async () => {
  const document = await render(initial, {
    policy: { canConnectPort: ({ node }) => (node === 'b' ? 'Locked input' : null) },
    renderNodeShell: () => ({ className: 'custom-shell' }),
    renderPort: (context) =>
      context.port.kind === 'output'
        ? undefined
        : {
            className: 'locked-socket',
            content: context.disabledReason ?? context.label,
          },
  });
  expect(document.querySelectorAll('.custom-shell [data-flow-port]')).toHaveLength(2);
  expect(document.querySelector('.locked-socket')?.textContent).toBe('Locked input');
  expect(document.querySelector('.locked-socket')?.hasAttribute('disabled')).toBe(true);
  expect(document.querySelector('.locked-socket')?.getAttribute('title')).toBe('Locked input');
  expect(document.querySelector('[data-flow-port="out"]')?.classList.contains('zloz-ui-port')).toBe(
    true,
  );
});

test('loose ports expose source/target intent to native and composable controls without relabelling authored kinds', async () => {
  const editor = createEditorFromConnectionDocument(
    captureConnectionDocument({ graph: initial.graph, connectionMode: 'loose' }),
  );
  for (const custom of [false, true]) {
    const renderPort: GraphSurfaceOptions<string>['renderPort'] = custom
      ? (context) => ({ content: context.label })
      : undefined;
    const options = renderPort ? { renderPort } : {};
    const before = await render(editor, options);
    const input = before.querySelector('[data-flow-owner="b"][data-flow-port="in"]');
    expect(input?.getAttribute('aria-label')).toBe('Connect from Target: Primary');
    expect(input?.getAttribute('data-flow-port-kind')).toBe('input');
    expect(
      before.querySelector('[data-flow-surface]')?.getAttribute('data-flow-connection-mode'),
    ).toBe('loose');
    if (custom) expect(input?.getAttribute('data-flow-connection-end')).toBe('source');
    const staged = updateEditor(editor, {
      type: 'PortActivated',
      endpoint: { node: 'b', port: 'in' },
    });
    const after = await render(staged, options);
    const output = after.querySelector('[data-flow-owner="a"][data-flow-port="out"]');
    expect(output?.getAttribute('aria-label')).toBe('Connect to Source: out');
    expect(output?.getAttribute('data-flow-port-kind')).toBe('output');
    if (custom) expect(output?.getAttribute('data-flow-connection-end')).toBe('target');
    expect(
      after
        .querySelector('[data-flow-owner="b"][data-flow-port="in"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(canvasHelpContext(staged, {}, false, false).defaultText).toContain('any port');
  }
});
