import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  flowView,
  flowPortLabel,
  flowNodeFrame,
  flowPort,
  type FlowViewOptions,
} from '../src/foldkit';
import { createEditor, updateEditor, type EditorEvent, type EditorState } from '../src/index';

const initial = createEditor({
  nodes: [
    {
      id: 'g',
      kind: 'group',
      label: 'Group',
      position: { x: 0, y: 0 },
      size: { width: 500, height: 400 },
      ports: [],
    },
    {
      id: 'n',
      parentId: 'g',
      label: 'Node',
      position: { x: 100, y: 80 },
      size: { width: 200, height: 120 },
      ports: [
        { id: 'left', label: 'Primary', kind: 'input', side: 'left', offset: 0.25 },
        { id: 'right', kind: 'output', side: 'right', offset: 0.5 },
        { id: 'top', kind: 'input', side: 'top', offset: 0.5 },
        { id: 'bottom', kind: 'output', side: 'bottom', offset: 0.75 },
        { id: 'custom', kind: 'input', side: 'right', anchor: { x: 0.25, y: 0.75 } },
      ],
    },
  ],
  edges: [],
});

async function render(state: EditorState, options: Partial<FlowViewOptions<EditorEvent>> = {}) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Port labels',
          body: flowView(h, model, {
            id: 'ports',
            label: 'Port labels',
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

test('port labels opt in and follow canonical world anchors on every side', async () => {
  expect((await render(initial)).querySelector('[data-flow-port-label]')).toBeNull();
  const document = await render(initial, { portLabels: true, minimalMode: true });
  expect(document.querySelectorAll('[data-flow-port-label]')).toHaveLength(5);
  for (const [id, left, top] of [
    ['left', '82px', '110px'],
    ['right', '318px', '140px'],
    ['top', '200px', '62px'],
    ['bottom', '250px', '218px'],
    ['custom', '168px', '170px'],
  ]) {
    const label = document.querySelector('[data-flow-port-label="' + id + '"]');
    expect(label?.getAttribute('style')).toContain('left: ' + left);
    expect(label?.getAttribute('style')).toContain('top: ' + top);
    expect(label?.getAttribute('style')).toContain('pointer-events: none');
    expect(label?.getAttribute('aria-hidden')).toBe('true');
  }
  expect(document.querySelector('[data-flow-port-label="left"]')?.textContent).toBe('Primary');
  expect(document.querySelector('[data-flow-port-label="right"]')?.textContent).toBe('right');
  expect(document.querySelector('[data-flow-port="left"]')?.getAttribute('aria-label')).toBe(
    'Connect to Node: Primary',
  );
  const collapsed = updateEditor(initial, { type: 'GroupCollapseToggled', id: 'g' });
  expect(
    (await render(collapsed, { portLabels: true })).querySelectorAll('[data-flow-port-label]'),
  ).toHaveLength(0);
});

test('custom port labels compose independently of node shells and retain native port names', async () => {
  const document = await render(
    { ...initial, readOnly: true },
    {
      portLabels: { offset: 24 },
      renderNodeShell: (context, h) =>
        flowNodeFrame(
          h,
          context,
          [h.Class('custom-shell')],
          context.node.ports.map((port) => flowPort(h, context, port, [], ['→'])),
        ),
      renderPortLabel: (context, h) =>
        context.port.id === 'top'
          ? null
          : context.port.id === 'left'
            ? flowPortLabel(
                h,
                { ...context, placement: 'right', offset: 30 },
                [h.Class('custom-port-badge')],
                [h.strong([], [context.label])],
              )
            : undefined,
    },
  );
  const badge = document.querySelector('.custom-port-badge');
  expect(badge?.textContent).toBe('Primary');
  expect(badge?.getAttribute('style')).toContain('left: 130px');
  expect(badge?.getAttribute('style')).toContain('top: 110px');
  expect(badge?.getAttribute('style')).toContain('pointer-events: none');
  expect(document.querySelectorAll('[data-flow-port-label]')).toHaveLength(4);
  expect(document.querySelector('.custom-shell [data-flow-port-label]')).toBeNull();
  expect(document.querySelector('[data-flow-port="left"]')?.getAttribute('aria-label')).toBe(
    'Connect to Node: Primary',
  );
  expect(document.querySelector('[data-flow-port="left"]')?.hasAttribute('disabled')).toBe(true);
  const hidden = updateEditor(initial, {
    type: 'VisibilityChanged',
    visibility: { hiddenNodeIds: ['n'] },
  });
  expect(
    (await render(hidden, { portLabels: true })).querySelector('[data-flow-port-label]'),
  ).toBeNull();
  await expect(render(initial, { portLabels: { offset: -1 } })).rejects.toThrow();
});
