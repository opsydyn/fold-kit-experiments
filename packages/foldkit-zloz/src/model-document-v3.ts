/* oxlint-disable anti-slop/no-unknown-parameters, linteffect/no-naked-object-state-update -- These public owned-data decoders reject accessors/prototypes before structural inspection. */
import { editRecord, editFields, editIdentifier } from './edit-data';
import { ZlozError } from './graph';
import {
  captureGroupDocumentV3,
  upgradeGroupDocumentV3,
  planGroupDocumentDowngradeV3,
  type ZlozGroupDocumentV3,
} from './group-document-v3';
import { captureModelDocumentV2, type ZlozModelDocumentV2 } from './model-document-v2';
import { ownPortableData } from './portable-data';
import { preflightPortableJson, PortableJsonError } from './portable-json';
import type { JsonValue } from './types';
export type ZlozEditionV3 = Readonly<{ id: string; name: string; snapshot: ZlozGroupDocumentV3 }>;
export type ZlozModelOriginV3 = Readonly<{
  modelId: string;
  modelName: string;
  edition: ZlozEditionV3;
}>;
export type ZlozModelDocumentV3 = Readonly<{
  id: string;
  name: string;
  snapshot: ZlozGroupDocumentV3;
  editions: readonly ZlozEditionV3[];
  origin: ZlozModelOriginV3 | null;
}>;
export const modelDocumentV3Limits = Object.freeze({
  maxCharacters: 16000000,
  maxDepth: 80,
  maxValues: 1000000,
  maxEditions: 1000,
});
function invalid(reason = 'Invalid or unsupported canonical v3 model/edition document.'): never {
  throw new ZlozError('invalid-graph', reason);
}
const text = (value: JsonValue | undefined): value is string =>
  editIdentifier(value) && value.trim().length > 0;
type SnapshotReader = (value: JsonValue) => ZlozGroupDocumentV3;
function edition(
  value: JsonValue | undefined,
  read: SnapshotReader = captureGroupDocumentV3,
): ZlozEditionV3 {
  if (
    !editRecord(value) ||
    !editFields(value, ['id', 'name', 'snapshot']) ||
    !text(value.id) ||
    !text(value.name) ||
    value.snapshot === undefined
  )
    return invalid();
  return Object.freeze({ id: value.id, name: value.name, snapshot: read(value.snapshot) });
}
function editions(
  value: JsonValue | undefined,
  read: SnapshotReader = captureGroupDocumentV3,
): readonly ZlozEditionV3[] {
  if (!Array.isArray(value) || value.length > modelDocumentV3Limits.maxEditions)
    return invalid('Invalid or oversized v3 edition collection.');
  const result = value.map((item) => edition(item, read));
  if (new Set(result.map((item) => item.id)).size !== result.length)
    return invalid('Edition IDs must be unique.');
  return Object.freeze(result);
}
function originValue(
  value: JsonValue | undefined,
  ownerId: string,
  read: SnapshotReader,
): ZlozModelOriginV3 | null {
  if (value === null) return null;
  if (
    !editRecord(value) ||
    !editFields(value, ['modelId', 'modelName', 'edition']) ||
    !text(value.modelId) ||
    !text(value.modelName) ||
    value.modelId === ownerId
  )
    return invalid('Invalid v3 fork provenance.');
  return Object.freeze({
    modelId: value.modelId,
    modelName: value.modelName,
    edition: edition(value.edition, read),
  });
}
function model(
  value: JsonValue,
  read: SnapshotReader = captureGroupDocumentV3,
): ZlozModelDocumentV3 {
  if (
    !editRecord(value) ||
    !editFields(value, ['id', 'name', 'snapshot', 'editions', 'origin']) ||
    !text(value.id) ||
    !text(value.name) ||
    value.snapshot === undefined
  )
    return invalid();
  return Object.freeze({
    id: value.id,
    name: value.name,
    snapshot: read(value.snapshot),
    editions: editions(value.editions, read),
    origin: originValue(value.origin, value.id, read),
  });
}
function bounded(value: JsonValue): string {
  const json = JSON.stringify(value);
  if (json.length > modelDocumentV3Limits.maxCharacters)
    invalid('Canonical v3 model exceeds its text budget.');
  preflightPortableJson(
    json,
    modelDocumentV3Limits.maxDepth,
    modelDocumentV3Limits.maxValues,
    'Canonical v3 model',
  );
  return json;
}
function owned(input: unknown): JsonValue {
  return ownPortableData(input, modelDocumentV3Limits, 'Canonical v3 model');
}
function read(json: string): JsonValue {
  if (json.length > modelDocumentV3Limits.maxCharacters)
    invalid('Canonical v3 model exceeds its text budget.');
  // oxlint-disable-next-line linteffect/no-try-catch -- Normalize only known JSON syntax/scanner failures at this peer-free decoder boundary.
  try {
    preflightPortableJson(
      json,
      modelDocumentV3Limits.maxDepth,
      modelDocumentV3Limits.maxValues,
      'Canonical v3 model',
    );
    return owned(JSON.parse(json));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof PortableJsonError)
      return invalid(error.message);
    throw error;
  }
}
/** Own every checkpoint; aggregate bounds supplement each standalone document's tighter limits. */
export function captureModelDocumentV3(input: unknown): ZlozModelDocumentV3 {
  const value = owned(input);
  bounded(value);
  const checked = model(value);
  bounded(owned({ format: 'foldkit-zloz-model', version: 3, document: checked }));
  return checked;
}
export function captureEditionV3(input: unknown): ZlozEditionV3 {
  const value = owned(input);
  bounded(value);
  return edition(value);
}
export function serializeModelDocumentV3(input: ZlozModelDocumentV3): string {
  const checked = captureModelDocumentV3(input);
  return bounded(owned({ format: 'foldkit-zloz-model', version: 3, document: checked }));
}
export function parseModelDocumentV3(json: string): ZlozModelDocumentV3 {
  const value = read(json);
  if (
    !editRecord(value) ||
    !editFields(value, ['format', 'version', 'document']) ||
    value.format !== 'foldkit-zloz-model' ||
    value.version !== 3 ||
    value.document === undefined
  )
    return invalid();
  return model(value.document);
}
export function serializeEditionsV3(input: readonly ZlozEditionV3[]): string {
  const checked = editions(owned(input));
  return bounded(owned({ format: 'foldkit-zloz-editions', version: 3, editions: checked }));
}
export function parseEditionsV3(json: string): readonly ZlozEditionV3[] {
  const value = read(json);
  if (
    !editRecord(value) ||
    !editFields(value, ['format', 'version', 'editions']) ||
    value.format !== 'foldkit-zloz-editions' ||
    value.version !== 3
  )
    return invalid();
  return editions(value.editions);
}
/** Explicit standalone v1/v2 canonical-body upgrade; already-v3 snapshots reject rather than reset capability. */
export function upgradeModelDocumentV3(input: unknown): ZlozModelDocumentV3 {
  const value = owned(input);
  bounded(value);
  return captureModelDocumentV3(model(value, upgradeGroupDocumentV3));
}
export type ZlozModelDowngradeFindingV3 = Readonly<{
  path: string;
  code: 'unrepresentable' | 'capability-removed';
  reason: string;
}>;
export type ZlozModelDowngradePlanV3 =
  | Readonly<{
      type: 'blocked';
      source: ZlozModelDocumentV3;
      findings: readonly ZlozModelDowngradeFindingV3[];
    }>
  | Readonly<{
      type: 'reviewable';
      source: ZlozModelDocumentV3;
      findings: readonly ZlozModelDowngradeFindingV3[];
      document: ZlozModelDocumentV2;
    }>;
