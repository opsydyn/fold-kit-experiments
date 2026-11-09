import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  createEventStormingPattern,
  resolveAuditComparisonControls,
  resolveAuditComparisonRequest,
  type ZlozAuditComparisonState,
  type ZlozModelDocument,
} from '../src/index';

function fixture(): ZlozModelDocument {
  const graph = createEventStormingPattern(),
    first = graph.edges[0];
  assert(first);
  const bad = {
    ...first,
    architecture: { family: 'event-storming' as const, role: 'emits' as const },
  };
  return {
    id: 'model',
    name: 'Model',
    origin: null,
    snapshot: {
      graph: {
        ...graph,
        edges: [
          { ...bad, id: 'new' },
          { ...bad, id: 'keep' },
        ],
      },
    },
    editions: [
      {
        id: 'before',
        name: 'Before',
        snapshot: {
          graph: {
            ...graph,
            edges: [
              { ...bad, id: 'gone' },
              { ...bad, id: 'keep' },
            ],
          },
        },
      },
    ],
  };
}
const state: ZlozAuditComparisonState = {
  baselineId: 'before',
  selectedId: null,
  filters: { introduced: true, resolved: true, persisting: true },
};

test('headless controls retain selection and filter by category without changing the comparison', () => {
  const document = fixture();
  const context = resolveAuditComparisonControls(document, state);
  expect(
    context.entries.map((entry) => [entry.kind, entry.finding.edgeId, entry.source.kind]),
  ).toEqual([
    ['introduced', 'new', 'current'],
    ['resolved', 'gone', 'edition'],
    ['persisting', 'keep', 'current'],
  ]);
  expect(context.filters.resolved.count).toBe(1);
  const toggled = resolveAuditComparisonRequest(document, state, {
    type: 'FilterToggled',
    kind: 'introduced',
  });
  assert(toggled.type === 'ready');
  const filtered = resolveAuditComparisonControls(document, toggled.state);
  expect(filtered.entries.map((entry) => entry.kind)).toEqual(['resolved', 'persisting']);
  expect(filtered.comparison?.summary).toEqual(context.comparison?.summary);
  expect(resolveAuditComparisonControls(document, { ...state, baselineId: null }).reason).toContain(
    'Choose a baseline',
  );
  expect(
    resolveAuditComparisonControls(document, { ...state, selectedId: 'missing' }).reason,
  ).toContain('unavailable');
  expect(
    resolveAuditComparisonRequest(document, state, { type: 'TargetSelected', editionId: 'missing' })
      .type,
  ).toBe('ignored');
  expect(
    resolveAuditComparisonRequest(document, state, {
      type: 'BaselineSelected',
      editionId: 'missing',
    }).type,
  ).toBe('ignored');
  const cleared = resolveAuditComparisonRequest(document, state, {
    type: 'BaselineSelected',
    editionId: null,
  });
  assert(cleared.type === 'ready');
  expect(cleared.state.baselineId).toBeNull();
});

test('finding focus routes resolved findings to baseline and others to target without restoring data', () => {
  const document = fixture();
  const context = resolveAuditComparisonControls(document, state);
  for (const entry of context.entries) {
    const result = resolveAuditComparisonRequest(document, state, entry.request);
    assert(result.type === 'focus');
    expect(result.event).toEqual({ type: 'EdgeRevealRequested', id: entry.finding.edgeId });
    expect(result.source).toEqual(
      entry.kind === 'resolved'
        ? { kind: 'edition', id: 'before', name: 'Before' }
        : { kind: 'current' },
    );
  }
  const archived = {
    ...document,
    editions: [...document.editions, { id: 'after', name: 'After', snapshot: document.snapshot }],
  };
  const targetState = { ...state, selectedId: 'after' };
  const entry = resolveAuditComparisonControls(archived, targetState).entries[0];
  assert(entry);
  const result = resolveAuditComparisonRequest(archived, targetState, entry.request);
  assert(result.type === 'focus');
  expect(result.source).toEqual({ kind: 'edition', id: 'after', name: 'After' });
});

test('focus rechecks model, comparison, code, category, filters and current compatibility', () => {
  const document = fixture(),
    entry = resolveAuditComparisonControls(document, state).entries[0];
  assert(entry);
  for (const request of [
    { ...entry.request, modelId: 'other' },
    { ...entry.request, baselineId: 'other' },
    { ...entry.request, selectedId: 'other' },
    { ...entry.request, code: 'unknown-relationship' as const },
    { ...entry.request, kind: 'resolved' as const },
    { ...entry.request, edgeId: 'absent' },
  ])
    expect(resolveAuditComparisonRequest(document, state, request).type).toBe('ignored');
  expect(
    resolveAuditComparisonRequest(
      document,
      { ...state, filters: { ...state.filters, introduced: false } },
      entry.request,
    ).type,
  ).toBe('ignored');
  const repaired = { ...document, snapshot: { graph: { ...document.snapshot.graph, edges: [] } } };
  expect(resolveAuditComparisonRequest(repaired, state, entry.request).type).toBe('ignored');
  const options = { blockedReason: 'Busy' };
  expect(
    resolveAuditComparisonControls(document, state, options).entries.every(
      (entry) => entry.reason === 'Busy',
    ),
  ).toBe(true);
  expect(resolveAuditComparisonRequest(document, state, entry.request, options)).toEqual({
    type: 'blocked',
    reason: 'Busy',
  });
  const protectedOptions = { focusReason: () => 'Protected finding' };
  expect(resolveAuditComparisonRequest(document, state, entry.request, protectedOptions)).toEqual({
    type: 'blocked',
    reason: 'Protected finding',
  });
});
