import {
  editFields,
  editRecord,
  editIdentifier,
  editNumber,
  editPoint,
  editSize,
  ownEditorEdit,
} from './edit-data';
import { portPosition } from './geometry';
import { ZlozError } from './graph';
import { captureGroupDocumentV3 } from './group-document-v3';
import {
  applyGroupEditorTransactionV3,
  captureGroupEditorSourceV3,
  type ZlozGroupEditorStateV3,
  type ZlozGroupEditorSourceV3,
  type ZlozGroupEditorPolicyV3,
  type ZlozGroupEditorResultV3,
} from './group-editor-v3';
import { assertGroupGeometryConstraintsV3 } from './group-operations-v3';
import { resolveLayoutGeometry, validateLayoutHints } from './layout';
import { ownPortableData, PortableDataError } from './portable-data';
import type { LayoutRequestOptions, LayoutResult, EdgeRoute, JsonValue } from './types';

/** Complete capability-aware request. The host stores its active request before executing an engine. */
export type ZlozGroupLayoutRequestV3 = Readonly<{
  version: 3;
  requestId: string;
  source: ZlozGroupEditorSourceV3;
  options: LayoutRequestOptions;
}>;
export type ZlozGroupLayoutResultV3 = LayoutResult & Readonly<{ version: 3 }>;
export type ZlozGroupLayoutEngineV3 = (
  request: ZlozGroupLayoutRequestV3,
) => Promise<ZlozGroupLayoutResultV3>;
export type ZlozGroupLayoutApplyV3 = ZlozGroupEditorResultV3 &
  Readonly<{
    /** Transient, accepted geometry only; never persisted in authored edges or document history. */
    routes?: readonly EdgeRoute[];
  }>;
