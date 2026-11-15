import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createEditor,
  updateEditor,
  updateHistoryReview,
  type EditorState,
} from '@opsydyn/foldkit-zloz';

import {
  projectAlchemyDescriptor,
  alchemySourceId,
  resolveAlchemyFindingNavigator,
  resolveAlchemyFindingReveal,
} from '../src/index';
import type { AlchemyProjection } from '../src/types';
const raw = () => JSON.parse(readFileSync(new URL('fixtures/bank.json', import.meta.url), 'utf8'));
function projection() {
  const result = projectAlchemyDescriptor(raw());
  assert(result.type === 'reviewable');
  return result;
}
const scope = { scope: 'review/1' };
const ledger = 'example%2Fbank/Bank/stream/Ledger';
const model = 'example%2Fbank/Bank/model/Bank';
const relation =
  '["entry-type","example%2Fbank/Bank/event/MoneyDeposited","example%2Fbank/Bank/stream/Ledger"]';
function measured(p: Extract<AlchemyProjection, { type: 'reviewable' }>): EditorState {
  return updateEditor(createEditor(p.graph, { readOnly: true }), {
    type: 'SurfaceMeasured',
    size: { width: 900, height: 600 },
  });
}
test('findings resolve native node and relation recipes, select exactly one target and reveal collapsed descendants without graph/Undo changes', () => {
  const p = projection(),
    editor: EditorState = {
      ...measured(p),
      collapsedGroups: [model],
      visibility: { hiddenNodeIds: ['example%2Fbank/Bank/command/GrantBonus'] },
    };
  const entries = resolveAlchemyFindingNavigator(p, editor, scope).entries;
  expect(entries).toHaveLength(9);
  const node = entries.find((e) => e.finding.sourceId === ledger),
    edge = entries.find((e) => e.finding.sourceId === relation);
  assert(node?.request && edge?.request);
  expect(node.label).toBe('Ledger (stream)');
  expect(edge.label).toBe('entry-type: MoneyDeposited → Ledger');
  expect(node.reason).toBeNull();
  const decision = resolveAlchemyFindingReveal(p, editor, edge.request, scope);
  assert(decision.type === 'ready');
  expect(decision.target).toEqual({ entity: 'edge', id: relation });
  expect(decision.events).toEqual([
    { type: 'SelectionCleared' },
    { type: 'EdgeRevealRequested', id: relation },
    { type: 'EdgeSelected', id: relation, additive: false },
  ]);
  let review = { editionId: 'preview', editor };
  for (const input of decision.events) review = updateHistoryReview(review, input);
  expect(review.editor.selectedEdges).toEqual([relation]);
  expect(review.editor.selectedNodes).toEqual([]);
  expect(review.editor.collapsedGroups).toEqual([]);
  expect(review.editor.graph).toBe(editor.graph);
  expect(review.editor.past).toBe(editor.past);
  expect(review.editor.future).toBe(editor.future);
  const next = resolveAlchemyFindingReveal(p, review.editor, node.request, scope);
  assert(next.type === 'ready');
  for (const input of next.events) review = updateHistoryReview(review, input);
  expect(review.editor.selectedNodes).toEqual([ledger]);
  expect(review.editor.selectedEdges).toEqual([]);
  expect(review.editor.graph).toBe(editor.graph);
  expect(editor.collapsedGroups).toEqual([model]);
});
test('scope and full canonical source identity reject stale and forged requests, including changed content under the same revision', () => {
  const p = projection(),
    editor = measured(p),
    request = resolveAlchemyFindingNavigator(p, editor, scope).entries[0]?.request;
  assert(request);
  expect(resolveAlchemyFindingReveal(p, editor, request, { scope: 'review/2' }).type).toBe(
    'blocked',
  );
  expect(resolveAlchemyFindingReveal(p, editor, { ...request, code: 'forged' }, scope).type).toBe(
    'blocked',
  );
  expect(resolveAlchemyFindingReveal(p, editor, { ...request, sourceId: ledger }, scope).type).toBe(
    'blocked',
  );
  const changed = raw();
  changed.source.revision = 'next';
  const other = projectAlchemyDescriptor(changed);
  assert(other.type === 'reviewable');
  expect(resolveAlchemyFindingReveal(other, measured(other), request, scope).type).toBe('blocked');
  const edited = raw();
  edited.relations = edited.relations.filter((r: { kind: string }) => r.kind !== 'entry-type');
  const sameRevision = projectAlchemyDescriptor(edited);
  assert(sameRevision.type === 'reviewable');
  expect(sameRevision.source.source.revision).toBe(p.source.source.revision);
  expect(
    resolveAlchemyFindingReveal(sameRevision, measured(sameRevision), request, scope).type,
  ).toBe('blocked');
  const aliased = projectAlchemyDescriptor({
    ...p.source,
    declarations: p.source.declarations.map((d) =>
      d.id === ledger
        ? {
            ...d,
            name: 'AccountingLedger',
            locator: alchemySourceId('example/bank', 'Bank', 'stream', 'AccountingLedger'),
          }
        : d,
    ),
  });
  assert(aliased.type === 'reviewable');
  const aliasEntry = resolveAlchemyFindingNavigator(aliased, measured(aliased), scope).entries.find(
    (e) => e.finding.sourceId === ledger,
  );
  assert(aliasEntry?.request);
  expect(aliasEntry.label).toBe('AccountingLedger (stream)');
  const aliasReveal = resolveAlchemyFindingReveal(
    aliased,
    measured(aliased),
    aliasEntry.request,
    scope,
  );
  assert(aliasReveal.type === 'ready');
  expect(aliasReveal.target).toEqual({ entity: 'node', id: ledger });
  const reordered = raw();
  reordered.declarations.reverse();
  reordered.relations.reverse();
  const equivalent = projectAlchemyDescriptor(reordered);
  assert(equivalent.type === 'reviewable');
  expect(resolveAlchemyFindingReveal(equivalent, measured(equivalent), request, scope).type).toBe(
    'ready',
  );
});
test('unbound, ambiguous and missing source representations have explicit disabled reasons; visibility is respected', () => {
  const p = projection(),
    editor = measured(p);
  const augmented = {
    ...p,
    findings: [
      ...p.findings,
      {
        code: 'unbound',
        sourceId: null,
        severity: 'unverified' as const,
        reason: 'No source fact.',
      },
    ],
  };
  const absent = resolveAlchemyFindingNavigator(augmented, editor, scope).entries.at(-1);
  expect(absent?.reason).toContain('source');
  const duplicate = {
    ...p,
    findings: [p.findings[0], ...p.findings].filter((f): f is NonNullable<typeof f> => !!f),
  };
  expect(resolveAlchemyFindingNavigator(duplicate, editor, scope).entries[0]?.reason).toContain(
    'ambiguous',
  );
  const hidden = { ...editor, visibility: { hiddenNodeIds: [ledger] } };
  const hiddenRow = resolveAlchemyFindingNavigator(p, hidden, scope).entries.find(
    (e) => e.finding.sourceId === ledger,
  );
  expect(hiddenRow?.reason).toContain('hidden');
  const hiddenEdge = resolveAlchemyFindingNavigator(p, hidden, scope).entries.find(
    (e) => e.finding.sourceId === relation,
  );
  expect(hiddenEdge?.reason).toContain('hidden');
  const missing = {
    ...editor,
    graph: { ...editor.graph, edges: editor.graph.edges.filter((e) => e.id !== relation) },
  };
  expect(
    resolveAlchemyFindingNavigator(p, missing, scope).entries.find(
      (e) => e.finding.sourceId === relation,
    )?.reason,
  ).toContain('missing');
  const noCoverage = { ...p, coverage: p.coverage.filter((c) => c.sourceId !== ledger) };
  expect(
    resolveAlchemyFindingNavigator(noCoverage, editor, scope).entries.find(
      (e) => e.finding.sourceId === ledger,
    )?.reason,
  ).toContain('coverage');
  const mismatch = {
    ...editor,
    graph: {
      ...editor.graph,
      edges: editor.graph.edges.map((e) =>
        e.id === relation ? { ...e, source: { ...e.source, node: model } } : e,
      ),
    },
  };
  expect(
    resolveAlchemyFindingNavigator(p, mismatch, scope).entries.find(
      (e) => e.finding.sourceId === relation,
    )?.reason,
  ).toContain('endpoints');
  const blocked = projectAlchemyDescriptor({});
  expect(resolveAlchemyFindingNavigator(blocked, editor, scope).entries[0]?.reason).toContain(
    'reviewable',
  );
});
test('live host protection, writable editors, missing measurement and gestures cannot emit navigation recipes', () => {
  const p = projection(),
    editor = measured(p),
    entry = resolveAlchemyFindingNavigator(p, editor, scope).entries[0];
  assert(entry?.request);
  for (const [live, options] of [
    [editor, { ...scope, blockedReason: 'Protected by host' }],
    [{ ...editor, readOnly: false }, scope],
    [{ ...editor, surface: null }, scope],
    [updateEditor(editor, { type: 'PanStarted', pointer: 1, point: { x: 0, y: 0 } }), scope],
  ] as const) {
    const result = resolveAlchemyFindingReveal(p, live, entry.request, options);
    expect(result.type).toBe('blocked');
    expect('events' in result).toBe(false);
    expect(
      resolveAlchemyFindingNavigator(p, live, options).entries.every((e) => e.reason !== null),
    ).toBe(true);
  }
});

