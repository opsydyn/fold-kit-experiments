import { expect, test } from 'bun:test';

import { createOperationDocument, parseGraph } from '@opsydyn/foldkit-zloz';
import { parseCouplingAssessment } from '@opsydyn/foldkit-zloz/coupling';
import { Schema } from 'effect';

import operations from '../../foldkit-zloz/test/fixtures/operations-v1.json';
import { applyDiagramDelta, DiagramDeltaSchema } from '../src/delta';
import { DiagramFrameSchema, type DiagramFrame } from '../src/session';
import assessmentFixture from './fixtures/assessment-v1.json';
const assessment = parseCouplingAssessment(JSON.stringify(assessmentFixture));

const target = { teamId: 'team-a', diagramId: 'diagram-a' };
const initial = (): DiagramFrame => ({
  target,
  sourceVersion: 10,
  undoResetVersion: 0,
  document: createOperationDocument(
    parseGraph(JSON.stringify({ version: 1, graph: operations.graph })),
  ),
  coverage: [],
  assessments: [],
});
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Literal negative fixtures deliberately exercise malformed payloads.
const envelope = (payload: unknown, previousSourceVersion = 10) => ({
  format: 'foldkit-zloz-delta',
  version: 1,
  target,
  previousSourceVersion,
  sourceVersion: previousSourceVersion + 1,
  payload,
});
const graphPayload = {
  kind: 'graph',
  requestHash: 'a'.repeat(64),
  receipt: {
    ...target,
    actorId: 'alice',
    operationId: 'move-a',
    documentVersion: 1,
    status: 'accepted',
    code: null,
    change: {
      ...target,
      actorId: 'alice',
      operationId: 'move-a',
      fromVersion: 0,
      version: 1,
      undoOf: null,
      nodes: [
        {
          type: 'geometry',
          id: 'a',
          expected: 0,
          before: { position: { x: 10, y: 20 }, size: { width: 120, height: 80 } },
          after: { position: { x: 70, y: 90 }, size: { width: 120, height: 80 } },
        },
      ],
      edges: [],
    },
  },
};
const record = () => ({
  revision: 1,
  authoredBy: 'bob',
  operationId: 'assessment-1',
  assessment: structuredClone(assessment),
});

test('literal graph delta applies one public change without history or reassessing unchanged evidence', () => {
  const frame = { ...initial(), assessments: [record()] };
  const before = JSON.stringify(frame);
  const result = applyDiagramDelta(frame, envelope(graphPayload));
  expect(result._tag).toBe('Applied');
  if (result._tag !== 'Applied') return;
  expect(result.frame.sourceVersion).toBe(11);
  expect(result.frame.document.version).toBe(1);
  expect(result.frame.document.graph.nodes.find((n) => n.id === 'a')?.position).toEqual({
    x: 70,
    y: 90,
  });
  expect(result.frame.document.graph.nodes.find((n) => n.id === 'a')?.data).toEqual({
    host: { retain: [1, 'two', true] },
  });
  expect(result.frame.document.undo).toEqual([]);
  expect(result.frame.assessments).toBe(frame.assessments);
  expect(result.frame.coverage).toEqual([
    {
      actorId: 'alice',
      operationId: 'move-a',
      requestHash: 'a'.repeat(64),
      documentVersion: 1,
      status: 'accepted',
    },
  ]);
  expect(Schema.is(DiagramFrameSchema)(result.frame)).toBe(true);
  expect(JSON.stringify(frame)).toBe(before);
  const duplicate = applyDiagramDelta(result.frame, envelope(graphPayload));
  expect(duplicate).toEqual({ _tag: 'Covered', frame: result.frame });
});