/** Native request validation. Never treats a bare graph as a legacy document. */
export function validateGroupLayoutRequestV3(request: ZlozGroupLayoutRequestV3): void {
  if (
    request.version !== 3 ||
    !request.requestId.trim() ||
    request.requestId.length > 1024 ||
    !request.source.sessionId.trim() ||
    !Number.isSafeInteger(request.source.revision) ||
    request.source.revision < 0
  )
    throw new ZlozError(
      'invalid-layout',
      'Expected a native v3 layout request and valid source identity.',
    );
  const document = captureGroupDocumentV3(request.source.document);
  validateLayoutHints(document.graph, request.options);
}
export function groupLayoutRequestV3(
  editor: ZlozGroupEditorStateV3,
  requestId: string,
  options: LayoutRequestOptions = {},
): ZlozGroupLayoutRequestV3 {
  // Ownership rejects getters/nonfinite values before publishing the request to the host Model.
  const owned = ownPortableData(options, undefined, 'Layout hints');
  // SAFETY: Hints are owned data and validated below; this is not an external document decoder.
  const request = Object.freeze({
    version: 3 as const,
    requestId,
    source: captureGroupEditorSourceV3(editor),
    options: owned as LayoutRequestOptions,
  });
  validateGroupLayoutRequestV3(request);
  return request;
}
function layoutResult(value: JsonValue): value is JsonValue & ZlozGroupLayoutResultV3 {
  return (
    editRecord(value) &&
    editFields(value, ['version', 'requestId', 'revision', 'positions', 'routes']) &&
    value.version === 3 &&
    editIdentifier(value.requestId) &&
    editNumber(value.revision) &&
    Number.isSafeInteger(value.revision) &&
    value.revision >= 0 &&
    Array.isArray(value.positions) &&
    value.positions.every(
      (p) =>
        editRecord(p) &&
        editFields(p, ['id', 'x', 'y'], ['size']) &&
        editIdentifier(p.id) &&
        editNumber(p.x) &&
        editNumber(p.y) &&
        (!Object.hasOwn(p, 'size') || editSize(p.size)),
    ) &&
    Array.isArray(value.routes) &&
    value.routes.every(
      (r) =>
        editRecord(r) &&
        editFields(r, ['id', 'points'], ['label']) &&
        editIdentifier(r.id) &&
        Array.isArray(r.points) &&
        r.points.length >= 2 &&
        r.points.every(editPoint) &&
        (!Object.hasOwn(r, 'label') ||
          (editRecord(r.label) &&
            editFields(r.label, ['position', 'size']) &&
            editPoint(r.label.position) &&
            editSize(r.label.size))),
    )
  );
}
/** Pass the currently active request, never a request captured by an asynchronous completion closure. */
export function applyGroupLayoutV3(
  editor: ZlozGroupEditorStateV3,
  active: ZlozGroupLayoutRequestV3,
  input: ZlozGroupLayoutResultV3,
  policy: ZlozGroupEditorPolicyV3 = {},
): ZlozGroupLayoutApplyV3 {
  const invalid = (reason: string): ZlozGroupLayoutApplyV3 => ({
    type: 'blocked',
    code: 'invalid-document',
    reason,
    editor,
  });
  // Validate engine data before access. Policy exceptions deliberately remain outside this catch.
  let target, routes;
  // oxlint-disable-next-line linteffect/no-try-catch -- Translate known bounded engine geometry failures; live policy failures are not swallowed.
  try {
    validateGroupLayoutRequestV3(active);
    const result = ownEditorEdit(input, layoutResult, 'native v3 layout result');
    if (
      result.version !== 3 ||
      result.requestId !== active.requestId ||
      result.revision !== active.source.revision
    )
      return {
        type: 'blocked',
        code: 'stale-source',
        reason: 'The active v3 layout request has changed.',
        editor,
      };
    const document = captureGroupDocumentV3(active.source.document);
    const geometry = resolveLayoutGeometry(document.graph, active.options, result);
    if (geometry.routes.length !== document.graph.edges.length)
      return invalid('Native layout must return every edge route exactly once.');
    for (const edge of document.graph.edges) {
      const route = geometry.routes.find((r) => r.id === edge.id);
      const source = geometry.graph.nodes.find((n) => n.id === edge.source.node),
        target = geometry.graph.nodes.find((n) => n.id === edge.target.node);
      if (!route || !source || !target) return invalid('Missing native layout endpoint.');
      const start = portPosition(source, edge.source.port),
        end = portPosition(target, edge.target.port),
        first = route.points[0]!,
        last = route.points.at(-1)!;
      if (
        Math.abs(first.x - start.x) > 1e-6 ||
        Math.abs(first.y - start.y) > 1e-6 ||
        Math.abs(last.x - end.x) > 1e-6 ||
        Math.abs(last.y - end.y) > 1e-6
      )
        return invalid('Native layout routes must join the preserved authored port anchors.');
    }
    const nodes = new Map(geometry.graph.nodes.map((node) => [node.id, node]));
    for (const node of geometry.graph.nodes) {
      if (node.parentId === undefined) continue;
      const parent = nodes.get(node.parentId);
      if (
        !parent ||
        node.position.x < parent.position.x - 1e-6 ||
        node.position.y < parent.position.y - 1e-6 ||
        node.position.x + node.size.width > parent.position.x + parent.size.width + 1e-6 ||
        node.position.y + node.size.height > parent.position.y + parent.size.height + 1e-6
      )
        return invalid(`Layout placed ${node.id} outside its group bounds.`);
    }
    assertGroupGeometryConstraintsV3(document.graph, geometry.graph);
    target = captureGroupDocumentV3({ ...document, graph: geometry.graph });
    routes = geometry.routes;
  } catch (error) {
    if (error instanceof ZlozError || error instanceof PortableDataError)
      return invalid(error.message);
    throw error;
  }
  const applied = applyGroupEditorTransactionV3(
    editor,
    { source: active.source, document: target },
    policy,
  );
  return applied.type === 'blocked' ? applied : { ...applied, routes };
}
