import { expect, test } from 'bun:test';

import {
  createOperationDocument,
  decideOperation,
  parseGraph,
  recoverOperationDocument,
} from '@opsydyn/foldkit-zloz';
import { operationHash } from '@opsydyn/foldkit-zloz-alchemy/hash';
import { Schema } from 'effect';

import fixture from '../../../packages/foldkit-zloz/test/fixtures/operations-v1.json';
import { feedDescriptor } from '../src/editor/feed-state';
import { init, Message, saveStatus, update } from '../src/editor/main';
import { renderBoard } from './render-native';

const props = {
  teamId: 'team',
  diagramId: 'diagram',
  actorId: 'actor',
  role: 'owner' as const,
  name: 'Test diagram',
};
const room = { ...props, generation: 'generation' };
const frame = {
  target: room,
  sourceVersion: 1,
  document: createOperationDocument(
    parseGraph(JSON.stringify({ version: 1, graph: fixture.graph })),
  ),
  coverage: [],
};
const ready = () => {
  const started = update(
    init(props).model,
    Message.SucceededIdentity({ generation: room.generation }),
  ).model;
  return update(started, Message.ObservedFrame({ run: 0, room, frame })).model;
};
const event = (
  model: Parameters<typeof update>[0],
  input: Parameters<typeof Message.ObservedEditorInput>[0]['event'],
) => update(model, Message.ObservedEditorInput({ event: input })).model;

test('reselecting the current node preserves a rename draft queued by the input', () => {
  const selected = event(ready(), { type: 'NodeSelected', id: 'a', additive: false });
  const editing = update(selected, Message.ChangedLabel({ text: 'New label' })).model;
  const reselected = event(editing, { type: 'NodeSelected', id: 'a', additive: false });
  expect(reselected.draft).toBe('New label');

  const other = event(reselected, { type: 'NodeSelected', id: 'b', additive: false });
  expect(other.draft).toBe('Beta');
});

test('caught-up replacement snapshots keep the canvas identity while installing source metadata', () => {
  const live = ready();
  const handoff = update(live, Message.ObservedRenewal({ room, run: live.socketRun })).model;
  const promoted = update(
    handoff,
    Message.ObservedFrame({
      room,
      run: handoff.socketRun,
      frame: JSON.parse(JSON.stringify({ ...frame, sourceVersion: 2 })),
    }),
  ).model;
  expect(promoted.connection._tag).toBe('Live');
  expect(promoted.socketSlot).toBe('b');
  expect(promoted.session.confirmed?.sourceVersion).toBe(2);
  expect(promoted.session.confirmed?.document).toBe(live.session.confirmed?.document);
  expect(promoted.editor).toBe(live.editor);
  expect(saveStatus(promoted)).toBe('Saved');
});

test('handoff keeps the primary subscription and promotes only a caught-up bound replacement', async () => {
  const failed = update(
    ready(),
    Message.ObservedDisconnect({ room, run: 0, reason: 'failure' }),
  ).model;
  const live = update(failed, Message.ObservedFrame({ room, run: failed.socketRun, frame })).model;
  const before = feedDescriptor(live, 'a');
  const handoff = update(live, Message.ObservedRenewal({ room, run: live.socketRun })).model;
  expect(handoff.connection._tag).toBe('Handoff');
  expect(feedDescriptor(handoff, 'a')).toEqual(before);
  expect(feedDescriptor(handoff, 'b')).toEqual({ active: true, run: handoff.socketRun, delay: 0 });
  expect(saveStatus(handoff)).toBe('Saved');
  expect(update(handoff, Message.ObservedRenewal({ room, run: live.socketRun })).model).toBe(
    handoff,
  );
  const own = await preparedOwnEdit(live);
  const progressed = update(
    handoff,
    Message.ObservedFrame({ room, run: live.socketRun, frame: own.confirmed }),
  ).model;
  expect(progressed.connection._tag).toBe('Handoff');
  expect(progressed.session.confirmed?.document.version).toBe(1);
  expect(feedDescriptor(progressed, 'a')).toEqual(before);
  expect(
    update(progressed, Message.ObservedFrame({ room, run: handoff.socketRun, frame })).model,
  ).toBe(progressed);
  expect(
    update(
      progressed,
      Message.ObservedFrame({
        room,
        run: handoff.socketRun,
        frame: { ...own.confirmed, target: { teamId: 'other', diagramId: room.diagramId } },
      }),
    ).model,
  ).toBe(progressed);
  expect(
    update(
      progressed,
      Message.ObservedFrame({
        room,
        run: handoff.socketRun,
        frame: { ...own.confirmed, sourceVersion: NaN },
      }),
    ).model,
  ).toBe(progressed);
  const candidate = feedDescriptor(progressed, 'b');
  const promoted = update(
    progressed,
    Message.ObservedFrame({ room, run: handoff.socketRun, frame: own.confirmed }),
  ).model;
  expect(promoted.connection._tag).toBe('Live');
  expect(promoted.socketSlot).toBe('b');
  expect(feedDescriptor(promoted, 'b')).toEqual(candidate);
  expect(feedDescriptor(promoted, 'a').active).toBe(false);
  expect(
    update(
      promoted,
      Message.ObservedFrame({
        room,
        run: live.socketRun,
        frame: { ...own.confirmed, sourceVersion: 999 },
      }),
    ).model,
  ).toBe(promoted);
  expect(
    update(promoted, Message.ObservedDisconnect({ room, run: live.socketRun, reason: 'lease' }))
      .model,
  ).toBe(promoted);
  const again = update(promoted, Message.ObservedRenewal({ room, run: promoted.socketRun })).model;
  expect(feedDescriptor(again, 'b')).toEqual(feedDescriptor(promoted, 'b'));
  expect(feedDescriptor(again, 'a').active).toBe(true);
});

