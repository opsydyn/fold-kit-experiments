import { isPort, withPortPosition, ZlozError } from './graph';
import { captureGroupDocumentV3 } from './group-document-v3';
import {
  applyGroupEditorTransactionV3,
  captureGroupEditorSourceV3,
  reviewGroupEditorTransactionV3,
  type ZlozGroupEditorPolicyV3,
  type ZlozGroupEditorResultV3,
  type ZlozGroupEditorSourceV3,
  type ZlozGroupEditorStateV3,
  type ZlozGroupEditorTransactionV3,
} from './group-editor-v3';
import { ownPortableData } from './portable-data';
import type { Endpoint, JsonObject, JsonValue, Port, PortPosition, ZlozEdge } from './types';

/** One authored group-port edit. Label null removes the optional label; add appends. */
export type ZlozGroupPortEditV3 =
  | Readonly<{ operation: 'add'; nodeId: string; port: Port }>
  | Readonly<{ operation: 'label'; endpoint: Endpoint; label: string | null }>
  | Readonly<{ operation: 'position'; endpoint: Endpoint; position: PortPosition }>
  | Readonly<{ operation: 'remove'; endpoint: Endpoint }>;
export type ZlozGroupPortEditRequestV3 = Readonly<{
  source: ZlozGroupEditorSourceV3;
  edit: ZlozGroupPortEditV3;
}>;
export type ZlozGroupPortEditResultV3 =
  | ZlozGroupEditorResultV3
  | Readonly<{
      type: 'blocked';
      editor: ZlozGroupEditorStateV3;
      code: 'invalid-edit' | 'not-found' | 'ineligible-group' | 'capability-disabled';
      reason: string;
    }>;
/** Read-only review. Apply always rebuilds from request; a cached target is never authority. */
export type ZlozGroupPortEditPlanV3 =
  | Exclude<ZlozGroupPortEditResultV3, { type: 'applied' | 'unchanged' }>
  | Readonly<{ type: 'unchanged'; editor: ZlozGroupEditorStateV3 }>
  | Readonly<{
      type: 'ready';
      editor: ZlozGroupEditorStateV3;
      request: ZlozGroupPortEditRequestV3;
      transaction: ZlozGroupEditorTransactionV3;
      before: Port | null;
      after: Port | null;
      removedEdges: readonly ZlozEdge[];
    }>;
const record = (value: JsonValue): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
function fields(
  value: JsonObject,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => required.includes(key) || optional.includes(key))
  );
}
const identifier = (value: JsonValue | undefined): value is string =>
  typeof value === 'string' && value.length > 0;
