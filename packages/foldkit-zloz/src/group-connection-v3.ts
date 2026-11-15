import { editRecord, editIdentifier, editFields, editEndpoint, ownEditorEdit } from './edit-data';
import { isGraph, ZlozError } from './graph';
import { captureGroupDocumentV3 } from './group-document-v3';
import {
  applyGroupEditorTransactionV3,
  captureGroupEditorSourceV3,
  reviewGroupEditorTransactionV3,
  type ZlozGroupEditorStateV3,
  type ZlozGroupEditorSourceV3,
  type ZlozGroupEditorPolicyV3,
  type ZlozGroupEditorResultV3,
  type ZlozGroupEditorTransactionV3,
} from './group-editor-v3';
import type { Endpoint, EdgeEnd, ZlozEdge, JsonValue } from './types';
/** Explicit ordered endpoints. Creation may atomically add a fan-out/fan-in set. */
export type ZlozGroupConnectionEditV3 =
  | Readonly<{ operation: 'create'; edges: readonly ZlozEdge[] }>
  | Readonly<{ operation: 'reconnect'; edgeId: string; end: EdgeEnd; endpoint: Endpoint }>;
export type ZlozGroupConnectionRequestV3 = Readonly<{
  source: ZlozGroupEditorSourceV3;
  edit: ZlozGroupConnectionEditV3;
}>;
export type ZlozGroupConnectionResultV3 =
  | ZlozGroupEditorResultV3
  | Readonly<{
      type: 'blocked';
      editor: ZlozGroupEditorStateV3;
      code: 'invalid-edit' | 'not-found';
      reason: string;
    }>;
export type ZlozGroupConnectionPlanV3 =
  | Exclude<ZlozGroupConnectionResultV3, { type: 'applied' | 'unchanged' }>
  | Readonly<{ type: 'unchanged'; editor: ZlozGroupEditorStateV3 }>
  | Readonly<{
      type: 'ready';
      editor: ZlozGroupEditorStateV3;
      request: ZlozGroupConnectionRequestV3;
      transaction: ZlozGroupEditorTransactionV3;
      createdEdges: readonly ZlozEdge[];
      before: ZlozEdge | null;
      after: ZlozEdge | null;
    }>;
function validEdit(value: JsonValue): value is JsonValue & ZlozGroupConnectionEditV3 {
  if (!editRecord(value)) return false;
  if (value.operation === 'reconnect')
    return (
      editFields(value, ['operation', 'edgeId', 'end', 'endpoint']) &&
      editIdentifier(value.edgeId) &&
      (value.end === 'source' || value.end === 'target') &&
      editEndpoint(value.endpoint)
    );
  return (
    value.operation === 'create' &&
    editFields(value, ['operation', 'edges']) &&
    Array.isArray(value.edges) &&
    value.edges.length > 0 &&
    isGraph({ nodes: [], edges: value.edges }) &&
    value.edges.every(
      (edge) =>
        editRecord(edge) &&
        editFields(
          edge,
          ['id', 'source', 'target'],
          ['label', 'data', 'architecture', 'waypoints', 'pathStyle'],
        ) &&
        editEndpoint(edge.source) &&
        editEndpoint(edge.target),
    )
  );
}
const blocked = (
  editor: ZlozGroupEditorStateV3,
  code: 'invalid-edit' | 'not-found',
  reason: string,
): Extract<ZlozGroupConnectionResultV3, { type: 'blocked' }> => ({
  type: 'blocked',
  editor,
  code,
  reason,
});
function build(
  editor: ZlozGroupEditorStateV3,
  request: ZlozGroupConnectionRequestV3,
): Extract<ZlozGroupConnectionPlanV3, { type: 'ready' | 'blocked' }> {
  const fresh = reviewGroupEditorTransactionV3(editor, {
    source: request.source,
    document: editor.document,
  });
  if (fresh.type === 'blocked') return fresh;
  // oxlint-disable-next-line linteffect/no-try-catch -- Peer-free edit boundary converts known ownership/validation failures; policies run outside this catch.
  try {
    const edit = ownEditorEdit(request.edit, validEdit, 'v3 connection edit'),
      source = captureGroupEditorSourceV3(editor),
      document = source.document;
    const known = new Set(document.graph.edges.map((edge) => edge.id));
    if (edit.operation === 'create' && edit.edges.some((edge) => known.has(edge.id)))
      return blocked(editor, 'invalid-edit', 'A connection with this ID already exists.');
    const before =
      edit.operation === 'reconnect'
        ? (document.graph.edges.find((edge) => edge.id === edit.edgeId) ?? null)
        : null;
    if (edit.operation === 'reconnect' && before === null)
      return blocked(editor, 'not-found', 'The connection no longer exists.');
    const edges =
      edit.operation === 'create'
        ? [...document.graph.edges, ...edit.edges]
        : document.graph.edges.map((edge) =>
            edge.id === edit.edgeId ? { ...edge, [edit.end]: edit.endpoint } : edge,
          );
    const target = captureGroupDocumentV3({ ...document, graph: { ...document.graph, edges } });
    const createdEdges = Object.freeze(
      edit.operation === 'create' ? target.graph.edges.filter((edge) => !known.has(edge.id)) : [],
    );
    return Object.freeze({
      type: 'ready',
      editor,
      request: Object.freeze({ source, edit }),
      transaction: Object.freeze({ source, document: target }),
      createdEdges,
      before,
      after:
        edit.operation === 'reconnect'
          ? (target.graph.edges.find((edge) => edge.id === edit.edgeId) ?? null)
          : null,
    });
  } catch (error) {
    if (error instanceof ZlozError) return blocked(editor, 'invalid-edit', error.message);
    throw error;
  }
}
/** Nonpublishing preview; a protected member blocks an entire explicit connection set. */
export function planGroupConnectionV3(
  editor: ZlozGroupEditorStateV3,
  request: ZlozGroupConnectionRequestV3,
  policy: ZlozGroupEditorPolicyV3 = {},
): ZlozGroupConnectionPlanV3 {
  const plan = build(editor, request);
  if (plan.type === 'blocked') return plan;
  const review = reviewGroupEditorTransactionV3(editor, plan.transaction, policy);
  return review.type === 'ready' ? plan : review;
}
/** Rebuild against the live source/policies, then publish all connections in one Undo unit. */
export function applyGroupConnectionV3(
  editor: ZlozGroupEditorStateV3,
  request: ZlozGroupConnectionRequestV3,
  policy: ZlozGroupEditorPolicyV3 = {},
): ZlozGroupConnectionResultV3 {
  const plan = build(editor, request);
  return plan.type === 'blocked'
    ? plan
    : applyGroupEditorTransactionV3(editor, plan.transaction, policy);
}
