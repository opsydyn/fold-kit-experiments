import { expect, test } from 'bun:test';

import { createOperationDocument, decideOperation } from '@opsydyn/foldkit-zloz';
import type { ZlozOperationRequest } from '@opsydyn/foldkit-zloz';

import {
  beginEdit,
  isDiagramFrame,
  newSession,
  receiveFrame,
  receiveReply,
  unknownEdit,
} from '../src/session';
import type { DiagramFrame } from '../src/session';

const room = { teamId: 'team', diagramId: 'diagram', actorId: 'a', generation: 'tab' };
const initial = createOperationDocument({ nodes: [], edges: [] });
const request: ZlozOperationRequest = {
  version: 1,
  operationId: 'add',
  operation: {
    type: 'AddNode',
    expectedVersion: 0,
    node: {
      id: 'node',
      label: 'One',
      position: { x: 0, y: 0 },
      size: { width: 160, height: 90 },
      ports: [],
    },
  },
};
const decision = decideOperation(initial, request, {
  teamId: room.teamId,
  diagramId: room.diagramId,
  actorId: room.actorId,
});
const frame = (document = initial, sourceVersion = 1): DiagramFrame => ({
  target: room,
  document: { ...document, undo: [] },
  sourceVersion,
  coverage: [],
});
const staged = () =>
  beginEdit(receiveFrame(newSession(room), room, frame()), request, 'a'.repeat(64));
const reply = { receipt: decision.receipt, sourceVersion: 2, requestHash: 'a'.repeat(64) };

test('reply before frame, lag and duplicates preserve pending until actual coverage', () => {
  let state = receiveReply(staged(), room, reply);
  expect(state.pending).not.toBeNull();
  state = receiveFrame(state, room, frame(initial, 90));
  expect(state.pending).not.toBeNull();
  state = receiveFrame(state, room, frame(decision.document, 91));
  expect(state.pending).toBeNull();
  expect(state.confirmed?.document.version).toBe(1);
  expect(receiveFrame(state, room, frame(initial, 100)).confirmed?.document.version).toBe(1);
  expect(receiveReply(state, room, reply)).toEqual(state);
});
test('feed before reply requires actor, operation and request binding, not a large cursor', () => {
  const covered = {
    ...frame(decision.document, 2),
    coverage: [
      {
        actorId: 'a',
        operationId: 'add',
        requestHash: 'a'.repeat(64),
        documentVersion: 1,
        status: 'accepted' as const,
      },
    ],
  };
  expect(
    receiveFrame(staged(), room, {
      ...covered,
      coverage: [{ ...covered.coverage[0]!, requestHash: 'b'.repeat(64) }],
    }).pending,
  ).not.toBeNull();
  const state = receiveFrame(staged(), room, covered);
  expect(state.pending).toBeNull();
  expect(receiveReply(state, room, reply)).toEqual(state);
});
test('uncertain outcome retains exact identity and ignores old room or session callbacks', () => {
  const state = unknownEdit(staged(), room, 'add');
  expect(state.pending?.request).toEqual(request);
  expect(state.pending?.status).toBe('uncertain');
  expect(receiveFrame(state, { ...room, generation: 'old' }, frame(decision.document, 2))).toEqual(
    state,
  );
  expect(receiveReply(state, { ...room, diagramId: 'other' }, reply)).toEqual(state);
  expect(
    receiveReply(state, room, { ...reply, requestHash: 'b'.repeat(64) }).pending,
  ).not.toBeNull();
  expect(() => beginEdit(state, { ...request, operationId: 'another' }, 'a'.repeat(64))).toThrow();
});

test('a late transport failure cannot turn known acceptance into an unknown outcome', () => {
  const accepted = receiveReply(staged(), room, reply);
  expect(unknownEdit(accepted, room, request.operationId)).toEqual(accepted);
});

test('public Undo reset markers accept legacy frames but reject invalid versions and private journals', () => {
  expect(isDiagramFrame(frame())).toBe(true);
  expect(isDiagramFrame({ ...frame(), undoResetVersion: 0 })).toBe(true);
  for (const undoResetVersion of [-1, 0.5, 1, Number.MAX_SAFE_INTEGER + 1, '0'])
    expect(isDiagramFrame({ ...frame(), undoResetVersion })).toBe(false);
  expect(isDiagramFrame({ ...frame(decision.document), document: decision.document })).toBe(false);
});

test('newer legacy frames cannot forget the largest observed Undo reset watermark', () => {
  const reset = { ...frame(decision.document, 2), undoResetVersion: 1 };
  const known = receiveFrame(newSession(room), room, reset);
  const legacy = receiveFrame(known, room, frame(decision.document, 3));
  expect(legacy.confirmed?.undoResetVersion).toBe(1);
  const olderMarker = receiveFrame(legacy, room, {
    ...frame(decision.document, 4),
    undoResetVersion: 0,
  });
  expect(olderMarker.confirmed?.undoResetVersion).toBe(1);
  expect(olderMarker.confirmed?.sourceVersion).toBe(4);
});
