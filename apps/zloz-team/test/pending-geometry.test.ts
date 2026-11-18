import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { createOperationDocument, decideOperation, parseGraph } from '@opsydyn/foldkit-zloz';
import type { EditorEvent, ZlozGraphOperation } from '@opsydyn/foldkit-zloz';
import { operationHash } from '@opsydyn/foldkit-zloz-alchemy/hash';
import { Schema } from 'effect';

import fixture from '../../../packages/foldkit-zloz/test/fixtures/operations-v1.json';
import * as Assessment from '../src/editor/assessment';
import { init, Message, saveStatus, update, type Model } from '../src/editor/main';

const props = {
  teamId: 'team',
  diagramId: 'diagram-a',
  actorId: 'actor',
  role: 'owner' as const,
  name: 'Drag regression',
};
const room = { ...props, generation: 'drag-tab' };
const scope = { teamId: props.teamId, diagramId: props.diagramId, actorId: props.actorId };
const frame = {
  target: room,
  sourceVersion: 1,
  document: createOperationDocument(
    parseGraph(JSON.stringify({ version: 1, graph: fixture.graph })),
  ),
  coverage: [],
};
const ready = () =>
  update(
    update(init(props).model, Message.SucceededIdentity({ generation: room.generation })).model,
    Message.ObservedFrame({ room, run: 0, frame }),
  ).model;
const event = (model: Model, event: EditorEvent) =>
  update(model, Message.ObservedEditorInput({ event })).model;
const canvas = (model: Model) =>
  parseGraph(
    JSON.stringify({
      version: 1,
      graph: Schema.decodeUnknownSync(Schema.Struct({ graph: Schema.Unknown }))(model.editor).graph,
    }),
  );
const dragged = (model = ready()) =>
  event(
    event(event(model, { type: 'NodeDragStarted', id: 'a', pointer: 1, point: { x: 0, y: 0 } }), {
      type: 'PointerMoved',
      pointer: 1,
      point: { x: 40, y: 30 },
    }),
    { type: 'PointerReleased', pointer: 1 },
  );
async function prepared(model = dragged()) {
  const request = model.session.pending?.request;
  assert(request);
  const hash = await operationHash(request);
  return {
    request,
    hash,
    model: update(model, Message.PreparedEdit({ room, request, hash })).model,
  };
}
function peerFrame(operation: ZlozGraphOperation) {
  const decision = decideOperation(
    frame.document,
    { version: 1, operationId: 'peer', operation },
    { ...scope, actorId: 'peer' },
  );
  assert(decision.type === 'accepted');
  return { ...frame, sourceVersion: 2, document: { ...decision.document, undo: [] } };
}

test('released drag stays visible through preparation, duplicate snapshots and an unknown save outcome', async () => {
  const released = dragged();
  expect(canvas(released).nodes.find((node) => node.id === 'a')?.position).toEqual({
    x: 50,
    y: 50,
  });
  const own = await prepared(released);
  let model = own.model;
  expect(canvas(model).nodes.find((node) => node.id === 'a')?.position).toEqual({ x: 50, y: 50 });
  expect(model.session.confirmed?.document.graph.nodes[0]?.position).toEqual({ x: 10, y: 20 });
  expect(saveStatus(model)).toBe('Saving…');
  expect(model.ownEdits).toEqual([]);
  model = update(
    model,
    Message.ObservedFrame({ room, run: 0, frame: JSON.parse(JSON.stringify(frame)) }),
  ).model;
  model = update(model, Message.FailedEdit({ room, operationId: own.request.operationId })).model;
  model = update(
    model,
    Message.SucceededSnapshot({ room, role: 'owner', frame: { ...frame, sourceVersion: 2 } }),
  ).model;
  expect(canvas(model).nodes.find((node) => node.id === 'a')?.position).toEqual({ x: 50, y: 50 });
  expect(model.session.pending?.request).toBe(own.request);
  expect(saveStatus(model)).toBe('Save outcome unknown');
  expect(model.ownEdits).toEqual([]);
});

