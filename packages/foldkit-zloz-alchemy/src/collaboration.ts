import * as Domain from '@alchemy.run/domain';
import type { Key as AggregateKey } from '@alchemy.run/domain/Aggregate';
import type { ApiServer } from '@alchemy.run/domain/Api';
import type { ModelClass, Internals } from '@alchemy.run/domain/Model';
import type { ViewKey } from '@alchemy.run/domain/View';
import {
  applyOperationChangeShared,
  canonicalOperationValue,
  createOperationDocument,
  decideOperation,
  isOperationDocument,
  isOperationReceipt,
  isOperationRequest,
  parseOperationRequest,
  serializeOperationRequest,
  recoverOperationDocument,
} from '@opsydyn/foldkit-zloz';
import type {
  ZlozGraph,
  ZlozOperationPolicy,
  ZlozOperationRequest,
  ZlozOperationDocument,
} from '@opsydyn/foldkit-zloz';
import { Cause, Data, Effect, Layer, Schema } from 'effect';
import { RpcMiddleware } from 'effect/rpc';

import {
  AssessmentRequestSchema,
  parseAssessmentRequest,
  AssessmentRecordsSchema,
  AssessmentDecisionSchema,
  assessmentBinding,
  decideAssessment,
  applyAssessment,
  type AssessmentRequest,
  type AssessmentReply,
} from './assessment';
import {
  createDiagramCheckpoint,
  parseDiagramCheckpoint,
  type DiagramCheckpoint,
} from './checkpoint';
import { DiagramDeltaSchema, type DiagramDelta, type DiagramFeed } from './delta';
import { sha256Text } from './digest';
import { operationHash } from './hash';
import {
  RelationshipDecisionRequestSchema,
  RelationshipDecisionOutcomeSchema,
  RelationshipDecisionsSchema,
  decideRelationship,
  installRelationshipDecision,
  parseRelationshipDecisionRequest,
  type RelationshipDecisionRequest,
  type RelationshipDecisionOutcome,
} from './relationship-decision';
import { DiagramFrameSchema, type DiagramFrame, type DiagramReply } from './session';

export class DiagramAccessDenied extends Domain.Rejection('DiagramAccessDenied') {}
export class OperationIdReused extends Data.TaggedError('OperationIdReused') {}
class DiagramUnavailable extends Domain.Rejection('DiagramUnavailable') {}
class AdapterInvariant extends Data.TaggedError('AdapterInvariant')<{ message: string }> {}
const Identifier = Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(256)));
const Target = Schema.Struct({ teamId: Identifier, diagramId: Identifier });
export type DiagramTarget = typeof Target.Type;
const Actor = Schema.Struct({ userId: Identifier, sessionId: Identifier });
export type DiagramActor = typeof Actor.Type;
class CurrentDiagramActor extends Domain.RequestContext<CurrentDiagramActor>()(
  'Zloz/DiagramActor',
  Actor,
) {}
class DiagramSession extends RpcMiddleware.Service<
  DiagramSession,
  { provides: CurrentDiagramActor }
>()('Zloz/DiagramSession', { error: DiagramAccessDenied }) {}
const Document = Schema.Unknown.pipe(Schema.refine(isOperationDocument));
const Request = Schema.Unknown.pipe(Schema.refine(isOperationRequest));
const Receipt = Schema.Unknown.pipe(Schema.refine(isOperationReceipt));
const BoundReceipt = Schema.Struct({ binding: Schema.String, receipt: Receipt });
const InitialResult = Schema.Struct({ binding: Schema.String, created: Schema.Boolean });
// The host must declare the one allowed authorization rejection channel.
/* oxlint-disable linteffect/no-manual-effect-channels */
export interface DiagramIdentityResolver {
  (headers: Headers): Effect.Effect<DiagramActor, DiagramAccessDenied>;
}
export interface DiagramHost {
  readonly authorize: (
    actor: DiagramActor,
    target: DiagramTarget,
    edit: boolean,
  ) => Effect.Effect<void, DiagramAccessDenied>;
  readonly authorizeRecovery?: (
    actor: DiagramActor,
    target: DiagramTarget,
  ) => Effect.Effect<void, DiagramAccessDenied>;
  readonly recoveryPolicy?: (
    actor: DiagramActor,
    target: DiagramTarget,
    graph: ZlozGraph,
  ) => string | null;
  readonly policy?: (actor: DiagramActor, target: DiagramTarget) => ZlozOperationPolicy;
}
/* oxlint-enable linteffect/no-manual-effect-channels */
const targetKey = (target: DiagramTarget) =>
  canonicalOperationValue([target.teamId, target.diagramId]);
