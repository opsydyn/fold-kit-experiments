import {
  canonicalOperationValue,
  isEdgeArchitecture,
  isNodeArchitecture,
  type ZlozGraph,
} from '@opsydyn/foldkit-zloz';
import { Option, Schema } from 'effect';

import { sha256Text } from './digest';

export const decisionRecordLimit = 8_192;
const arrayByteLimit = 32_768;
const recordCountLimit = 32;
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;
const boundedText = (max: number) =>
  Schema.String.pipe(
    Schema.check(Schema.makeFilter((text) => text.trim() !== '' && bytes(text) <= max)),
  );
const Identifier = Schema.String.pipe(Schema.check(Schema.isPattern(/^[A-Za-z0-9_-]{1,128}$/)));
const ActorId = Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(256)));
const Fingerprint = Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/)));
const Counter = Schema.Number.pipe(
  Schema.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
  ),
);
export const RelationshipDecisionContentSchema = Schema.Struct({
  statement: boundedText(512),
  rationale: boundedText(2_048),
  evidence: Schema.Array(
    Schema.Struct({ kind: Schema.Literal('excerpt'), text: boundedText(1_024) }),
  ).pipe(Schema.check(Schema.isMaxLength(3))),
  openQuestion: Schema.NullOr(boundedText(1_024)),
});

const Share = Schema.Struct({
  type: Schema.Literal('ShareProposal'),
  proposalId: Identifier,
  relationshipId: boundedText(256),
  contextFingerprint: Fingerprint,
  draft: Schema.Struct({
    kind: Schema.Literal('manual'),
    content: RelationshipDecisionContentSchema,
  }),
});
const Review = {
  proposalId: Identifier,
  revision: Counter.pipe(Schema.check(Schema.isGreaterThan(0))),
};
export const RelationshipDecisionRequestSchema = Schema.Struct({
  version: Schema.Literal(1),
  operationId: Identifier,
  command: Schema.Union([
    Share,
    Schema.Struct({ type: Schema.Literal('AcceptProposal'), ...Review }),
    Schema.Struct({ type: Schema.Literal('WithdrawProposal'), ...Review }),
  ]),
});
export type RelationshipDecisionRequest = typeof RelationshipDecisionRequestSchema.Type;
export const parseRelationshipDecisionRequest = Schema.decodeUnknownSync(
  Schema.fromJsonString(RelationshipDecisionRequestSchema),
  { onExcessProperty: 'error' },
);

const Endpoint = Schema.Struct({
  nodeId: boundedText(256),
  portId: boundedText(256),
  label: Schema.String,
  architecture: Schema.NullOr(Schema.Unknown.pipe(Schema.refine(isNodeArchitecture))),
});
export const RelationshipContextSchema = Schema.Struct({
  recoveryVersion: Counter,
  relationship: Schema.Struct({
    id: boundedText(256),
    label: Schema.NullOr(Schema.String),
    architecture: Schema.NullOr(Schema.Unknown.pipe(Schema.refine(isEdgeArchitecture))),
  }),
  source: Endpoint,
  target: Endpoint,
});
type BoundContext = typeof RelationshipContextSchema.Type;
const RecordFields = {
  version: Schema.Literal(1),
  proposalId: Identifier,
  revision: Schema.Literal(1),
  relationshipId: boundedText(256),
  context: RelationshipContextSchema,
  contextFingerprint: Fingerprint,
  content: RelationshipDecisionContentSchema,
  requestedBy: ActorId,
  proposer: Schema.Union([
    Schema.Struct({ kind: Schema.Literal('manual') }),
    Schema.Struct({ kind: Schema.Literal('opy'), runId: Identifier }),
  ]),
};
const DecisionRecord = Schema.Union([
  Schema.Struct({ ...RecordFields, status: Schema.Literal('proposed') }),
  Schema.Struct({ ...RecordFields, status: Schema.Literal('accepted'), acceptedBy: ActorId }),
  Schema.Struct({ ...RecordFields, status: Schema.Literal('withdrawn'), withdrawnBy: ActorId }),
]);
export type RelationshipDecision = typeof DecisionRecord.Type;
const fits = (records: readonly RelationshipDecision[]) =>
  records.length <= recordCountLimit &&
  bytes(JSON.stringify(records)) <= arrayByteLimit &&
  records.every((record) => bytes(JSON.stringify(record)) <= decisionRecordLimit);
