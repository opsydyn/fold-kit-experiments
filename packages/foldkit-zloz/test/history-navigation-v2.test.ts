import { expect, test } from 'bun:test';

import {
  compareEditionsV2,
  parseConnectionDocument,
  parseModelDocumentV2,
  createModelEditorV2,
  createHistoryReviewV2,
  updateHistoryReviewV2,
  updateEditor,
  resolveHistoryChangeNavigatorV2,
  resolveHistoryChangeFocusV2,
  resolveHistoryChangeStepV2,
  type ZlozEditionV2,
  type ZlozHistoryComparisonSideV2,
} from '../src';
import looseWire from './fixtures/connection-v2-loose.json';
import wire from './fixtures/model-v2-modes.json';

const document = parseModelDocumentV2(JSON.stringify(wire));
const seed = document.editions[0]!;
const a = seed.snapshot.graph.nodes[0]!;
const b = seed.snapshot.graph.nodes[1]!;
const before: ZlozEditionV2 = {
  ...seed,
  snapshot: {
    ...seed.snapshot,
    graph: {
      nodes: [a, b, { ...b, id: 'old' }],
      edges: [
        ...seed.snapshot.graph.edges,
        {
          id: 'removed-edge',
          source: { node: 'a', port: 'out' },
          target: { node: 'old', port: 'in' },
        },
      ],
    },
  },
};
const after: ZlozEditionV2 = {
  ...seed,
  id: 'next',
  name: 'Next',
  snapshot: {
    ...seed.snapshot,
    connectionMode: 'strict',
    graph: {
      nodes: [{ ...a, label: 'Revised', position: { x: 1200, y: 0 } }, b, { ...b, id: 'mode' }],
      edges: [
        ...seed.snapshot.graph.edges,
        {
          id: 'added-edge',
          source: { node: 'a', port: 'out' },
          target: { node: 'mode', port: 'in' },
        },
      ],
    },
  },
};
const comparison = compareEditionsV2(before, after);
const context = (side: ZlozHistoryComparisonSideV2 = 'selected') =>
  resolveHistoryChangeNavigatorV2(comparison, side);
const entry = (entity: 'mode' | 'node' | 'edge', id?: string) => {
  const value = context().entries.find(
    (item) => item.entity === entity && (item.entity === 'mode' || item.id === id),
  );
  if (!value) throw new Error('Missing fixture entry');
  return value;
};

test('mode-only transitions have one explicit changed entry without a fake graph ID', () => {
  for (const [baseline, selected] of [
    [before, { ...before, snapshot: { ...before.snapshot, connectionMode: 'strict' as const } }],
    [{ ...before, snapshot: { ...before.snapshot, connectionMode: 'strict' as const } }, before],
  ] as const) {
    const diff = compareEditionsV2(baseline, selected);
    const nav = resolveHistoryChangeNavigatorV2(diff, 'baseline');
    expect(nav.total).toBe(1);
    expect(nav.entries).toHaveLength(1);
    expect(nav.entries[0]?.entity).toBe('mode');
    expect(nav.entries[0]?.kind).toBe('changed');
    expect(nav.entries[0]?.semanticChanged).toBe(true);
    expect(nav.entries[0]?.layoutChanged).toBe(false);
    expect('id' in nav.entries[0]!).toBe(false);
    expect('id' in nav.entries[0]!.request).toBe(false);
    expect(nav.filters.changed.count).toBe(1);
    expect(
      resolveHistoryChangeNavigatorV2(diff, 'baseline', { filters: { changed: false } }).entries,
    ).toHaveLength(0);
  }
  expect(resolveHistoryChangeNavigatorV2(compareEditionsV2(before, before), 'baseline').total).toBe(
    0,
  );
});

test('stable entity namespaces, ordering and filters include mode without colliding with a node ID', () => {
  expect(
    context().entries.map((item) => (item.entity === 'mode' ? ['mode'] : [item.entity, item.id])),
  ).toEqual([
    ['mode'],
    ['node', 'a'],
    ['node', 'mode'],
    ['node', 'old'],
    ['edge', 'added-edge'],
    ['edge', 'e'],
    ['edge', 'removed-edge'],
  ]);
  expect(context().total).toBe(7);
  expect(context().filters.changed.count).toBe(3);
  expect(
    resolveHistoryChangeNavigatorV2(comparison, 'selected', {
      filters: { added: false, removed: false },
    }).entries.map((item) => item.entity),
  ).toEqual(['mode', 'node', 'edge']);
  expect(Object.isFrozen(context())).toBe(true);
  expect(Object.isFrozen(context().entries[0]?.request)).toBe(true);
});