test('failed candidates retain the current feed and an old-feed close preserves the opening replacement', () => {
  const original = ready();
  const handoff = update(
    original,
    Message.ObservedRenewal({ room, run: original.socketRun }),
  ).model;
  const old = feedDescriptor(handoff, 'a');
  const failed = update(
    handoff,
    Message.ObservedDisconnect({ room, run: handoff.socketRun, reason: 'failure' }),
  ).model;
  expect(failed.connection._tag).toBe('Handoff');
  expect(feedDescriptor(failed, 'a')).toEqual(old);
  expect(feedDescriptor(failed, 'b')).toEqual({
    active: true,
    run: handoff.socketRun + 1,
    delay: 1000,
  });
  expect(saveStatus(failed)).toBe('Saved');
  expect(update(failed, Message.ObservedFrame({ room, run: handoff.socketRun, frame })).model).toBe(
    failed,
  );
  expect(
    update(failed, Message.ObservedDisconnect({ room, run: handoff.socketRun, reason: 'failure' }))
      .model,
  ).toBe(failed);
  const pending = feedDescriptor(failed, 'b');
  const closed = update(
    failed,
    Message.ObservedDisconnect({ room, run: original.socketRun, reason: 'lease' }),
  ).model;
  expect(closed.connection._tag).toBe('Reconnecting');
  expect(closed.socketSlot).toBe('b');
  expect(feedDescriptor(closed, 'b')).toEqual(pending);
  expect(feedDescriptor(closed, 'a').active).toBe(false);
  const restored = update(
    closed,
    Message.ObservedFrame({ room, run: closed.socketRun, frame }),
  ).model;
  expect(feedDescriptor(restored, 'b')).toEqual(pending);
  expect(saveStatus(restored)).toBe('Saved');
});

test('an authorized current feed can become Live after a newer HTTP snapshot without regressing it', async () => {
  const own = await preparedOwnEdit();
  const identified = update(
    init(props).model,
    Message.SucceededIdentity({ generation: room.generation }),
  ).model;
  const snapshotted = update(
    identified,
    Message.SucceededSnapshot({ room, frame: own.confirmed, role: 'owner' }),
  ).model;
  const next = update(
    snapshotted,
    Message.ObservedFrame({ room, run: snapshotted.socketRun, frame }),
  ).model;
  expect(next.connection._tag).toBe('Live');
  expect(next.session.confirmed?.document.version).toBe(own.confirmed.document.version);
  expect(next.session.confirmed?.sourceVersion).toBe(own.confirmed.sourceVersion);
  expect(saveStatus(next)).toBe('Saved');
});

test('handoff does not invent an edit outcome and denial retires both feeds permanently', async () => {
  const own = await preparedOwnEdit();
  const handoff = update(
    own.prepared,
    Message.ObservedRenewal({ room, run: own.prepared.socketRun }),
  ).model;
  const unconfirmed = update(
    handoff,
    Message.ObservedFrame({ room, run: handoff.socketRun, frame }),
  ).model;
  expect(unconfirmed.session.pending).toBe(handoff.session.pending);
  expect(saveStatus(unconfirmed)).toBe('Saving…');
  const confirmed = update(
    unconfirmed,
    Message.ObservedFrame({ room, run: unconfirmed.socketRun, frame: own.confirmed }),
  ).model;
  expect(saveStatus(confirmed)).toBe('Saved');
  expect(confirmed.session.pending).toBeNull();
  const denied = update(handoff, Message.FailedPresence({ room, status: 403 })).model;
  expect(feedDescriptor(denied, 'a').active).toBe(false);
  expect(feedDescriptor(denied, 'b').active).toBe(false);
  for (const run of [own.prepared.socketRun, handoff.socketRun]) {
    expect(update(denied, Message.ObservedFrame({ room, run, frame: own.confirmed })).model).toBe(
      denied,
    );
    expect(update(denied, Message.ObservedDisconnect({ room, run, reason: 'lease' })).model).toBe(
      denied,
    );
    expect(update(denied, Message.ObservedRenewal({ room, run })).model).toBe(denied);
  }
  expect(update(denied, Message.ClickedRetry()).model).toBe(denied);
});

