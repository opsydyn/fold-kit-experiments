import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { createOperationDocument, decideOperation } from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';

import { workshopLinkDenial } from '../../zloz-server/src/workshop-link';
import { init, Message, update, view } from '../src/editor/main';
import { createWorkshopNote } from '../src/editor/workshop';

const document = createOperationDocument({
  nodes: [
    createWorkshopNote('command', 'submit', []),
    createWorkshopNote('domain-event', 'submitted', []),
    createWorkshopNote('policy', 'fulfil', []),
  ],
  edges: [],
});
function open(actorId: string, snapshot = document, role: 'viewer' | 'editor' = 'editor') {
  const props = {
    teamId: 'team',
    diagramId: 'board',
    actorId,
    role,
    name: 'Orders',
    startingView: 'event-storming' as const,
  };
  const room = { ...props, generation: actorId };
  const started = update(
    init(props).model,
    Message.SucceededIdentity({ generation: actorId }),
  ).model;
  return update(
    started,
    Message.ObservedFrame({
      run: 0,
      room,
      frame: {
        target: room,
        sourceVersion: snapshot.version + 1,
        document: { ...snapshot, undo: [] },
        coverage: [],
      },
    }),
  ).model;
}
function connect(model: ReturnType<typeof open>, from: string, to: string) {
  for (const [node, port] of [
    [from, 'out'],
    [to, 'in'],
  ] as const) {
    model = update(
      model,
      Message.ObservedEditorInput({ event: { type: 'PortActivated', endpoint: { node, port } } }),
    ).model;
  }
  return model;
}
test('two editors author command → event → policy and recover both links after moving the event', async () => {
  const selected = update(
    open('author'),
    Message.SelectedWorkshopLink({ meaning: 'produces' }),
  ).model;
  const request = connect(selected, 'submit', 'submitted').session.pending!.request;
  const context = { teamId: 'team', diagramId: 'board', actorId: 'author' };
  const linked = decideOperation(document, request, context, {
    canApplyOperation: workshopLinkDenial,
  });
  expect(linked.receipt.status).toBe('accepted');
  const watching = open('peer');
  const synced = update(
    watching,
    Message.ObservedFrame({
      room: watching.room,
      run: 0,
      frame: JSON.parse(
        JSON.stringify({
          target: watching.room,
          sourceVersion: 2,
          document: { ...linked.document, undo: [] },
          coverage: [],
        }),
      ),
    }),
  ).model;
  expect(synced.session.confirmed?.document.graph.edges[0]?.architecture).toEqual({
    family: 'event-storming',
    role: 'produces',
  });
  const selectedActivation = update(
    synced,
    Message.SelectedWorkshopLink({ meaning: 'activates' }),
  ).model;
  const activation = connect(selectedActivation, 'submitted', 'fulfil').session.pending?.request;
  assert(activation);
  const activated = decideOperation(
    linked.document,
    activation,
    { ...context, actorId: 'peer' },
    {
      canApplyOperation: workshopLinkDenial,
    },
  );
  expect(activated.receipt.status).toBe('accepted');
  const moved = decideOperation(
    activated.document,
    {
      version: 1,
      operationId: 'move',
      operation: {
        type: 'MoveNodes',
        nodes: [{ id: 'submitted', expected: 0, position: { x: 550, y: 275 } }],
      },
    },
    context,
  );
  expect(moved.receipt.status).toBe('accepted');
  const peer = open('peer', JSON.parse(JSON.stringify(moved.document)));
  expect(peer.session.confirmed?.document.version).toBe(3);
  expect(
    peer.session.confirmed?.document.graph.nodes.find((node) => node.id === 'submitted')?.position,
  ).toEqual({ x: 550, y: 275 });
  expect(peer.session.confirmed?.document.graph.edges).toHaveLength(2);
  expect(peer.session.confirmed?.document.graph.edges[0]).toMatchObject({
    source: { node: 'submit', port: 'out' },
    target: { node: 'submitted', port: 'in' },
    architecture: { family: 'event-storming', role: 'produces' },
  });
  expect(peer.session.confirmed?.document.graph.edges).toContainEqual(
    expect.objectContaining({
      source: { node: 'submitted', port: 'out' },
      target: { node: 'fulfil', port: 'in' },
      architecture: { family: 'event-storming', role: 'activates' },
    }),
  );
  const rendered = await Effect.runPromise(
    renderToString(
      { Flags: Schema.Struct({}), init: () => ({ model: peer }), view },
      { flags: {}, isHydratable: false },
    ),
  );
  expect(rendered.html).toContain('Command produces Domain Event');
  expect(rendered.html).toContain('Domain Event activates Policy');
  expect(rendered.html).toContain('Activates · domain event → policy');
});
test('reversed Produces is rejected and plain port connections stay untyped', () => {
  const board = open('author');
  const selected = update(board, Message.SelectedWorkshopLink({ meaning: 'produces' })).model;
  const refused = connect(selected, 'submitted', 'submit');
  expect(refused.session.pending).toBeNull();
  expect(refused.error).toContain('command');
  const plain = connect(board, 'submit', 'submitted').session.pending!.request.operation;
  expect(plain.type).toBe('Connect');
  if (plain.type === 'Connect') expect(plain.edge.architecture).toBeUndefined();
});