test('literal refusal and no-op advance source ordering without changing graph or inventing acknowledgement', () => {
  const frame = initial();
  const refused = applyDiagramDelta(
    frame,
    envelope({
      kind: 'graph',
      requestHash: 'b'.repeat(64),
      receipt: {
        ...target,
        actorId: 'bob',
        operationId: 'refused',
        documentVersion: 0,
        status: 'rejected',
        code: 'Conflict',
        message: 'Stale geometry',
        change: null,
      },
    }),
  );
  expect(refused._tag).toBe('Applied');
  if (refused._tag !== 'Applied') return;
  expect(refused.frame.document).toBe(frame.document);
  expect(refused.frame.coverage[0]).toMatchObject({ status: 'rejected', operationId: 'refused' });
  const noop = applyDiagramDelta(refused.frame, envelope({ kind: 'noop' }, 11));
  expect(noop._tag).toBe('Applied');
  if (noop._tag !== 'Applied') return;
  expect(noop.frame.document).toBe(frame.document);
  expect(noop.frame.coverage).toBe(refused.frame.coverage);
  expect(noop.frame.sourceVersion).toBe(12);
});

test('literal assessment revisions change only one record and preserve graph/source counter distinctions', () => {
  const frame = initial();
  const saved = applyDiagramDelta(frame, envelope({ kind: 'assessment', record: record() }));
  expect(saved._tag).toBe('Applied');
  if (saved._tag !== 'Applied') return;
  expect(saved.frame.document).toBe(frame.document);
  expect(saved.frame.coverage).toBe(frame.coverage);
  expect(saved.frame.assessments).toEqual([record()]);
  expect(saved.frame.sourceVersion).toBe(11);
  const next = {
    ...record(),
    revision: 2,
    operationId: 'assessment-2',
    assessment: { ...assessment, scope: { ...assessment.scope, horizon: 'Reviewed horizon' } },
  };
  const updated = applyDiagramDelta(
    saved.frame,
    envelope({ kind: 'assessment', record: next }, 11),
  );
  expect(updated._tag).toBe('Applied');
  if (updated._tag === 'Applied') expect(updated.frame.assessments).toEqual([next]);
  for (const invalid of [
    { ...record(), revision: 3 },
    {
      ...record(),
      assessment: { ...assessment, target: { ...assessment.target, graphVersion: 1 } },
    },
    {
      ...record(),
      assessment: { ...assessment, target: { ...assessment.target, documentId: 'other' } },
    },
    {
      ...record(),
      assessment: { ...assessment, target: { ...assessment.target, sourceNodeId: 'b' } },
    },
  ])
    expect(applyDiagramDelta(frame, envelope({ kind: 'assessment', record: invalid }))._tag).toBe(
      'Resync',
    );
});

test('invalid versions, payloads, targets, patches and gaps require resync without changing confirmed state', () => {
  const frame = initial();
  const before = JSON.stringify(frame);
  const valid = envelope(graphPayload);
  const invalid = [
    null,
    [],
    { ...valid, version: 2 },
    { ...valid, binding: 'private' },
    { ...valid, target: { ...target, teamId: 'other' } },
    { ...valid, previousSourceVersion: 11, sourceVersion: 12 },
    { ...valid, sourceVersion: 10 },
    { ...valid, sourceVersion: Infinity },
    {
      ...valid,
      previousSourceVersion: Number.MAX_SAFE_INTEGER,
      sourceVersion: Number.MAX_SAFE_INTEGER + 1,
    },
    envelope({ ...graphPayload, requestHash: 'not-a-hash' }),
    envelope({ ...graphPayload, receipt: { ...graphPayload.receipt, actorId: 'forged' } }),
    envelope({
      ...graphPayload,
      receipt: {
        ...graphPayload.receipt,
        change: { ...graphPayload.receipt.change, fromVersion: 1, version: 2 },
        documentVersion: 2,
      },
    }),
    envelope({
      ...graphPayload,
      receipt: {
        ...graphPayload.receipt,
        change: {
          ...graphPayload.receipt.change,
          nodes: [{ ...graphPayload.receipt.change.nodes[0], expected: 12 }],
        },
      },
    }),
  ];
  for (const [index, value] of invalid.entries())
    expect(applyDiagramDelta(frame, value)._tag, `invalid case ${index}`).toBe('Resync');
  expect(JSON.stringify(frame)).toBe(before);
  expect(Schema.is(DiagramDeltaSchema)(valid)).toBe(true);
});