test('unrelated canonical edits remain visible alongside a pending move', async () => {
  const own = await prepared();
  const peer = peerFrame({ type: 'RenameNode', id: 'b', expected: 0, label: 'Peer label' });
  const model = update(own.model, Message.ObservedFrame({ room, run: 0, frame: peer })).model;
  expect(canvas(model).nodes.find((node) => node.id === 'a')?.position).toEqual({ x: 50, y: 50 });
  expect(canvas(model).nodes.find((node) => node.id === 'b')?.label).toBe('Peer label');
  expect(model.session.confirmed?.document.graph).toEqual(peer.document.graph);
  expect(model.session.pending?.request).toBe(own.request);
});

test('a real geometry conflict or deletion wins without resurrecting a pending preview', async () => {
  for (const operation of [
    { type: 'MoveNodes', nodes: [{ id: 'a', expected: 0, position: { x: 80, y: 90 } }] },
    { type: 'Delete', expectedVersion: 0, nodeIds: ['a'], edgeIds: [] },
  ] satisfies ZlozGraphOperation[]) {
    const own = await prepared();
    const peer = peerFrame(operation);
    const model = update(own.model, Message.ObservedFrame({ room, run: 0, frame: peer })).model;
    expect(canvas(model)).toEqual(peer.document.graph);
    expect(model.session.pending?.request).toBe(own.request);
    const decision = decideOperation(peer.document, own.request, scope);
    assert(decision.type === 'rejected');
    const rejected = update(
      model,
      Message.SucceededEdit({
        room,
        reply: { receipt: decision.receipt, requestHash: own.hash, sourceVersion: 3 },
      }),
    ).model;
    expect(canvas(rejected)).toEqual(peer.document.graph);
    expect(rejected.session.pending).toBeNull();
    expect(rejected.session.notice).toContain('Edit refused:');
    expect(rejected.ownEdits).toEqual([]);
  }
});

test('the save badge reports a move conflict until a subsequent edit is confirmed', async () => {
  const own = await prepared();
  const peer = peerFrame({
    type: 'MoveNodes',
    nodes: [{ id: 'a', expected: 0, position: { x: 80, y: 90 } }],
  });
  const model = update(own.model, Message.ObservedFrame({ room, run: 0, frame: peer })).model;
  const decision = decideOperation(peer.document, own.request, scope);
  assert(decision.type === 'rejected');
  expect(decision.receipt.code).toBe('Conflict');
  const reply = { receipt: decision.receipt, requestHash: own.hash, sourceVersion: 3 };
  const unrelated = update(
    model,
    Message.SucceededEdit({ room, reply: { ...reply, requestHash: '0'.repeat(64) } }),
  ).model;
  expect(saveStatus(unrelated)).toBe('Saving…');

  const rejected = update(model, Message.SucceededEdit({ room, reply })).model;
  expect(saveStatus(rejected)).toBe('Move conflict');
  expect(canvas(rejected)).toEqual(peer.document.graph);
  const refreshed = update(
    rejected,
    Message.SucceededSnapshot({ room, role: 'owner', frame: { ...peer, sourceVersion: 3 } }),
  ).model;
  expect(saveStatus(refreshed)).toBe('Move conflict');

  const retry = await prepared(dragged(refreshed));
  expect(saveStatus(retry.model)).toBe('Saving…');
  const accepted = decideOperation(peer.document, retry.request, scope);
  assert(accepted.type === 'accepted');
  const confirmed = update(
    retry.model,
    Message.ObservedFrame({
      room,
      run: 0,
      frame: {
        ...peer,
        sourceVersion: 4,
        document: { ...accepted.document, undo: [] },
        coverage: [
          {
            actorId: scope.actorId,
            operationId: retry.request.operationId,
            requestHash: retry.hash,
            documentVersion: accepted.document.version,
            status: 'accepted',
          },
        ],
      },
    }),
  ).model;
  expect(saveStatus(confirmed)).toBe('Saved');
  expect(saveStatus(update(confirmed, Message.SucceededEdit({ room, reply })).model)).toBe('Saved');
});