test('Activates rejects policy → event in the editor and on direct submission', () => {
  const selected = update(
    open('author'),
    Message.SelectedWorkshopLink({ meaning: 'activates' }),
  ).model;
  const denied = connect(selected, 'fulfil', 'submitted');
  expect(denied.session.pending).toBeNull();
  expect(denied.error).toContain('policy input');
  const plain = connect(open('author'), 'fulfil', 'submitted').session.pending?.request;
  assert(plain?.operation.type === 'Connect');
  const result = decideOperation(
    document,
    {
      ...plain,
      operation: {
        ...plain.operation,
        edge: {
          ...plain.operation.edge,
          architecture: { family: 'event-storming', role: 'activates' },
        },
      },
    },
    { teamId: 'team', diagramId: 'board', actorId: 'author' },
    { canApplyOperation: workshopLinkDenial },
  );
  expect(result.receipt).toMatchObject({ status: 'rejected', code: 'Protected' });
  expect(result.document.graph.edges).toHaveLength(0);
});

test('the authoritative decision rejects a reversed typed link submitted directly', () => {
  const choice = update(
    open('author'),
    Message.SelectedWorkshopLink({ meaning: 'produces' }),
  ).model;
  const request = connect(choice, 'submit', 'submitted').session.pending!.request;
  const operation = request.operation;
  assert(operation.type === 'Connect');
  const edge = {
    ...operation.edge,
    source: { node: 'submitted', port: 'out' },
    target: { node: 'submit', port: 'in' },
  };
  const result = decideOperation(
    document,
    { ...request, operation: { ...operation, edge } },
    { teamId: 'team', diagramId: 'board', actorId: 'author' },
    { canApplyOperation: workshopLinkDenial },
  );
  expect(result.receipt).toMatchObject({
    status: 'rejected',
    code: 'Protected',
    message: expect.stringContaining('domain-event to command'),
  });
  expect(result.document.graph.edges).toHaveLength(0);
});

