import { expect, test } from 'bun:test';

import { createOperationDocument, decideOperation } from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';

import { init, Message, update, view, type Model } from '../src/editor/main';

const graph = {
  nodes: ['near', 'far', 'last'].map((id, index) => ({
    id,
    label: id,
    position: { x: index === 0 ? 0 : 1500 + index * 500, y: index === 0 ? 0 : 1000 },
    size: { width: 150, height: 80 },
    ports: [
      { id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 },
      { id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 },
    ],
  })),
  edges: [
    { id: 'first', source: { node: 'near', port: 'out' }, target: { node: 'far', port: 'in' } },
    { id: 'second', source: { node: 'far', port: 'out' }, target: { node: 'last', port: 'in' } },
  ],
};
async function render(model: Model) {
  const { html } = await Effect.runPromise(
    renderToString(
      { Flags: Schema.Struct({}), init: () => ({ model }), view },
      { flags: {}, isHydratable: false },
    ),
  );
  return html;
}
const event = (model: Model, input: Parameters<typeof Message.ObservedEditorInput>[0]['event']) =>
  update(model, Message.ObservedEditorInput({ event: input })).model;

test('measured views retain the full graph, update offscreen records and restore them on pan', async () => {
  const started = update(
    init({
      teamId: 'team',
      diagramId: 'diagram',
      actorId: 'actor',
      role: 'owner',
      name: 'Viewport',
    }).model,
    Message.SucceededIdentity({ generation: 'viewport-generation' }),
  ).model;
  const document = createOperationDocument(graph);
  const ready = update(
    started,
    Message.ObservedFrame({
      run: 0,
      room: started.room,
      frame: { target: started.room, sourceVersion: 0, document, coverage: [] },
    }),
  ).model;
  const measured = event(ready, { type: 'SurfaceMeasured', size: { width: 800, height: 500 } });
  const initial = await render(measured);
  expect(initial).toContain('data-flow-node="near"');
  expect(initial).not.toContain('data-flow-node="far"');
  expect(initial).not.toContain('data-flow-node="last"');
  expect(initial).toContain('aria-label="near → far"');
  expect(initial).toContain('aria-label="far → last"');
  expect(measured.session.confirmed?.document.graph).toEqual(graph);

  const renamed = decideOperation(
    document,
    {
      version: 1,
      operationId: 'offscreen-rename',
      operation: { type: 'RenameNode', id: 'far', expected: 0, label: 'Updated far' },
    },
    { actorId: 'peer', teamId: 'team', diagramId: 'diagram' },
  );
  expect(renamed.receipt.status).toBe('accepted');
  const received = update(
    measured,
    Message.ObservedFrame({
      run: 0,
      room: started.room,
      frame: {
        target: started.room,
        sourceVersion: 1,
        document: { ...renamed.document, undo: [] },
        coverage: [],
      },
    }),
  ).model;
  const offscreen = await render(received);
  expect(offscreen).not.toContain('data-flow-node="far"');
  expect(offscreen).toContain('aria-label="near → Updated far"');
  const panned = event(received, {
    type: 'ViewportChanged',
    viewport: { x: -1900, y: -900, zoom: 1 },
  });
  const restored = await render(panned);
  expect(restored).toContain('data-flow-node="far"');
  expect(restored).toContain('aria-label="Select Updated far"');
  expect(panned.session.confirmed?.document.graph).toEqual(renamed.document.graph);

  const selected = event(panned, { type: 'NodeSelected', id: 'far', additive: false });
  const returned = event(selected, { type: 'ViewportChanged', viewport: { x: 0, y: 0, zoom: 1 } });
  expect(await render(returned)).toContain('data-flow-node="far"');
  expect(returned.session.confirmed?.document.version).toBe(1);
});