export function planModelDocumentDowngradeV3(input: ZlozModelDocumentV3): ZlozModelDowngradePlanV3 {
  const source = captureModelDocumentV3(input),
    findings: ZlozModelDowngradeFindingV3[] = [];
  const inspect = (snapshot: ZlozGroupDocumentV3, path: string) => {
    const plan = planGroupDocumentDowngradeV3(snapshot);
    if (plan.type === 'blocked')
      findings.push({ path, code: 'unrepresentable', reason: plan.reason });
    else
      for (const loss of plan.losses)
        findings.push({ path, code: 'capability-removed', reason: loss.reason });
  };
  inspect(source.snapshot, '/snapshot');
  source.editions.forEach((item, index) => inspect(item.snapshot, `/editions/${index}/snapshot`));
  if (source.origin) inspect(source.origin.edition.snapshot, '/origin/edition/snapshot');
  const checked = Object.freeze(findings.map((item) => Object.freeze(item)));
  if (findings.some((item) => item.code === 'unrepresentable'))
    return Object.freeze({ type: 'blocked', source, findings: checked });
  const project = (snapshot: ZlozGroupDocumentV3) => {
    const plan = planGroupDocumentDowngradeV3(snapshot);
    if (plan.type !== 'reviewable')
      return invalid('Downgrade capability changed during pure planning.');
    return plan.document;
  };
  return Object.freeze({
    type: 'reviewable',
    source,
    findings: checked,
    document: captureModelDocumentV2({
      id: source.id,
      name: source.name,
      snapshot: project(source.snapshot),
      editions: source.editions.map((item) => ({ ...item, snapshot: project(item.snapshot) })),
      origin:
        source.origin === null
          ? null
          : {
              ...source.origin,
              edition: {
                ...source.origin.edition,
                snapshot: project(source.origin.edition.snapshot),
              },
            },
    }),
  });
}
