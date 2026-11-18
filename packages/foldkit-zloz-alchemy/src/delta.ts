import {
  applyOperationChangeShared,
  isOperationDocument,
  isOperationReceipt,
} from '@opsydyn/foldkit-zloz';
import { evaluateCouplingAssessment } from '@opsydyn/foldkit-zloz/coupling';
import { Result, Schema } from 'effect';

import { AssessmentRecordSchema, applyAssessment, withinRecordBounds } from './assessment';
import type { DiagramFrame } from './session';

const Counter = Schema.Number.pipe(
  Schema.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
  ),
);
const Identifier = Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(256)));
const exact = <A extends object>(value: A, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const Target = Schema.Struct({ teamId: Identifier, diagramId: Identifier }).pipe(
  Schema.check(Schema.makeFilter((value) => exact(value, ['teamId', 'diagramId']))),
);
const Receipt = Schema.declare(isOperationReceipt, { toCodecJson: () => undefined });
const PublicDocument = Schema.declare(
  (value): value is NonNullable<DiagramFrame>['document'] =>
    isOperationDocument(value) && value.undo.length === 0,
  { toCodecJson: () => undefined },
);
const Graph = Schema.Struct({
  kind: Schema.Literal('graph'),
  receipt: Receipt,
  requestHash: Schema.String.pipe(
    Schema.check(Schema.makeFilter((value) => value === '' || /^[a-f0-9]{64}$/.test(value))),
  ),
}).pipe(
  Schema.check(Schema.makeFilter((value) => exact(value, ['kind', 'receipt', 'requestHash']))),
);
const Assessment = Schema.Struct({
  kind: Schema.Literal('assessment'),
  record: AssessmentRecordSchema,
}).pipe(Schema.check(Schema.makeFilter((value) => exact(value, ['kind', 'record']))));
const Reset = Schema.Struct({
  kind: Schema.Literal('reset'),
  reason: Schema.Literals(['initialized', 'recovered']),
  document: PublicDocument,
  undoResetVersion: Counter,
}).pipe(
  Schema.check(
    Schema.makeFilter((value) => exact(value, ['kind', 'reason', 'document', 'undoResetVersion'])),
  ),
);
const Noop = Schema.Struct({ kind: Schema.Literal('noop') }).pipe(
  Schema.check(Schema.makeFilter((value) => exact(value, ['kind']))),
);
const Delta = Schema.Struct({
  format: Schema.Literal('foldkit-zloz-delta'),
  version: Schema.Literal(1),
  target: Target,
  previousSourceVersion: Counter,
  sourceVersion: Counter,
  payload: Schema.Union([Graph, Assessment, Reset, Noop]),
}).pipe(
  Schema.check(
    Schema.makeFilter(
      (value) =>
        exact(value, [
          'format',
          'version',
          'target',
          'previousSourceVersion',
          'sourceVersion',
          'payload',
        ]) && value.sourceVersion === value.previousSourceVersion + 1,
    ),
  ),
);
export type DiagramDelta = typeof Delta.Type;
export const DiagramDeltaSchema = Schema.declare(
  (value): value is DiagramDelta => {
    if (
      !Schema.is(Delta)(value) ||
      !exact(value, [
        'format',
        'version',
        'target',
        'previousSourceVersion',
        'sourceVersion',
        'payload',
      ]) ||
      !exact(value.target, ['teamId', 'diagramId'])
    )
      return false;
    const keys = {
      graph: ['kind', 'receipt', 'requestHash'],
      assessment: ['kind', 'record'],
      reset: ['kind', 'reason', 'document', 'undoResetVersion'],
      noop: ['kind'],
    };
    return (
      exact(value.payload, keys[value.payload.kind]) &&
      (value.payload.kind !== 'assessment' ||
        exact(value.payload.record, ['revision', 'authoredBy', 'operationId', 'assessment']))
    );
  },
  { toCodecJson: () => undefined },
);
export const DiagramFeedSchema = Schema.Struct({
  format: Schema.Literal('foldkit-zloz-feed'),
  version: Schema.Literal(1),
  target: Target,
  cursor: Counter,
  sourceVersion: Counter,
});
export type DiagramFeed = typeof DiagramFeedSchema.Type;
export type DeltaResult =
  | Readonly<{ _tag: 'Applied' | 'Covered'; frame: DiagramFrame }>
  | Readonly<{ _tag: 'Resync'; reason: string }>;
const resync = (reason: string): DeltaResult => ({ _tag: 'Resync', reason });

/** The confirmed frame is already validated and immutable. Only changed evidence is revalidated. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Public wire boundary fully validates input before replay.
export function applyDiagramDelta(frame: DiagramFrame | null, input: unknown): DeltaResult {
  if (!Schema.is(DiagramDeltaSchema)(input)) return resync('Invalid public delta');
  const delta = input;
  if (
    frame &&
    (delta.target.teamId !== frame.target.teamId ||
      delta.target.diagramId !== frame.target.diagramId)
  )
    return resync('Wrong target');
  const payload = delta.payload;
  if (
    payload.kind === 'graph' &&
    (payload.receipt.teamId !== delta.target.teamId ||
      payload.receipt.diagramId !== delta.target.diagramId)
  )
    return resync('Wrong receipt target');
  if (frame && delta.sourceVersion <= frame.sourceVersion) return { _tag: 'Covered', frame };
  if (delta.previousSourceVersion !== (frame?.sourceVersion ?? 0))
    return resync('Missing predecessor');
  if (payload.kind === 'reset') {
    if (payload.reason === 'initialized') {
      if (
        frame ||
        delta.previousSourceVersion !== 0 ||
        payload.document.version !== 0 ||
        payload.undoResetVersion !== 0
      )
        return resync('Invalid initialization');
      return {
        _tag: 'Applied',
        frame: {
          target: delta.target,
          sourceVersion: delta.sourceVersion,
          document: payload.document,
          undoResetVersion: 0,
          coverage: [],
          assessments: [],
        },
      };
    }
    if (
      !frame ||
      payload.document.version !== frame.document.version + 1 ||
      payload.undoResetVersion !== payload.document.version
    )
      return resync('Invalid recovery');
    return {
      _tag: 'Applied',
      frame: {
        ...frame,
        sourceVersion: delta.sourceVersion,
        document: payload.document,
        undoResetVersion: payload.undoResetVersion,
      },
    };
  }
  if (!frame) return resync('Missing initialization');
  if (payload.kind === 'noop')
    return { _tag: 'Applied', frame: { ...frame, sourceVersion: delta.sourceVersion } };
  if (payload.kind === 'assessment') {
    const records = frame.assessments ?? [];
    const record = payload.record;
    const current =
      records.find(
        (old) => old.assessment.target.relationshipId === record.assessment.target.relationshipId,
      )?.revision ?? 0;
    if (
      record.revision !== current + 1 ||
      evaluateCouplingAssessment(record.assessment, {
        documentId: delta.target.diagramId,
        graphVersion: frame.document.version,
        graph: frame.document.graph,
      }).status === 'rejected'
    )
      return resync('Invalid assessment revision or binding');
    const assessments = applyAssessment(records, record);
    if (!withinRecordBounds(assessments)) return resync('Assessment capacity exceeded');
    return {
      _tag: 'Applied',
      frame: { ...frame, sourceVersion: delta.sourceVersion, assessments },
    };
  }
  const receipt = payload.receipt;
  return Result.match(
    Result.try((): DeltaResult => {
      if (receipt.status === 'rejected' && receipt.documentVersion !== frame.document.version)
        return resync('Invalid refusal version');
      const document =
        receipt.status === 'accepted'
          ? { ...applyOperationChangeShared(frame.document, receipt.change), undo: [] }
          : frame.document;
      const coverage = [
        ...frame.coverage,
        {
          actorId: receipt.actorId,
          operationId: receipt.operationId,
          requestHash: payload.requestHash,
          documentVersion: receipt.documentVersion,
          status: receipt.status,
        },
      ].slice(-128);
      return {
        _tag: 'Applied',
        frame: { ...frame, sourceVersion: delta.sourceVersion, document, coverage },
      };
    }),
    { onSuccess: (result) => result, onFailure: () => resync('Invalid graph patch') },
  );
}