test('the save badge reports a move rejected by frame coverage without a receipt code', async () => {
  const own = await prepared();
  const peer = peerFrame({
    type: 'MoveNodes',
    nodes: [{ id: 'a', expected: 0, position: { x: 80, y: 90 } }],
  });
  const rejected = update(
    own.model,
    Message.ObservedFrame({
      room,
      run: 0,
      frame: {
        ...peer,
        coverage: [
          {
            actorId: scope.actorId,
            operationId: own.request.operationId,
            requestHash: own.hash,
            documentVersion: peer.document.version,
            status: 'rejected',
          },
        ],
      },
    }),
  ).model;
  expect(saveStatus(rejected)).toBe('Move rejected');
  expect(canvas(rejected)).toEqual(peer.document.graph);
});

test('resize preview persists until acknowledgement and preparation failure restores the canonical size', async () => {
  const resized = event(ready(), { type: 'NodeWidthChanged', id: 'a', width: 200 });
  expect(canvas(resized).nodes.find((node) => node.id === 'a')?.size).toEqual({
    width: 200,
    height: 80,
  });
  const own = await prepared(resized);
  expect(canvas(own.model).nodes.find((node) => node.id === 'a')?.size).toEqual({
    width: 200,
    height: 80,
  });
  const failed = update(resized, Message.FailedPreparation({ room })).model;
  expect(canvas(failed)).toEqual(frame.document.graph);
  expect(failed.session.pending).toBeNull();
});

test('multi-node preview stays atomic when a teammate changes one selected node', async () => {
  let model = event(ready(), { type: 'NodeSelected', id: 'a', additive: false });
  model = event(model, { type: 'NodeSelected', id: 'b', additive: true });
  const own = await prepared(dragged(model));
  expect(own.request.operation).toMatchObject({
    type: 'MoveNodes',
    nodes: [{ id: 'a' }, { id: 'b' }],
  });
  expect(canvas(own.model).nodes.find((node) => node.id === 'a')?.position).toEqual({
    x: 50,
    y: 50,
  });
  expect(canvas(own.model).nodes.find((node) => node.id === 'b')?.position).toEqual({
    x: 340,
    y: 50,
  });
  const peer = peerFrame({
    type: 'MoveNodes',
    nodes: [{ id: 'b', expected: 0, position: { x: 500, y: 60 } }],
  });
  const conflicted = update(own.model, Message.ObservedFrame({ room, run: 0, frame: peer })).model;
  expect(canvas(conflicted)).toEqual(peer.document.graph);
});

test('viewer role refresh removes the unaccepted preview without changing request identity', async () => {
  const own = await prepared();
  const viewer = update(
    own.model,
    Message.SucceededSnapshot({ room, frame, role: 'viewer' }),
  ).model;
  expect(canvas(viewer)).toEqual(frame.document.graph);
  expect(viewer.session.pending?.request).toBe(own.request);
  expect(viewer.ownEdits).toEqual([]);
});

test('frame-before-reply acknowledgement removes the preview without duplicate Undo history', async () => {
  const own = await prepared();
  const decision = decideOperation(frame.document, own.request, scope);
  assert(decision.type === 'accepted');
  const confirmed = update(
    own.model,
    Message.ObservedFrame({
      room,
      run: 0,
      frame: {
        ...frame,
        sourceVersion: 2,
        document: { ...decision.document, undo: [] },
        coverage: [
          {
            actorId: props.actorId,
            operationId: own.request.operationId,
            requestHash: own.hash,
            documentVersion: 1,
            status: 'accepted',
          },
        ],
      },
    }),
  ).model;
  const late = update(
    confirmed,
    Message.SucceededEdit({
      room,
      reply: { receipt: decision.receipt, requestHash: own.hash, sourceVersion: 2 },
    }),
  ).model;
  expect(canvas(late).nodes.find((node) => node.id === 'a')?.position).toEqual({ x: 50, y: 50 });
  expect(late.session.pending).toBeNull();
  expect(late.ownEdits).toEqual([{ operationId: own.request.operationId, documentVersion: 1 }]);
  expect(saveStatus(late)).toBe('Saved');
});

