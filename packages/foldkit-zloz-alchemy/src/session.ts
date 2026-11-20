import {
  canonicalOperationValue,
  isOperationDocument,
  isOperationReceipt,
  isOperationRequest,
} from '@opsydyn/foldkit-zloz';
import type {
  ZlozOperationDocument,
  ZlozOperationReceipt,
  ZlozOperationRequest,
} from '@opsydyn/foldkit-zloz';
import { Data, Schema } from 'effect';

import { AssessmentRecordsJsonSchema, type AssessmentRecord } from './assessment';
import { structWithExtensions } from './json-struct';
import { RelationshipDecisionsSchema, type RelationshipDecision } from './relationship-decision';

export type DiagramTarget = Readonly<{ teamId: string; diagramId: string }>;
export type DiagramRoom = DiagramTarget & Readonly<{ actorId: string; generation: string }>;
export type DiagramCoverage = Readonly<{
  actorId: string;
  operationId: string;
  requestHash: string;
  documentVersion: number;
  status: 'accepted' | 'rejected';
}>;
/** The inverse journal is always empty on this public read boundary. */
export type DiagramFrame = Readonly<{
  target: DiagramTarget;
  sourceVersion: number;
  /** Last successful recovery's document version; omitted by legacy producers. */
  undoResetVersion?: number;
  document: ZlozOperationDocument;
  coverage: readonly DiagramCoverage[];
  assessments?: readonly AssessmentRecord[];
  relationshipDecisions?: readonly RelationshipDecision[];
  relationshipDecisionRecoveryVersion?: number;
}>;
export type DiagramReply = Readonly<{
  receipt: ZlozOperationReceipt;
  sourceVersion: number;
  requestHash: string;
}>;
type AcceptedDiagramReply = Omit<DiagramReply, 'receipt'> &
  Readonly<{ receipt: Extract<ZlozOperationReceipt, { status: 'accepted' }> }>;
export type DiagramPending =
  | Readonly<{ status: 'preparing'; request: ZlozOperationRequest; requestHash: null }>
  | Readonly<{
      status: 'sending' | 'uncertain';
      request: ZlozOperationRequest;
      requestHash: string;
    }>
  | Readonly<{
      status: 'awaiting-frame';
      request: ZlozOperationRequest;
      requestHash: string;
      accepted: AcceptedDiagramReply;
    }>;
export type DiagramSession = Readonly<{
  room: DiagramRoom;
  confirmed: DiagramFrame | null;
  pending: DiagramPending | null;
  notice: string;
}>;
const Version = Schema.Number.pipe(
  Schema.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
  ),
);
const Coverage = structWithExtensions({
  actorId: Schema.String,
  operationId: Schema.String,
  requestHash: Schema.String,
  documentVersion: Version,
  status: Schema.Literals(['accepted', 'rejected']),
});
const PublicDocument = Schema.Unknown.pipe(
  Schema.refine(isOperationDocument),
  Schema.check(Schema.makeFilter((document) => document.undo.length === 0)),
);
const Frame = structWithExtensions({
  target: structWithExtensions({ teamId: Schema.String, diagramId: Schema.String }),
  sourceVersion: Version,
  undoResetVersion: Schema.optionalKey(Version),
  document: PublicDocument,
  assessments: Schema.optionalKey(AssessmentRecordsJsonSchema),
  relationshipDecisions: Schema.optionalKey(RelationshipDecisionsSchema),
  relationshipDecisionRecoveryVersion: Schema.optionalKey(Version),
  coverage: Schema.Array(Coverage).pipe(Schema.check(Schema.isMaxLength(128))),
}).pipe(
  Schema.check(
    Schema.makeFilter(
      (frame) =>
        (frame.undoResetVersion ?? 0) <= frame.document.version &&
        (frame.relationshipDecisionRecoveryVersion ?? 0) <= frame.document.version,
    ),
  ),
);
const Reply = Schema.Struct({
  receipt: Schema.Unknown.pipe(Schema.refine(isOperationReceipt)),
  sourceVersion: Version,
  requestHash: Schema.String,
});
const AcceptedReply = Reply.pipe(
  Schema.refine((value): value is AcceptedDiagramReply => value.receipt.status === 'accepted'),
);
export const DiagramRoomSchema = Schema.Struct({
  teamId: Schema.String,
  diagramId: Schema.String,
  actorId: Schema.String,
  generation: Schema.String,
});
export const DiagramRequestSchema = Schema.Unknown.pipe(Schema.refine(isOperationRequest));
export const DiagramSessionSchema = Schema.Struct({
  room: DiagramRoomSchema,
  confirmed: Schema.NullOr(Frame),
  notice: Schema.String,
  pending: Schema.NullOr(
    Schema.Union([
      Schema.Struct({
        status: Schema.Literal('preparing'),
        request: DiagramRequestSchema,
        requestHash: Schema.Null,
      }),
      Schema.Struct({
        status: Schema.Literals(['sending', 'uncertain']),
        request: DiagramRequestSchema,
        requestHash: Schema.String,
      }),
      Schema.Struct({
        status: Schema.Literal('awaiting-frame'),
        request: DiagramRequestSchema,
        requestHash: Schema.String,
        accepted: AcceptedReply,
      }),
    ]),
  ),
});
export const DiagramDocumentSchema = PublicDocument;
export function isDiagramFrame(value: unknown): value is DiagramFrame {
  return Schema.is(Frame)(value);
}
/** Full guarded frame shape; JSON conversion also validates and preserves extension properties. */
export const DiagramFrameSchema = Frame;
export function isDiagramReply(value: unknown): value is DiagramReply {
  return Schema.is(Reply)(value);
}
class EditorNotReady extends Data.TaggedError('EditorNotReady') {}
export const sameTarget = (a: DiagramTarget, b: DiagramTarget) =>
  a.teamId === b.teamId && a.diagramId === b.diagramId;
