/* oxlint-disable anti-slop/no-runtime-typeof -- Validate bounded, owned session metadata at the explicit v3 constructor/source boundary. */
import { ZlozError } from './graph';
import { graphChanges, graphChangePolicyReason } from './graph-change-policy';
import { captureGroupDocumentV3, type ZlozGroupDocumentV3 } from './group-document-v3';
import { historyValueEqual } from './history';
import { ownPortableData } from './portable-data';
import type { EditorPolicy, JsonObject, JsonValue } from './types';

/** Trusted immutable runtime state, not a portable session format or a legacy EditorState. */
export type ZlozGroupEditorStateV3 = Readonly<{
  format: 'foldkit-zloz-group-editor';
  version: 3;
  sessionId: string;
  revision: number;
  document: ZlozGroupDocumentV3;
  history: Readonly<{
    past: readonly ZlozGroupDocumentV3[];
    future: readonly ZlozGroupDocumentV3[];
  }>;
  historyLimit: number;
  readOnly: boolean;
  /** Host-owned live lifecycle. It is never captured/restored by document history. */
  activity: Readonly<{ type: 'idle' }> | Readonly<{ type: 'busy'; reason: string }>;
}>;
export type ZlozGroupEditorOptionsV3 = Readonly<{
  /** Allocate a different incarnation when replacing/reopening a session. */
  sessionId: string;
  historyLimit?: number;
  readOnly?: boolean;
}>;
export type ZlozGroupEditorSourceV3 = Readonly<{
  sessionId: string;
  revision: number;
  document: ZlozGroupDocumentV3;
}>;
export type ZlozGroupEditorTransactionV3 = Readonly<{
  source: ZlozGroupEditorSourceV3;
  /** Complete authored target; implied group movement/expansion is not inferred. */
  document: ZlozGroupDocumentV3;
}>;
export type ZlozGroupEditorEventV3 = Readonly<{
  type: 'UndoPressed' | 'RedoPressed';
  source: ZlozGroupEditorSourceV3;
}>;
export type ZlozGroupEditorCommitV3 = Readonly<{
  operation: 'apply' | 'undo' | 'redo';
  sessionId: string;
  revision: number;
  source: ZlozGroupDocumentV3;
  target: ZlozGroupDocumentV3;
}>;
export type ZlozGroupEditorPolicyV3 = EditorPolicy &
  Readonly<{
    /** Complete live operation veto, including mode/capability/camera/data changes. */
    canCommitGroupDocumentV3?: (candidate: ZlozGroupEditorCommitV3) => string | null | undefined;
  }>;
export type ZlozGroupEditorResultV3 = Readonly<{ editor: ZlozGroupEditorStateV3 }> &
  (
    | Readonly<{ type: 'applied' | 'unchanged' }>
    | Readonly<{
        type: 'blocked';
        code:
          | 'stale-source'
          | 'invalid-document'
          | 'protected'
          | 'busy'
          | 'read-only'
          | 'history-disabled'
          | 'revision-exhausted'
          | 'version-required';
        reason: string;
      }>
  );
export type ZlozGroupEditorBoundaryV3 =
  | 'native-controls'
  | 'clipboard'
  | 'model'
  | 'editions'
  | 'layout'
  | 'svg'
  | 'png'
  | 'mermaid'
  | 'modelling-patch'
  | 'review-packet';

const isRecord = (value: JsonValue): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const history = (past: readonly ZlozGroupDocumentV3[], future: readonly ZlozGroupDocumentV3[]) =>
  Object.freeze({ past: Object.freeze([...past]), future: Object.freeze([...future]) });
const blocked = (
  editor: ZlozGroupEditorStateV3,
  code: Extract<ZlozGroupEditorResultV3, { type: 'blocked' }>['code'],
  reason: string,
): Extract<ZlozGroupEditorResultV3, { type: 'blocked' }> => ({
  type: 'blocked',
  editor,
  code,
  reason,
});
const denial = (reason: string | null | undefined) =>
  reason == null ? null : reason.trim() || 'The document change is protected.';