test('containment findings reveal their child without inventing an edge; outputs detach findings from caller-owned records', () => {
  const p = projection(),
    editor = measured(p),
    membership = p.source.relations.find(
      (r) => r.kind === 'contains' && r.target === 'example%2Fbank/Bank/aggregate/Account',
    );
  assert(membership);
  const finding = {
    code: 'membership-disclosure',
    sourceId: membership.id,
    severity: 'loss' as const,
    reason: 'Membership is represented by grouping.',
  };
  const custom = { ...p, findings: [finding] };
  const row = resolveAlchemyFindingNavigator(custom, editor, scope).entries[0];
  assert(row?.request);
  expect(row.target).toEqual({ entity: 'node', id: 'example%2Fbank/Bank/aggregate/Account' });
  expect(row.label).toBe('contains: Bank → Account');
  expect(Object.isFrozen(row)).toBe(true);
  expect(Object.isFrozen(row.request)).toBe(true);
  finding.reason = 'Changed externally';
  expect(row.finding.reason).toBe('Membership is represented by grouping.');
  const result = resolveAlchemyFindingReveal(custom, editor, row.request, scope);
  assert(result.type === 'ready');
  expect(result.events[1]).toEqual({
    type: 'NodeRevealRequested',
    id: 'example%2Fbank/Bank/aggregate/Account',
  });
  const missing = {
    ...editor,
    graph: {
      ...editor.graph,
      nodes: editor.graph.nodes.filter((n) => n.id !== 'example%2Fbank/Bank/aggregate/Account'),
    },
  };
  const denied = resolveAlchemyFindingReveal(custom, missing, row.request, scope);
  expect(denied.type).toBe('blocked');
  expect(Object.isFrozen(denied)).toBe(true);
});