test('another drag remains responsive while a prior move saves without starting a concurrent write', async () => {
  const own = await prepared();
  let model = event(own.model, {
    type: 'NodeDragStarted',
    id: 'a',
    pointer: 2,
    point: { x: 0, y: 0 },
  });
  model = event(model, { type: 'PointerMoved', pointer: 2, point: { x: 40, y: 0 } });
  const released = update(
    model,
    Message.ObservedEditorInput({ event: { type: 'PointerReleased', pointer: 2 } }),
  );
  expect(canvas(released.model).nodes.find((node) => node.id === 'a')?.position).toEqual({
    x: 90,
    y: 50,
  });
  expect(released.model.session.pending?.request).toBe(own.request);
  expect(released.commands ?? []).toEqual([]);
  expect(saveStatus(released.model)).toBe('Saving…');
});

const movedAgain = (model: Model, id = 'a', dx = 40) =>
  event(
    event(event(model, { type: 'NodeDragStarted', id, pointer: 2, point: { x: 0, y: 0 } }), {
      type: 'PointerMoved',
      pointer: 2,
      point: { x: dx, y: 0 },
    }),
    { type: 'PointerReleased', pointer: 2 },
  );

function acknowledged(
  own: Awaited<ReturnType<typeof prepared>>,
  model: Model,
  document = frame.document,
) {
  const decision = decideOperation(document, own.request, scope);
  assert(decision.type === 'accepted');
  return update(
    model,
    Message.ObservedFrame({
      room,
      run: 0,
      frame: {
        ...frame,
        sourceVersion: decision.document.version + 1,
        document: { ...decision.document, undo: [] },
        coverage: [
          {
            actorId: props.actorId,
            operationId: own.request.operationId,
            requestHash: own.hash,
            documentVersion: decision.document.version,
            status: 'accepted',
          },
        ],
      },
    }),
  );
}

test('queued moves coalesce across nodes and use proven accepted geometry clocks rather than predicted versions', async () => {
  const own = await prepared();
  const queued = movedAgain(movedAgain(own.model, 'b'), 'a');
  expect(canvas(queued).nodes.find((node) => node.id === 'b')?.position).toEqual({ x: 340, y: 20 });
  expect(canvas(queued).nodes.find((node) => node.id === 'a')?.position).toEqual({ x: 90, y: 50 });
  const peer = peerFrame({ type: 'RenameNode', id: 'b', expected: 0, label: 'Changed by peer' });
  const advanced = acknowledged(own, queued, peer.document);
  expect(advanced.model.session.pending?.request.operation).toEqual({
    type: 'MoveNodes',
    nodes: [
      { id: 'b', expected: 0, position: { x: 340, y: 20 } },
      { id: 'a', expected: 2, position: { x: 90, y: 50 } },
    ],
  });
  expect(advanced.commands).toHaveLength(1);
  expect(advanced.model.session.pending?.request.operationId).not.toBe(own.request.operationId);
  expect(canvas(advanced.model).nodes.find((node) => node.id === 'b')?.label).toBe(
    'Changed by peer',
  );
});

test('an acknowledgement during the next gesture advances owned clocks without authoring a peer move', async () => {
  const own = await prepared();
  let dragging = event(own.model, {
    type: 'NodeDragStarted',
    id: 'a',
    pointer: 2,
    point: { x: 0, y: 0 },
  });
  dragging = event(dragging, { type: 'PointerMoved', pointer: 2, point: { x: 40, y: 0 } });
  const peer = peerFrame({
    type: 'MoveNodes',
    nodes: [{ id: 'b', expected: 0, position: { x: 500, y: 60 } }],
  });
  const received = acknowledged(own, dragging, peer.document).model;
  const released = event(received, { type: 'PointerReleased', pointer: 2 });
  expect(released.session.pending?.request.operation).toEqual({
    type: 'MoveNodes',
    nodes: [{ id: 'a', expected: 2, position: { x: 90, y: 50 } }],
  });
  const next = await prepared(released);
  expect(canvas(next.model).nodes.find((node) => node.id === 'b')?.position).toEqual({
    x: 500,
    y: 60,
  });
});