export const RelationshipDecisionsSchema = Schema.Array(DecisionRecord).pipe(
  Schema.check(Schema.makeFilter(fits)),
);
export const RelationshipDecisionOutcomeSchema = Schema.Union([
  Schema.Struct({ status: Schema.Literal('recorded'), record: DecisionRecord }),
  Schema.Struct({
    status: Schema.Literal('rejected'),
    code: Schema.Literals([
      'ContextChanged',
      'RelationshipMissing',
      'ProposalNotOpen',
      'RevisionMismatch',
      'OperationIdMismatch',
      'DecisionCapacity',
      'ProposalIdUsed',
      'RelationshipAlreadyAssigned',
    ]),
  }),
]);
export type RelationshipDecisionOutcome = typeof RelationshipDecisionOutcomeSchema.Type;
const rejected = (code: Extract<RelationshipDecisionOutcome, { status: 'rejected' }>['code']) =>
  ({ status: 'rejected', code }) as const;
const recorded = (record: RelationshipDecision): RelationshipDecisionOutcome => ({
  status: 'recorded',
  record,
});

export function relationshipContext(
  graph: ZlozGraph,
  relationshipId: string,
  recoveryVersion: number,
): Option.Option<BoundContext> {
  const edge = graph.edges.find(({ id }) => id === relationshipId);
  if (!edge) return Option.none();
  const endpoint = (value: typeof edge.source) => {
    const node = graph.nodes.find(({ id }) => value.node === id);
    return (
      node && {
        nodeId: node.id,
        portId: value.port,
        label: node.label,
        architecture: node.architecture ?? null,
      }
    );
  };
  const source = endpoint(edge.source);
  const target = endpoint(edge.target);
  if (!source || !target) return Option.none();
  return Option.some({
    recoveryVersion,
    relationship: {
      id: edge.id,
      label: edge.label ?? null,
      architecture: edge.architecture ?? null,
    },
    source,
    target,
  });
}
export const contextFingerprint = (context: BoundContext) =>
  sha256Text(canonicalOperationValue(context));

export async function decideRelationship(
  graph: ZlozGraph,
  recoveryVersion: number,
  records: readonly RelationshipDecision[],
  actorId: string,
  command: RelationshipDecisionRequest['command'],
): Promise<RelationshipDecisionOutcome> {
  if (command.type === 'ShareProposal') {
    if (records.some((record) => record.proposalId === command.proposalId))
      return rejected('ProposalIdUsed');
    if (
      records.some(
        (record) =>
          record.relationshipId === command.relationshipId && record.status !== 'withdrawn',
      )
    )
      return rejected('RelationshipAlreadyAssigned');
    const found = relationshipContext(graph, command.relationshipId, recoveryVersion);
    if (Option.isNone(found)) return rejected('RelationshipMissing');
    const context = found.value;
    if (!Schema.is(RelationshipContextSchema)(context)) return rejected('DecisionCapacity');
    if ((await contextFingerprint(context)) !== command.contextFingerprint)
      return rejected('ContextChanged');
    const record: RelationshipDecision = {
      version: 1,
      revision: 1,
      proposalId: command.proposalId,
      relationshipId: command.relationshipId,
      status: 'proposed',
      content: command.draft.content,
      context,
      contextFingerprint: command.contextFingerprint,
      requestedBy: actorId,
      proposer: { kind: 'manual' },
    };
    // Reserve the worst JSON expansion for a valid actor ID for every pending proposal.
    const reserved = [...records, record].map((item) =>
      item.status === 'proposed'
        ? { ...item, status: 'withdrawn' as const, withdrawnBy: '\u0000'.repeat(256) }
        : item,
    );
    return fits(reserved) ? recorded(record) : rejected('DecisionCapacity');
  }
  const proposal = records.find((record) => record.proposalId === command.proposalId);
  if (proposal?.status !== 'proposed') return rejected('ProposalNotOpen');
  if (proposal.revision !== command.revision) return rejected('RevisionMismatch');
  if (command.type === 'WithdrawProposal')
    return recorded({ ...proposal, status: 'withdrawn', withdrawnBy: actorId });
  const context = relationshipContext(graph, proposal.relationshipId, recoveryVersion);
  if (Option.isNone(context)) return rejected('RelationshipMissing');
  if ((await contextFingerprint(context.value)) !== proposal.contextFingerprint)
    return rejected('ContextChanged');
  return recorded({ ...proposal, status: 'accepted', acceptedBy: actorId });
}

export function installRelationshipDecision(
  records: readonly RelationshipDecision[],
  record: RelationshipDecision,
): readonly RelationshipDecision[] {
  return record.status === 'proposed'
    ? [...records, record]
    : records.map((previous) => (previous.proposalId === record.proposalId ? record : previous));
}
