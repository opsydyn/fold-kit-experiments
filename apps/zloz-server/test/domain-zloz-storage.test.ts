import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

import type { Delivery } from '@alchemy.run/domain/Platform';
import { createOperationDocument, decideOperation } from '@opsydyn/foldkit-zloz';
import { AssessmentRecordsSchema } from '@opsydyn/foldkit-zloz-alchemy/assessment';
import { makeDiagramDomain } from '@opsydyn/foldkit-zloz-alchemy/collaboration';
import { DiagramFrameSchema, isDiagramFrame } from '@opsydyn/foldkit-zloz-alchemy/session';
import { Effect, Schema } from 'effect';

import { makeCouplingStressFixture } from '../../zloz-team/test/coupling-load';
import { constructView, declaredView, readyStorage, realKit } from './domain-store-fixture';

const target = { teamId: 'snapshot-proof-team', diagramId: 'snapshot-proof-diagram' };
const key = JSON.stringify([target.teamId, target.diagramId]);
const source = `ZlozDiagramV1/${key}`;
const domain = makeDiagramDomain({ authorize: () => Effect.void });

test.each(['duplicate-relationship', 'utf8-overflow'] as const)(
  'legacy persisted assessment %s fails the real decoder and rolls back before any output',
  async (kind) => {
    const { graph, records } = makeCouplingStressFixture(target.diagramId);
    const invalid =
      kind === 'duplicate-relationship'
        ? [...records, records[0]]
        : records.map((record, index) =>
            index === 0 ? { ...record, extra: '🙂'.repeat(300_000) } : record,
          );
    const frame = {
      target,
      sourceVersion: 480,
      document: createOperationDocument(graph),
      coverage: [],
      assessments: invalid,
    };
    expect(isDiagramFrame(frame)).toBe(false);
    const view = domain.model.definitions.views.find((v) => v.viewName === 'ZlozDiagramLiveV1');
    assert(view, 'Missing legacy view');
    await Effect.runPromise(
      Effect.gen(function* () {
        const kit = yield* realKit(domain.model.definitions, view);
        const declaration = yield* declaredView(view, kit);
        const storage = readyStorage(kit, {
          snapshot: { state: frame, version: 480, seq: 480, checkpoints: { [source]: 480 } },
        });
        const instance = yield* constructView(declaration, storage);
        const before = storage.dump();
        const result = yield* instance.receive(key, [
          {
            target: { kind: 'view', name: view.viewName },
            key,
            source,
            seq: 481,
            origin: 'ZlozDiagramV1',
            tag: 'InitializationRefused',
            event: { _tag: 'InitializationRefused', binding: 'literal' },
            envelope: {
              id: key,
              stream: source,
              seq: 481,
              at: 1700000000000,
              commandId: 'bad-state',
            },
          },
        ]);
        expect(result).toHaveProperty('alchemy/Domain/Defect');
        expect(storage.dump()).toEqual(before);
        expect(storage.trace.filter((row) => row.operation === 'put')).toEqual([]);
        expect(storage.trace.filter((row) => row.operation === 'rollback')).toHaveLength(1);
      }).pipe(Effect.scoped),
    );
  },
);

