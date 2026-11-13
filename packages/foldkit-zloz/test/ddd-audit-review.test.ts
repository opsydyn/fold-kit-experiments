import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  compareModelDddRelationships,
  parseModelDocument,
  serializeModelDocument,
  resolveDddAuditControls,
  resolveDddAuditRequest,
  dddRelationshipRules,
  type ZlozDddAuditState,
} from '../src/index';
import wire from './fixtures/ddd-review-model.json';
const fixture = () => parseModelDocument(JSON.stringify(wire));
const state: ZlozDddAuditState = {
  baselineId: 'ddd-before',
  selectedId: 'ddd-after',
  filters: { introduced: true, resolved: true, persisting: true },
};
test('DDD edition comparison has exact deterministic deltas, current/owned targets and detached projections', () => {
  const model = fixture(),
    original = serializeModelDocument(model);
  const result = compareModelDddRelationships(model, { baselineId: 'ddd-before' });
  assert(result.type === 'compared');
  const c = result.comparison;
  expect(c.status).toBe('regressed');
  expect(c.summary).toEqual({ introduced: 2, resolved: 3, persisting: 1 });
  expect(c.introduced.map((e) => [e.edgeId, e.code])).toEqual([
    ['new', 'unknown-relationship'],
    ['recoded', 'unknown-relationship'],
  ]);
  expect(c.resolved.map((e) => [e.edgeId, e.code])).toEqual([
    ['fixed', 'incompatible-roles'],
    ['recoded', 'incompatible-roles'],
    ['removed', 'same-context'],
  ]);
  expect(c.persisting.map((e) => [e.before.edgeLabel, e.after.edgeLabel])).toEqual([
    ['Outstanding emission', 'Still outstanding'],
  ]);
  expect(c.selected.source).toEqual({ kind: 'current' });
  expect(c.selected.audit.status).toBe('incompatible');
  const same = compareModelDddRelationships(model, {
    baselineId: 'ddd-before',
    selectedId: 'ddd-before',
  });
  assert(same.type === 'compared');
  expect(same.comparison.status).toBe('no-new-findings');
  expect(same.comparison.summary).toEqual({ introduced: 0, resolved: 0, persisting: 4 });
  expect(same.comparison.selected.audit.status).toBe('incompatible');
  const archived = compareModelDddRelationships(
    { ...model, snapshot: { graph: { nodes: [], edges: [] } } },
    { baselineId: 'ddd-before', selectedId: 'ddd-after' },
  );
  assert(archived.type === 'compared');
  expect(archived.comparison.summary).toEqual(c.summary);
  const reverse = compareModelDddRelationships(model, {
    baselineId: 'ddd-after',
    selectedId: 'ddd-before',
  });
  assert(reverse.type === 'compared');
  expect(reverse.comparison.summary).toEqual({ introduced: 3, resolved: 2, persisting: 1 });
  expect(
    compareModelDddRelationships(
      {
        ...model,
        snapshot: {
          graph: { ...model.snapshot.graph, edges: [...model.snapshot.graph.edges].reverse() },
        },
        editions: [...model.editions].reverse(),
      },
      { baselineId: 'ddd-before' },
    ),
  ).toEqual(result);
  expect(c.introduced[0]?.source).not.toBe(model.snapshot.graph.edges[2]?.source);
  expect(serializeModelDocument(model)).toBe(original);
});
test('DDD selectors reject rather than falling back, and one validated custom catalogue applies to both sides', () => {
  const model = fixture();
  expect(compareModelDddRelationships(model, { baselineId: 'missing' })).toMatchObject({
    type: 'blocked',
    code: 'unknown-baseline',
  });
  expect(
    compareModelDddRelationships(model, { baselineId: 'ddd-before', selectedId: 'missing' }),
  ).toMatchObject({ type: 'blocked', code: 'unknown-edition' });
  const first = model.editions[0];
  assert(first);
  expect(
    compareModelDddRelationships(
      {
        ...model,
        editions: [],
        origin: { modelId: 'parent', modelName: 'Parent', edition: first },
      },
      { baselineId: first.id },
    ).type,
  ).toBe('blocked');
  const custom = compareModelDddRelationships(
    model,
    { baselineId: 'ddd-before' },
    {
      rules: [
        ...dddRelationshipRules,
        {
          architecture: { family: 'ddd', scope: 'tactical', role: 'custom', name: 'enriches' },
          sources: ['aggregate-root'],
          targets: ['domain-event'],
          label: 'Enriches',
          direction: 'directed',
        },
      ],
    },
  );
  assert(custom.type === 'compared');
  expect(custom.comparison.summary).toEqual({ introduced: 0, resolved: 3, persisting: 1 });
  const rule = dddRelationshipRules[0];
  assert(rule);
  expect(() =>
    compareModelDddRelationships(model, { baselineId: 'missing' }, { rules: [rule, rule] }),
  ).toThrow();
});
test('DDD review supports standalone current or edition findings, filters, labels and node/edge reveal requests without edits', () => {
  const model = fixture(),
    original = serializeModelDocument(model);
  const single = resolveDddAuditControls(model, { ...state, baselineId: null, selectedId: null });
  expect(single.comparison).toBeNull();
  expect(single.audit?.summary).toEqual({ edges: 4, typed: 1, unrelated: 0, blocked: 3 });
  expect(single.entries.map((e) => [e.kind, e.finding.edgeId])).toEqual([
    ['current', 'keep'],
    ['current', 'new'],
    ['current', 'recoded'],
  ]);
  const context = resolveDddAuditControls(model, state, {
    labelFinding: (item) => `DDD ${item.finding.edgeId}`,
  });
  expect(context.entries).toHaveLength(6);
  const resolved = context.entries.find(
    (e) => e.kind === 'resolved' && e.finding.edgeId === 'removed',
  );
  assert(resolved);
  for (const subject of ['edge', 'source', 'target'] as const) {
    const request = { ...resolved.request, subject };
    const result = resolveDddAuditRequest(model, state, request);
    assert(result.type === 'focus');
    expect(result.source).toMatchObject({ kind: 'edition', id: 'ddd-before' });
    expect(result.event).toEqual(
      subject === 'edge'
        ? { type: 'EdgeRevealRequested', id: 'removed' }
        : { type: 'NodeRevealRequested', id: 'left' },
    );
  }
  expect(resolved.label).toBe('DDD removed');
  expect(serializeModelDocument(model)).toBe(original);
});
test('DDD navigation rechecks selection, model, exact finding, filters and live policy', () => {
  const model = fixture(),
    context = resolveDddAuditControls(model, state);
  const entry = context.entries.find((e) => e.kind === 'introduced');
  assert(entry);
  for (const request of [
    { ...entry.request, modelId: 'other' },
    { ...entry.request, selectedId: null },
    { ...entry.request, token: 'old' },
  ])
    expect(resolveDddAuditRequest(model, state, request)).toEqual({ type: 'ignored' });
  expect(
    resolveDddAuditRequest(
      model,
      { ...state, filters: { ...state.filters, introduced: false } },
      entry.request,
    ),
  ).toEqual({ type: 'ignored' });
  const changed = {
    ...model,
    editions: model.editions.map((e) =>
      e.id !== 'ddd-after'
        ? e
        : {
            ...e,
            snapshot: {
              graph: {
                ...e.snapshot.graph,
                edges: e.snapshot.graph.edges.map((edge) => ({ ...edge, label: 'changed' })),
              },
            },
          },
    ),
  };
  expect(resolveDddAuditRequest(changed, state, entry.request)).toEqual({ type: 'ignored' });
  expect(
    resolveDddAuditRequest(model, state, entry.request, { blockedReason: 'Read review locked' }),
  ).toEqual({ type: 'blocked', reason: 'Read review locked' });
  expect(
    resolveDddAuditRequest(model, state, entry.request, {
      focusReason: () => 'Protected navigation',
    }),
  ).toEqual({ type: 'blocked', reason: 'Protected navigation' });
  expect(
    resolveDddAuditRequest(model, state, { type: 'TargetSelected', editionId: 'missing' }),
  ).toEqual({ type: 'ignored' });
  expect(resolveDddAuditControls(model, { ...state, selectedId: 'missing' })).toMatchObject({
    audit: null,
    entries: [],
    reason: 'The selected edition is unavailable in this model.',
  });
});
