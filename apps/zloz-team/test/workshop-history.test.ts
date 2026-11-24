import { expect, test } from 'bun:test';

import {
  createEditor,
  createOperationDocument,
  decideOperation,
  type ZlozOperationRequest,
} from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';

import { empty, observe } from '../src/editor/evolution';
import { chooseBaseline, historyView, openHistory } from '../src/editor/history-review';
import * as Board from '../src/editor/main';
import { createWorkshopNote } from '../src/editor/workshop';

const initial = createOperationDocument({
  nodes: [{ ...createWorkshopNote('hotspot', 'question', []), label: 'Retry ownership' }],
  edges: [],
});
function apply(
  doc: typeof initial,
  operationId: string,
  operation: ZlozOperationRequest['operation'],
) {
  const result = decideOperation(
    doc,
    { version: 1, operationId, operation },
    { teamId: 'a', diagramId: 'b', actorId: 'facilitator' },
  );
  expect(result.receipt.status).toBe('accepted');
  return result.document;
}
async function compare(
  before: typeof initial,
  after: typeof initial,
  summary: string,
  ...between: (typeof initial)[]
) {
  const history = [before, ...between, after].reduce(observe, empty);
  const state = openHistory(history, after.version, createEditor(after.graph), true)!;
  const compared = chooseBaseline(state, String(before.version));
  const { html } = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: compared }),
        view: (model, h) => ({
          title: 'Comparison',
          body: historyView(h, model, after.version, {
            close: 'close',
            playback: () => 'seek',
            baseline: () => 'compare',
            navigate: () => 'navigate',
          }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  expect(html).toContain(`>${summary}</text>`);
  expect(html).toContain(`>Retry ownership · ${summary}</li>`);
}
test('rewind names a hotspot transition, a move, and Undo on the ghost and in the differences list', async () => {
  const resolved = apply(initial, 'resolve', {
    type: 'SetHotspotStatus',
    id: 'question',
    expected: 0,
    status: 'resolved',
  });
  const moved = apply(resolved, 'move', {
    type: 'MoveNodes',
    nodes: [{ id: 'question', expected: 0, position: { x: 320, y: 60 } }],
  });
  const undone = apply(moved, 'undo-resolve', { type: 'Undo', operationId: 'resolve' });
  await compare(initial, resolved, 'Hotspot · Open → Resolved');
  await compare(resolved, moved, 'Hotspot moved');
  await compare(initial, moved, 'Hotspot · Open → Resolved · moved', resolved);
  await compare(moved, undone, 'Hotspot · Resolved → Open');
});

test('Delete and its Undo compare presence without inferring a resolution', async () => {
  const deleted = apply(initial, 'delete', {
    type: 'Delete',
    expectedVersion: 0,
    nodeIds: ['question'],
    edgeIds: [],
  });
  const restored = apply(deleted, 'restore', { type: 'Undo', operationId: 'delete' });
  await compare(initial, deleted, 'Hotspot removed');
  await compare(deleted, restored, 'Hotspot added');
});

test('a moved domain event retains its workshop vocabulary', async () => {
  const event = createOperationDocument({
    nodes: [{ ...createWorkshopNote('domain-event', 'question', []), label: 'Retry ownership' }],
    edges: [],
  });
  const moved = apply(event, 'move-event', {
    type: 'MoveNodes',
    nodes: [{ id: 'question', expected: 0, position: { x: 320, y: 60 } }],
  });
  await compare(event, moved, 'Domain Event moved');
});

test('resizing in place does not label a hotspot as moved', async () => {
  const resized = apply(initial, 'resize', {
    type: 'ResizeNodes',
    nodes: [
      {
        id: 'question',
        expected: 0,
        frame: { position: initial.graph.nodes[0]!.position, size: { width: 240, height: 110 } },
      },
    ],
  });
  await compare(initial, resized, 'Hotspot resized');
});

test('Evolution counts open hotspots in confirmed versions through resolution, deletion and Undo', () => {
  const resolved = apply(initial, 'resolve', {
    type: 'SetHotspotStatus',
    id: 'question',
    expected: 0,
    status: 'resolved',
  });
  const reopened = apply(resolved, 'undo-resolution', { type: 'Undo', operationId: 'resolve' });
  const deleted = apply(reopened, 'delete', {
    type: 'Delete',
    expectedVersion: 2,
    nodeIds: ['question'],
    edgeIds: [],
  });
  const restored = apply(deleted, 'undo-delete', { type: 'Undo', operationId: 'delete' });
  const history = [initial, resolved, reopened, deleted, restored].reduce(observe, empty);
  expect(history.samples.map((sample) => sample.counts.openHotspots)).toEqual([1, 0, 1, 0, 1]);
});

test('opening a past evolution point compares the resolved hotspot while live has already reopened it', async () => {
  const props = {
    teamId: 'a',
    diagramId: 'b',
    actorId: 'viewer',
    role: 'viewer' as const,
    name: 'Returns',
  };
  const room = { ...props, generation: 'generation' };
  const resolved = apply(initial, 'resolve', {
    type: 'SetHotspotStatus',
    id: 'question',
    expected: 0,
    status: 'resolved',
  });
  const reopened = apply(resolved, 'undo', { type: 'Undo', operationId: 'resolve' });
  const started = Board.update(
    Board.init(props).model,
    Board.Message.SucceededIdentity({ generation: room.generation }),
  ).model;
  const live = [initial, resolved, reopened].reduce(
    (model, document) =>
      Board.update(
        model,
        Board.Message.ObservedFrame({
          run: 0,
          room,
          frame: {
            target: room,
            sourceVersion: document.version + 1,
            document: { ...document, undo: [] },
            coverage: [],
          },
        }),
      ).model,
    started,
  );
  const review = Board.update(live, Board.Message.OpenedHistory({ version: 1, baseline: 0 })).model;
  const { html } = await Effect.runPromise(
    renderToString(
      { Flags: Schema.Struct({}), init: () => ({ model: review }), view: Board.view },
      { flags: {}, isHydratable: false },
    ),
  );
  expect(html).toContain('Read-only · Version 1');
  expect(html).toContain('Live version 2');
  expect(html).toContain('Retry ownership · Hotspot · Open → Resolved');
  expect(review.session).toBe(live.session);
  expect(review.session.pending).toBeNull();
});