test('independently decoded peer frames retain unchanged Model branches without discarding any changed value', () => {
  const original = ready();
  const previous = original.session.confirmed!;
  const originalBytes = JSON.stringify(original);
  const duplicate = update(
    original,
    Message.ObservedFrame({ run: 0, room, frame: JSON.parse(JSON.stringify(previous)) }),
  ).model;
  expect(duplicate.session.confirmed).toBe(previous);
  const renamed = decideOperation(
    previous.document,
    {
      version: 1,
      operationId: 'peer-rename-sharing',
      operation: { type: 'RenameNode', id: 'a', expected: 0, label: 'Peer Alpha' },
    },
    { actorId: 'peer', teamId: 'team', diagramId: 'diagram' },
  );
  expect(renamed.receipt.status).toBe('accepted');
  const incoming = {
    ...previous,
    sourceVersion: 2,
    document: { ...renamed.document, undo: [] },
    coverage: [
      {
        actorId: 'peer',
        operationId: 'peer-rename-sharing',
        requestHash: 'a'.repeat(64),
        documentVersion: 1,
        status: 'accepted' as const,
      },
    ],
  };
  const next = update(
    original,
    Message.ObservedFrame({ run: 0, room, frame: JSON.parse(JSON.stringify(incoming)) }),
  ).model;
  const confirmed = next.session.confirmed!;
  expect(confirmed).toEqual(incoming);
  expect(confirmed.document.graph.nodes[0]!.label).toBe('Peer Alpha');
  expect(confirmed.document.graph.nodes[1]).toBe(previous.document.graph.nodes[1]);
  expect(confirmed.document.graph.nodes[0]!.ports).toBe(previous.document.graph.nodes[0]!.ports);
  expect(confirmed.document.graph.edges).toBe(previous.document.graph.edges);
  expect(confirmed.document.nodes[1]).toBe(previous.document.nodes[1]);
  expect(confirmed.document.edges).toBe(previous.document.edges);
  expect(next.ownEdits).toEqual([]);
  expect(JSON.stringify(original)).toBe(originalBytes);
});

test('frame sharing preserves recovery, reordered entities, removed records and prototype-sensitive JSON metadata', () => {
  const original = ready();
  const previous = original.session.confirmed!;
  const graph = {
    nodes: [
      previous.document.graph.nodes[1]!,
      {
        ...previous.document.graph.nodes[0]!,
        data: JSON.parse(
          '{"__proto__":{"retained":true},"constructor":"metadata","nested":{"list":[3,2,1],"nil":null}}',
        ),
      },
    ],
    edges: [{ ...previous.document.graph.edges[0]!, data: { replacement: [null, true] } }],
  };
  const recovery = recoverOperationDocument(previous.document, graph, 0).document;
  const incoming = {
    ...previous,
    sourceVersion: 2,
    undoResetVersion: recovery.version,
    document: { ...recovery, undo: [] },
  };
  const before = JSON.stringify(incoming);
  const next = update(
    original,
    Message.ObservedFrame({ run: 0, room, frame: JSON.parse(before) }),
  ).model;
  expect(next.session.confirmed).toEqual(incoming);
  expect(next.session.confirmed!.document.graph).toEqual(graph);
  expect(next.session.confirmed!.document.nodes.find((clock) => clock.id === 'g')?.present).toBe(
    false,
  );
  expect(next.session.confirmed!.document.edges.find((clock) => clock.id === 'cb')?.present).toBe(
    false,
  );
  expect(Object.keys(next.session.confirmed!.document.graph.nodes[1]!.data!)).toContain(
    '__proto__',
  );
  expect(JSON.stringify(incoming)).toBe(before);
  expect(original.session.confirmed).toBe(previous);
});

test('equal graph values still install fresh field clocks and a current viewer role', () => {
  const original = ready();
  const previous = original.session.confirmed!;
  const scope = { actorId: 'peer', teamId: 'team', diagramId: 'diagram' };
  const changed = decideOperation(
    previous.document,
    {
      version: 1,
      operationId: 'temporary-label',
      operation: { type: 'RenameNode', id: 'a', expected: 0, label: 'Temporary' },
    },
    scope,
  );
  const restored = decideOperation(
    changed.document,
    {
      version: 1,
      operationId: 'restored-label',
      operation: { type: 'RenameNode', id: 'a', expected: 1, label: 'Alpha' },
    },
    scope,
  );
  expect(restored.receipt.status).toBe('accepted');
  const incoming = { ...previous, sourceVersion: 3, document: { ...restored.document, undo: [] } };
  const next = update(
    original,
    Message.ObservedFrame({ run: 0, room, frame: JSON.parse(JSON.stringify(incoming)) }),
  ).model;
  expect(next.session.confirmed).toEqual(incoming);
  expect(next.session.confirmed!.document.graph).toBe(previous.document.graph);
  const pending = event(next, { type: 'NodeLabelChanged', id: 'a', label: 'Fresh edit' }).session
    .pending;
  expect(pending?.request.operation).toEqual({
    type: 'RenameNode',
    id: 'a',
    expected: 2,
    label: 'Fresh edit',
  });
  const viewer = update(
    next,
    Message.SucceededSnapshot({ room, frame: incoming, role: 'viewer' }),
  ).model;
  expect(viewer.role).toBe('viewer');
  const forbidden = update(
    viewer,
    Message.ObservedEditorInput({
      event: { type: 'NodeLabelChanged', id: 'a', label: 'Forbidden' },
    }),
  );
  expect(forbidden.model.session.pending).toBeNull();
  expect(forbidden.model.session.confirmed).toBe(viewer.session.confirmed);
  const readEditor = Schema.decodeUnknownSync(
    Schema.Struct({ graph: Schema.Unknown, readOnly: Schema.Boolean }),
  );
  expect(readEditor(forbidden.model.editor).graph).toBe(readEditor(viewer.editor).graph);
  expect(readEditor(forbidden.model.editor).readOnly).toBe(true);
  expect(forbidden.commands).toBeUndefined();
  const invalid = JSON.parse(JSON.stringify(incoming));
  invalid.document.nodes[0].label = -1;
  expect(update(next, Message.ObservedFrame({ run: 0, room, frame: invalid })).model).toBe(next);
});