test('conflicting queued movement is retained for review, never sent or silently rebased over a teammate', async () => {
  const own = await prepared();
  const queued = movedAgain(own.model, 'b');
  const peer = peerFrame({
    type: 'MoveNodes',
    nodes: [{ id: 'b', expected: 0, position: { x: 500, y: 60 } }],
  });
  const result = acknowledged(own, queued, peer.document);
  expect(result.model.session.pending).toBeNull();
  expect(result.commands ?? []).toEqual([]);
  expect(result.model.queuedMove?._tag).toBe('Blocked');
  expect(result.model.queuedMove?.nodes).toEqual([
    { id: 'b', expected: 0, position: { x: 340, y: 20 } },
  ]);
  expect(canvas(result.model).nodes.find((node) => node.id === 'b')?.position).toEqual({
    x: 500,
    y: 60,
  });
  expect(saveStatus(result.model)).toBe('Queued moves need review');
  const discarded = update(result.model, Message.ClickedDiscardQueuedMove());
  expect(discarded.model.queuedMove).toBeNull();
  expect(discarded.commands ?? []).toEqual([]);
});

test('coalesced no-change movement does not create a second request and tiny selections do not queue', async () => {
  const own = await prepared();
  const queued = movedAgain(movedAgain(own.model), 'a', -40);
  const result = acknowledged(own, queued);
  expect(result.model.queuedMove).toBeNull();
  expect(result.model.session.pending).toBeNull();
  expect(result.commands ?? []).toEqual([]);
  expect(saveStatus(result.model)).toBe('Saved');
  const tiny = movedAgain(own.model, 'a', 1);
  expect(tiny.queuedMove).toBeNull();
  expect(tiny.session.pending?.request).toBe(own.request);
});

test('revoked edit access cannot flush a queued move or leave it labelled as a progressing save', async () => {
  const own = await prepared();
  const queued = movedAgain(own.model);
  const canonical = acknowledged(own, own.model).model.session.confirmed;
  assert(canonical);
  const viewer = update(
    queued,
    Message.SucceededSnapshot({ room, frame: canonical, role: 'viewer' }),
  );
  expect(viewer.model.session.pending).toBeNull();
  expect(viewer.model.queuedMove?._tag).toBe('Blocked');
  expect(viewer.commands ?? []).toEqual([]);
  expect(canvas(viewer.model)).toEqual(canonical.document.graph);
  expect(saveStatus(viewer.model)).toBe('Queued moves need review');
});

test('acknowledged move converges without a visual rollback and preserves assessment review requirements', async () => {
  let model = ready();
  for (const message of [
    Assessment.Message.SelectedRelationship({ id: 'ab' }),
    Assessment.Message.ChangedScope({ field: 'abstraction', text: 'Team scope' }),
  ])
    model = update(model, Message.GotAssessmentMessage({ room, message })).model;
  const draft = model.assessment;
  const own = await prepared(dragged(model));
  const decision = decideOperation(frame.document, own.request, scope);
  assert(decision.type === 'accepted');
  const reply = { receipt: decision.receipt, requestHash: own.hash, sourceVersion: 2 };
  const waiting = update(own.model, Message.SucceededEdit({ room, reply })).model;
  expect(canvas(waiting).nodes.find((node) => node.id === 'a')?.position).toEqual({ x: 50, y: 50 });
  expect(waiting.session.pending?.status).toBe('awaiting-frame');
  const confirmed = update(
    waiting,
    Message.ObservedFrame({
      room,
      run: 0,
      frame: { ...frame, sourceVersion: 2, document: { ...decision.document, undo: [] } },
    }),
  ).model;
  expect(canvas(confirmed).nodes.find((node) => node.id === 'a')?.position).toEqual({
    x: 50,
    y: 50,
  });
  expect(confirmed.session.pending).toBeNull();
  expect(saveStatus(confirmed)).toBe('Saved');
  expect(confirmed.ownEdits).toEqual([
    { operationId: own.request.operationId, documentVersion: 1 },
  ]);
  expect(confirmed.assessment).toEqual(draft);
  assert(confirmed.assessment.status === 'editing');
  expect(confirmed.assessment.draft.target.graphVersion).toBe(0);
  expect(confirmed.session.confirmed?.document.version).toBe(1);
});
