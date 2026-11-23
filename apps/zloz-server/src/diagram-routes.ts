import type { D1Database } from '@cloudflare/workers-types';
import {
  canonicalOperationValue,
  parseGraph,
  parseOperationRequest,
  serializeGraph,
} from '@opsydyn/foldkit-zloz';
import type { ZlozGraph, ZlozOperationRequest } from '@opsydyn/foldkit-zloz';
import {
  parseAssessmentRequest,
  type AssessmentRequest,
  type AssessmentReply,
} from '@opsydyn/foldkit-zloz-alchemy/assessment';
import {
  parseDiagramCheckpoint,
  type DiagramCheckpoint,
} from '@opsydyn/foldkit-zloz-alchemy/checkpoint';
import type { DiagramActor, DiagramTarget } from '@opsydyn/foldkit-zloz-alchemy/collaboration';
import type { DiagramFeed } from '@opsydyn/foldkit-zloz-alchemy/delta';
import {
  decisionRecordLimit,
  parseRelationshipDecisionRequest,
  type RelationshipDecision,
  type RelationshipDecisionRequest,
  type RelationshipDecisionOutcome,
} from '@opsydyn/foldkit-zloz-alchemy/relationship-decision';
import type { DiagramFrame, DiagramReply } from '@opsydyn/foldkit-zloz-alchemy/session';
import type { Auth as BetterAuth } from 'better-auth';
import { Data, Schema } from 'effect';

import type { authOptions } from './auth-options';
import { ClefReference, type ClefAdvice } from './clef-contract';
import { epochSql } from './date-sql';
import { BodyRejected, bodyText } from './http-body';
import type { DiagramPeer } from './presence';
import { usableNodeIcon } from './team-icons';

const Identifier = Schema.String.pipe(Schema.check(Schema.isPattern(/^[A-Za-z0-9_-]{1,128}$/)));
const Creation = Schema.Struct({
  operationId: Identifier,
  name: Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(120))),
  graph: Schema.Unknown,
});
const Heartbeat = Schema.Struct({
  connectionId: Identifier,
  selection: Schema.Array(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))).pipe(
    Schema.check(Schema.isMaxLength(250)),
  ),
  cursor: Schema.NullOr(Schema.Struct({ x: Schema.Finite, y: Schema.Finite })),
});
type NativeAuth = Readonly<{
  api: Pick<BetterAuth<ReturnType<typeof authOptions>>['api'], 'getSession'>;
}>;
export interface DiagramService {
  readonly decisionAuthoring?: boolean;
  readonly clefShadow?: {
    readonly read: (
      actor: DiagramActor,
      target: DiagramTarget,
      reference: ClefReference,
    ) => Promise<RelationshipDecision | null>;
    readonly admit: (actor: DiagramActor) => Promise<boolean>;
    readonly review: (proposal: RelationshipDecision) => Promise<ClefAdvice>;
  };
  readonly saveRelationshipDecision?: (
    actor: DiagramActor,
    target: DiagramTarget,
    request: RelationshipDecisionRequest,
  ) => Promise<RelationshipDecisionOutcome>;
  readonly bootstrap?: (
    actor: DiagramActor,
    target: DiagramTarget,
  ) => Promise<{ readonly frame: DiagramFrame | null; readonly feed: DiagramFeed }>;
  readonly saveAssessment: (
    actor: DiagramActor,
    target: DiagramTarget,
    request: AssessmentRequest,
  ) => Promise<AssessmentReply>;
  readonly defer: (work: Promise<void>) => void;
  readonly checkpoint: (
    actor: DiagramActor,
    target: DiagramTarget,
  ) => Promise<DiagramCheckpoint | null>;
  readonly recover: (
    actor: DiagramActor,
    target: DiagramTarget,
    operationId: string,
    expectedVersion: number,
    checkpoint: DiagramCheckpoint,
  ) => Promise<{
    status: 'restored' | 'conflict' | 'unchanged';
    documentVersion: number;
    sourceVersion: number;
  }>;
  readonly graph: (actor: DiagramActor, target: DiagramTarget) => Promise<ZlozGraph | null>;
  readonly initialize: (
    actor: DiagramActor,
    target: DiagramTarget,
    operationId: string,
    graph: ZlozGraph,
  ) => Promise<{ created: boolean; sourceVersion: number; sourceStream: string }>;
  readonly execute: (
    actor: DiagramActor,
    target: DiagramTarget,
    request: ZlozOperationRequest,
  ) => Promise<DiagramReply>;
  readonly frame: (
    actor: DiagramActor,
    target: DiagramTarget,
    atLeast?: Readonly<{ stream: string; version: number }>,
  ) => Promise<DiagramFrame | null>;
  readonly heartbeat: (
    target: DiagramTarget,
    peer: Omit<DiagramPeer, 'seenAt'>,
  ) => Promise<readonly DiagramPeer[]>;
}
class InvalidDiagramInput extends Data.TaggedError('InvalidDiagramInput') {}
async function readInput<Value>(
  request: Request,
  parse: (text: string) => Value,
  limit = 8192,
): Promise<Value> {
  try {
    return parse(await bodyText(request, limit));
  } catch (error) {
    if (error instanceof BodyRejected) throw error;
    throw new InvalidDiagramInput();
  }
}
const json = <Value>(value: Value, status = 200) =>
  Response.json(value, { status, headers: { 'cache-control': 'private, no-store' } });