test('a surface measurement before the first frame remains local and survives identity and snapshot startup', () => {
  const opening = init(props).model;
  const measured = update(
    opening,
    Message.ObservedEditorInput({
      event: { type: 'SurfaceMeasured', size: { width: 800, height: 500 } },
    }),
  );
  const surface = (model: typeof opening) =>
    Schema.decodeUnknownSync(
      Schema.Struct({
        surface: Schema.NullOr(Schema.Struct({ width: Schema.Number, height: Schema.Number })),
      }),
    )(model.editor).surface;
  expect(surface(measured.model)).toEqual({ width: 800, height: 500 });
  expect(measured.model.session.confirmed).toBeNull();
  expect(measured.model.room.generation).toBe('');
  expect(measured.commands).toBeUndefined();
  const identified = update(
    measured.model,
    Message.SucceededIdentity({ generation: room.generation }),
  ).model;
  const confirmed = update(identified, Message.ObservedFrame({ run: 0, room, frame })).model;
  expect(surface(confirmed)).toEqual({ width: 800, height: 500 });
  expect(confirmed.session.confirmed?.document.graph).toEqual(frame.document.graph);
});

test('invalid startup measurements and late measurements after access ends cannot change the Model', () => {
  const opening = init(props).model;
  for (const size of [
    { width: 0, height: 500 },
    { width: 800, height: 0 },
    { width: Number.NaN, height: 500 },
    { width: 800, height: Number.POSITIVE_INFINITY },
  ]) {
    const observed = update(
      opening,
      Message.ObservedEditorInput({ event: { type: 'SurfaceMeasured', size } }),
    );
    expect(observed.model).toBe(opening);
    expect(observed.commands).toBeUndefined();
  }
  const denied = update(ready(), Message.FailedPresence({ room, status: 403 })).model;
  expect(
    update(
      denied,
      Message.ObservedEditorInput({
        event: { type: 'SurfaceMeasured', size: { width: 800, height: 500 } },
      }),
    ).model,
  ).toBe(denied);
});

test('sub-threshold selection never enqueues a canonical move or leaves Saved', () => {
  const original = ready();
  const started = event(original, {
    type: 'NodeDragStarted',
    id: 'a',
    pointer: 1,
    point: { x: 100, y: 100 },
  });
  const moved = event(started, { type: 'PointerMoved', pointer: 1, point: { x: 101, y: 102 } });
  const released = update(
    moved,
    Message.ObservedEditorInput({
      event: { type: 'PointerReleased', pointer: 1 },
    }),
  );
  expect(released.commands).toBeUndefined();
  expect(released.model.session.pending).toBeNull();
  expect(released.model.session.confirmed?.document).toBe(original.session.confirmed?.document);
  expect(saveStatus(released.model)).toBe('Saved');
  expect(released.model.ownEdits).toEqual(original.ownEdits);
});

test('an authored gesture preview is not shown as Saved', () => {
  const original = ready();
  expect(saveStatus(original)).toBe('Saved');
  const started = event(original, {
    type: 'NodeDragStarted',
    id: 'a',
    pointer: 1,
    point: { x: 10, y: 20 },
  });
  const moved = event(started, { type: 'PointerMoved', pointer: 1, point: { x: 40, y: 50 } });
  expect(saveStatus(moved)).toBe('Editing…');
});

test('failed request preparation restores confirmed geometry', () => {
  const original = ready();
  const started = event(original, {
    type: 'NodeDragStarted',
    id: 'a',
    pointer: 1,
    point: { x: 10, y: 20 },
  });
  const moved = event(started, { type: 'PointerMoved', pointer: 1, point: { x: 40, y: 50 } });
  const released = event(moved, { type: 'PointerReleased', pointer: 1 });
  expect(saveStatus(released)).toBe('Saving…');
  const failed = update(released, Message.FailedPreparation({ room })).model;
  const decoded = Schema.decodeUnknownSync(Schema.Struct({ graph: Schema.Unknown }))(failed.editor);
  expect(decoded.graph).toEqual(frame.document.graph);
});

