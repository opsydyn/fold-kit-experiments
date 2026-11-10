import { createEditor } from './editor';
import { ZlozError, parseSnapshot } from './graph';
import { captureEdition, parseEditions, serializeEditions, type ZlozEdition } from './history';
import type { EditorOptions, EditorState, JsonValue, ZlozSnapshot } from './types';

/** Immediate parent provenance pinned to the original immutable edition, not a mutable lookup. */
export type ZlozModelOrigin = Readonly<{
  modelId: string;
  modelName: string;
  edition: ZlozEdition;
}>;
/** Portable document identity is separate from diagram IDs, session revision and Undo. */
export type ZlozModelDocument = Readonly<{
  id: string;
  name: string;
  snapshot: ZlozSnapshot;
  editions: readonly ZlozEdition[];
  origin: ZlozModelOrigin | null;
}>;
export type ZlozModelIdentity = Pick<ZlozModelDocument, 'id' | 'name'>;
export type ZlozEditionForkPolicy = Readonly<{
  canForkEdition?: (
    source: ZlozModelDocument,
    edition: ZlozEdition,
    target: ZlozModelIdentity,
  ) => string | null;
}>;
export type ZlozEditionForkResult =
  | Readonly<{ type: 'forked'; document: ZlozModelDocument }>
  | Readonly<{ type: 'blocked'; reason: string }>;
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const record = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const fields = (value: Record<string, JsonValue>, names: readonly string[]) =>
  Object.keys(value).every((key) => names.includes(key));
function invalid(): never {
  throw new ZlozError('invalid-graph', 'Invalid or unsupported model document');
}
/** Validate, detach and freeze authored document data. Does not store an editor or invent identity. */
export function captureModelDocument(input: ZlozModelDocument): ZlozModelDocument {
  if (!record(input) || !text(input.id) || !text(input.name) || !Array.isArray(input.editions))
    invalid();
  const snapshot = captureEdition({
    id: input.id,
    name: input.name,
    snapshot: input.snapshot,
  }).snapshot;
  const editions = parseEditions(serializeEditions(input.editions));
  const raw = input.origin;
  if (
    raw !== null &&
    (!record(raw) ||
      !fields(raw, ['modelId', 'modelName', 'edition']) ||
      !record(raw.edition) ||
      !text(raw.modelId) ||
      !text(raw.modelName) ||
      raw.modelId === input.id)
  )
    invalid();
  const origin =
    raw === null
      ? null
      : Object.freeze({
          modelId: raw.modelId,
          modelName: raw.modelName,
          edition: captureEdition(raw.edition),
        });
  return Object.freeze({ id: input.id, name: input.name, snapshot, editions, origin });
}
export function serializeModelDocument(document: ZlozModelDocument): string {
  return JSON.stringify({
    format: 'foldkit-zloz-model',
    version: 1,
    document: captureModelDocument(document),
  });
}
/** Strict independent envelope. Old graph, snapshot and edition-archive codecs remain unchanged. */
export function parseModelDocument(json: string): ZlozModelDocument {
  let wire: unknown;
  // oxlint-disable-next-line linteffect/no-try-catch -- Dependency-free JSON boundary translates syntax errors to the core error contract.
  try {
    wire = JSON.parse(json);
  } catch {
    return invalid();
  }
  if (
    !record(wire) ||
    !fields(wire, ['format', 'version', 'document']) ||
    wire.format !== 'foldkit-zloz-model' ||
    wire.version !== 1
  )
    invalid();
  const value = wire.document;
  if (
    !record(value) ||
    !fields(value, ['id', 'name', 'snapshot', 'editions', 'origin']) ||
    !text(value.id) ||
    !text(value.name) ||
    !record(value.snapshot) ||
    !fields(value.snapshot, ['graph', 'viewport']) ||
    !Array.isArray(value.editions)
  )
    invalid();
  const snapshot = parseSnapshot(JSON.stringify({ version: 1, ...value.snapshot }));
  const editions = parseEditions(
    JSON.stringify({ format: 'foldkit-zloz-editions', version: 1, editions: value.editions }),
  );
  const origin = value.origin;
  if (
    origin !== null &&
    (!record(origin) ||
      !fields(origin, ['modelId', 'modelName', 'edition']) ||
      !text(origin.modelId) ||
      !text(origin.modelName))
  )
    invalid();
  let checkedOrigin: ZlozModelOrigin | null = null;
  if (origin !== null) {
    if (!record(origin) || !text(origin.modelId) || !text(origin.modelName)) invalid();
    checkedOrigin = {
      modelId: origin.modelId,
      modelName: origin.modelName,
      edition: parseEditions(
        JSON.stringify({ format: 'foldkit-zloz-editions', version: 1, editions: [origin.edition] }),
      )[0]!,
    };
  }
  return captureModelDocument({
    id: value.id,
    name: value.name,
    snapshot,
    editions,
    origin: checkedOrigin,
  });
}
/** Select only editions owned by the supplied source. Diagram IDs remain local to the new model. */
export function forkEdition(
  source: ZlozModelDocument,
  editionId: string,
  target: ZlozModelIdentity,
  policy: ZlozEditionForkPolicy = {},
): ZlozEditionForkResult {
  const checked = captureModelDocument(source);
  if (!text(target.id) || !text(target.name) || target.id === checked.id)
    return { type: 'blocked', reason: 'Choose a nonempty, distinct model identity and name.' };
  const identity = Object.freeze({ id: target.id, name: target.name });
  const edition = checked.editions.find((item) => item.id === editionId);
  if (!edition)
    return { type: 'blocked', reason: 'The source edition is unavailable in this model.' };
  const reason = policy.canForkEdition?.(checked, edition, identity) ?? null;
  if (reason !== null)
    return { type: 'blocked', reason: reason.trim() || 'Edition forking is protected.' };
  return {
    type: 'forked',
    document: captureModelDocument({
      id: identity.id,
      name: identity.name,
      snapshot: edition.snapshot,
      editions: [],
      origin: { modelId: checked.id, modelName: checked.name, edition },
    }),
  };
}
/** Fresh editable session with independent Undo/Redo and no inherited transient state. */
export function createModelEditor(
  document: ZlozModelDocument,
  options: EditorOptions = {},
): EditorState {
  const checked = captureModelDocument(document);
  if (checked.snapshot.viewport)
    return createEditor(checked.snapshot.graph, {
      viewport: checked.snapshot.viewport,
      ...options,
    });
  return createEditor(checked.snapshot.graph, options);
}
