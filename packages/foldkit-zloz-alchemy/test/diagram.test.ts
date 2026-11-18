import { expect, test } from 'bun:test';

import * as Domain from '@alchemy.run/domain';
import {
  createOperationDocument,
  decideOperation,
  parseGraph,
  parseOperationRequest,
} from '@opsydyn/foldkit-zloz';
import { parseCouplingAssessment } from '@opsydyn/foldkit-zloz/coupling';
import { Effect, Layer, Schema } from 'effect';

import fixture from '../../foldkit-zloz/test/fixtures/operations-v1.json';
import { DiagramAccessDenied, makeDiagramDomain } from '../src/collaboration';
import assessmentFixture from './fixtures/assessment-v1.json';

const actor = { userId: 'alice', sessionId: 'session-alice' };
const bob = { userId: 'bob', sessionId: 'session-bob' };
const target = { teamId: 'team-a', diagramId: 'diagram-a' };
const graph = () => parseGraph(JSON.stringify({ version: 1, graph: fixture.graph }));
const host = () => {
  const revoked = new Set<string>();
  const domain = makeDiagramDomain({
    authorize: (identity, resource) =>
      identity.userId !== 'outsider' &&
      resource.teamId === 'team-a' &&
      !revoked.has(identity.userId)
        ? Effect.void
        : Effect.fail(new DiagramAccessDenied()),
    policy: () => ({}),
  });
  const layer = domain.model.layer(Layer.empty).pipe(Layer.provide(Domain.InMemory));
  return { domain, layer, revoked };
};

test('real Domain model and local decisions consume the same literal operations and retain independent edits on Undo', async () => {
  const { domain, layer } = host();
  expect(Domain.verify(domain.model)).toEqual([]);
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* domain.initialize(actor, target, 'initial', graph());
      let expected = createOperationDocument(graph());
      for (const [text, identity] of [
        [fixture.move, actor],
        [fixture.rename, bob],
        [fixture.undoMove, actor],
      ] as const) {
        const request = parseOperationRequest(text);
        expected = decideOperation(expected, request, {
          ...target,
          actorId: identity.userId,
        }).document;
        const result = yield* domain.execute(identity, target, request);
        expect(result.receipt.status).toBe('accepted');
        expect(yield* domain.read(actor, target)).toEqual(expected);
      }
      expect(expected.graph.nodes[0]?.position).toEqual({ x: 10, y: 20 });
      expect(expected.graph.nodes[0]?.label).toBe('Teammate name');
    }).pipe(Effect.provide(layer), Effect.scoped),
  );
});

test('racing duplicate and changed-payload submissions are bound to one result before it can escape native deduplication', async () => {
  const { domain, layer, revoked } = host();
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* domain.initialize(actor, target, 'initial', graph());
      const request = parseOperationRequest(fixture.move);
      const results = yield* Effect.all(
        [domain.execute(actor, target, request), domain.execute(actor, target, request)],
        { concurrency: 'unbounded' },
      );
      expect(results[0]).toEqual(results[1]);
      expect((yield* domain.read(actor, target))?.version).toBe(1);
      const otherActor = yield* domain.execute(bob, target, request);
      expect(otherActor.receipt.actorId).toBe('bob');
      expect(otherActor.receipt.status).toBe('rejected');
      const secondTarget = { ...target, diagramId: 'diagram-b' };
      yield* domain.initialize(actor, secondTarget, 'initial', graph());
      const otherDiagram = yield* domain.execute(actor, secondTarget, request);
      expect(otherDiagram.receipt.diagramId).toBe('diagram-b');
      expect(otherDiagram.receipt.status).toBe('accepted');
      const changed = {
        ...request,
        operation: { type: 'RenameNode' as const, id: 'a', expected: 0, label: 'Reused identity' },
      };
      const mismatch = yield* Effect.result(domain.execute(actor, target, changed));
      expect(mismatch).toMatchObject({ _tag: 'Failure', failure: { _tag: 'OperationIdReused' } });
      expect((yield* domain.read(actor, target))?.graph.nodes[0]?.label).toBe('Alpha');
      revoked.add('alice');
      expect(yield* Effect.result(domain.execute(actor, target, request))).toMatchObject({
        _tag: 'Failure',
        failure: { _tag: 'DiagramAccessDenied' },
      });
      expect(
        yield* Effect.result(
          domain.execute({ userId: 'outsider', sessionId: 'outsider' }, target, request),
        ),
      ).toMatchObject({ _tag: 'Failure', failure: { _tag: 'DiagramAccessDenied' } });
      expect(yield* Effect.result(domain.read(bob, { ...target, teamId: 'team-b' }))).toMatchObject(
        { _tag: 'Failure', failure: { _tag: 'DiagramAccessDenied' } },
      );
    }).pipe(Effect.provide(layer), Effect.scoped),
  );
});