test('a late identity callback cannot replace an established room', () => {
  const original = ready();
  expect(update(original, Message.SucceededIdentity({ generation: 'late' })).model).toEqual(
    original,
  );
});

test('authorization denial cannot be reopened by a late socket close or frame', () => {
  const original = ready();
  const denied = update(original, Message.FailedPresence({ room, status: 403 })).model;
  expect(denied.connection._tag).toBe('Denied');
  expect(
    update(denied, Message.ObservedDisconnect({ room, run: denied.socketRun, reason: 'failure' }))
      .model,
  ).toEqual(denied);
  expect(update(denied, Message.ObservedFrame({ run: 0, room, frame })).model).toEqual(denied);
});

test('typed room generations reject callbacks after switching diagrams or logging out', () => {
  const original = ready();
  const other = init({ ...props, diagramId: 'another-diagram' }).model;
  expect(update(other, Message.SucceededSnapshot({ room, frame, role: 'owner' })).model).toEqual(
    other,
  );
  const loggedOut = update(original, Message.FailedSnapshot({ room, status: 401 })).model;
  expect(update(loggedOut, Message.ObservedFrame({ run: 0, room, frame })).model).toEqual(
    loggedOut,
  );
});

test('failed presence refresh clears unverified peers without disabling graph editing', () => {
  const known = update(
    ready(),
    Message.SucceededPresence({
      room,
      peers: [
        {
          connectionId: 'peer',
          actorId: 'peer-actor',
          name: 'Peer',
          selection: ['a'],
          cursor: null,
          seenAt: 1,
        },
      ],
    }),
  ).model;
  expect(known.peers).toHaveLength(1);
  const failed = update(known, Message.FailedPresence({ room, status: 503 })).model;
  expect(failed.peers).toEqual([]);
  expect(failed.connection._tag).toBe('Live');
});

test('denial is terminal for late HTTP success, network failure and prepared writes', () => {
  const denied = update(ready(), Message.FailedSnapshot({ room, status: 401 })).model;
  expect(update(denied, Message.SucceededSnapshot({ room, frame, role: 'owner' })).model).toEqual(
    denied,
  );
  expect(update(denied, Message.FailedSnapshot({ room, status: 0 })).model).toEqual(denied);
});

test('live canonical geometry remains visible during a pan and release does not enqueue a write', () => {
  const original = ready();
  const panning = event(original, { type: 'PanStarted', pointer: 1, point: { x: 0, y: 0 } });
  const peer = decideOperation(
    frame.document,
    {
      version: 1,
      operationId: 'peer-move',
      operation: {
        type: 'MoveNodes',
        nodes: [{ id: 'a', expected: 0, position: { x: 70, y: 90 } }],
      },
    },
    { teamId: props.teamId, diagramId: props.diagramId, actorId: 'peer' },
  );
  const received = update(
    panning,
    Message.ObservedFrame({
      run: 0,
      room,
      frame: { ...frame, sourceVersion: 2, document: { ...peer.document, undo: [] } },
    }),
  ).model;
  const decoded = Schema.decodeUnknownSync(Schema.Struct({ graph: Schema.Unknown }))(
    received.editor,
  );
  expect(decoded.graph).toEqual(peer.document.graph);
  const released = update(
    received,
    Message.ObservedEditorInput({ event: { type: 'PointerReleased', pointer: 1 } }),
  );
  expect(released.commands ?? []).toEqual([]);
  expect(released.model.session.pending).toBeNull();
});