test('focus preserves the chosen side and returns mode details without a reveal event', () => {
  for (const side of ['baseline', 'selected'] as const) {
    const result = resolveHistoryChangeFocusV2(comparison, side, entry('mode').request);
    if (result.type !== 'ready') throw new Error('Mode unavailable');
    expect(result.target).toEqual({
      type: 'mode',
      side,
      editionId: side === 'baseline' ? 'first' : 'next',
      connectionMode: side === 'baseline' ? 'loose' : 'strict',
    });
    expect('event' in result.target).toBe(false);
    const graph = resolveHistoryChangeFocusV2(comparison, side, entry('node', 'a').request);
    if (graph.type !== 'ready') throw new Error('Node unavailable');
    expect(graph.target).toEqual({
      type: 'graph',
      side,
      editionId: side === 'baseline' ? 'first' : 'next',
      connectionMode: side === 'baseline' ? 'loose' : 'strict',
      event: { type: 'NodeRevealRequested', id: 'a' },
    });
  }
});

test('absent nodes and edges stay visible with reasons, never falling back to the other side', () => {
  for (const [side, kind] of [
    ['baseline', 'added'],
    ['selected', 'removed'],
  ] as const) {
    const entries = context(side).entries.filter((item) => item.kind === kind);
    expect(entries).toHaveLength(2);
    for (const item of entries) {
      expect(item.reason).toContain(`absent from the ${side} edition`);
      expect(resolveHistoryChangeFocusV2(comparison, side, item.request).type).toBe('blocked');
    }
  }
});

test('Previous/Next preserve side, include mode, do not wrap or skip unavailable candidates', () => {
  for (const side of ['baseline', 'selected'] as const) {
    const first = resolveHistoryChangeStepV2(comparison, side, null, 'next');
    if (first.type !== 'ready') throw new Error('No first change');
    expect(first.entry.entity).toBe('mode');
    expect(first.target.side).toBe(side);
    const next = resolveHistoryChangeStepV2(comparison, side, first.entry.request, 'next');
    if (next.type !== 'ready') throw new Error('No node change');
    expect(next.target.side).toBe(side);
    expect(next.entry.entity).toBe('node');
    expect(resolveHistoryChangeStepV2(comparison, side, next.entry.request, 'previous')).toEqual(
      first,
    );
    expect(resolveHistoryChangeStepV2(comparison, side, first.entry.request, 'previous').type).toBe(
      'blocked',
    );
  }
  expect(
    resolveHistoryChangeStepV2(comparison, 'baseline', entry('node', 'a').request, 'next').type,
  ).toBe('blocked');
  const added = resolveHistoryChangeStepV2(
    comparison,
    'selected',
    entry('node', 'a').request,
    'next',
  );
  if (added.type !== 'ready' || added.entry.entity !== 'node') throw new Error('No added node');
  expect(added.entry.id).toBe('mode');
  expect(
    resolveHistoryChangeStepV2(
      comparison,
      'selected',
      entry('edge', 'removed-edge').request,
      'next',
    ).type,
  ).toBe('blocked');
  expect(resolveHistoryChangeStepV2(comparison, 'selected', null, 'previous').type).toBe('blocked');
});