test('initialization and recovery resets sanitize history and retain assessment evidence with its old graph pin', () => {
  const initialDocument = initial().document;
  const opened = applyDiagramDelta(
    null,
    envelope(
      { kind: 'reset', reason: 'initialized', document: initialDocument, undoResetVersion: 0 },
      0,
    ),
  );
  expect(opened._tag).toBe('Applied');
  if (opened._tag === 'Applied') expect(opened.frame.sourceVersion).toBe(1);
  const frame = { ...initial(), assessments: [record()] };
  const restored = {
    ...initialDocument,
    version: 1,
    nodes: initialDocument.nodes.map((n) => ({
      ...n,
      version: 1,
      geometry: 1,
      label: 1,
      ports: 1,
    })),
    edges: initialDocument.edges.map((e) => ({ ...e, version: 1 })),
  };
  const delta = envelope({
    kind: 'reset',
    reason: 'recovered',
    document: restored,
    undoResetVersion: 1,
  });
  const result = applyDiagramDelta(frame, delta);
  expect(result._tag).toBe('Applied');
  if (result._tag === 'Applied') {
    expect(result.frame.document).toEqual(restored);
    expect(result.frame.assessments).toBe(frame.assessments);
    expect(result.frame.assessments?.[0]?.assessment.target.graphVersion).toBe(0);
    expect(result.frame.undoResetVersion).toBe(1);
  }
  for (const document of [
    {
      ...restored,
      undo: [{ actorId: 'private', operationId: 'private', inverse: { nodes: [], edges: [] } }],
    },
    { ...restored, version: 7 },
  ])
    expect(
      applyDiagramDelta(
        frame,
        envelope({
          kind: 'reset',
          reason: 'recovered',
          document,
          undoResetVersion: document.version,
        }),
      )._tag,
    ).toBe('Resync');
});

test('assessment count and UTF-8 caps reject updates without evicting retained evidence', () => {
  const sample = record();
  const retained = (index: number) => ({
    ...sample,
    assessment: {
      ...sample.assessment,
      target: { ...sample.assessment.target, relationshipId: `retained-${index}` },
    },
  });
  const full = { ...initial(), assessments: Array.from({ length: 500 }, (_, i) => retained(i)) };
  expect(Schema.is(DiagramFrameSchema)(full)).toBe(true);
  expect(applyDiagramDelta(full, envelope({ kind: 'assessment', record: sample }))._tag).toBe(
    'Resync',
  );
  const big = {
    ...sample,
    assessment: {
      ...sample.assessment,
      scope: { abstraction: '界'.repeat(2048), horizon: '界'.repeat(2048) },
    },
  };
  const records: (typeof big)[] = [];
  for (let i = 0; i < 500; i++) {
    const next = {
      ...big,
      assessment: {
        ...big.assessment,
        target: { ...big.assessment.target, relationshipId: `retained-${i}` },
      },
    };
    if (new TextEncoder().encode(JSON.stringify([...records, next, big])).byteLength > 1_048_576)
      break;
    records.push(next);
  }
  const almost = {
    ...initial(),
    assessments: [
      ...records,
      {
        ...big,
        assessment: {
          ...big.assessment,
          target: { ...big.assessment.target, relationshipId: 'last-retained' },
        },
      },
    ],
  };
  expect(Schema.is(DiagramFrameSchema)(almost)).toBe(true);
  expect(
    new TextEncoder().encode(JSON.stringify([...almost.assessments, big])).byteLength,
  ).toBeGreaterThan(1_048_576);
  expect(applyDiagramDelta(almost, envelope({ kind: 'assessment', record: big }))._tag).toBe(
    'Resync',
  );
});