test('a changed-payload race cannot make two edits or disclose the first payload receipt', async () => {
  const { domain, layer } = host();
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* domain.initialize(actor, target, 'initial', graph());
      const first = parseOperationRequest(fixture.move);
      const second = {
        ...first,
        operation: { type: 'RenameNode' as const, id: 'a', expected: 0, label: 'Racing alternate' },
      };
      const settled = yield* Effect.all(
        [
          Effect.result(domain.execute(actor, target, first)),
          Effect.result(domain.execute(actor, target, second)),
        ],
        { concurrency: 'unbounded' },
      );
      expect(settled.filter((result) => result._tag === 'Success')).toHaveLength(1);
      expect(settled.filter((result) => result._tag === 'Failure')).toHaveLength(1);
      const state = yield* domain.read(actor, target);
      expect(state?.version).toBe(1);
      const firstWon = settled[0]?._tag === 'Success';
      const initialGraph = graph();
      expect(state?.graph).toEqual({
        ...initialGraph,
        nodes: initialGraph.nodes.map((node) =>
          node.id === 'a'
            ? {
                ...node,
                label: firstWon ? 'Alpha' : 'Racing alternate',
                position: firstWon ? { x: 70, y: 90 } : { x: 10, y: 20 },
              }
            : node,
        ),
      });
    }).pipe(Effect.provide(layer), Effect.scoped),
  );
});

test.each(['deleteGroup', 'removePort'] as const)(
  'literal %s and its inverse survive the real Domain event codec',
  async (name) => {
    const { domain, layer } = host();
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* domain.initialize(actor, target, 'initial', graph());
        const request = parseOperationRequest(fixture[name]);
        const accepted = yield* domain.execute(actor, target, request);
        expect(accepted.receipt.status).toBe('accepted');
        const expected = decideOperation(createOperationDocument(graph()), request, {
          ...target,
          actorId: actor.userId,
        });
        expect(yield* domain.read(actor, target)).toEqual(expected.document);
        const restored = yield* domain.execute(actor, target, {
          version: 1,
          operationId: `undo-${name}`,
          operation: { type: 'Undo', operationId: request.operationId },
        });
        expect(restored.receipt.status).toBe('accepted');
        expect((yield* domain.read(actor, target))?.graph).toEqual(graph());
      }).pipe(Effect.provide(layer), Effect.scoped),
    );
  },
);

test('public Domain projection carries canonical source coverage without private inverse events', async () => {
  const { domain, layer } = host();
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* domain.initialize(actor, target, 'initial', graph());
      const request = parseOperationRequest(fixture.move);
      const reply = yield* domain.execute(actor, target, request);
      const frame = yield* domain.frame(actor, target, {
        stream: reply.sourceStream,
        version: reply.sourceVersion,
      });
      expect(frame?.document.graph.nodes[0]?.position).toEqual({ x: 70, y: 90 });
      expect(frame?.document.undo).toEqual([]);
      expect(frame?.coverage).toEqual([
        expect.objectContaining({
          actorId: actor.userId,
          operationId: request.operationId,
          requestHash: reply.requestHash,
          documentVersion: 1,
          status: 'accepted',
        }),
      ]);
      expect(frame?.sourceVersion).toBe(reply.sourceVersion);
      expect(JSON.stringify(frame)).not.toContain('inverse');
    }).pipe(Effect.provide(layer), Effect.scoped),
  );
});

