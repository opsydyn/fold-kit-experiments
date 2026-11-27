import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import {
  resolveHistoryComparisonPresentationV2,
  parseModelDocumentV2,
  parseConnectionDocument,
  type ZlozEditionV2,
  type ZlozHistoryPresentationOptionsV2,
} from '../src';
import {
  historyComparisonV2,
  historyGhostsV2,
  type ZlozHistoryPresentationViewOptionsV2,
  type ZlozHistoryGhostOptionsV2,
} from '../src/effect-ui';
import looseWire from './fixtures/connection-v2-loose.json';
import modelWire from './fixtures/model-v2-modes.json';

const before = parseModelDocumentV2(JSON.stringify(modelWire)).editions[0]!;
const strict: ZlozEditionV2 = {
  ...before,
  name: 'Strict checkpoint',
  snapshot: { ...before.snapshot, connectionMode: 'strict' },
};
const moved: ZlozEditionV2 = {
  ...before,
  id: 'moved',
  name: 'Moved checkpoint',
  snapshot: {
    ...before.snapshot,
    graph: {
      ...before.snapshot.graph,
      nodes: before.snapshot.graph.nodes.map((node) =>
        node.id === 'a' ? { ...node, position: { x: 80, y: 60 } } : node,
      ),
    },
  },
};
async function render(
  selected = strict,
  options: ZlozHistoryPresentationOptionsV2 = {},
  view: ZlozHistoryPresentationViewOptionsV2<string> = {},
  ghosts: ZlozHistoryGhostOptionsV2<string> = {},
  baseline = before,
) {
  const context = resolveHistoryComparisonPresentationV2(baseline, selected, options);
  const TestView = Html.component({
    name: 'HistoryPresentation',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) =>
      h.div(historyComparisonV2(h, context, view), historyGhostsV2<string>(context, ghosts)),
  });
  const output = await Effect.runPromise(HtmlServer.renderToHtml(TestView, {}, { static: true }));
  const window = new Window();
  window.document.body.innerHTML = output.html;
  return { document: window.document, context, html: output.html };
}