function assertSession(editor: ZlozGroupEditorStateV3): void {
  if (
    editor.format !== 'foldkit-zloz-group-editor' ||
    editor.version !== 3 ||
    typeof editor.sessionId !== 'string' ||
    !editor.sessionId.trim() ||
    editor.sessionId.length > 1024 ||
    !Number.isSafeInteger(editor.revision) ||
    editor.revision < 0 ||
    !Number.isSafeInteger(editor.historyLimit) ||
    editor.historyLimit < 0 ||
    editor.historyLimit > 1000 ||
    !Array.isArray(editor.history?.past) ||
    !Array.isArray(editor.history.future) ||
    editor.history.past.length > 1000 ||
    editor.history.future.length > 1000 ||
    typeof editor.readOnly !== 'boolean' ||
    (editor.activity?.type !== 'idle' &&
      (editor.activity?.type !== 'busy' || !editor.activity.reason?.trim()))
  )
    throw new ZlozError('invalid-edit', 'Expected a valid explicit v3 group editor session.');
}
/** Own and validate a complete v3 document. Never upgrades or enables group ports implicitly. */
export function createGroupEditorV3(
  document: ZlozGroupDocumentV3,
  options: ZlozGroupEditorOptionsV3,
): ZlozGroupEditorStateV3 {
  const owned = ownPortableData(options, undefined, 'Group editor options');
  if (
    !isRecord(owned) ||
    Object.keys(owned).some((key) => !['sessionId', 'historyLimit', 'readOnly'].includes(key)) ||
    typeof owned.sessionId !== 'string' ||
    !owned.sessionId.trim() ||
    owned.sessionId.length > 1024 ||
    ('historyLimit' in owned &&
      (typeof owned.historyLimit !== 'number' ||
        !Number.isSafeInteger(owned.historyLimit) ||
        owned.historyLimit < 0 ||
        owned.historyLimit > 1000)) ||
    ('readOnly' in owned && typeof owned.readOnly !== 'boolean')
  )
    throw new ZlozError(
      'invalid-edit',
      'Provide a nonempty sessionId (at most 1024 characters), historyLimit 0–1000 and boolean readOnly.',
    );
  return Object.freeze({
    format: 'foldkit-zloz-group-editor',
    version: 3,
    sessionId: owned.sessionId,
    revision: 0,
    document: captureGroupDocumentV3(document),
    history: history([], []),
    historyLimit: owned.historyLimit ?? 100,
    readOnly: owned.readOnly ?? false,
    activity: Object.freeze({ type: 'idle' }),
  });
}
/** Snapshot freshness, not permission. Never deserialize a runtime session to obtain authority. */
export function captureGroupEditorSourceV3(
  editor: ZlozGroupEditorStateV3,
): ZlozGroupEditorSourceV3 {
  assertSession(editor);
  return Object.freeze({
    sessionId: editor.sessionId,
    revision: editor.revision,
    document: captureGroupDocumentV3(editor.document),
  });
}
function freshness(
  editor: ZlozGroupEditorStateV3,
  source: ZlozGroupEditorSourceV3,
): Extract<ZlozGroupEditorResultV3, { type: 'blocked' }> | null {
  assertSession(editor);
  // Source tokens are data, not authority. Inspect descriptors before any property access.
  const fields = Object.getOwnPropertyDescriptors(source);
  if (
    Reflect.ownKeys(fields).length !== 3 ||
    ['sessionId', 'revision', 'document'].some((key) => !fields[key] || !('value' in fields[key]!))
  )
    throw new ZlozError('invalid-edit', 'Expected a data-only v3 source token.');
  // Bound metadata separately so the document retains its full own budget.
  const metadata = ownPortableData(
    { sessionId: fields.sessionId?.value, revision: fields.revision?.value },
    undefined,
    'Group editor source',
  );
  if (
    !isRecord(metadata) ||
    metadata.sessionId !== editor.sessionId ||
    metadata.revision !== editor.revision ||
    !historyValueEqual(
      captureGroupDocumentV3(fields.document?.value),
      captureGroupDocumentV3(editor.document),
    )
  )
    return blocked(
      editor,
      'stale-source',
      'The v3 source session, revision or complete document has changed.',
    );
  if (editor.readOnly) return blocked(editor, 'read-only', 'The v3 editor is read-only.');
  if (editor.activity.type === 'busy') return blocked(editor, 'busy', editor.activity.reason);
  if (editor.historyLimit === 0)
    return blocked(editor, 'history-disabled', 'Enable Undo before changing a v3 document.');
  if (editor.revision >= Number.MAX_SAFE_INTEGER)
    return blocked(editor, 'revision-exhausted', 'Editor revision counter is exhausted.');
  return null;
}
function prepare(
  editor: ZlozGroupEditorStateV3,
  source: ZlozGroupEditorSourceV3,
  document: ZlozGroupDocumentV3,
): Extract<ZlozGroupEditorResultV3, { type: 'blocked' }> | ZlozGroupDocumentV3 {
  // oxlint-disable-next-line linteffect/no-try-catch -- Peer-free core translates only known document/source validation failures into blocked transactions; policy and implementation exceptions propagate.
  try {
    const reason = freshness(editor, source);
    if (reason) return reason;
    return captureGroupDocumentV3(document);
  } catch (error) {
    if (error instanceof ZlozError) return blocked(editor, 'invalid-document', error.message);
    throw error;
  }
}
function policyReason(
  editor: ZlozGroupEditorStateV3,
  target: ZlozGroupDocumentV3,
  operation: ZlozGroupEditorCommitV3['operation'],
  policy: ZlozGroupEditorPolicyV3,
): string | null {
  const source = captureGroupDocumentV3(editor.document);
  const changes = graphChanges(source.graph, target.graph);
  for (const change of changes)
    if (
      change.entity === 'node' &&
      change.before &&
      change.after &&
      (change.before.kind === 'group') !== (change.after.kind === 'group') &&
      change.before.ports.some((port) => change.after?.ports.some((next) => next.id === port.id))
    )
      return 'Handle shared ports and incident connections before changing group boundary kind.';
  return (
    graphChangePolicyReason(
      source.graph,
      target.graph,
      changes,
      policy,
      target.connectionMode,
      'The graph change is protected.',
    ) ??
    denial(
      policy.canCommitGroupDocumentV3?.(
        Object.freeze({
          operation,
          sessionId: editor.sessionId,
          revision: editor.revision,
          source,
          target,
        }),
      ),
    )
  );
}
/** @internal Nonpublishing review shared by v3 planners and Apply; never confers cached authority. */
export function reviewGroupEditorTransactionV3(
  editor: ZlozGroupEditorStateV3,
  transaction: ZlozGroupEditorTransactionV3,
  policy: ZlozGroupEditorPolicyV3 = {},
):
  | Extract<ZlozGroupEditorResultV3, { type: 'blocked' }>
  | Readonly<{ type: 'unchanged'; editor: ZlozGroupEditorStateV3 }>
  | Readonly<{ type: 'ready'; document: ZlozGroupDocumentV3 }> {
  const target = prepare(editor, transaction.source, transaction.document);
  if ('type' in target) return target;
  if (historyValueEqual(editor.document, target)) return { type: 'unchanged', editor };
  const reason = policyReason(editor, target, 'apply', policy);
  if (reason !== null) return blocked(editor, 'protected', reason);
  return { type: 'ready', document: target };
}
/** One synchronous publication and one full-document Undo unit, after all live checks. */
export function applyGroupEditorTransactionV3(
  editor: ZlozGroupEditorStateV3,
  transaction: ZlozGroupEditorTransactionV3,
  policy: ZlozGroupEditorPolicyV3 = {},
): ZlozGroupEditorResultV3 {
  const review = reviewGroupEditorTransactionV3(editor, transaction, policy);
  if (review.type !== 'ready') return review;
  const target = review.document;
  return {
    type: 'applied',
    editor: Object.freeze({
      ...editor,
      document: target,
      revision: editor.revision + 1,
      history: history(
        [...editor.history.past, captureGroupDocumentV3(editor.document)].slice(
          -editor.historyLimit,
        ),
        [],
      ),
    }),
  };
}
/** Source-bound Undo/Redo. Live protections apply in the travel direction; revision never rewinds. */
export function updateGroupEditorV3(
  editor: ZlozGroupEditorStateV3,
  event: ZlozGroupEditorEventV3,
  policy: ZlozGroupEditorPolicyV3 = {},
): ZlozGroupEditorResultV3 {
  assertSession(editor);
  if (event.type !== 'UndoPressed' && event.type !== 'RedoPressed')
    return blocked(
      editor,
      'version-required',
      'Use the distinct v3 workbench controller or a versioned planner for native events.',
    );
  const undo = event.type === 'UndoPressed';
  const frames = undo ? editor.history.past : editor.history.future;
  const target = prepare(editor, event.source, frames.at(-1) ?? editor.document);
  if ('type' in target) return target;
  if (frames.length === 0) return { type: 'unchanged', editor };
  const reason = policyReason(editor, target, undo ? 'undo' : 'redo', policy);
  if (reason !== null) return blocked(editor, 'protected', reason);
  const past = undo
    ? frames.slice(0, -1)
    : [...editor.history.past, captureGroupDocumentV3(editor.document)].slice(-editor.historyLimit);
  const future = undo
    ? [...editor.history.future, captureGroupDocumentV3(editor.document)].slice(
        -editor.historyLimit,
      )
    : frames.slice(0, -1);
  return {
    type: 'applied',
    editor: Object.freeze({
      ...editor,
      document: target,
      revision: editor.revision + 1,
      history: history(past, future),
    }),
  };
}
/** Native v3 entry availability only; unchanged means use its distinct API, never pass a bare graph to a legacy entry. */
export function resolveGroupEditorBoundaryV3(
  editor: ZlozGroupEditorStateV3,
  boundary: ZlozGroupEditorBoundaryV3,
): ZlozGroupEditorResultV3 {
  assertSession(editor);
  if (
    boundary === 'native-controls' ||
    boundary === 'model' ||
    boundary === 'editions' ||
    boundary === 'layout' ||
    boundary === 'svg' ||
    boundary === 'png'
  )
    return { type: 'unchanged', editor };
  return blocked(
    editor,
    'version-required',
    `${boundary} requires a qualified native v3 contract. Keep the full document or use explicit downgrade planning.`,
  );
}