const targetFromKey = (key: string): DiagramTarget => {
  const [teamId, diagramId] = Schema.decodeUnknownSync(Schema.Tuple([Identifier, Identifier]))(
    JSON.parse(key),
  );
  return { teamId, diagramId };
};
const internalId = (
  kind: 'initialize' | 'execute' | 'recover' | 'assessment' | 'relationship-decision',
  actor: DiagramActor,
  id: string,
) => canonicalOperationValue([kind, actor.userId, id]);

type DiagramServices =
  | AggregateKey<'ZlozDiagramV1'>
  | ViewKey<'ZlozDiagramLiveV1'>
  | ViewKey<'ZlozDiagramDeltaV1'>;
export interface DiagramInitialization {
  readonly created: boolean;
  readonly sourceVersion: number;
  readonly sourceStream: string;
}
export interface DiagramRecovery {
  readonly status: 'restored' | 'conflict' | 'unchanged';
  readonly documentVersion: number;
  readonly sourceVersion: number;
}
/* The public SDK boundary declares services/errors explicitly instead of leaking its
 * generated class graph (which cannot be emitted as a portable declaration). */
/* oxlint-disable linteffect/no-manual-effect-channels */
export interface DiagramRuntime {
  readonly saveRelationshipDecision: (
    actor: DiagramActor,
    target: DiagramTarget,
    request: RelationshipDecisionRequest,
  ) => Effect.Effect<
    RelationshipDecisionOutcome,
    DiagramAccessDenied | DiagramUnavailable | Domain.AlreadyExecuted
  >;
  readonly bootstrap: (
    actor: DiagramActor,
    target: DiagramTarget,
  ) => Effect.Effect<
    { readonly frame: DiagramFrame | null; readonly feed: DiagramFeed },
    DiagramAccessDenied | Domain.ConsistencyTimeout
  >;
  readonly saveAssessment: (
    actor: DiagramActor,
    target: DiagramTarget,
    request: AssessmentRequest,
  ) => Effect.Effect<
    AssessmentReply,
    DiagramAccessDenied | DiagramUnavailable | OperationIdReused | Domain.AlreadyExecuted
  >;
  readonly initialize: (
    actor: DiagramActor,
    target: DiagramTarget,
    operationId: string,
    graph: ZlozGraph,
  ) => Effect.Effect<
    DiagramInitialization,
    DiagramAccessDenied | OperationIdReused | Domain.AlreadyExecuted
  >;
  readonly execute: (
    actor: DiagramActor,
    target: DiagramTarget,
    request: ZlozOperationRequest,
  ) => Effect.Effect<
    DiagramReply & { readonly sourceStream: string },
    DiagramAccessDenied | DiagramUnavailable | OperationIdReused | Domain.AlreadyExecuted
  >;
  readonly read: (
    actor: DiagramActor,
    target: DiagramTarget,
  ) => Effect.Effect<ZlozOperationDocument | null, DiagramAccessDenied>;
  readonly frame: (
    actor: DiagramActor,
    target: DiagramTarget,
    atLeast?: Readonly<{ stream: string; version: number }>,
  ) => Effect.Effect<DiagramFrame | null, DiagramAccessDenied | Domain.ConsistencyTimeout>;
  readonly checkpoint: (
    actor: DiagramActor,
    target: DiagramTarget,
  ) => Effect.Effect<DiagramCheckpoint | null, DiagramAccessDenied>;
  readonly recover: (
    actor: DiagramActor,
    target: DiagramTarget,
    operationId: string,
    expectedVersion: number,
    checkpoint: DiagramCheckpoint,
  ) => Effect.Effect<
    DiagramRecovery,
    | DiagramAccessDenied
    | DiagramUnavailable
    | OperationIdReused
    | Domain.AlreadyExecuted
    | Cause.UnknownError
  >;
}
// oxlint-disable-next-line linteffect/no-effect-type-alias -- SDK service requirement mapping preserves the emitted method contract.
type WithDiagramService<F> = F extends (...args: infer Args) => Effect.Effect<infer A, infer E>
  ? (...args: Args) => Effect.Effect<A, E, DiagramServices>
  : never;
export interface DiagramDomain {
  readonly model: ModelClass<'ZlozDiagramsV1', DiagramServices, never>;
  readonly saveRelationshipDecision: WithDiagramService<DiagramRuntime['saveRelationshipDecision']>;
  readonly bootstrap: WithDiagramService<DiagramRuntime['bootstrap']>;
  readonly deltaApi: Domain.Api.Any & Effect.Effect<ApiServer, never, Internals | DiagramSession>;
  readonly api: Domain.Api.Any & Effect.Effect<ApiServer, never, Internals | DiagramSession>;
  readonly sessionLayer: (resolve: DiagramIdentityResolver) => Layer.Layer<DiagramSession>;
  readonly runtime: Effect.Effect<DiagramRuntime, never, DiagramServices>;
  readonly saveAssessment: WithDiagramService<DiagramRuntime['saveAssessment']>;
  readonly initialize: WithDiagramService<DiagramRuntime['initialize']>;
  readonly execute: WithDiagramService<DiagramRuntime['execute']>;
  readonly read: WithDiagramService<DiagramRuntime['read']>;
  readonly frame: WithDiagramService<DiagramRuntime['frame']>;
  readonly checkpoint: WithDiagramService<DiagramRuntime['checkpoint']>;
  readonly recover: WithDiagramService<DiagramRuntime['recover']>;
}
/* oxlint-enable linteffect/no-manual-effect-channels */

