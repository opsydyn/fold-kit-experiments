import { editFields, editIdentifier, editRecord } from './edit-data';
import { ZlozError } from './graph';
import {
  createGroupEditorV3,
  applyGroupEditorTransactionV3,
  type ZlozGroupEditorStateV3,
  type ZlozGroupEditorSourceV3,
  type ZlozGroupEditorOptionsV3,
  type ZlozGroupEditorResultV3,
  type ZlozGroupEditorPolicyV3,
} from './group-editor-v3';
import { compareHistoryGraphs, historyValueEqual } from './history';
import {
  captureEditionV3,
  captureModelDocumentV3,
  parseEditionsV3,
  serializeEditionsV3,
  type ZlozEditionV3,
  type ZlozModelDocumentV3,
} from './model-document-v3';
import { ownPortableData } from './portable-data';
export function createModelEditorV3(
  input: ZlozModelDocumentV3,
  options: ZlozGroupEditorOptionsV3,
): ZlozGroupEditorStateV3 {
  return createGroupEditorV3(captureModelDocumentV3(input).snapshot, options);
}
export type ZlozHistoryReviewV3 = Readonly<{
  edition: ZlozEditionV3;
  editor: ZlozGroupEditorStateV3 & Readonly<{ readOnly: true }>;
}>;
export function createHistoryReviewV3(
  input: ZlozEditionV3,
  sessionId: string,
): ZlozHistoryReviewV3 {
  const edition = captureEditionV3(input),
    editor = createGroupEditorV3(edition.snapshot, { sessionId, readOnly: true, historyLimit: 0 });
  return Object.freeze({ edition, editor: Object.freeze({ ...editor, readOnly: true }) });
}
/** Canonical publication input, not another runtime source of authored truth. */
export function captureWorkingModelV3(
  input: ZlozModelDocumentV3,
  editor: ZlozGroupEditorStateV3,
): ZlozModelDocumentV3 {
  const model = captureModelDocumentV3(input);
  return captureModelDocumentV3({ ...model, snapshot: editor.document });
}
export function compareEditionsV3(baseline: ZlozEditionV3, selected: ZlozEditionV3) {
  const before = captureEditionV3(baseline),
    after = captureEditionV3(selected),
    graph = compareHistoryGraphs(before.snapshot.graph, after.snapshot.graph);
  const modeChange = Object.freeze({
    before: before.snapshot.connectionMode,
    after: after.snapshot.connectionMode,
    changed: before.snapshot.connectionMode !== after.snapshot.connectionMode,
  });
  const capabilityChange = Object.freeze({
    before: before.snapshot.capabilities,
    after: after.snapshot.capabilities,
    changed: !historyValueEqual(before.snapshot.capabilities, after.snapshot.capabilities),
  });
  return Object.freeze({
    baseline: before,
    selected: after,
    nodes: Object.freeze(graph.nodes.map((c) => Object.freeze(c))),
    edges: Object.freeze(graph.edges.map((c) => Object.freeze(c))),
    modeChange,
    capabilityChange,
    semanticChanged:
      modeChange.changed ||
      capabilityChange.changed ||
      graph.nodes.some((c) => c.semanticChanged) ||
      graph.edges.some((c) => c.semanticChanged),
    layoutChanged:
      graph.nodes.some((c) => c.layoutChanged) || graph.edges.some((c) => c.layoutChanged),
  });
}
export type ZlozEditionMergeResultV3 =
  | Readonly<{ type: 'merged' | 'unchanged'; editions: readonly ZlozEditionV3[] }>
  | Readonly<{ type: 'blocked'; reason: string; existing: ZlozEditionV3; proposed: ZlozEditionV3 }>;
export function mergeEditionsV3(
  current: readonly ZlozEditionV3[],
  incoming: readonly ZlozEditionV3[],
): ZlozEditionMergeResultV3 {
  const source = parseEditionsV3(serializeEditionsV3(current)),
    next = parseEditionsV3(serializeEditionsV3(incoming)),
    byId = new Map(source.map((e) => [e.id, e]));
  for (const proposed of next) {
    const existing = byId.get(proposed.id);
    if (existing && !historyValueEqual(existing, proposed))
      return Object.freeze({
        type: 'blocked',
        reason: `Conflicting edition ID: ${proposed.id}`,
        existing,
        proposed,
      });
  }
  const added = next.filter((e) => !byId.has(e.id));
  return Object.freeze({
    type: added.length ? 'merged' : 'unchanged',
    editions: Object.freeze([...source, ...added]),
  });
}
export function forkModelDocumentV3(
  input: ZlozModelDocumentV3,
  editionId: string,
  identity: Readonly<{ id: string; name: string }>,
): ZlozModelDocumentV3 {
  const source = captureModelDocumentV3(input),
    edition = source.editions.find((e) => e.id === editionId);
  const named = ownPortableData(identity, undefined, 'Fork identity');
  if (
    !editRecord(named) ||
    !editFields(named, ['id', 'name']) ||
    !editIdentifier(named.id) ||
    !editIdentifier(named.name)
  )
    throw new ZlozError('invalid-edit', 'Provide an explicit fresh fork ID and name.');
  if (!edition || named.id === source.id)
    throw new ZlozError('invalid-edit', 'Choose an existing edition and a fresh model identity.');
  return captureModelDocumentV3({
    id: named.id,
    name: named.name,
    snapshot: edition.snapshot,
    editions: [],
    origin: { modelId: source.id, modelName: source.name, edition },
  });
}
export type ZlozEditionRestoreRequestV3 = Readonly<{
  source: ZlozGroupEditorSourceV3;
  modelId: string;
  edition: ZlozEditionV3;
}>;
/** Pin model identity and exact immutable catalogue entry, then use the live full-document transaction. */
export function restoreModelEditionV3(
  input: ZlozModelDocumentV3,
  editor: ZlozGroupEditorStateV3,
  request: ZlozEditionRestoreRequestV3,
  policy: ZlozGroupEditorPolicyV3 = {},
): ZlozGroupEditorResultV3 {
  const model = captureModelDocumentV3(input),
    edition = captureEditionV3(request.edition),
    current = model.editions.find((e) => e.id === edition.id);
  if (
    request.modelId !== model.id ||
    !current ||
    !historyValueEqual(current, edition) ||
    !historyValueEqual(model.snapshot, editor.document)
  )
    return {
      type: 'blocked',
      editor,
      code: 'stale-source',
      reason: 'The model binding, working snapshot or selected edition changed.',
    };
  return applyGroupEditorTransactionV3(
    editor,
    { source: request.source, document: current.snapshot },
    policy,
  );
}
