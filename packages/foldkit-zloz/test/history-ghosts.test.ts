import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import { historyGhosts, type NativeHistoryGhostArtwork } from '../src/effect-ui';
import {
  captureEdition,
  compareEditions,
  type ZlozGraph,
  type ZlozHistoryGhostVisibility,
} from '../src/index';
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
async function render(
  options: Partial<ZlozHistoryGhostVisibility> & NativeHistoryGhostArtwork<string> = {},
  comparison = diff,
) {
  const TestView = Html.component({
    name: 'HistoryTest',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) => h.div(historyGhosts(comparison, options, 'selected', options)),
  });
  const output = await Effect.runPromise(HtmlServer.renderToHtml(TestView, {}, { static: true }));
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
    'pointer-events:none',
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