test('a viewer follows only confirmed typed steps, reveals them locally and recognizes the end', async () => {
  const edge = (id: string, from: string, to: string) => ({
    id,
    source: { node: from, port: 'out' },
    target: { node: to, port: 'in' },
  });
  const snapshot = createOperationDocument({
    nodes: [
      ...document.graph.nodes,
      {
        ...createWorkshopNote('domain-event', 'declined', document.graph.nodes),
        label: 'Order declined',
      },
    ],
    edges: [
      {
        ...edge('a', 'submit', 'submitted'),
        architecture: { family: 'event-storming', role: 'produces' },
      },
      {
        ...edge('b', 'submitted', 'fulfil'),
        architecture: { family: 'event-storming', role: 'activates' },
      },
      {
        ...edge('c', 'submit', 'declined'),
        architecture: { family: 'event-storming', role: 'produces' },
      },
      { ...edge('plain', 'fulfil', 'submit'), label: 'Produces' },
    ],
  });
  let model = open('reviewer', snapshot, 'viewer');
  const original = model.session;
  const send = (message: Parameters<typeof update>[1]) => {
    model = update(model, message).model;
  };
  const panel = async () =>
    (
      await Effect.runPromise(
        renderToString(
          {
            Flags: Schema.Struct({}),
            init: () => ({ model }),
            view,
          },
          { flags: {}, isHydratable: false },
        ),
      )
    ).html;
  send(
    Message.ObservedEditorInput({
      event: { type: 'SurfaceMeasured', size: { width: 800, height: 500 } },
    }),
  );
  send(Message.SelectedInspector({ inspector: 'journey' }));
  expect(await panel()).toContain('Starting note');
  send(Message.ChoseJourneyStart({ id: 'submit' }));
  const fork = await panel();
  expect(fork).toContain('Follow Produces → Domain Event');
  expect(fork).toContain('Follow Produces → Order declined');
  const overview = fork.match(/<svg[^>]*aria-label="Journey overview"[^>]*>[\s\S]*?<\/svg>/)?.[0];
  expect(overview?.match(/<path[\s>]/g)).toHaveLength(3);
  expect(overview).toContain('Command produces Domain Event');
  expect(overview).toContain('Command produces Order declined');
  expect(overview).not.toContain('Policy produces Command');
  expect(fork).not.toContain('Back one step');
  send(Message.FollowedJourneyLink({ id: 'b' }));
  expect(await panel()).toContain('Follow Produces → Domain Event');
  send(Message.FollowedJourneyLink({ id: 'a' }));
  expect(await panel()).toContain('Follow Activates → Policy');
  send(Message.FollowedJourneyLink({ id: 'b' }));
  const end = await panel();
  expect(end).toContain('End of this path');
  expect(end).toContain('Reveal Command');
  expect(end).toContain('Reveal Domain Event');
  expect(end).toContain('Reveal Policy');
  expect(end).not.toContain('Follow Produces');
  expect(model.editor).toMatchObject({ notice: 'Revealed Policy.' });
  expect(end).toContain('Back one step');
  send(Message.SteppedBackInJourney({ edgeId: 'b', depth: 2 }));
  expect(model.journey).toEqual({ start: 'submit', via: ['a'] });
  expect(model.editor).toMatchObject({ notice: 'Revealed Domain Event.' });
  send(Message.FollowedJourneyLink({ id: 'b' }));
  expect(model.session).toBe(original);
  const deleted = decideOperation(
    snapshot,
    {
      version: 1,
      operationId: 'peer-delete',
      operation: { type: 'Delete', expectedVersion: 0, nodeIds: [], edgeIds: ['b'] },
    },
    { teamId: 'team', diagramId: 'board', actorId: 'author' },
  );
  expect(deleted.receipt.status).toBe('accepted');
  send(
    Message.ObservedFrame({
      run: 0,
      room: model.room,
      frame: {
        target: model.room,
        sourceVersion: 2,
        document: { ...deleted.document, undo: [] },
        coverage: [],
      },
    }),
  );
  const revised = await panel();
  expect(revised).toContain('The board changed.');
  expect(revised).toContain('Reveal Domain Event');
  expect(revised).not.toContain('Reveal Policy');
  const peerSession = model.session;
  send(Message.SteppedBackInJourney({ edgeId: 'b', depth: 2 }));
  expect(await panel()).toContain('Reveal Domain Event');
  send(Message.SteppedBackInJourney({ edgeId: 'a', depth: 1 }));
  expect(model.journey).toEqual({ start: 'submit', via: [] });
  expect(model.editor).toMatchObject({ notice: 'Revealed Command.' });
  expect(await panel()).not.toContain('Back one step');
  send(Message.FollowedJourneyLink({ id: 'c' }));
  expect(await panel()).toContain('Reveal Order declined');
  expect(model.session).toBe(peerSession);
  expect(model.session.pending).toBeNull();
});

