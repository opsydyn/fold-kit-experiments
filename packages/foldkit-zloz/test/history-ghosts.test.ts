import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozHistoryGhosts, type ZlozHistoryGhostOptions } from '../src/foldkit';
import { captureEdition, compareEditions, type ZlozGraph } from '../src/index';
const node = {
  id: 'a',
  label: 'Order',
  position: { x: 20, y: 30 },
  size: { width: 200, height: 100 },
  ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }] as const,
};
const before: ZlozGraph = {
  nodes: [
    node,
    {
      ...node,
      id: 'b',
      label: 'Removed',
      position: { x: 20, y: 200 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
    },
  ],
  edges: [
    { id: 'removed-edge', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } },
  ],
};
const after: ZlozGraph = { nodes: [{ ...node, position: { x: 300, y: 30 } }], edges: [] };
const diff = compareEditions(
  captureEdition({ id: 'a', name: 'Before', snapshot: { graph: before } }),
  captureEdition({ id: 'b', name: 'After', snapshot: { graph: after } }),
);
async function render(options: ZlozHistoryGhostOptions<never> = {}, comparison = diff) {
  const output = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: {} }),
        view: (_model, h: HtmlBuilder<never>) => ({
          title: 'Ghosts',
          body: h.div([], [zlozHistoryGhosts(h, comparison, options) ?? h.span([], [])]),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = output.html;
  return window.document;
}
test('ghosts use old geometry with independent movements; no ports, editing targets or focusable descendants', async () => {
  const document = await render();
  expect(document.querySelector('[data-zloz-history-id="a"]')?.getAttribute('transform')).toBe(
    'translate(20 30)',
  );
  expect(document.querySelectorAll('[data-zloz-history-node]')).toHaveLength(2);
  expect(document.querySelectorAll('[data-zloz-history-movement]')).toHaveLength(1);
  expect(
    document.querySelectorAll('button, input, [tabindex], [data-flow-node], [data-flow-port]'),
  ).toHaveLength(0);
  expect(document.querySelector('[data-zloz-history-ghosts]')?.getAttribute('style')).toContain(
    'pointer-events: none',
  );
  expect(document.body.textContent).toContain('Removed: Removed');
  expect(document.querySelector('[data-zloz-history-edge]')?.getAttribute('d')).toBe(
    'M220,80 L20,250',
  );
});
test('global and individual visibility controls and custom mark omission compose independently', async () => {
  expect(
    (await render({ enabled: false })).querySelectorAll('[data-zloz-history-ghosts]'),
  ).toHaveLength(0);
  const hidden = await render({ nodes: false });
  expect(hidden.querySelectorAll('[data-zloz-history-node]')).toHaveLength(0);
  expect(hidden.querySelectorAll('[data-zloz-history-movement]')).toHaveLength(1);
  expect(
    (await render({ movements: false, edges: false, renderNode: () => null })).querySelectorAll(
      'path',
    ),
  ).toHaveLength(0);
});

test('overlapping movement uses an outside lane and preserves actual movement direction', async () => {
  const selected = captureEdition({
    id: 'overlap',
    name: 'Small move',
    snapshot: {
      graph: {
        ...before,
        nodes: before.nodes.map((item) =>
          item.id === 'a' ? { ...item, position: { x: 30, y: 30 } } : item,
        ),
      },
    },
  });
  const document = await render({}, compareEditions(diff.baseline, selected));
  expect(document.querySelector('[data-zloz-history-movement="a"] path')?.getAttribute('d')).toBe(
    'M120,30 L120,2 L130,2 L130,30',
  );
});
