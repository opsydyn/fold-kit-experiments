import { expect, test } from 'bun:test';

import * as Domain from '@alchemy.run/domain';
import { Effect, Layer } from 'effect';

import { createDiagramCheckpoint, parseDiagramCheckpoint } from '../src/checkpoint';
import { DiagramAccessDenied, makeDiagramDomain } from '../src/collaboration';

const graph = {
  nodes: [
    {
      id: 'n',
      label: 'Before',
      position: { x: 0, y: 0 },
      size: { width: 120, height: 80 },
      ports: [],
      data: { retain: true },
    },
  ],
  edges: [],
};
const target = { teamId: 't', diagramId: 'd' };
const owner = { userId: 'owner', sessionId: 'owner-session' };
test('checkpoint integrity binds target, version and graph', async () => {
  const checkpoint = await createDiagramCheckpoint(target, 0, graph);
  expect(await parseDiagramCheckpoint(JSON.stringify(checkpoint))).toEqual(checkpoint);
  for (const changed of [
    { ...checkpoint, target: { ...target, teamId: 'foreign' } },
    { ...checkpoint, documentVersion: 1 },
    { ...checkpoint, graph: { nodes: [], edges: [] } },
  ])
    await expect(parseDiagramCheckpoint(JSON.stringify(changed))).rejects.toThrow();
});
test('recovery is owner-authorized, version guarded, retry-bound and preserves the native history', async () => {
  let allowed = true;
  const domain = makeDiagramDomain({
    authorize: () => Effect.void,
    authorizeRecovery: (actor) =>
      allowed && actor.userId === owner.userId
        ? Effect.void
        : Effect.fail(new DiagramAccessDenied()),
  });
  const layer = domain.model.layer(Layer.empty).pipe(Layer.provide(Domain.InMemory));
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* domain.initialize(owner, target, 'init', graph);
      const checkpoint = yield* Effect.promise(() => createDiagramCheckpoint(target, 0, graph));
      expect(yield* domain.checkpoint(owner, target)).toEqual(checkpoint);
      yield* domain.execute(owner, target, {
        version: 1,
        operationId: 'rename',
        operation: { type: 'RenameNode', id: 'n', expected: 0, label: 'After' },
      });
      const conflict = yield* domain.recover(owner, target, 'stale', 0, checkpoint);
      expect(conflict.status).toBe('conflict');
      expect((yield* domain.read(owner, target))?.graph.nodes[0]?.label).toBe('After');
      const restored = yield* domain.recover(owner, target, 'restore', 1, checkpoint);
      expect(restored.status).toBe('restored');
      expect(restored.documentVersion).toBe(2);
      expect(yield* domain.recover(owner, target, 'restore', 1, checkpoint)).toEqual(restored);
      expect((yield* domain.read(owner, target))?.graph).toEqual(graph);
      expect((yield* domain.read(owner, target))?.undo).toEqual([]);
      expect(
        (yield* Effect.result(domain.recover(owner, target, 'restore', 2, checkpoint)))._tag,
      ).toBe('Failure');
      expect(
        (yield* Effect.result(
          domain.recover({ userId: 'editor', sessionId: 'e' }, target, 'editor', 2, checkpoint),
        ))._tag,
      ).toBe('Failure');
      allowed = false;
      expect(
        (yield* Effect.result(domain.recover(owner, target, 'restore', 1, checkpoint)))._tag,
      ).toBe('Failure');
    }).pipe(Effect.provide(layer), Effect.scoped),
  );
});

test('ordinary host authorization does not grant recovery when its dedicated hook is missing', async () => {
  const domain = makeDiagramDomain({ authorize: () => Effect.void });
  const checkpoint = await createDiagramCheckpoint(target, 0, graph);
  const program = Effect.gen(function* () {
    yield* domain.initialize(owner, target, 'no-hook-init', graph);
    const download = yield* Effect.result(domain.checkpoint(owner, target));
    const restore = yield* Effect.result(domain.recover(owner, target, 'no-hook', 0, checkpoint));
    expect(download._tag).toBe('Failure');
    expect(restore._tag).toBe('Failure');
    expect((yield* domain.read(owner, target))?.version).toBe(0);
  });
  const layer = domain.model.layer(Layer.empty).pipe(Layer.provide(Domain.InMemory));
  await Effect.runPromise(program.pipe(Effect.provide(layer), Effect.scoped));
});
