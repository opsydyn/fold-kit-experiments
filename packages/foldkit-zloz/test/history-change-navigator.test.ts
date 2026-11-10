import { expect, test } from 'bun:test';

import {
  captureEdition,
  compareEditions,
  resolveHistoryChangeNavigator,
  resolveHistoryChangeFocus,
  type ZlozNode,
} from '../src/index';
const node = (id: string, x: number): ZlozNode => ({
  id,
  label: id,
  position: { x, y: 0 },
  size: { width: 100, height: 80 },
  ports: [
    { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
    { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
  ],
});
const before = captureEdition({
  id: 'before',
  name: 'Original',
  snapshot: {
    graph: {
      nodes: [node('link', 0), node('removed', 2000)],
      edges: [
        {
          id: 'link',
          source: { node: 'link', port: 'out' },
          target: { node: 'removed', port: 'in' },
        },
      ],
    },
  },
});
const after = captureEdition({
  id: 'after',
  name: 'Evolved',
  snapshot: {
    graph: { nodes: [{ ...node('link', 500), label: 'Changed' }, node('added', 900)], edges: [] },
  },
});
const comparison = compareEditions(before, after);
test('kind filters preserve stable entity identity, labels and the source comparison', () => {
  const context = resolveHistoryChangeNavigator(comparison);
  expect(context.entries.map((entry) => [entry.entity, entry.id, entry.kind])).toEqual([
    ['node', 'added', 'added'],
    ['node', 'link', 'changed'],
    ['node', 'removed', 'removed'],
    ['edge', 'link', 'removed'],
  ]);
  expect(context.filters.removed.count).toBe(2);
  const filtered = resolveHistoryChangeNavigator(comparison, {
    filters: { added: false, changed: false },
  });
  expect(filtered.entries.map((entry) => entry.entity)).toEqual(['node', 'edge']);
  expect(filtered.total).toBe(4);
  expect(
    resolveHistoryChangeNavigator(comparison, {
      filters: { added: false, removed: false, changed: false },
    }).statusText,
  ).toContain('No changes match');
  expect(comparison.nodes).toHaveLength(3);
});
test('explicit focus resolves selected reveal events and baseline-only removed geometry', () => {
  const entries = resolveHistoryChangeNavigator(comparison).entries;
  const changed = entries.find((entry) => entry.kind === 'changed');
  const removed = entries.find((entry) => entry.id === 'removed');
  const edge = entries.find((entry) => entry.entity === 'edge');
  if (!changed || !removed || !edge) throw new Error('Missing fixture changes');
  const current = resolveHistoryChangeFocus(comparison, changed.request);
  expect(current.type).toBe('ready');
  if (current.type === 'ready')
    expect(current.target).toEqual({
      side: 'selected',
      editionId: 'after',
      event: { type: 'NodeRevealRequested', id: 'link' },
    });
  const earlier = resolveHistoryChangeFocus(comparison, removed.request);
  if (earlier.type !== 'ready' || earlier.target.side !== 'baseline')
    throw new Error('Missing earlier geometry');
  expect(earlier.target.nodes.map((value) => value.position.x)).toEqual([2000]);
  const connection = resolveHistoryChangeFocus(comparison, edge.request);
  if (connection.type !== 'ready' || connection.target.side !== 'baseline')
    throw new Error('Missing endpoint geometry');
  expect(connection.target.nodes.map((value) => value.id)).toEqual(['link', 'removed']);
});
test('stale identity, hidden entries and current policy veto old requests without side effects', () => {
  const entry = resolveHistoryChangeNavigator(comparison).entries[0];
  if (!entry) throw new Error('Missing fixture');
  expect(resolveHistoryChangeFocus(comparison, { ...entry.request, baselineId: 'other' })).toEqual({
    type: 'ignored',
  });
  expect(resolveHistoryChangeFocus(comparison, { ...entry.request, id: 'missing' })).toEqual({
    type: 'ignored',
  });
  expect(
    resolveHistoryChangeFocus(comparison, entry.request, { filters: { added: false } }),
  ).toEqual({ type: 'ignored' });
  expect(resolveHistoryChangeFocus(comparison, entry.request, { blockedReason: 'Busy' })).toEqual({
    type: 'blocked',
    reason: 'Busy',
  });
  expect(
    resolveHistoryChangeFocus(comparison, entry.request, { focusReason: () => 'Protected view' }),
  ).toEqual({ type: 'blocked', reason: 'Protected view' });
  expect(
    resolveHistoryChangeNavigator(comparison, { blockedReason: ' ' }).entries[0]?.reason?.length,
  ).toBeGreaterThan(0);
  expect(resolveHistoryChangeFocus(null, entry.request)).toEqual({ type: 'ignored' });
  expect(resolveHistoryChangeNavigator(null).entries).toEqual([]);
  expect(resolveHistoryChangeNavigator(compareEditions(before, before)).statusText).toContain(
    'No changes between',
  );
});

test('current edge focus uses the edge namespace and customizable labels preserve identity', () => {
  const selected = captureEdition({
    ...after,
    snapshot: {
      graph: {
        ...after.snapshot.graph,
        edges: [
          {
            id: 'link',
            source: { node: 'link', port: 'out' },
            target: { node: 'added', port: 'in' },
            label: 'Connects',
          },
        ],
      },
    },
  });
  const diff = compareEditions(before, selected);
  const context = resolveHistoryChangeNavigator(diff, {
    labelChange: (item) => `${item.entity} ${item.change.id}`,
    filterLabels: { changed: 'Updated' },
  });
  const edge = context.entries.find((entry) => entry.entity === 'edge');
  if (!edge) throw new Error('Missing edge');
  expect(context.filters.changed.label).toBe('Updated');
  expect(edge.label).toBe('edge link');
  const decision = resolveHistoryChangeFocus(diff, edge.request);
  if (decision.type !== 'ready') throw new Error('Missing current focus');
  expect(decision.target).toEqual({
    side: 'selected',
    editionId: 'after',
    event: { type: 'EdgeRevealRequested', id: 'link' },
  });
  expect(context.entries.filter((entry) => entry.id === 'link')).toHaveLength(2);
});
