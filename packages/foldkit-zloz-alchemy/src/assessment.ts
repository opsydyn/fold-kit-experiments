import { canonicalOperationValue, type ZlozOperationDocument } from '@opsydyn/foldkit-zloz';
import { evaluateCouplingAssessment, isCouplingAssessment } from '@opsydyn/foldkit-zloz/coupling';
import { Schema } from 'effect';

import { structWithExtensions } from './json-struct';

const Identifier = Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(256)));
const Revision = Schema.Number.pipe(
  Schema.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
  ),
);
// ADR 0044: the exact domain guard already proves this opaque value is JSON.
// Keep that guard on both codec directions without a second generic JSON walk.
export const CouplingAssessmentSchema = Schema.declare(isCouplingAssessment, {
  toCodecJson: () => undefined,
});
export const AssessmentRequestSchema = Schema.Struct({
  version: Schema.Literal(1),
  operationId: Identifier,
  expectedRevision: Revision,
  assessment: CouplingAssessmentSchema,
});
export type AssessmentRequest = typeof AssessmentRequestSchema.Type;
export const AssessmentRecordSchema = Schema.Struct({
  revision: Revision.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1))),
  authoredBy: Identifier,
  operationId: Identifier,
  assessment: CouplingAssessmentSchema,
});
export type AssessmentRecord = typeof AssessmentRecordSchema.Type;
export const withinRecordBounds = (records: readonly AssessmentRecord[]) =>
  records.length <= 500 &&
  new Set(records.map((record) => record.assessment.target.relationshipId)).size ===
    records.length &&
  new TextEncoder().encode(JSON.stringify(records)).byteLength <= 1_048_576;
export const AssessmentRecordsSchema = Schema.Array(AssessmentRecordSchema).pipe(
  Schema.check(Schema.isMaxLength(500), Schema.makeFilter(withinRecordBounds)),
);
/** Preserve loose frame record extensions while deriving a typed JSON codec. */
export const AssessmentRecordsJsonSchema = Schema.Array(
  structWithExtensions(AssessmentRecordSchema.fields),
).pipe(Schema.check(Schema.isMaxLength(500), Schema.makeFilter(withinRecordBounds)));
export const AssessmentDecisionSchema = Schema.Union([
  Schema.Struct({ status: Schema.Literal('accepted'), record: AssessmentRecordSchema }),
  Schema.Struct({
    status: Schema.Literal('rejected'),
    code: Schema.Literals(['revision-conflict', 'stale-target', 'capacity-exceeded']),
    currentRevision: Revision,
  }),
]);
export type AssessmentDecision = typeof AssessmentDecisionSchema.Type;
export const AssessmentReplySchema = Schema.Struct({
  operationId: Identifier,
  decision: AssessmentDecisionSchema,
  sourceVersion: Revision,
});
export type AssessmentReply = typeof AssessmentReplySchema.Type;
export const parseAssessmentRequest = Schema.decodeUnknownSync(
  Schema.fromJsonString(AssessmentRequestSchema),
  { onExcessProperty: 'error' },
);
export const assessmentBinding = (actorId: string, request: AssessmentRequest) =>
  canonicalOperationValue({ actorId, request });

/** Called inside the diagram's ordered decision; never a read-then-write across stores. */
export function decideAssessment(
  documentId: string,
  document: ZlozOperationDocument,
  records: readonly AssessmentRecord[],
  actorId: string,
  request: AssessmentRequest,
): AssessmentDecision {
  const currentRevision =
    records.find(
      (record) =>
        record.assessment.target.relationshipId === request.assessment.target.relationshipId,
    )?.revision ?? 0;
  if (request.expectedRevision !== currentRevision)
    return { status: 'rejected', code: 'revision-conflict', currentRevision };
  const result = evaluateCouplingAssessment(request.assessment, {
    documentId,
    graphVersion: document.version,
    graph: document.graph,
  });
  if (result.status === 'rejected')
    return { status: 'rejected', code: 'stale-target', currentRevision };
  const record = {
    revision: currentRevision + 1,
    authoredBy: actorId,
    operationId: request.operationId,
    assessment: request.assessment,
  };
  if (!Schema.is(AssessmentRecordsSchema)(applyAssessment(records, record)))
    return { status: 'rejected', code: 'capacity-exceeded', currentRevision };
  return { status: 'accepted', record };
}
export const applyAssessment = (records: readonly AssessmentRecord[], record: AssessmentRecord) => [
  ...records.filter(
    (old) => old.assessment.target.relationshipId !== record.assessment.target.relationshipId,
  ),
  record,
];