// oxlint-disable-next-line linteffect/no-mixed-pillar-function -- Test boundary owns both fixture layer assembly and the exercised workflow.
test('shared assessments use independent revisions, exact retry binding and current edit authorization', async () => {
  const revoked = new Set<string>();
  // oxlint-disable-next-line linteffect/no-mixed-pillar-function -- Test host deliberately varies live permission at the service boundary.
  const domain = makeDiagramDomain({
    authorize: (identity, resource, edit) =>
      resource.teamId === 'team-a' &&
      !revoked.has(identity.userId) &&
      !(edit && identity.userId === 'viewer')
        ? Effect.void
        : Effect.fail(new DiagramAccessDenied()),
    authorizeRecovery: () => Effect.void,
  });
  const layer = domain.model.layer(Layer.empty).pipe(Layer.provide(Domain.InMemory));
  expect(Domain.verify(domain.model)).toEqual([]);
  const authored = parseCouplingAssessment(JSON.stringify(assessmentFixture));
  const request = {
    version: 1 as const,
    operationId: 'save-assessment',
    expectedRevision: 0,
    assessment: authored,
  };
  // oxlint-disable-next-line linteffect/no-mixed-pillar-function -- Test boundary assembles the real model and host layer.
  await Effect.runPromise(
    Effect.gen(function* () {
      const initialized = yield* domain.initialize(actor, target, 'init', graph());
      const first = yield* Effect.all(
        [
          domain.saveAssessment(actor, target, request),
          domain.saveAssessment(actor, target, request),
        ],
        { concurrency: 'unbounded' },
      );
      expect(first[0]).toEqual(first[1]);
      expect(first[0].decision).toMatchObject({
        status: 'accepted',
        record: { revision: 1, authoredBy: 'alice' },
      });
      expect((yield* domain.read(actor, target))?.version).toBe(0);
      expect((yield* domain.read(actor, target))?.undo).toEqual([]);
      const viewer = { userId: 'viewer', sessionId: 'viewer-session' };
      const frame = yield* domain.frame(viewer, target, {
        stream: initialized.sourceStream,
        version: first[0].sourceVersion,
      });
      expect(frame?.assessments).toHaveLength(1);
      expect(frame?.assessments?.[0]?.assessment).toEqual(authored);
      expect(yield* Effect.result(domain.saveAssessment(viewer, target, request))).toMatchObject({
        _tag: 'Failure',
        failure: { _tag: 'DiagramAccessDenied' },
      });
      const raced = yield* Effect.all(
        [
          domain.saveAssessment(actor, target, {
            ...request,
            operationId: 'alice-second',
            expectedRevision: 1,
          }),
          domain.saveAssessment(bob, target, {
            ...request,
            operationId: 'bob-second',
            expectedRevision: 1,
          }),
        ],
        { concurrency: 'unbounded' },
      );
      expect(raced.filter((reply) => reply.decision.status === 'accepted')).toHaveLength(1);
      expect(raced.filter((reply) => reply.decision.status === 'rejected')).toMatchObject([
        { decision: { code: 'revision-conflict', currentRevision: 2 } },
      ]);
      expect(
        yield* Effect.result(
          domain.saveAssessment(actor, target, {
            ...request,
            assessment: { ...authored, scope: { ...authored.scope, horizon: 'Changed payload' } },
          }),
        ),
      ).toMatchObject({ _tag: 'Failure', failure: { _tag: 'OperationIdReused' } });
      const move = parseOperationRequest(fixture.move);
      yield* domain.execute(actor, target, move);
      const stale = yield* domain.saveAssessment(actor, target, {
        ...request,
        operationId: 'stale',
        expectedRevision: 2,
      });
      expect(stale.decision).toEqual({
        status: 'rejected',
        code: 'stale-target',
        currentRevision: 2,
      });
      const rebound = {
        ...request,
        operationId: 'reviewed',
        expectedRevision: 2,
        assessment: { ...authored, target: { ...authored.target, graphVersion: 1 } },
      };
      expect((yield* domain.saveAssessment(actor, target, rebound)).decision.status).toBe(
        'accepted',
      );
      const checkpoint = yield* domain.checkpoint(actor, target);
      expect(checkpoint).not.toBeNull();
      if (!checkpoint) return;
      yield* domain.execute(bob, target, parseOperationRequest(fixture.rename));
      const recovered = yield* domain.recover(actor, target, 'restore', 2, checkpoint);
      const restored = yield* domain.frame(actor, target, {
        stream: initialized.sourceStream,
        version: recovered.sourceVersion,
      });
      expect(restored?.document.version).toBe(3);
      expect(restored?.assessments?.[0]?.revision).toBe(3);
      expect(restored?.assessments?.[0]?.assessment.target.graphVersion).toBe(1);
      revoked.add('alice');
      expect(yield* Effect.result(domain.saveAssessment(actor, target, request))).toMatchObject({
        _tag: 'Failure',
        failure: { _tag: 'DiagramAccessDenied' },
      });
      expect(yield* Effect.result(domain.frame(bob, { ...target, teamId: 'other' }))).toMatchObject(
        { _tag: 'Failure', failure: { _tag: 'DiagramAccessDenied' } },
      );
    }).pipe(Effect.provide(layer), Effect.scoped),
  );
});

