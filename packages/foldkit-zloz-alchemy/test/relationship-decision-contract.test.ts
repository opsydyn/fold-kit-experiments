import { expect, test } from 'bun:test';

import {
  canonicalOperationValue,
  decideOperation,
  parseOperationRequest,
} from '@opsydyn/foldkit-zloz';
import { Schema } from 'effect';

import { applyDiagramDelta } from '../src/delta';
import { sha256Text } from '../src/digest';
import { DiagramFrameSchema } from '../src/session';
import wire from './fixtures/relationship-decision-v1.json';

const codec = Schema.toCodecJson(DiagramFrameSchema);

test('old live frames preserve optional decisions and legacy no-ops preserve exact graph and assessments', () => {
  const original = Schema.decodeUnknownSync(codec)(wire.historicalFrame);
  const received = {
    ...wire.historicalFrame,
    sourceVersion: 10,
    relationshipDecisions: [wire.acceptedEvent.outcome.record],
  };
  expect<unknown>(Schema.decodeUnknownSync(codec)(received)).toEqual(received);

  const [share, accept] = wire.legacyDeltas;
  expect(applyDiagramDelta(original, accept)._tag).toBe('Resync');
  const afterShare = applyDiagramDelta(original, share);
  expect(afterShare._tag).toBe('Applied');
  if (afterShare._tag !== 'Applied') return;
  expect(afterShare.frame.sourceVersion).toBe(9);
  const afterAccept = applyDiagramDelta(afterShare.frame, accept);
  expect(afterAccept._tag).toBe('Applied');
  if (afterAccept._tag !== 'Applied') return;
  expect<unknown>(afterAccept.frame).toEqual({ ...wire.historicalFrame, sourceVersion: 10 });
  expect(afterAccept.frame.document).toBe(original.document);
  expect(afterAccept.frame.assessments).toBe(original.assessments);
  expect(applyDiagramDelta(afterAccept.frame, accept)).toEqual({
    _tag: 'Covered',
    frame: afterAccept.frame,
  });
});

test('independent fingerprints bind evidence and recovery, and fixture edits use valid graph operations', async () => {
  const original = Schema.decodeUnknownSync(codec)(wire.historicalFrame);
  const event = wire.acceptedEvent;
  const context = wire.expectedProposed.context;
  const { drag, changedEvidence, removedRelationship, recoveredGraph } = wire.graphScenarios;
  const digest = (value: typeof context) => sha256Text(canonicalOperationValue(value));
  expect(await digest(context)).toBe(wire.shareRequest.command.contextFingerprint);
  expect(await digest(context)).toBe(drag.expectedFingerprint);
  expect(
    await sha256Text(canonicalOperationValue([event.target, event.actorId, wire.acceptRequest])),
  ).toBe(event.requestHash);

  const apply = (
    request:
      | typeof drag.request
      | typeof changedEvidence.request
      | typeof removedRelationship.request,
  ) => {
    const decision = decideOperation(
      original.document,
      parseOperationRequest(JSON.stringify(request)),
      { ...original.target, actorId: 'alice' },
    );
    expect(decision.type).toBe('accepted');
    return decision.document.graph;
  };
  const moved = apply(drag.request);
  expect(moved.nodes.find((node) => node.id === context.source.nodeId)?.position).toEqual(
    drag.expectedPosition,
  );
  expect(moved.edges).toEqual(original.document.graph.edges);
  const renamed = apply(changedEvidence.request).nodes.find(
    (node) => node.id === context.target.nodeId,
  );
  expect(renamed?.label).toBe('Beta archive');
  if (!renamed) return;
  expect(await digest({ ...context, target: { ...context.target, label: renamed.label } })).toBe(
    changedEvidence.expectedFingerprint,
  );
  expect(changedEvidence.expectedFingerprint).not.toBe(drag.expectedFingerprint);
  expect(apply(removedRelationship.request).edges).toEqual([]);
  expect(await digest({ ...context, recoveryVersion: recoveredGraph.recoveryVersion })).toBe(
    recoveredGraph.expectedFingerprint,
  );
  expect(recoveredGraph.expectedFingerprint).not.toBe(drag.expectedFingerprint);
});