/**
 * First-class optional adapter. Expose only initialize/execute/read through a host
 * that resolves trusted identity; never expose native command RPCs to a browser.
 */
export function makeDiagramDomain(host: DiagramHost): DiagramDomain {
  const DecisionReply = Schema.Struct({
    requestHash: Schema.String,
    outcome: RelationshipDecisionOutcomeSchema,
  });
  class RelationshipDecisionDecided extends Domain.Event('RelationshipDecisionDecided', {
    version: Schema.Literal(1),
    target: Target,
    operationId: Identifier,
    actorId: Identifier,
    ...DecisionReply.fields,
  }) {}
  class SaveRelationshipDecision extends Domain.Command('SaveRelationshipDecision', {
    target: Schema.String,
    middleware: [DiagramSession],
    input: { request: RelationshipDecisionRequestSchema },
    events: [RelationshipDecisionDecided],
    reply: DecisionReply.fields,
    rejects: [DiagramAccessDenied, DiagramUnavailable],
  }) {}
  const decisionHash = (
    target: DiagramTarget,
    actorId: string,
    request: RelationshipDecisionRequest,
  ) => sha256Text(canonicalOperationValue([target, actorId, request]));
  class AssessmentDecided extends Domain.Event('AssessmentDecided', {
    binding: Schema.String,
    decision: AssessmentDecisionSchema,
  }) {}
  class SaveAssessment extends Domain.Command('SaveAssessment', {
    target: Schema.String,
    middleware: [DiagramSession],
    input: { request: AssessmentRequestSchema },
    events: [AssessmentDecided],
    reply: { binding: Schema.String, decision: AssessmentDecisionSchema },
    rejects: [DiagramAccessDenied, DiagramUnavailable],
  }) {}
  class DiagramInitialized extends Domain.Event('DiagramInitialized', {
    binding: Schema.String,
    document: Document,
  }) {}
  class InitializationRefused extends Domain.Event('InitializationRefused', {
    binding: Schema.String,
  }) {}
  class OperationDecided extends Domain.Event('OperationDecided', {
    ...BoundReceipt.fields,
    requestHash: Schema.optionalKey(Schema.String),
  }) {}
  const RecoveryResult = Schema.Struct({
    binding: Schema.String,
    status: Schema.Literals(['restored', 'conflict', 'unchanged']),
    documentVersion: Schema.Number,
  });
  class RecoveryDecided extends Domain.Event('RecoveryDecided', {
    ...RecoveryResult.fields,
    document: Schema.NullOr(Document),
  }) {}
  class RecoverDiagram extends Domain.Command('RecoverDiagram', {
    target: Schema.String,
    middleware: [DiagramSession],
    input: { binding: Schema.String, checkpoint: Schema.String, expectedVersion: Schema.Number },
    events: [RecoveryDecided],
    rejects: [DiagramAccessDenied, DiagramUnavailable],
    reply: RecoveryResult.fields,
  }) {}
  const authorizeRecovery = (actor: DiagramActor, target: DiagramTarget) =>
    host.authorizeRecovery?.(actor, target) ?? Effect.fail(new DiagramAccessDenied());
  class InitializeDiagram extends Domain.Command('InitializeDiagram', {
    target: Schema.String,
    middleware: [DiagramSession],
    input: { binding: Schema.String, document: Document },
    events: [DiagramInitialized, InitializationRefused],
    rejects: [DiagramAccessDenied],
    reply: InitialResult.fields,
  }) {}
  class SubmitOperation extends Domain.Command('SubmitOperation', {
    target: Schema.String,
    middleware: [DiagramSession],
    input: { request: Request },
    events: [OperationDecided],
    rejects: [DiagramAccessDenied, DiagramUnavailable],
    reply: BoundReceipt.fields,
  }) {}
  class Diagram extends Domain.Aggregate('ZlozDiagramV1', {
    id: Schema.String,
    state: Schema.Struct({
      document: Schema.NullOr(Document),
      assessments: Schema.optionalKey(AssessmentRecordsSchema),
      relationshipDecisions: Schema.optionalKey(RelationshipDecisionsSchema),
      relationshipDecisionRecoveryVersion: Schema.optionalKey(Schema.Number),
    }),
    initial: { document: null },
    commands: [
      InitializeDiagram,
      SubmitOperation,
      RecoverDiagram,
      SaveAssessment,
      SaveRelationshipDecision,
    ],
    decide: {
      SaveRelationshipDecision: (state, command, context) =>
        Effect.gen(function* () {
          const actor = yield* CurrentDiagramActor;
          const target = targetFromKey(context.id);
          yield* host.authorize(actor, target, true);
          const document = state.document;
          if (!document) return yield* new DiagramUnavailable();
          const records = state.relationshipDecisions ?? [];
          const input = command.request.command;
          if (input.type === 'WithdrawProposal') {
            const proposal = records.find(({ proposalId }) => proposalId === input.proposalId);
            if (proposal && proposal.requestedBy !== actor.userId)
              yield* authorizeRecovery(actor, target);
          }
          const requestHash = yield* Effect.promise(() =>
            decisionHash(target, actor.userId, command.request),
          );
          const outcome = yield* Effect.promise(() =>
            decideRelationship(
              document.graph,
              state.relationshipDecisionRecoveryVersion ?? 0,
              records,
              actor.userId,
              input,
            ),
          );
          return [
            new RelationshipDecisionDecided({
              version: 1,
              target,
              operationId: command.request.operationId,
              actorId: actor.userId,
              requestHash,
              outcome,
            }),
          ];
        }),
      SaveAssessment: (state, command, context) =>
        Effect.gen(function* () {
          const actor = yield* CurrentDiagramActor;
          const target = targetFromKey(context.id);
          yield* host.authorize(actor, target, true);
          if (!state.document) return yield* new DiagramUnavailable();
          return [
            new AssessmentDecided({
              binding: assessmentBinding(actor.userId, command.request),
              decision: decideAssessment(
                target.diagramId,
                state.document,
                state.assessments ?? [],
                actor.userId,
                command.request,
              ),
            }),
          ];
        }),
      RecoverDiagram: (state, command, context) =>
        Effect.gen(function* () {
          const actor = yield* CurrentDiagramActor;
          const target = targetFromKey(context.id);
          yield* authorizeRecovery(actor, target);
          if (!state.document) return yield* new DiagramUnavailable();
          const checkpoint = yield* Effect.tryPromise(() =>
            parseDiagramCheckpoint(command.checkpoint),
          ).pipe(Effect.mapError(() => new DiagramAccessDenied()));
          if (
            checkpoint.target.teamId !== target.teamId ||
            checkpoint.target.diagramId !== target.diagramId ||
            host.recoveryPolicy?.(actor, target, checkpoint.graph)
          )
            return yield* new DiagramAccessDenied();
          const decision = recoverOperationDocument(
            state.document,
            checkpoint.graph,
            command.expectedVersion,
          );
          return [
            new RecoveryDecided({
              binding: command.binding,
              status: decision.status,
              documentVersion: decision.document.version,
              document: decision.status === 'restored' ? decision.document : null,
            }),
          ];
        }),

      InitializeDiagram: (state, command, context) =>
        Effect.gen(function* () {
          const actor = yield* CurrentDiagramActor;
          const target = targetFromKey(context.id);
          yield* host.authorize(actor, target, true);
          return state.document === null
            ? [new DiagramInitialized({ binding: command.binding, document: command.document })]
            : [new InitializationRefused({ binding: command.binding })];
        }),
      SubmitOperation: (state, command, context) =>
        Effect.gen(function* () {
          const actor = yield* CurrentDiagramActor;
          const target = targetFromKey(context.id);
          yield* host.authorize(actor, target, true);
          if (state.document === null) return yield* new DiagramUnavailable();
          const scope = { ...target, actorId: actor.userId };
          const decision = decideOperation(
            state.document,
            command.request,
            scope,
            host.policy?.(actor, target),
          );
          return [
            new OperationDecided({
              binding: canonicalOperationValue({ ...scope, request: command.request }),
              receipt: decision.receipt,
              requestHash: yield* Effect.promise(() => operationHash(command.request)),
            }),
          ];
        }),
    },
    evolve: {
      RelationshipDecisionDecided: (state, event) =>
        event.outcome.status === 'recorded'
          ? {
              ...state,
              relationshipDecisions: installRelationshipDecision(
                state.relationshipDecisions ?? [],
                event.outcome.record,
              ),
            }
          : state,
      AssessmentDecided: (state, event) =>
        event.decision.status === 'accepted'
          ? {
              ...state,
              assessments: applyAssessment(state.assessments ?? [], event.decision.record),
            }
          : state,
      RecoveryDecided: (state, event) =>
        event.document
          ? {
              ...state,
              document: event.document,
              relationshipDecisionRecoveryVersion: event.documentVersion,
            }
          : state,
      DiagramInitialized: (_state, event) => ({ document: event.document }),
      InitializationRefused: (state) => state,
      OperationDecided: (state, event) => {
        if (event.receipt.status === 'rejected') return state;
        if (!state.document)
          throw new AdapterInvariant({ message: 'An operation preceded diagram initialization' });
        // Domain owns immutable, validated state; changed event values are detached
        // by replay while unchanged graph values can remain shared with `before`.
        return {
          ...state,
          document: applyOperationChangeShared(state.document, event.receipt.change),
        };
      },
    },
    reply: {
      SaveRelationshipDecision: (_state, events) => {
        const event = events[0];
        if (!event || event._tag !== 'RelationshipDecisionDecided')
          throw new AdapterInvariant({ message: 'Relationship command has no decision event' });
        return { requestHash: event.requestHash, outcome: event.outcome };
      },
      SaveAssessment: (_state, events) => {
        const event = events[0];
        if (!event || event._tag !== 'AssessmentDecided')
          throw new AdapterInvariant({ message: 'Assessment has no decision event' });
        return { binding: event.binding, decision: event.decision };
      },
      RecoverDiagram: (_state, events) => {
        const event = events[0];
        if (!event || event._tag !== 'RecoveryDecided')
          throw new AdapterInvariant({ message: 'Recovery has no decision event' });
        return {
          binding: event.binding,
          status: event.status,
          documentVersion: event.documentVersion,
        };
      },

      InitializeDiagram: (_state, events) => {
        const event = events[0];
        if (event?._tag !== 'DiagramInitialized' && event?._tag !== 'InitializationRefused')
          throw new AdapterInvariant({ message: 'Initialization has no decision event' });
        return { binding: event.binding, created: event._tag === 'DiagramInitialized' };
      },
      SubmitOperation: (_state, events) => {
        const event = events[0];
        if (!event || event._tag !== 'OperationDecided')
          throw new AdapterInvariant({ message: 'Operation has no decision event' });
        return { binding: event.binding, receipt: event.receipt };
      },
    },
  }) {}
  const Frame = DiagramFrameSchema;
  class PublicChanged extends Domain.Event('PublicChanged', { version: Schema.Number }) {}
  class DiagramLive extends Domain.View('ZlozDiagramLiveV1', {
    from: [Diagram],
    key: Diagram,
    state: Schema.NullOr(Frame),
    initial: null,
    events: [PublicChanged],
    evolve: {
      RelationshipDecisionDecided: (state, event, context) => {
        if (!state) return state;
        const next = { ...state, sourceVersion: context.envelope.seq };
        return event.outcome.status === 'recorded'
          ? {
              ...next,
              relationshipDecisions: installRelationshipDecision(
                state.relationshipDecisions ?? [],
                event.outcome.record,
              ),
            }
          : next;
      },
      AssessmentDecided: (state, event, context) =>
        state && {
          ...state,
          sourceVersion: context.envelope.seq,
          assessments:
            event.decision.status === 'accepted'
              ? applyAssessment(state.assessments ?? [], event.decision.record)
              : (state.assessments ?? []),
        },
      RecoveryDecided: (state, event, context) =>
        state && {
          ...state,
          sourceVersion: context.envelope.seq,
          document: event.document ? { ...event.document, undo: [] } : state.document,
          undoResetVersion: event.document ? event.documentVersion : (state.undoResetVersion ?? 0),
          relationshipDecisionRecoveryVersion: event.document
            ? event.documentVersion
            : (state.relationshipDecisionRecoveryVersion ?? 0),
        },

      DiagramInitialized: (_state, event, context) => ({
        target: targetFromKey(context.key.id),
        sourceVersion: context.envelope.seq,
        document: { ...event.document, undo: [] },
        undoResetVersion: 0,
        coverage: [],
      }),
      InitializationRefused: (state, _event, context) =>
        state && { ...state, sourceVersion: context.envelope.seq },
      OperationDecided: (state, event, context) => {
        if (!state)
          throw new AdapterInvariant({ message: 'Public operation preceded initialization' });
        const receipt = event.receipt;
        const document =
          receipt.status === 'accepted'
            ? applyOperationChangeShared(state.document, receipt.change)
            : state.document;
        return {
          ...state,
          sourceVersion: context.envelope.seq,
          document: { ...document, undo: [] },
          coverage: [
            ...state.coverage,
            {
              actorId: receipt.actorId,
              operationId: receipt.operationId,
              requestHash: event.requestHash ?? '',
              documentVersion: receipt.documentVersion,
              status: receipt.status,
            },
          ].slice(-128),
        };
      },
    },
    emit: {
      RelationshipDecisionDecided: (_event, context) =>
        new PublicChanged({ version: context.after?.document.version ?? 0 }),
      AssessmentDecided: (_event, context) =>
        new PublicChanged({ version: context.after?.document.version ?? 0 }),
      RecoveryDecided: (_event, context) =>
        new PublicChanged({ version: context.after?.document.version ?? 0 }),
      DiagramInitialized: (_event, context) =>
        new PublicChanged({ version: context.after?.document.version ?? 0 }),
      InitializationRefused: (_event, context) =>
        new PublicChanged({ version: context.after?.document.version ?? 0 }),
      OperationDecided: (_event, context) =>
        new PublicChanged({ version: context.after?.document.version ?? 0 }),
    },
    middleware: [DiagramSession],
    rejects: [DiagramAccessDenied],
    validate: (request) =>
      CurrentDiagramActor.pipe(
        Effect.flatMap((actor) => host.authorize(actor, targetFromKey(request.key.id), false)),
      ),
  }) {}
  class PublicDelta extends Domain.Event('PublicDelta', { delta: DiagramDeltaSchema }) {}
  const publicDelta = (key: string, sourceVersion: number, payload: DiagramDelta['payload']) =>
    new PublicDelta({
      delta: {
        format: 'foldkit-zloz-delta',
        version: 1,
        target: targetFromKey(key),
        previousSourceVersion: sourceVersion - 1,
        sourceVersion,
        payload,
      },
    });
  class DiagramDeltaView extends Domain.View('ZlozDiagramDeltaV1', {
    from: [Diagram],
    key: Diagram,
    state: Schema.NullOr(
      Schema.Struct({ target: Target, sourceStream: Schema.String, sourceVersion: Schema.Number }),
    ),
    initial: null,
    events: [PublicDelta],
    evolve: {
      ZlozDiagramV1: (_state, _event, context) => ({
        target: targetFromKey(context.key.id),
        sourceStream: context.envelope.stream,
        sourceVersion: context.envelope.seq,
      }),
    },
    emit: {
      DiagramInitialized: (event, context) =>
        publicDelta(context.key.id, context.envelope.seq, {
          kind: 'reset',
          reason: 'initialized',
          document: { ...event.document, undo: [] },
          undoResetVersion: 0,
        }),
      InitializationRefused: (_event, context) =>
        publicDelta(context.key.id, context.envelope.seq, { kind: 'noop' }),
      RecoveryDecided: (event, context) =>
        publicDelta(
          context.key.id,
          context.envelope.seq,
          event.document
            ? {
                kind: 'reset',
                reason: 'recovered',
                document: { ...event.document, undo: [] },
                undoResetVersion: event.documentVersion,
              }
            : { kind: 'noop' },
        ),
      OperationDecided: (event, context) =>
        publicDelta(context.key.id, context.envelope.seq, {
          kind: 'graph',
          receipt: event.receipt,
          requestHash: event.requestHash ?? '',
        }),
      RelationshipDecisionDecided: (_event, context) =>
        publicDelta(context.key.id, context.envelope.seq, { kind: 'noop' }),
      AssessmentDecided: (event, context) =>
        publicDelta(
          context.key.id,
          context.envelope.seq,
          event.decision.status === 'accepted'
            ? { kind: 'assessment', record: event.decision.record }
            : { kind: 'noop' },
        ),
    },
    middleware: [DiagramSession],
    rejects: [DiagramAccessDenied],
    validate: (request) =>
      CurrentDiagramActor.pipe(
        Effect.flatMap((actor) => host.authorize(actor, targetFromKey(request.key.id), false)),
      ),
  }) {}
  class DiagramModel extends Domain.Model('ZlozDiagramsV1', {
    aggregates: [Diagram],
    views: [DiagramLive, DiagramDeltaView],
  }) {}
  class DiagramApi extends Domain.Api('ZlozDiagramReadApiV1', {
    model: DiagramModel,
    commands: [],
    views: ['ZlozDiagramLiveV1'],
  }) {}
  class DiagramDeltaApi extends Domain.Api('ZlozDiagramDeltaReadApiV1', {
    model: DiagramModel,
    commands: [],
    views: ['ZlozDiagramDeltaV1'],
  }) {}
  const sessionLayer = (resolve: DiagramIdentityResolver) =>
    Layer.succeed(DiagramSession, (effect, { headers }) =>
      Effect.gen(function* () {
        const actor = yield* resolve(new Headers(Object.entries(headers)));
        return yield* effect.pipe(Effect.provideService(CurrentDiagramActor, actor));
      }),
    );
  function frame(
    identity: DiagramActor,
    resource: DiagramTarget,
    atLeast?: Readonly<{ stream: string; version: number }>,
  ) {
    return Effect.gen(function* () {
      const actor = Schema.decodeUnknownSync(Actor)({ ...identity });
      const target = Schema.decodeUnknownSync(Target)({ ...resource });
      yield* host.authorize(actor, target, false);
      const live = yield* DiagramLive;
      return (yield* live.snapshot(Diagram.ref(targetKey(target)), { atLeast })).state;
    });
  }

  function bootstrap(identity: DiagramActor, resource: DiagramTarget) {
    return Effect.gen(function* () {
      const actor = Schema.decodeUnknownSync(Actor)({ ...identity });
      const target = Schema.decodeUnknownSync(Target)({ ...resource });
      yield* host.authorize(actor, target, false);
      const delta = yield* DiagramDeltaView;
      const frontier = yield* delta.snapshot(Diagram.ref(targetKey(target)));
      const canonical = yield* frame(
        actor,
        target,
        frontier.state
          ? { stream: frontier.state.sourceStream, version: frontier.state.sourceVersion }
          : undefined,
      );
      return {
        frame: canonical,
        feed: {
          format: 'foldkit-zloz-feed' as const,
          version: 1 as const,
          target,
          cursor: frontier.cursor,
          sourceVersion: frontier.state?.sourceVersion ?? 0,
        },
      };
    });
  }
  function initialize(
    identity: DiagramActor,
    resource: DiagramTarget,
    operationId: string,
    graph: ZlozGraph,
  ) {
    return Effect.gen(function* () {
      const actor = Schema.decodeUnknownSync(Actor)({ ...identity });
      const target = Schema.decodeUnknownSync(Target)({ ...resource });
      Schema.decodeUnknownSync(Identifier)(operationId);
      yield* host.authorize(actor, target, true);
      const document = createOperationDocument(graph);
      const binding = canonicalOperationValue({ ...target, actorId: actor.userId, document });
      const diagrams = yield* Diagram;
      const result = yield* diagrams
        .send(targetKey(target), new InitializeDiagram({ binding, document }), {
          commandId: internalId('initialize', actor, operationId),
        })
        .pipe(Effect.provideService(CurrentDiagramActor, actor));
      if (result.reply.binding !== binding) return yield* new OperationIdReused();
      return {
        created: result.reply.created,
        sourceVersion: result.version,
        sourceStream: result.stream,
      };
    });
  }
  function saveRelationshipDecision(
    identity: DiagramActor,
    resource: DiagramTarget,
    input: RelationshipDecisionRequest,
  ) {
    return Effect.gen(function* () {
      const actor = Schema.decodeUnknownSync(Actor)({ ...identity });
      const target = Schema.decodeUnknownSync(Target)({ ...resource });
      const request = parseRelationshipDecisionRequest(JSON.stringify(input));
      yield* host.authorize(actor, target, true);
      const requestHash = yield* Effect.promise(() => decisionHash(target, actor.userId, request));
      const diagrams = yield* Diagram;
      const result = yield* diagrams
        .send(targetKey(target), new SaveRelationshipDecision({ request }), {
          commandId: internalId('relationship-decision', actor, request.operationId),
        })
        .pipe(Effect.provideService(CurrentDiagramActor, actor));
      if (result.reply.requestHash !== requestHash)
        return { status: 'rejected', code: 'OperationIdMismatch' } as const;
      return result.reply.outcome;
    });
  }
  function saveAssessment(
    identity: DiagramActor,
    resource: DiagramTarget,
    input: AssessmentRequest,
  ) {
    return Effect.gen(function* () {
      const actor = Schema.decodeUnknownSync(Actor)({ ...identity });
      const target = Schema.decodeUnknownSync(Target)({ ...resource });
      // Detach nested Unknown/refined evidence before yielding to host I/O.
      const request = parseAssessmentRequest(JSON.stringify(input));
      yield* host.authorize(actor, target, true);
      const binding = assessmentBinding(actor.userId, request);
      const diagrams = yield* Diagram;
      const result = yield* diagrams
        .send(targetKey(target), new SaveAssessment({ request }), {
          commandId: internalId('assessment', actor, request.operationId),
        })
        .pipe(Effect.provideService(CurrentDiagramActor, actor));
      if (result.reply.binding !== binding) return yield* new OperationIdReused();
      return {
        operationId: request.operationId,
        decision: result.reply.decision,
        sourceVersion: result.version,
      };
    });
  }
  function execute(identity: DiagramActor, resource: DiagramTarget, input: ZlozOperationRequest) {
    return Effect.gen(function* () {
      const actor = Schema.decodeUnknownSync(Actor)({ ...identity });
      const target = Schema.decodeUnknownSync(Target)({ ...resource });
      const request = parseOperationRequest(serializeOperationRequest(input));
      const binding = canonicalOperationValue({ ...target, actorId: actor.userId, request });
      // This runs before native receipt lookup; cached success cannot bypass revocation.
      yield* host.authorize(actor, target, true);
      const diagrams = yield* Diagram;
      const result = yield* diagrams
        .send(targetKey(target), new SubmitOperation({ request }), {
          commandId: internalId('execute', actor, request.operationId),
        })
        .pipe(Effect.provideService(CurrentDiagramActor, actor));
      // Mandatory after lookup too: changed-payload races can both precede decide.
      if (result.reply.binding !== binding) return yield* new OperationIdReused();
      return {
        receipt: result.reply.receipt,
        sourceVersion: result.version,
        sourceStream: result.stream,
        requestHash: yield* Effect.promise(() => operationHash(request)),
      };
    });
  }
  function read(identity: DiagramActor, resource: DiagramTarget) {
    return Effect.gen(function* () {
      const actor = Schema.decodeUnknownSync(Actor)({ ...identity });
      const target = Schema.decodeUnknownSync(Target)({ ...resource });
      yield* host.authorize(actor, target, false);
      const diagrams = yield* Diagram;
      const state = yield* diagrams.state(targetKey(target));
      return state.document;
    });
  }
  function checkpoint(identity: DiagramActor, resource: DiagramTarget) {
    return Effect.gen(function* () {
      const actor = Schema.decodeUnknownSync(Actor)({ ...identity });
      const target = Schema.decodeUnknownSync(Target)({ ...resource });
      yield* authorizeRecovery(actor, target);
      const document = yield* read(actor, target);
      return document
        ? yield* Effect.promise(() =>
            createDiagramCheckpoint(target, document.version, document.graph),
          )
        : null;
    });
  }
  function recover(
    identity: DiagramActor,
    resource: DiagramTarget,
    operationId: string,
    expectedVersion: number,
    saved: DiagramCheckpoint,
  ) {
    return Effect.gen(function* () {
      const actor = Schema.decodeUnknownSync(Actor)({ ...identity });
      const target = Schema.decodeUnknownSync(Target)({ ...resource });
      Schema.decodeUnknownSync(Identifier)(operationId);
      Schema.decodeUnknownSync(
        Schema.Number.pipe(
          Schema.check(
            Schema.isInt(),
            Schema.isGreaterThanOrEqualTo(0),
            Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
          ),
        ),
      )(expectedVersion);
      yield* authorizeRecovery(actor, target);
      const checkpoint = yield* Effect.tryPromise(() =>
        parseDiagramCheckpoint(JSON.stringify(saved)),
      );
      if (
        checkpoint.target.teamId !== target.teamId ||
        checkpoint.target.diagramId !== target.diagramId
      )
        return yield* new DiagramAccessDenied();
      const binding = canonicalOperationValue({
        ...target,
        actorId: actor.userId,
        operationId,
        expectedVersion,
        digest: checkpoint.digest,
      });
      const diagrams = yield* Diagram;
      const result = yield* diagrams
        .send(
          targetKey(target),
          new RecoverDiagram({ binding, expectedVersion, checkpoint: JSON.stringify(checkpoint) }),
          { commandId: internalId('recover', actor, operationId) },
        )
        .pipe(Effect.provideService(CurrentDiagramActor, actor));
      if (result.reply.binding !== binding) return yield* new OperationIdReused();
      return {
        status: result.reply.status,
        documentVersion: result.reply.documentVersion,
        sourceVersion: result.version,
      };
    });
  }
  // Resolve the aggregate client while the hosting Layer discovers its bindings.
  const runtime = Effect.gen(function* () {
    const diagrams = yield* Diagram;
    const live = yield* DiagramLive;
    const delta = yield* DiagramDeltaView;
    return {
      bootstrap: (...args: Parameters<typeof bootstrap>) =>
        bootstrap(...args).pipe(
          Effect.provideService(DiagramLive, live),
          Effect.provideService(DiagramDeltaView, delta),
        ),
      saveRelationshipDecision: (...args: Parameters<typeof saveRelationshipDecision>) =>
        saveRelationshipDecision(...args).pipe(Effect.provideService(Diagram, diagrams)),
      saveAssessment: (...args: Parameters<typeof saveAssessment>) =>
        saveAssessment(...args).pipe(Effect.provideService(Diagram, diagrams)),
      checkpoint: (...args: Parameters<typeof checkpoint>) =>
        checkpoint(...args).pipe(Effect.provideService(Diagram, diagrams)),
      recover: (...args: Parameters<typeof recover>) =>
        recover(...args).pipe(Effect.provideService(Diagram, diagrams)),
      frame: (...args: Parameters<typeof frame>) =>
        frame(...args).pipe(Effect.provideService(DiagramLive, live)),
      initialize: (...args: Parameters<typeof initialize>) =>
        initialize(...args).pipe(Effect.provideService(Diagram, diagrams)),
      execute: (...args: Parameters<typeof execute>) =>
        execute(...args).pipe(Effect.provideService(Diagram, diagrams)),
      read: (...args: Parameters<typeof read>) =>
        read(...args).pipe(Effect.provideService(Diagram, diagrams)),
    };
  });
  return {
    model: DiagramModel,
    bootstrap,
    deltaApi: DiagramDeltaApi,
    saveAssessment,
    saveRelationshipDecision,
    checkpoint,
    recover,
    api: DiagramApi,
    sessionLayer,
    initialize,
    execute,
    read,
    frame,
    runtime,
  };
}