test('a shared Triggers closes the loop, marks the repeated command and backs up one visit', async () => {
  const snapshot = createOperationDocument({
    nodes: document.graph.nodes,
    edges: [
      {
        id: 'produces',
        source: { node: 'submit', port: 'out' },
        target: { node: 'submitted', port: 'in' },
        architecture: { family: 'event-storming', role: 'produces' },
      },
      {
        id: 'activates',
        source: { node: 'submitted', port: 'out' },
        target: { node: 'fulfil', port: 'in' },
        architecture: { family: 'event-storming', role: 'activates' },
      },
    ],
  });
  const author = update(
    open('author', snapshot),
    Message.SelectedWorkshopLink({ meaning: 'triggers' }),
  ).model;
  const denied = connect(author, 'submit', 'fulfil');
  expect(denied.session.pending).toBeNull();
  expect(denied.error).toContain('command input');
  const request = connect(author, 'fulfil', 'submit').session.pending?.request;
  assert(request?.operation.type === 'Connect');
  const { edge } = request.operation;
  expect(edge.architecture).toEqual({ family: 'event-storming', role: 'triggers' });
  const scope = { teamId: 'team', diagramId: 'board', actorId: 'author' };
  const policy = { canApplyOperation: workshopLinkDenial };
  const reversed = {
    ...edge,
    source: { node: 'submit', port: 'out' },
    target: { node: 'fulfil', port: 'in' },
  };
  expect(
    decideOperation(
      snapshot,
      { ...request, operation: { ...request.operation, edge: reversed } },
      scope,
      policy,
    ).receipt,
  ).toMatchObject({ status: 'rejected', code: 'Protected' });
  const saved = decideOperation(snapshot, request, scope, policy);
  expect(saved.receipt.status).toBe('accepted');
  let viewer = open('viewer', JSON.parse(JSON.stringify(saved.document)), 'viewer');
  const original = viewer.session;
  const send = (message: Parameters<typeof update>[1]) => {
    viewer = update(viewer, message).model;
  };
  const render = async () =>
    (
      await Effect.runPromise(
        renderToString(
          { Flags: Schema.Struct({}), init: () => ({ model: viewer }), view },
          { flags: {}, isHydratable: false },
        ),
      )
    ).html;
  send(Message.SelectedInspector({ inspector: 'journey' }));
  send(Message.ChoseJourneyStart({ id: 'submit' }));
  send(Message.FollowedJourneyLink({ id: 'produces' }));
  send(Message.FollowedJourneyLink({ id: 'activates' }));
  expect(await render()).toContain('Follow Triggers → Command');
  send(Message.FollowedJourneyLink({ id: edge.id }));
  const loop = await render();
  expect(loop).toContain('Revisited · first seen at step 1');
  expect(loop).toContain('Step 4 · Command');
  expect(loop.match(/<svg[^>]*aria-label="Journey overview"[^>]*>[\s\S]*?<\/svg>/)?.[0]).toContain(
    'Policy triggers Command',
  );
  expect(loop.match(/id="journey-current-note"/g)).toHaveLength(1);
  send(Message.FollowedJourneyLink({ id: 'produces' }));
  expect(await render()).toContain('Revisited · first seen at step 2');
  send(Message.SteppedBackInJourney({ edgeId: 'produces', depth: 1 }));
  expect(viewer.journey.via).toHaveLength(4);
  send(Message.SteppedBackInJourney({ edgeId: 'produces', depth: 4 }));
  expect(viewer.journey.via).toEqual(['produces', 'activates', edge.id]);
  send(Message.SteppedBackInJourney({ edgeId: edge.id, depth: 3 }));
  expect(await render()).not.toContain('Revisited · first seen');
  expect(viewer.journey.via).toEqual(['produces', 'activates']);
  expect(await render()).toContain('Step 3 · Policy');
  expect(viewer.session).toBe(original);
});

test('a large fork keeps the full trail choices and centres the overview on an off-map destination', async () => {
  const events = Array.from({ length: 9 }, (_, i) => ({
    ...createWorkshopNote('domain-event', 'event-' + i, []),
    label: 'Outcome ' + i,
  }));
  const snapshot = createOperationDocument({
    nodes: [createWorkshopNote('command', 'start', []), ...events],
    edges: events.map((node) => ({
      id: 'to-' + node.id,
      source: { node: 'start', port: 'out' },
      target: { node: node.id, port: 'in' },
      architecture: { family: 'event-storming' as const, role: 'produces' as const },
    })),
  });
  let model = open('viewer', snapshot, 'viewer');
  const original = model.session;
  const send = (message: Parameters<typeof update>[1]) => {
    model = update(model, message).model;
  };
  const render = async () =>
    (
      await Effect.runPromise(
        renderToString(
          { Flags: Schema.Struct({}), init: () => ({ model }), view },
          { flags: {}, isHydratable: false },
        ),
      )
    ).html;
  send(Message.SelectedInspector({ inspector: 'journey' }));
  send(Message.ChoseJourneyStart({ id: 'start' }));
  const fork = await render();
  expect(fork).toContain('Showing 8 nearby notes');
  expect(fork).toContain('Follow Produces → Outcome 8');
  send(Message.FollowedJourneyLink({ id: 'to-event-8' }));
  const tip = await render();
  expect(tip).toContain('Step 2 · Outcome 8');
  expect(tip).toContain('<title>Outcome 8</title>');
  send(Message.SteppedBackInJourney({ edgeId: 'to-event-8', depth: 1 }));
  expect(await render()).toContain('Step 1 · Command');
  expect(model.session).toBe(original);
});