const sameRoom = (a: DiagramRoom, b: DiagramRoom) =>
  sameTarget(a, b) && a.actorId === b.actorId && a.generation === b.generation;
export const newSession = (room: DiagramRoom): DiagramSession => ({
  room,
  confirmed: null,
  pending: null,
  notice: '',
});
export function prepareEdit(state: DiagramSession, request: ZlozOperationRequest): DiagramSession {
  if (state.pending || !state.confirmed) throw new EditorNotReady();
  return { ...state, pending: { status: 'preparing', request, requestHash: null }, notice: '' };
}
export function beginEdit(
  state: DiagramSession,
  request: ZlozOperationRequest,
  requestHash: string,
): DiagramSession {
  if (
    (state.pending &&
      (state.pending.status !== 'preparing' ||
        canonicalOperationValue(state.pending.request) !== canonicalOperationValue(request))) ||
    !state.confirmed ||
    !/^[a-f0-9]{64}$/.test(requestHash)
  )
    throw new EditorNotReady();
  return {
    ...state,
    pending: { request, requestHash, status: 'sending' },
    notice: '',
  };
}
export function receiveFrame(
  state: DiagramSession,
  room: DiagramRoom,
  frame: DiagramFrame,
): DiagramSession {
  if (!sameRoom(state.room, room) || !sameTarget(state.room, frame.target)) return state;
  const old = state.confirmed;
  if (
    old &&
    (frame.document.version < old.document.version || frame.sourceVersion < old.sourceVersion)
  )
    return state;
  let pending = state.pending;
  let notice = state.notice;
  if (pending) {
    const coverage = frame.coverage.find(
      (entry) =>
        entry.actorId === room.actorId &&
        entry.operationId === pending?.request.operationId &&
        entry.requestHash === pending.requestHash,
    );
    const accepted = pending.status === 'awaiting-frame' ? pending.accepted : null;
    if (coverage && frame.document.version >= coverage.documentVersion) {
      if (coverage.status === 'rejected')
        notice = 'Edit conflicted or was refused. Review the current diagram.';
      pending = null;
    } else if (
      accepted &&
      frame.document.version >= accepted.receipt.documentVersion &&
      frame.sourceVersion >= accepted.sourceVersion
    )
      pending = null;
  }
  // A newer legacy frame may omit the marker; retain knowledge already observed
  // so a late pre-recovery acknowledgement cannot resurrect local Undo history.
  const undoResetVersion = Math.max(old?.undoResetVersion ?? 0, frame.undoResetVersion ?? 0);
  const confirmed =
    undoResetVersion > (frame.undoResetVersion ?? 0) ? { ...frame, undoResetVersion } : frame;
  return { ...state, confirmed, pending, notice };
}
export function receiveReply(
  state: DiagramSession,
  room: DiagramRoom,
  reply: DiagramReply,
): DiagramSession {
  const pending = state.pending;
  const receipt = reply.receipt;
  if (
    !sameRoom(state.room, room) ||
    !pending ||
    pending.status === 'preparing' ||
    !sameTarget(state.room, receipt) ||
    receipt.actorId !== room.actorId ||
    receipt.operationId !== pending.request.operationId ||
    reply.requestHash !== pending.requestHash
  )
    return state;
  if (receipt.status === 'rejected')
    return {
      ...state,
      pending: null,
      notice: `Edit refused: ${receipt.code}. Review the current diagram.`,
    };
  const next = {
    ...state,
    pending: { ...pending, status: 'awaiting-frame' as const, accepted: { ...reply, receipt } },
  };
  return state.confirmed ? receiveFrame(next, room, state.confirmed) : next;
}
export function unknownEdit(
  state: DiagramSession,
  room: DiagramRoom,
  operationId: string,
): DiagramSession {
  if (
    !sameRoom(state.room, room) ||
    state.pending?.request.operationId !== operationId ||
    state.pending.status === 'preparing' ||
    state.pending.status === 'awaiting-frame'
  )
    return state;
  return {
    ...state,
    pending: { ...state.pending, status: 'uncertain' },
    notice: 'Save outcome unknown. Retry this edit to recover its original result.',
  };
}