const parseClefReference = Schema.decodeUnknownSync(Schema.fromJsonString(ClefReference), {
  onExcessProperty: 'error',
});

// Directory ordering is a best-effort, one-second projection. Canonical edits and
// receipts retain their full durable version history; this guard avoids repeated
// metadata-only disk writes and cannot regress a later completed projection.
export const directoryRecencyProjectionSql =
  'UPDATE diagramDirectory SET updatedAt = MAX(updatedAt, ?1) WHERE organizationId = ?2 AND diagramId = ?3 AND updatedAt <= ?1 - 1000';

async function graphIconsAvailable(db: D1Database, teamId: string, graph: ZlozGraph) {
  const refs = new Set(graph.nodes.flatMap((node) => (node.icon ? [node.icon] : [])));
  for (const icon of refs) if (!(await usableNodeIcon(db, teamId, icon))) return false;
  return true;
}

/** Trusted session-derived identity; a body can never supply an actor or role. */
export async function handleDiagramRequest(
  request: Request,
  db: D1Database,
  auth: NativeAuth,
  service: DiagramService,
  trace?: (phase: string) => void,
): Promise<Response> {
  const match = new URL(request.url).pathname.match(
    /^\/api\/zloz\/diagrams\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9_-]{1,128})(?:\/(operations|export|presence|checkpoint|restore|assessments|decisions|clef-review))?$/,
  );
  if (!match) return json({ error: 'Missing' }, 404);
  const target = { teamId: match[1]!, diagramId: match[2]! };
  const action = match[3] ?? '';
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    trace?.('session');
    if (!session) return json({ error: 'SignInRequired' }, 401);
    const access = await db
      .prepare(
        `SELECT member.role, diagramDirectory.name, diagramDirectory.updatedAt FROM member JOIN session ON session.userId = member.userId LEFT JOIN diagramDirectory ON diagramDirectory.organizationId = member.organizationId AND diagramDirectory.diagramId = ? WHERE member.organizationId = ? AND member.userId = ? AND session.id = ? AND ${epochSql('session.expiresAt')} > ?`,
      )
      .bind(target.diagramId, target.teamId, session.user.id, session.session.id, Date.now())
      .first<{
        role: string;
        name: string | null;
        // oxlint-disable-next-line linteffect/no-raw-time-domain-field -- D1 boundary: nullable LEFT JOIN projection of the existing epoch-millisecond metadata column, not a canonical document clock.
        updatedAt: number | null;
      }>();
    if (!access || !['owner', 'editor', 'viewer'].includes(access.role))
      return json({ error: 'AccessDenied' }, 403);
    const actor = { userId: session.user.id, sessionId: session.session.id };
    trace?.('access');
    if ((action === 'checkpoint' || action === 'restore') && access.role !== 'owner')
      return json({ error: 'AccessDenied' }, 403);
    const edit = request.method === 'POST' && action !== 'presence';
    if (edit && access.role === 'viewer') return json({ error: 'AccessDenied' }, 403);
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'MethodNotAllowed' }, 405);
    if (request.method === 'POST' && !action) {
      const command = await readInput(
        request,
        (text) => {
          const input = Schema.decodeUnknownSync(Schema.fromJsonString(Creation))(text);
          return { ...input, graph: parseGraph(JSON.stringify(input.graph)) };
        },
        1_048_576,
      );
      if (command.operationId !== target.diagramId)
        return json({ error: 'CreationIdMismatch' }, 400);
      const graph = command.graph;
      if (
        graph.nodes.length > 250 ||
        graph.edges.length > 500 ||
        new TextEncoder().encode(serializeGraph(graph)).byteLength > 1_048_576
      )
        return json({ error: 'DiagramTooLarge' }, 413);
      if (!(await graphIconsAvailable(db, target.teamId, graph)))
        return json({ error: 'IconUnavailable' }, 422);
      // Include immutable directory metadata in the native command identity. A changed
      // name cannot repair the original creation under a different metadata binding.
      const identityBytes = new TextEncoder().encode(
        canonicalOperationValue([command.operationId, command.name]),
      );
      const digest = await crypto.subtle.digest('SHA-256', identityBytes);
      const commandId = `create-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
      const initialized = await service.initialize(actor, target, commandId, graph);
      if (!initialized.created) return json({ error: 'DiagramExists' }, 409);
      // Creation redirects straight into this view. Fence its first snapshot to
      // the committed initialization before publishing a directory link to it.
      const ready = await service.frame(actor, target, {
        stream: initialized.sourceStream,
        version: initialized.sourceVersion,
      });
      if (!ready) return json({ error: 'Initializing' }, 503);
      await db
        .prepare(
          'INSERT INTO diagramDirectory (organizationId, diagramId, name, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(organizationId, diagramId) DO NOTHING',
        )
        .bind(target.teamId, target.diagramId, command.name, Date.now())
        .run();
      return json({ target, name: command.name });
    }
    if (access.name === null || access.updatedAt === null) return json({ error: 'Missing' }, 404);
    const directory = { name: access.name, updatedAt: access.updatedAt };
    if (request.method === 'GET' && action === 'checkpoint') {
      const saved = await service.checkpoint(actor, target);
      if (!saved) return json({ error: 'Missing' }, 404);
      return new Response(JSON.stringify(saved), {
        headers: {
          'content-type': 'application/json',
          'content-disposition': `attachment; filename="checkpoint-v${saved.documentVersion}.json"`,
          'cache-control': 'private, no-store',
        },
      });
    }
    if (request.method === 'POST' && action === 'restore') {
      const input = await readInput(
        request,
        Schema.decodeUnknownSync(
          Schema.fromJsonString(
            Schema.Struct({
              operationId: Identifier,
              expectedVersion: Schema.Number.pipe(
                Schema.check(
                  Schema.isInt(),
                  Schema.isGreaterThanOrEqualTo(0),
                  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
                ),
              ),
              checkpoint: Schema.Unknown,
            }),
          ),
        ),
        2_097_152,
      );
      const saved = await parseDiagramCheckpoint(JSON.stringify(input.checkpoint)).catch(() => {
        throw new InvalidDiagramInput();
      });
      if (saved.target.teamId !== target.teamId || saved.target.diagramId !== target.diagramId)
        return json({ error: 'CheckpointTargetMismatch' }, 400);
      if (
        saved.graph.nodes.length > 250 ||
        saved.graph.edges.length > 500 ||
        new TextEncoder().encode(serializeGraph(saved.graph)).byteLength > 1_048_576
      )
        return json({ error: 'DiagramTooLarge' }, 413);
      if (!(await graphIconsAvailable(db, target.teamId, saved.graph)))
        return json({ error: 'IconUnavailable' }, 422);
      return json(
        await service.recover(actor, target, input.operationId, input.expectedVersion, saved),
      );
    }
    if (request.method === 'POST' && action === 'clef-review') {
      const shadow = service.clefShadow;
      if (!service.decisionAuthoring || !shadow) return json({ error: 'Missing' }, 404);
      const reference = await readInput(request, parseClefReference, 512);
      const proposal = await shadow.read(actor, target, reference);
      if (!proposal) return json({ error: 'ProposalChanged' }, 409);
      if (!(await shadow.admit(actor))) return json({ error: 'ReviewRateLimited' }, 429);
      const advice = await shadow.review(proposal);
      if (!(await shadow.read(actor, target, reference)))
        return json({ error: 'ProposalChanged' }, 409);
      return json(advice);
    }
    if (request.method === 'POST' && action === 'decisions') {
      if (!service.decisionAuthoring || !service.saveRelationshipDecision)
        return json({ error: 'Missing' }, 404);
      const input = await readInput(request, parseRelationshipDecisionRequest, decisionRecordLimit);
      return json(await service.saveRelationshipDecision(actor, target, input));
    }
    if (request.method === 'POST' && action === 'assessments') {
      const input = await readInput(request, parseAssessmentRequest, 65_536);
      return json(await service.saveAssessment(actor, target, input));
    }
    if (request.method === 'POST' && action === 'operations') {
      const input = await readInput(request, parseOperationRequest, 1_048_576);
      const operation = input.operation;
      const icon =
        operation.type === 'SetNodeIcon'
          ? operation.icon
          : operation.type === 'AddNode'
            ? operation.node.icon
            : undefined;
      if (icon && !(await usableNodeIcon(db, target.teamId, icon)))
        return json({ error: 'IconUnavailable' }, 422);
      const result = await service.execute(actor, target, input);
      trace?.('commit');
      // The native host owns this best-effort projection beyond response completion.
      // Canonical commit/retry acknowledgement must not wait on directory metadata.
      const now = Date.now();
      // Reuse this request's fresh directory read to avoid a D1 round trip
      // within the recency window. SQL still guards overlapping stale reads.
      if (directory.updatedAt <= now - 1000)
        service.defer(
          db
            .prepare(directoryRecencyProjectionSql)
            .bind(now, target.teamId, target.diagramId)
            .run()
            .then(
              () => undefined,
              () => undefined,
            ),
        );
      return json(result);
    }
    if (request.method === 'POST' && action === 'presence') {
      const input = await readInput(
        request,
        Schema.decodeUnknownSync(Schema.fromJsonString(Heartbeat)),
        1_048_576,
      );
      if (
        input.cursor &&
        (Math.abs(input.cursor.x) > 10_000_000 || Math.abs(input.cursor.y) > 10_000_000)
      )
        return json({ error: 'InvalidCursor' }, 400);
      return json({
        peers: await service.heartbeat(target, {
          ...input,
          actorId: actor.userId,
          name: session.user.name.slice(0, 100),
        }),
      });
    }
    if (request.method !== 'GET' || (action && action !== 'export'))
      return json({ error: 'MethodNotAllowed' }, 405);
    if (action === 'export') {
      const graph = await service.graph(actor, target);
      if (!graph) return json({ error: 'Missing' }, 404);
      return new Response(serializeGraph(graph), {
        headers: {
          'content-type': 'application/json',
          'content-disposition': 'attachment; filename="diagram.zloz.json"',
          'cache-control': 'private, no-store',
        },
      });
    }
    const bootstrap = service.bootstrap
      ? await service.bootstrap(actor, target)
      : { frame: await service.frame(actor, target) };
    const frame = bootstrap.frame;
    if (!frame) return json({ error: 'Initializing' }, 503);
    if (service.decisionAuthoring || frame.relationshipDecisions?.length) {
      const decisionFrame = {
        frame: { ...frame, relationshipDecisions: frame.relationshipDecisions ?? [] },
        decisionAuthoring: service.decisionAuthoring === true,
        name: directory.name,
        role: access.role,
      };
      return json(
        service.clefShadow && access.role !== 'viewer'
          ? { ...decisionFrame, clefShadow: true }
          : decisionFrame,
      );
    }
    const {
      relationshipDecisionRecoveryVersion: _decisionRecoveryVersion,
      relationshipDecisions: _decisions,
      ...graphFrame
    } = frame;
    return json({ ...bootstrap, frame: graphFrame, name: directory.name, role: access.role });
  } catch (error) {
    if (error instanceof InvalidDiagramInput) return json({ error: 'InvalidDiagramInput' }, 400);
    if (error instanceof BodyRejected) return json({ error: 'BodyRejected' }, error.status);
    if (error instanceof Object && '_tag' in error) {
      if (error._tag === 'DiagramAccessDenied') return json({ error: 'AccessDenied' }, 403);
      if (error._tag === 'OperationIdReused') return json({ error: 'OperationIdReused' }, 409);
      if (error._tag === 'BodyRejected' && 'status' in error && error.status === 413)
        return json({ error: 'BodyTooLarge' }, 413);
    }
    // Invalid codecs and unavailable storage are not successful writes. A client keeps
    // an uncertain request on non-2xx and recovers by retrying its original identity.
    return json({ error: 'ServiceUnavailable' }, 503);
  }
}