function endpoint(value: JsonValue | undefined): value is Endpoint {
  return (
    value !== undefined &&
    record(value) &&
    fields(value, ['node', 'port']) &&
    identifier(value.node) &&
    identifier(value.port)
  );
}
function anchorFields(value: JsonObject): boolean {
  const anchor = value.anchor;
  return (
    !Object.hasOwn(value, 'anchor') ||
    (anchor !== undefined && record(anchor) && fields(anchor, ['x', 'y']))
  );
}
function editValue(value: JsonValue): value is JsonValue & ZlozGroupPortEditV3 {
  if (!record(value)) return false;
  switch (value.operation) {
    case 'add':
      return (
        fields(value, ['operation', 'nodeId', 'port']) &&
        identifier(value.nodeId) &&
        value.port !== undefined &&
        record(value.port) &&
        fields(value.port, ['id', 'kind', 'side'], ['offset', 'anchor', 'label']) &&
        anchorFields(value.port) &&
        isPort(value.port)
      );
    case 'label':
      return (
        fields(value, ['operation', 'endpoint', 'label']) &&
        endpoint(value.endpoint) &&
        (value.label === null || typeof value.label === 'string')
      );
    case 'position':
      return (
        fields(value, ['operation', 'endpoint', 'position']) &&
        endpoint(value.endpoint) &&
        value.position !== undefined &&
        record(value.position) &&
        fields(value.position, ['side'], ['offset', 'anchor']) &&
        anchorFields(value.position) &&
        isPort({ ...value.position, id: 'position-validation', kind: 'input' })
      );
    case 'remove':
      return fields(value, ['operation', 'endpoint']) && endpoint(value.endpoint);
    default:
      return false;
  }
}
/** Own data before narrowing optional offset/anchor contracts; never publish raw JSON values. */
function captureEdit(input: ZlozGroupPortEditV3): ZlozGroupPortEditV3 {
  const edit = ownPortableData(input, undefined, 'Group port edit');
  if (!editValue(edit))
    throw new ZlozError(
      'invalid-edit',
      'Expected an exact add, label, position or remove group-port edit.',
    );
  return edit;
}
function blocked(
  editor: ZlozGroupEditorStateV3,
  code: Extract<ZlozGroupPortEditResultV3, { type: 'blocked' }>['code'],
  reason: string,
): Extract<ZlozGroupPortEditResultV3, { type: 'blocked' }> {
  return { type: 'blocked', editor, code, reason };
}
function withLabel(port: Port, label: string | null): Port {
  const { label: _label, ...unlabelled } = port;
  return label === null ? unlabelled : { ...port, label };
}
/** Build intent only, without invoking policies or allocating a prospective session/history. */
function build(
  editor: ZlozGroupEditorStateV3,
  request: ZlozGroupPortEditRequestV3,
): Extract<ZlozGroupPortEditPlanV3, { type: 'ready' | 'blocked' }> {
  const fresh = reviewGroupEditorTransactionV3(editor, {
    source: request.source,
    document: editor.document,
  });
  if (fresh.type === 'blocked') return fresh;
  // oxlint-disable-next-line linteffect/no-try-catch -- Peer-free edit boundary converts known data/geometry errors only; policy callbacks run outside this catch.
  try {
    const edit = captureEdit(request.edit);
    const source = captureGroupEditorSourceV3(editor);
    const document = source.document;
    const nodeId = edit.operation === 'add' ? edit.nodeId : edit.endpoint.node;
    const node = document.graph.nodes.find((n) => n.id === nodeId);
    if (!node) return blocked(editor, 'not-found', 'The group no longer exists.');
    if (
      node.architecture?.family === 'event-storming' &&
      (node.architecture.role === 'lane' || node.architecture.role === 'hotspot')
    )
      return blocked(
        editor,
        'ineligible-group',
        'EventStorming lanes and hotspots remain portless.',
      );
    if (node.kind !== 'group')
      return blocked(
        editor,
        'ineligible-group',
        'Choose a group; ordinary-node port editing uses its existing API.',
      );
    if (!document.capabilities.groupPorts)
      return blocked(
        editor,
        'capability-disabled',
        'Enable group ports explicitly in the v3 document before editing them.',
      );
    const port =
      edit.operation === 'add'
        ? null
        : (node.ports.find((p) => p.id === edit.endpoint.port) ?? null);
    if (edit.operation !== 'add' && port === null)
      return blocked(editor, 'not-found', 'The group port no longer exists.');
    if (edit.operation === 'add' && node.ports.some((p) => p.id === edit.port.id))
      return blocked(editor, 'invalid-edit', 'The group already has a port with this ID.');
    let ports = node.ports;
    switch (edit.operation) {
      case 'add':
        ports = [...ports, edit.port];
        break;
      case 'label':
        ports = ports.map((p) => (p.id === edit.endpoint.port ? withLabel(p, edit.label) : p));
        break;
      case 'position':
        ports = ports.map((p) =>
          p.id === edit.endpoint.port ? withPortPosition(p, edit.position) : p,
        );
        break;
      case 'remove':
        ports = ports.filter((p) => p.id !== edit.endpoint.port);
        break;
    }
    const removedEdges = Object.freeze(
      edit.operation === 'remove'
        ? document.graph.edges.filter(
            (edge) =>
              (edge.source.node === nodeId && edge.source.port === edit.endpoint.port) ||
              (edge.target.node === nodeId && edge.target.port === edit.endpoint.port),
          )
        : [],
    );
    const removedIds = new Set(removedEdges.map((edge) => edge.id));
    const target = captureGroupDocumentV3({
      ...document,
      graph: {
        nodes: document.graph.nodes.map((n) => (n.id === nodeId ? { ...n, ports } : n)),
        edges: document.graph.edges.filter((edge) => !removedIds.has(edge.id)),
      },
    });
    const portId = edit.operation === 'add' ? edit.port.id : edit.endpoint.port;
    return Object.freeze({
      type: 'ready',
      editor,
      request: Object.freeze({ source, edit }),
      transaction: Object.freeze({ source, document: target }),
      before: port,
      after:
        target.graph.nodes.find((n) => n.id === nodeId)?.ports.find((p) => p.id === portId) ?? null,
      removedEdges,
    });
  } catch (error) {
    if (error instanceof ZlozError) return blocked(editor, 'invalid-edit', error.message);
    throw error;
  }
}
/** Preview complete group-port effects and current protection reasons without changing editor/history. */
export function planGroupPortEditV3(
  editor: ZlozGroupEditorStateV3,
  request: ZlozGroupPortEditRequestV3,
  policy: ZlozGroupEditorPolicyV3 = {},
): ZlozGroupPortEditPlanV3 {
  const plan = build(editor, request);
  if (plan.type === 'blocked') return plan;
  const review = reviewGroupEditorTransactionV3(editor, plan.transaction, policy);
  return review.type === 'ready' ? plan : review;
}
/** Rebuild from exact live intent and publish through the v3 kernel: one edit plus attached edges, one Undo. */
export function applyGroupPortEditV3(
  editor: ZlozGroupEditorStateV3,
  request: ZlozGroupPortEditRequestV3,
  policy: ZlozGroupEditorPolicyV3 = {},
): ZlozGroupPortEditResultV3 {
  const plan = build(editor, request);
  return plan.type === 'blocked'
    ? plan
    : applyGroupEditorTransactionV3(editor, plan.transaction, policy);
}