test('additive aggregate schema accepts legacy document-only snapshots', () => {
  const { domain } = host();
  const aggregate = domain.model.aggregates[0];
  expect(aggregate).toBeDefined();
  if (!aggregate) return;
  const legacy = { document: createOperationDocument(graph()) };
  expect(Schema.is(aggregate.definition.state)(legacy)).toBe(true);
});

// oxlint-disable-next-line linteffect/no-mixed-pillar-function -- SDK boundary test assembles a host callback and real execution layer.
test('assessment submission detaches caller-owned evidence before asynchronous authorization', async () => {
  const input = {
    version: 1 as const,
    operationId: 'detached-input',
    expectedRevision: 0,
    assessment: parseCouplingAssessment(JSON.stringify(assessmentFixture)),
  };
  let mutate = false;
  const domain = makeDiagramDomain({
    authorize: () =>
      Effect.sync(() => {
        if (mutate)
          Object.assign(input.assessment.scope, { horizon: 'Unexpected caller mutation' });
      }),
  });
  const layer = domain.model.layer(Layer.empty).pipe(Layer.provide(Domain.InMemory));
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* domain.initialize(actor, target, 'init', graph());
      mutate = true;
      const reply = yield* domain.saveAssessment(actor, target, input);
      expect(reply.decision).toMatchObject({
        status: 'accepted',
        record: { assessment: { scope: { horizon: 'Next six months' } } },
      });
      expect(input.assessment.scope.horizon).toBe('Unexpected caller mutation');
    }).pipe(Effect.provide(layer), Effect.scoped),
  );
});

test('cursor-first bootstrap fences the canonical frame through every decision, including refusals and duplicates', async () => {
  const { domain, layer, revoked } = host();
  await Effect.runPromise(
    Effect.gen(function* () {
      const empty = yield* domain.bootstrap(actor, target);
      expect(empty.frame).toBeNull();
      expect(empty.feed.cursor).toBe(0);
      yield* domain.initialize(actor, target, 'initial', graph());
      // oxlint-disable-next-line linteffect/no-effect-wrapper-alias -- Bounded test polling waits for the actual asynchronous projection.
      const waitForCursor = (cursor: number) =>
        Effect.gen(function* () {
          for (let attempt = 0; attempt < 100; attempt++) {
            const value = yield* domain.bootstrap(actor, target);
            if (value.feed.cursor === cursor) return value;
            yield* Effect.sleep(10);
          }
          return yield* Effect.fail(new DiagramAccessDenied());
        });
      const first = yield* waitForCursor(1);
      expect(first.feed.cursor).toBe(1);
      expect(first.feed.sourceVersion).toBe(1);
      expect(first.frame?.sourceVersion).toBeGreaterThanOrEqual(first.feed.sourceVersion);
      const request = parseOperationRequest(fixture.move);
      yield* domain.execute(actor, target, request);
      yield* domain.execute(actor, target, request);
      yield* domain.execute(bob, target, request);
      yield* domain.initialize(actor, target, 'refused-init', graph());
      const result = yield* waitForCursor(4);
      expect(result.feed.cursor).toBe(4);
      expect(result.feed.sourceVersion).toBe(4);
      expect(result.frame?.sourceVersion).toBeGreaterThanOrEqual(4);
      expect(result.frame?.document.version).toBe(1);
      expect(result.frame?.coverage).toHaveLength(2);
      expect(result.frame?.document.undo).toEqual([]);
      revoked.add('alice');
      expect(yield* Effect.result(domain.bootstrap(actor, target))).toMatchObject({
        _tag: 'Failure',
        failure: { _tag: 'DiagramAccessDenied' },
      });
    }).pipe(Effect.provide(layer), Effect.scoped),
  );
});