test('another pointer cannot discard the observed versions of an active drag', () => {
  const start = event(ready(), {
    type: 'NodeDragStarted',
    id: 'a',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const moved = event(start, { type: 'PointerMoved', pointer: 1, point: { x: 30, y: 30 } });
  const peer = decideOperation(
    frame.document,
    {
      version: 1,
      operationId: 'peer-move',
      operation: {
        type: 'MoveNodes',
        nodes: [{ id: 'a', expected: 0, position: { x: 70, y: 90 } }],
      },
    },
    { teamId: props.teamId, diagramId: props.diagramId, actorId: 'peer' },
  );
  const received = update(
    moved,
    Message.ObservedFrame({
      run: 0,
      room,
      frame: { ...frame, sourceVersion: 2, document: { ...peer.document, undo: [] } },
    }),
  ).model;
  const unrelated = event(received, { type: 'PointerReleased', pointer: 2 });
  expect(unrelated.session.pending).toBeNull();
  expect(unrelated.base?.version).toBe(0);
  const released = event(unrelated, { type: 'PointerReleased', pointer: 1 });
  expect(released.session.pending?.request.operation).toMatchObject({
    type: 'MoveNodes',
    nodes: [{ id: 'a', expected: 0 }],
  });
});

test('authorization lease renewal reconnects immediately while failures retain bounded retry backoff', () => {
  const original = ready();
  const renewed = update(
    original,
    Message.ObservedDisconnect({ room, run: original.socketRun, reason: 'lease' }),
  ).model;
  expect(renewed.socketRun).toBe(original.socketRun + 1);
  expect(renewed.reconnectDelayMs).toBe(0);
  const failed = update(
    renewed,
    Message.ObservedDisconnect({ room, run: renewed.socketRun, reason: 'failure' }),
  ).model;
  expect(failed.reconnectDelayMs).toBe(1000);
  expect(
    update(failed, Message.ObservedDisconnect({ room, run: renewed.socketRun, reason: 'lease' }))
      .model,
  ).toEqual(failed);
});

const preparedOwnEdit = async (model = ready()) => {
  const queued = update(model, Message.ClickedAdd()).model;
  const request = queued.session.pending!.request;
  const hash = await operationHash(request);
  const prepared = update(queued, Message.PreparedEdit({ room, request, hash })).model;
  const decision = decideOperation(model.session.confirmed!.document, request, {
    teamId: room.teamId,
    diagramId: room.diagramId,
    actorId: room.actorId,
  });
  expect(decision.receipt.status).toBe('accepted');
  const sourceVersion = model.session.confirmed!.sourceVersion + 1;
  return {
    prepared,
    request,
    reply: { receipt: decision.receipt, sourceVersion, requestHash: hash },
    confirmed: {
      ...frame,
      sourceVersion,
      document: { ...decision.document, undo: [] },
      undoResetVersion: model.session.confirmed!.undoResetVersion ?? 0,
      coverage: [
        {
          actorId: room.actorId,
          operationId: request.operationId,
          requestHash: hash,
          documentVersion: decision.document.version,
          status: 'accepted' as const,
        },
      ],
    },
  };
};

test('transient snapshot failures renew the live feed without confirming or replacing an uncertain edit', async () => {
  const own = await preparedOwnEdit();
  const uncertain = update(
    own.prepared,
    Message.FailedEdit({ room, operationId: own.request.operationId }),
  ).model;
  for (const status of [0, 429, 500, 503]) {
    const failed = update(uncertain, Message.FailedSnapshot({ room, status })).model;
    expect(failed.connection._tag).toBe('Reconnecting');
    expect(failed.socketRun).toBe(uncertain.socketRun + 1);
    expect(failed.reconnectDelayMs).toBe(1000);
    expect(failed.session.pending).toBe(uncertain.session.pending);
    expect(failed.session.confirmed).toBe(uncertain.session.confirmed);
    expect(failed.ownEdits).toEqual([]);
    expect(saveStatus(failed)).toBe('Save outcome unknown');
    expect(
      update(
        failed,
        Message.ObservedDisconnect({ room, run: uncertain.socketRun, reason: 'failure' }),
      ).model,
    ).toBe(failed);
    const acknowledged = update(
      failed,
      Message.SucceededSnapshot({ room, frame: own.confirmed, role: 'owner' }),
    ).model;
    expect(acknowledged.session.pending).toBeNull();
    expect(saveStatus(acknowledged)).toBe('Reconnecting…');
    const live = update(
      acknowledged,
      Message.ObservedFrame({ run: acknowledged.socketRun, room, frame: own.confirmed }),
    ).model;
    expect(saveStatus(live)).toBe('Saved');
  }
});

test('manual retry renews a reconnecting feed immediately and preserves the original pending request', async () => {
  const own = await preparedOwnEdit();
  const failed = update(
    own.prepared,
    Message.ObservedDisconnect({ room, run: own.prepared.socketRun, reason: 'failure' }),
  ).model;
  const retried = update(failed, Message.ClickedRetry()).model;
  expect(retried.socketRun).toBe(failed.socketRun + 1);
  expect(retried.reconnectDelayMs).toBe(0);
  expect(retried.session.pending).toBe(failed.session.pending);
  expect(retried.session.confirmed).toBe(failed.session.confirmed);
  expect(saveStatus(retried)).toBe('Saving…');
  const empty = update(
    ready(),
    Message.ObservedDisconnect({ room, run: 0, reason: 'failure' }),
  ).model;
  const reconnected = update(empty, Message.ClickedRetry()).model;
  expect(reconnected.socketRun).toBe(empty.socketRun + 1);
  expect(reconnected.reconnectDelayMs).toBe(0);
  expect(saveStatus(reconnected)).toBe('Reconnecting…');
});

test('late snapshot transport failure renews the feed while authorization denial remains terminal', () => {
  const original = ready();
  const failed = update(original, Message.FailedSnapshot({ room, status: 0 })).model;
  expect(failed.socketRun).toBe(original.socketRun + 1);
  expect(saveStatus(failed)).toBe('Reconnecting…');
  const live = update(failed, Message.ObservedFrame({ run: failed.socketRun, room, frame })).model;
  expect(saveStatus(live)).toBe('Saved');
  for (const status of [401, 403, 404]) {
    const denied = update(live, Message.FailedSnapshot({ room, status })).model;
    expect(denied.connection._tag).toBe('Denied');
    expect(saveStatus(denied)).toBe('Access ended');
    expect(update(denied, Message.ClickedRetry()).model).toBe(denied);
    expect(update(denied, Message.ObservedFrame({ run: 0, room, frame })).model).toBe(denied);
    expect(update(denied, Message.SucceededSnapshot({ room, frame, role: 'owner' })).model).toBe(
      denied,
    );
  }
});

test('recovery clears local Undo during a gesture and valid post-recovery edits remain undoable', async () => {
  const own = await preparedOwnEdit();
  const acknowledged = update(
    own.prepared,
    Message.ObservedFrame({ run: 0, room, frame: own.confirmed }),
  ).model;
  expect(acknowledged.ownEdits.map((entry) => entry.operationId)).toEqual([
    own.request.operationId,
  ]);
  const active = event(acknowledged, {
    type: 'NodeDragStarted',
    id: 'a',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const restored = recoverOperationDocument(
    own.confirmed.document,
    frame.document.graph,
    1,
  ).document;
  const recoveryFrame = { ...frame, document: restored, sourceVersion: 3, undoResetVersion: 2 };
  const recovered = update(
    active,
    Message.ObservedFrame({ run: 0, room, frame: recoveryFrame }),
  ).model;
  expect(recovered.ownEdits).toEqual([]);
  expect(update(recovered, Message.ClickedUndo()).commands ?? []).toEqual([]);
  const idle = event(recovered, { type: 'GestureCancelled' });
  const next = await preparedOwnEdit(idle);
  const received = update(
    next.prepared,
    Message.ObservedFrame({ run: 0, room, frame: next.confirmed }),
  ).model;
  expect(received.ownEdits.map((entry) => entry.operationId)).toEqual([next.request.operationId]);
  expect(update(received, Message.ClickedUndo()).model.session.pending?.request.operation).toEqual({
    type: 'Undo',
    operationId: next.request.operationId,
  });
});

test('recovery cannot resurrect old Undo through either HTTP/feed acknowledgement ordering', async () => {
  for (const replyFirst of [false, true]) {
    const own = await preparedOwnEdit();
    const waiting = replyFirst
      ? update(own.prepared, Message.SucceededEdit({ room, reply: own.reply })).model
      : own.prepared;
    const restored = recoverOperationDocument(
      own.confirmed.document,
      frame.document.graph,
      1,
    ).document;
    const recovered = update(
      waiting,
      Message.ObservedFrame({
        run: 0,
        room,
        frame: { ...own.confirmed, document: restored, sourceVersion: 3, undoResetVersion: 2 },
      }),
    ).model;
    expect(recovered.session.pending).toBeNull();
    expect(recovered.ownEdits).toEqual([]);
    const late = update(recovered, Message.SucceededEdit({ room, reply: own.reply })).model;
    expect(late.ownEdits).toEqual([]);
    expect(saveStatus(late)).toBe('Saved');
  }
});

test('ordinary peer changes and unsuccessful restores preserve locally acknowledged Undo', async () => {
  const own = await preparedOwnEdit();
  const acknowledged = update(
    own.prepared,
    Message.ObservedFrame({ run: 0, room, frame: own.confirmed }),
  ).model;
  const unchanged = update(
    acknowledged,
    Message.ObservedFrame({ run: 0, room, frame: { ...own.confirmed, sourceVersion: 3 } }),
  ).model;
  expect(unchanged.ownEdits.map((entry) => entry.operationId)).toEqual([own.request.operationId]);
  const peer = decideOperation(
    own.confirmed.document,
    {
      version: 1,
      operationId: 'peer-label',
      operation: { type: 'RenameNode', id: 'a', expected: 0, label: 'Peer label' },
    },
    { teamId: room.teamId, diagramId: room.diagramId, actorId: 'peer' },
  );
  const received = update(
    unchanged,
    Message.ObservedFrame({
      run: 0,
      room,
      frame: { ...own.confirmed, document: { ...peer.document, undo: [] }, sourceVersion: 4 },
    }),
  ).model;
  expect(received.ownEdits.map((entry) => entry.operationId)).toEqual([own.request.operationId]);
});

test('late HTTP acceptance after coverage eviction retains only post-reset Undo', async () => {
  const own = await preparedOwnEdit();
  const restored = recoverOperationDocument(
    own.confirmed.document,
    frame.document.graph,
    1,
  ).document;
  const recovered = update(
    own.prepared,
    Message.ObservedFrame({
      run: 0,
      room,
      frame: { ...frame, document: restored, sourceVersion: 200, undoResetVersion: 2 },
    }),
  ).model;
  expect(recovered.session.pending).not.toBeNull();
  const lateOld = update(recovered, Message.SucceededEdit({ room, reply: own.reply })).model;
  expect(lateOld.session.pending).toBeNull();
  expect(lateOld.ownEdits).toEqual([]);
  const next = await preparedOwnEdit(lateOld);
  // Rejected decisions can evict receipt coverage without evicting the private
  // accepted inverse journal. The exact HTTP receipt still proves this outcome.
  const observed = update(
    next.prepared,
    Message.ObservedFrame({
      run: 0,
      room,
      frame: { ...next.confirmed, sourceVersion: 400, coverage: [] },
    }),
  ).model;
  expect(observed.session.pending).not.toBeNull();
  const foreign = update(
    observed,
    Message.SucceededEdit({
      room,
      reply: { ...next.reply, receipt: { ...next.reply.receipt, actorId: 'foreign' } },
    }),
  ).model;
  expect(foreign.session.pending).not.toBeNull();
  expect(foreign.ownEdits).toEqual([]);
  const accepted = update(foreign, Message.SucceededEdit({ room, reply: next.reply })).model;
  expect(accepted.session.pending).toBeNull();
  expect(accepted.ownEdits.map((entry) => entry.operationId)).toEqual([next.request.operationId]);
});

test('learning a recovery marker late preserves edits acknowledged after that recovery', async () => {
  const own = await preparedOwnEdit();
  const acknowledged = update(
    own.prepared,
    Message.ObservedFrame({ run: 0, room, frame: own.confirmed }),
  ).model;
  const restored = recoverOperationDocument(
    own.confirmed.document,
    frame.document.graph,
    1,
  ).document;
  // A legacy producer can deliver the replacement graph before the new marker.
  const legacy = update(
    acknowledged,
    Message.ObservedFrame({
      run: 0,
      room,
      frame: { ...frame, document: restored, sourceVersion: 3 },
    }),
  ).model;
  const next = await preparedOwnEdit(legacy);
  const newer = update(
    next.prepared,
    Message.ObservedFrame({ run: 0, room, frame: next.confirmed }),
  ).model;
  const learned = update(
    newer,
    Message.ObservedFrame({
      run: 0,
      room,
      frame: { ...next.confirmed, sourceVersion: 400, undoResetVersion: 2 },
    }),
  ).model;
  expect(learned.ownEdits).toEqual([{ operationId: next.request.operationId, documentVersion: 3 }]);
  expect(update(learned, Message.ClickedUndo()).model.session.pending?.request.operation).toEqual({
    type: 'Undo',
    operationId: next.request.operationId,
  });
});

test('History opens the latest confirmed version in focus mode and leaves the live session intact', () => {
  const focused = update(ready(), Message.ToggledBoardFocus()).model;
  const reviewing = update(focused, Message.OpenedLatestHistory()).model;
  expect(reviewing.historyReview).toBeTruthy();
  expect(reviewing.session).toBe(focused.session);
  const returned = update(reviewing, Message.ClosedHistory()).model;
  expect(returned.focusedBoard).toBe(true);
  expect(returned.session).toBe(focused.session);
  const offline = update(
    focused,
    Message.ObservedDisconnect({ room, run: 0, reason: 'failure' }),
  ).model;
  expect(update(offline, Message.OpenedLatestHistory()).model).toBe(offline);
});

test('rewind keeps the historical canvas above its transport as live advances and returns to the new live version in one action', async () => {
  const live = ready();
  const reviewing = update(live, Message.OpenedLatestHistory()).model;
  const peer = await preparedOwnEdit(live);
  const advanced = update(
    reviewing,
    Message.ObservedFrame({ room, run: 0, frame: peer.confirmed }),
  ).model;
  expect(advanced.historyReview).toBe(reviewing.historyReview);
  const rendered = await renderBoard(advanced);
  expect(rendered.html).toContain('Read-only · Version 0');
  expect(rendered.html).toContain('Live version 1');
  expect(rendered.html).toContain('Only one version in this session window');
  expect(rendered.html.indexOf('id="history-diagram-surface"')).toBeGreaterThan(-1);
  expect(rendered.html.indexOf('id="history-back-live"')).toBeGreaterThan(
    rendered.html.indexOf('id="history-diagram-surface"'),
  );
  const returned = update(advanced, Message.ClosedHistory()).model;
  expect(returned.historyReview).toBeNull();
  expect(returned.session.confirmed?.document.version).toBe(1);
  expect(returned.session).toBe(advanced.session);
  expect(returned.session.pending).toBeNull();
});

test('manual rewind steps across the confirmed window with reduced motion and keeps live edits intact', async () => {
  const initial = ready();
  const advance = await preparedOwnEdit(initial);
  const live = update(
    initial,
    Message.ObservedFrame({ room, run: 0, frame: advance.confirmed }),
  ).model;
  const reviewing = update(
    { ...live, historyReducedMotion: true },
    Message.OpenedLatestHistory(),
  ).model;
  const stepped = update(
    reviewing,
    Message.ChangedHistoryPlayback({
      run: reviewing.historyRun,
      event: { type: 'PreviousClicked' },
    }),
  ).model;
  const rendered = await renderBoard(stepped);
  expect(rendered.html).toContain('Session window · Versions 0–1');
  expect(rendered.html).toContain('Reduced motion · Step or scrub manually.');
  expect(rendered.html).toContain('Read-only · Version 0');
  expect(rendered.html).toContain('Live version 1');
  expect(stepped.session).toBe(live.session);
  expect(stepped.ownEdits).toBe(live.ownEdits);
});