test('live scopes, filters, membership and host vetoes revalidate old requests and cursors', () => {
  const request = entry('mode').request;
  expect(resolveHistoryChangeFocusV2(null, 'selected', request).type).toBe('ignored');
  expect(
    resolveHistoryChangeFocusV2(comparison, 'selected', { ...request, selectedId: 'stale' }).type,
  ).toBe('ignored');
  expect(
    resolveHistoryChangeStepV2(comparison, 'selected', { ...request, baselineId: 'stale' }, 'next')
      .type,
  ).toBe('ignored');
  expect(
    resolveHistoryChangeFocusV2(comparison, 'selected', request, { filters: { changed: false } })
      .type,
  ).toBe('ignored');
  expect(
    resolveHistoryChangeStepV2(comparison, 'selected', request, 'next', {
      filters: { changed: false },
    }).type,
  ).toBe('ignored');
  let locked = false;
  const options = { focusReason: () => (locked ? 'Review locked' : null) };
  expect(resolveHistoryChangeFocusV2(comparison, 'baseline', request, options).type).toBe('ready');
  locked = true;
  expect(resolveHistoryChangeFocusV2(comparison, 'baseline', request, options)).toEqual({
    type: 'blocked',
    reason: 'Review locked',
  });
  expect(resolveHistoryChangeStepV2(comparison, 'baseline', null, 'next', options)).toEqual({
    type: 'blocked',
    reason: 'Review locked',
  });
  const denied = resolveHistoryChangeFocusV2(comparison, 'selected', request, {
    blockedReason: ' ',
  });
  expect(denied.type).toBe('blocked');
  if (denied.type === 'blocked') expect(denied.reason.length).toBeGreaterThan(0);
  expect(resolveHistoryChangeNavigatorV2(null, 'selected').entries).toHaveLength(0);
});

test('chosen-side reveal composes into independent read-only reviews without changing working history', () => {
  const present = updateEditor(createModelEditorV2(document), {
    type: 'SurfaceMeasured',
    size: { width: 800, height: 440 },
  });
  const working = updateEditor(present, { type: 'NodeLabelChanged', id: 'a', label: 'Working' });
  for (const side of ['baseline', 'selected'] as const) {
    const checkpoint = side === 'baseline' ? comparison.baseline : comparison.selected;
    const review = createHistoryReviewV2(checkpoint, working);
    const result = resolveHistoryChangeFocusV2(comparison, side, entry('node', 'a').request);
    if (result.type !== 'ready' || result.target.type !== 'graph')
      throw new Error('No graph target');
    const focused = updateHistoryReviewV2(review, result.target.event);
    expect(focused.edition).toBe(review.edition);
    expect(focused.editor.connectionMode).toBe(checkpoint.snapshot.connectionMode);
    expect(focused.editor.selectedNodes).toEqual(review.editor.selectedNodes);
    expect(focused.editor.notice).toBe(
      `Revealed ${checkpoint.snapshot.graph.nodes.find((node) => node.id === 'a')!.label}.`,
    );
    expect(focused.editor.past).toHaveLength(0);
    expect(focused.editor.future).toHaveLength(0);
    expect(focused.editor.readOnly).toBe(true);
  }
  expect(working.graph.nodes[0]?.label).toBe('Working');
  expect(working.past).toHaveLength(1);
  expect(working.connectionMode).toBe('strict');
});

test('actual loose-only edges and reversed comparisons retain their chosen checkpoint mode', () => {
  const loose = {
    id: 'loose',
    name: 'Loose',
    snapshot: parseConnectionDocument(JSON.stringify(looseWire)),
  };
  const selected = {
    ...loose,
    snapshot: {
      ...loose.snapshot,
      graph: {
        ...loose.snapshot.graph,
        edges: loose.snapshot.graph.edges.map((edge) => ({ ...edge, label: 'Changed' })),
      },
    },
  };
  const diff = compareEditionsV2(loose, selected);
  const item = resolveHistoryChangeNavigatorV2(diff, 'baseline').entries[0]!;
  const result = resolveHistoryChangeFocusV2(diff, 'baseline', item.request);
  if (result.type !== 'ready') throw new Error('Loose edge unavailable');
  expect(result.target).toEqual({
    type: 'graph',
    side: 'baseline',
    editionId: 'loose',
    connectionMode: 'loose',
    event: { type: 'EdgeRevealRequested', id: 'orders-billing' },
  });
  const reversed = compareEditionsV2(after, before);
  for (const side of ['baseline', 'selected'] as const) {
    const mode = resolveHistoryChangeStepV2(reversed, side, null, 'next');
    if (mode.type !== 'ready') throw new Error('Reversed mode unavailable');
    expect(mode.target.connectionMode).toBe(side === 'baseline' ? 'strict' : 'loose');
    expect(mode.target.editionId).toBe(side === 'baseline' ? 'next' : 'first');
  }
});