test('both actual Zloz views preserve full guarded state and expose the exact per-apply read/write topology', async () => {
  const report: unknown[] = [];
  const { graph, records } = makeCouplingStressFixture(target.diagramId);
  const document = createOperationDocument(graph);
  const frame = { target, sourceVersion: 480, document, coverage: [], assessments: records };
  expect(graph.nodes).toHaveLength(250);
  expect(graph.edges).toHaveLength(500);
  expect(records).toHaveLength(480);
  const firstRecord = records[0];
  assert(firstRecord, 'Missing first stress assessment');
  const updatedRecord = {
    ...firstRecord,
    revision: 2,
    authoredBy: 'synthetic-owner',
    operationId: 'snapshot-assessment-2',
  };
  expect(Schema.is(AssessmentRecordsSchema)(records)).toBe(true);
  expect(isDiagramFrame(frame)).toBe(true);
  const request = {
    version: 1 as const,
    operationId: 'snapshot-proof-rename',
    operation: { type: 'RenameNode' as const, id: 'n0', expected: 0, label: 'Literal new label' },
  };
  const decided = decideOperation(document, request, { ...target, actorId: 'synthetic-owner' });
  expect(decided.receipt.status).toBe('accepted');

  for (const view of domain.model.definitions.views) {
    for (const kind of ['refused', 'accepted', 'assessment'] as const) {
      await Effect.runPromise(
        Effect.gen(function* () {
          const kit = yield* realKit(domain.model.definitions, view);
          const declaration = yield* declaredView(view, kit);
          const isLegacy = view.viewName === 'ZlozDiagramLiveV1';
          const state = isLegacy ? frame : { target, sourceStream: source, sourceVersion: 480 };
          const snapshot = { state, version: 480, seq: 480, checkpoints: { [source]: 480 } };
          const storage = readyStorage(kit, { snapshot, 'in-seq': 480 });
          const instance = yield* constructView(declaration, storage);
          const event =
            kind === 'accepted'
              ? {
                  _tag: 'OperationDecided',
                  binding: 'private-fixture-binding',
                  requestHash: 'a'.repeat(64),
                  receipt: decided.receipt,
                }
              : kind === 'assessment'
                ? {
                    _tag: 'AssessmentDecided',
                    binding: 'private-fixture-binding',
                    decision: { status: 'accepted', record: updatedRecord },
                  }
                : { _tag: 'InitializationRefused', binding: 'private-fixture-binding' };
          const delivery: Delivery = {
            target: { kind: 'view', name: view.viewName },
            key,
            source,
            seq: 481,
            origin: 'ZlozDiagramV1',
            tag: event._tag,
            event,
            envelope: {
              id: key,
              stream: source,
              seq: 481,
              at: 1700000000000,
              commandId: 'literal-481',
              correlationId: 'correlation-481',
            },
          };
          storage.clear();
          yield* instance.receive(key, [delivery]);
          const trace = structuredClone(storage.trace);
          const reads = trace.filter(
            (row) => row.operation === 'get' && row.keys.includes('snapshot'),
          );
          expect(reads).toHaveLength(2);
          expect(reads[0]?.transaction).toBeGreaterThan(0);
          expect(reads[0]?.gate).toBeGreaterThan(0);
          expect(reads[1]).toEqual(reads[0]);
          expect(reads[0]?.bytes).toBe(new TextEncoder().encode(JSON.stringify(snapshot)).length);
          const persisted = storage.dump();
          const expectedState = isLegacy
            ? kind === 'accepted'
              ? {
                  ...frame,
                  sourceVersion: 481,
                  document: { ...decided.document, undo: [] },
                  coverage: [
                    {
                      actorId: 'synthetic-owner',
                      operationId: request.operationId,
                      requestHash: 'a'.repeat(64),
                      documentVersion: 1,
                      status: 'accepted',
                    },
                  ],
                }
              : kind === 'assessment'
                ? {
                    ...frame,
                    sourceVersion: 481,
                    assessments: [...records.slice(1), updatedRecord],
                  }
                : { ...frame, sourceVersion: 481 }
            : { target, sourceStream: source, sourceVersion: 481 };
          expect(persisted.snapshot).toEqual({
            state: expectedState,
            version: 481,
            seq: 481,
            checkpoints: { [source]: 481 },
          });
          const expectedEvent = isLegacy
            ? { _tag: 'PublicChanged', version: kind === 'accepted' ? 1 : 0 }
            : {
                _tag: 'PublicDelta',
                delta: {
                  format: 'foldkit-zloz-delta',
                  version: 1,
                  target,
                  previousSourceVersion: 480,
                  sourceVersion: 481,
                  payload:
                    kind === 'accepted'
                      ? { kind: 'graph', receipt: decided.receipt, requestHash: 'a'.repeat(64) }
                      : kind === 'assessment'
                        ? { kind: 'assessment', record: updatedRecord }
                        : { kind: 'noop' },
                },
              };
          const expectedEntry = {
            seq: 481,
            event: expectedEvent,
            state: expectedState,
            envelope: {
              id: key,
              stream: `${view.viewName}/${key}`,
              seq: 481,
              at: 1700000000000,
              commandId: 'literal-481',
              correlationId: 'correlation-481',
            },
          };
          expect(persisted['entry:000000000481']).toEqual(expectedEntry);
          expect(persisted['in:000000000481']).toEqual(delivery);
          expect(persisted['in-seq']).toBe(481);
          expect(yield* instance.after(480)).toEqual([expectedEntry]);
          expect(JSON.stringify(yield* instance.after(480))).not.toContain(
            'private-fixture-binding',
          );
          expect(JSON.stringify(yield* instance.after(480))).not.toContain('"inverse"');
          if (isLegacy) {
            const next = Schema.decodeUnknownSync(DiagramFrameSchema)(
              (yield* instance.read()).state,
            );
            expect(next.assessments).toEqual(
              kind === 'assessment' ? [...records.slice(1), updatedRecord] : records,
            );
            expect(next.document.graph.nodes[0]?.label).toBe(
              kind === 'accepted' ? 'Literal new label' : 'Node 0',
            );
            expect(next.document.graph.edges).toEqual(graph.edges);
            expect(isDiagramFrame(next)).toBe(true);
          }
          const singleReadBudget = reads.length === 1;
          expect(singleReadBudget).toBe(false);
          report.push({
            view: view.viewName,
            kind,
            snapshotReads: reads.length,
            singleReadBudget,
            snapshotBytes: reads[0]?.bytes,
            snapshotReadPayloadBytes: reads.reduce((sum, row) => sum + row.bytes, 0),
            trace,
          });
        }).pipe(Effect.scoped),
      );
    }
  }
  if (process.env.ZLOZ_SNAPSHOT_PROOF_REPORT)
    await writeFile(
      process.env.ZLOZ_SNAPSHOT_PROOF_REPORT,
      JSON.stringify(
        {
          sdk: '2.0.0-beta.85',
          fixture: { nodes: 250, edges: 500, assessments: 480 },
          provenance:
            'Unmodified exported SDK constructor and storage wrapper; controlled JSON storage. No native CPU, SQLite, crash or M4 qualification claim.',
          cases: report,
        },
        null,
        2,
      ) + '\n',
    );
});