test('mode-only comparison has explicit accessible text and no invented graph ghosts', async () => {
  const { document, context } = await render();
  expect(document.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
  expect(document.querySelector('[data-zloz-history-mode]')?.textContent).toBe(
    'Connection mode changed from loose to strict.',
  );
  expect(document.body.textContent).toContain(
    'Strict checkpoint compared with First. No node or edge changes.',
  );
  expect(
    document.querySelectorAll(
      '[data-zloz-history-node], [data-zloz-history-edge], [data-zloz-history-movement]',
    ),
  ).toHaveLength(0);
  expect(context.comparison.semanticChanged).toBe(true);
  expect(context.comparison.layoutChanged).toBe(false);
});

test('unchanged modes are explicit and graph layout is described separately', async () => {
  const { document } = await render(moved);
  expect(document.body.textContent).toContain('Connection mode unchanged: loose.');
  expect(document.body.textContent).toContain('Graph layout changed.');
  expect(
    document.querySelector('[data-zloz-history-node="changed"]')?.getAttribute('transform'),
  ).toBe('translate(0 0)');
  expect(document.querySelectorAll('[data-zloz-history-movement]')).toHaveLength(1);
  expect(document.querySelectorAll('[data-zloz-history-edge]')).toHaveLength(1);
  expect(document.querySelector('[data-zloz-history-ghosts]')?.getAttribute('aria-hidden')).toBe(
    'true',
  );
  expect(document.querySelector('[data-zloz-history-ghosts]')?.getAttribute('style')).toContain(
    'pointer-events:none',
  );
  expect(
    document.querySelectorAll('button, input, [tabindex], [data-flow-port], [data-flow-node]'),
  ).toHaveLength(0);
});

test('global, individual and minimal visibility retain choices and mode feedback', async () => {
  const ghosts = { enabled: true, nodes: false, edges: true, movements: true };
  const normal = await render(moved, { ghosts });
  expect(normal.document.querySelectorAll('[data-zloz-history-node]')).toHaveLength(0);
  expect(normal.document.querySelectorAll('[data-zloz-history-edge]')).toHaveLength(1);
  for (const options of [
    { ghosts: { ...ghosts, enabled: false } },
    { ghosts, minimalMode: true },
  ]) {
    const hidden = await render(moved, options);
    expect(hidden.document.querySelectorAll('[data-zloz-history-ghosts]')).toHaveLength(0);
    expect(hidden.document.body.textContent).toContain('Connection mode unchanged: loose.');
    expect(hidden.context.ghosts.nodes).toBe(false);
  }
  const minimal = resolveHistoryComparisonPresentationV2(before, moved, {
    ghosts,
    minimalMode: true,
  });
  expect(minimal.ghosts.enabled).toBe(true);
  expect(minimal.effectiveGhosts.enabled).toBe(false);
  expect(
    resolveHistoryComparisonPresentationV2(before, moved, { ghosts }).effectiveGhosts.enabled,
  ).toBe(true);
  expect(ghosts).toEqual({ enabled: true, nodes: false, edges: true, movements: true });
  expect(Object.isFrozen(ghosts)).toBe(false);
});

test('text, parts, layout and inert mark customization compose without overrides', async () => {
  const result = await render(
    moved,
    {
      formatMode: (change) =>
        change.kind === 'unchanged' ? `Mode ${change.mode}` : 'Mode transition',
      formatSummary: () => 'Custom summary',
    },
    {
      label: 'Custom review',
      renderSummary: (_context, h) => h.strong('Summary badge'),
      renderMode: (_context, h) => h.em('Mode badge'),
      renderLayout: (parts) => [parts.mode!, parts.summary!],
    },
    {
      renderNode: (change) =>
        new Html.Element<string>('circle').attr('data-custom-ghost', change.id),
      renderEdge: () => null,
      renderMovement: () => null,
    },
  );
  expect(result.context.modeText).toBe('Mode loose');
  expect(result.context.summaryText).toBe('Custom summary');
  expect(result.document.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe(
    'Custom review',
  );
  expect(result.document.querySelector('[role="status"]')?.textContent).toBe(
    'Mode badgeSummary badge',
  );
  expect(result.document.querySelectorAll('[data-custom-ghost="a"]')).toHaveLength(1);
  expect(
    result.document.querySelectorAll('[data-zloz-history-edge], [data-zloz-history-movement]'),
  ).toHaveLength(0);
  const omitted = await render(strict, {}, { renderMode: () => null, renderSummary: () => null });
  expect(omitted.document.querySelector('[role="status"]')?.textContent).toBe('');
  const fallback = await render(
    strict,
    { formatMode: () => ' ', formatSummary: () => '' },
    { renderMode: () => undefined },
  );
  expect(fallback.document.body.textContent).toContain(
    'Connection mode changed from loose to strict.',
  );
});

test('loose-only projection validates checkpoints and never reinterprets ports', async () => {
  const loose = {
    id: 'loose',
    name: 'Loose',
    snapshot: parseConnectionDocument(JSON.stringify(looseWire)),
  };
  const selected: ZlozEditionV2 = {
    ...loose,
    snapshot: {
      ...loose.snapshot,
      graph: {
        ...loose.snapshot.graph,
        edges: loose.snapshot.graph.edges.map((edge) => ({ ...edge, label: 'Changed label' })),
      },
    },
  };
  const result = await render(selected, {}, {}, {}, loose);
  expect(result.document.body.textContent).toContain('Graph meaning changed.');
  expect(
    result.document.querySelector('[data-zloz-history-edge]')?.getAttribute('data-zloz-history-id'),
  ).toBe('orders-billing');
  expect(result.context.comparison.baseline.snapshot.graph.nodes[0]?.ports[0]?.kind).toBe('input');
  expect(() =>
    resolveHistoryComparisonPresentationV2(loose, {
      ...loose,
      snapshot: { ...loose.snapshot, connectionMode: 'strict' },
    }),
  ).toThrow();
  expect(Object.isFrozen(result.context)).toBe(true);
  expect(Object.isFrozen(result.context.ghosts)).toBe(true);
  expect(Object.isFrozen(result.context.effectiveGhosts)).toBe(true);
});

test('names render as escaped text; camera-only differences do not claim graph changes', async () => {
  const selected = {
    ...before,
    name: '<script>bad()</script>',
    snapshot: { ...before.snapshot, viewport: { x: 42, y: 50, zoom: 2 } },
  };
  const result = await render(selected);
  expect(result.document.querySelectorAll('script')).toHaveLength(0);
  expect(result.document.body.textContent).toContain(
    '<script>bad()</script> compared with First. No node or edge changes.',
  );
  expect(result.context.comparison.semanticChanged).toBe(false);
  expect(result.context.comparison.layoutChanged).toBe(false);
});

test('baseline display draws the compared selected geometry and reverses movement without reversing semantic status', async () => {
  const result = await render(moved, { displaySide: 'baseline' });
  expect(
    result.document.querySelector('[data-zloz-history-node="changed"]')?.getAttribute('transform'),
  ).toBe('translate(80 60)');
  expect(result.document.body.textContent).toContain('Compared: A');
  expect(result.context.comparison.baseline.id).toBe(before.id);
  expect(result.context.comparison.selected.id).toBe(moved.id);
  expect(result.context.displaySide).toBe('baseline');
});

test('baseline ghosts retain chronological added/removed meaning while using the other side geometry', async () => {
  const selected = {
    ...moved,
    snapshot: {
      ...moved.snapshot,
      graph: {
        ...moved.snapshot.graph,
        nodes: [
          ...moved.snapshot.graph.nodes,
          { ...moved.snapshot.graph.nodes[0]!, id: 'c', ports: [] },
        ],
      },
    },
  };
  const result = await render(selected, { displaySide: 'baseline' });
  expect(result.document.querySelectorAll('[data-zloz-history-node="added"]')).toHaveLength(1);
  expect(result.document.querySelectorAll('[data-zloz-history-node="removed"]')).toHaveLength(0);
});
