import { expect, test } from 'bun:test';

import {
  applyOperationChange,
  createOperationDocument,
  decideOperation,
  parseOperationRequest,
  parseGraph,
} from '@opsydyn/foldkit-zloz';
import type { ZlozOperationDocument, ZlozOperationReceipt } from '@opsydyn/foldkit-zloz';
import { Effect } from 'effect';

import fixture from '../../foldkit-zloz/test/fixtures/operations-v1.json';
import { makeDiagramDomain } from '../src/collaboration';
import type { DiagramFrame } from '../src/session';

type Accepted = Extract<ZlozOperationReceipt, { status: 'accepted' }>;
type State = Readonly<{ document: ZlozOperationDocument; assessments: readonly [] }>;
type Event = Readonly<{ receipt: Accepted; requestHash: string }>;
const target = { teamId: 'team-a', diagramId: 'diagram-a' };
const domain = makeDiagramDomain({ authorize: () => Effect.void });
// SAFETY: The SDK erases handler types; the declared aggregate and literal
// accepted event below establish these actual owned handler inputs.
const aggregate = domain.model.definitions.aggregates[0]!.definition.evolve as {
  OperationDecided: (state: State, event: Event) => State;
};
// SAFETY: The named view and its literal frame/event/context establish the
// input shapes erased by the SDK definitions interface.
const live = domain.model.definitions.views.find((view) => view.viewName === 'ZlozDiagramLiveV1')!
  .definition.evolve as {
  OperationDecided: (
    state: DiagramFrame,
    event: Event,
    context: { envelope: { seq: number } },
  ) => DiagramFrame;
};
function freeze<T>(value: T): T {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Deep-freeze a parsed JSON fixture, including all nested containers.
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

test('owned aggregate and full-view replay preserve immutable unchanged graph values without changing persisted results', () => {
  const document = freeze(
    createOperationDocument(parseGraph(JSON.stringify({ version: 1, graph: fixture.graph }))),
  );
  const request = parseOperationRequest(fixture.move);
  const decision = decideOperation(document, request, { ...target, actorId: 'alice' });
  expect(decision.receipt.status).toBe('accepted');
  if (decision.receipt.status !== 'accepted') return;
  const event = { receipt: decision.receipt, requestHash: 'a'.repeat(64) };
  const expected = applyOperationChange(document, event.receipt.change);
  const state: State = freeze({ document, assessments: [] });
  const next = aggregate.OperationDecided(state, event);
  expect(next.document).toEqual(expected);
  expect(next.document.graph.nodes[1]).toBe(document.graph.nodes[1]);
  expect(next.document.graph.edges[0]).toBe(document.graph.edges[0]);
  expect(next.document.graph.nodes[0]).not.toBe(document.graph.nodes[0]);
  expect(next.assessments).toBe(state.assessments);
  const frame: DiagramFrame = freeze({ target, sourceVersion: 1, document, coverage: [] });
  const projected = live.OperationDecided(frame, event, { envelope: { seq: 2 } });
  expect(projected.document).toEqual({ ...expected, undo: [] });
  expect(projected.document.graph.nodes[1]).toBe(document.graph.nodes[1]);
  expect(projected.document.graph.edges[0]).toBe(document.graph.edges[0]);
  expect(projected.sourceVersion).toBe(2);
  expect(projected.coverage).toEqual([
    {
      actorId: 'alice',
      operationId: request.operationId,
      requestHash: event.requestHash,
      documentVersion: 1,
      status: 'accepted',
    },
  ]);
  expect(document.version).toBe(0);
  expect(document.graph.nodes[0]!.position).toEqual({ x: 10, y: 20 });
});
