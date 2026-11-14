import {
  assertConnectionDocument,
  captureConnectionDocument,
  planConnectionDocumentDowngrade,
  type ZlozConnectionDocument,
} from './connection-document';
import { ZlozError } from './graph';
import { captureEdition, parseEditions, serializeEditions, type ZlozEdition } from './history';
import { captureModelDocument, type ZlozModelDocument } from './model-document';
import type { ZlozSnapshot } from './types';

/** Each checkpoint owns its explicit mode; the containing model never overrides it. */
export type ZlozEditionV2 = Readonly<{
  id: string;
  name: string;
  snapshot: ZlozConnectionDocument;
}>;
export type ZlozModelOriginV2 = Readonly<{
  modelId: string;
  modelName: string;
  edition: ZlozEditionV2;
}>;
/** Canonical v2 data only. Editors, forks, comparisons and restore are separate adoption boundaries. */
export type ZlozModelDocumentV2 = Readonly<{
  id: string;
  name: string;
  snapshot: ZlozConnectionDocument;
  editions: readonly ZlozEditionV2[];
  origin: ZlozModelOriginV2 | null;
}>;
export type ZlozV2DowngradeFinding =
  | Readonly<{ code: 'loose-mode-removed'; path: string; reason: string }>
  | Readonly<{
      code: 'loose-edges-unrepresentable';
      path: string;
      edgeIds: readonly string[];
      reason: string;
    }>;
/** Prospective v1 data is provided only when every owned checkpoint can be represented. No consent or Apply. */
export type ZlozModelV2DowngradePlan =
  | Readonly<{
      type: 'blocked';
      source: ZlozModelDocumentV2;
      findings: readonly ZlozV2DowngradeFinding[];
    }>
  | Readonly<{
      type: 'reviewable';
      source: ZlozModelDocumentV2;
      findings: readonly ZlozV2DowngradeFinding[];
      document: ZlozModelDocument;
    }>;
export type ZlozEditionsV2DowngradePlan =
  | Readonly<{
      type: 'blocked';
      source: readonly ZlozEditionV2[];
      findings: readonly ZlozV2DowngradeFinding[];
    }>
  | Readonly<{
      type: 'reviewable';
      source: readonly ZlozEditionV2[];
      findings: readonly ZlozV2DowngradeFinding[];
      editions: readonly ZlozEdition[];
    }>;

type WireFields = Readonly<{
  format?: unknown;
  version?: unknown;
  document?: unknown;
  id?: unknown;
  name?: unknown;
  snapshot?: unknown;
  editions?: unknown;
  origin?: unknown;
  modelId?: unknown;
  modelName?: unknown;
  edition?: unknown;
}>;
function record(value: unknown): value is WireFields {
  return (
    typeof value === 'object' &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}
function fields(value: WireFields, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function invalid(): never {
  throw new ZlozError(
    'invalid-graph',
    'Invalid or unsupported canonical v2 model/edition document',
  );
}
function freeze<T>(value: T): T {
  if (record(value) || Array.isArray(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function assertEdition(value: unknown): asserts value is ZlozEditionV2 {
  if (
    !record(value) ||
    !fields(value, ['id', 'name', 'snapshot']) ||
    !text(value.id) ||
    !text(value.name)
  )
    invalid();
  assertConnectionDocument(value.snapshot);
}
function assertEditions(value: unknown): asserts value is readonly ZlozEditionV2[] {
  if (!Array.isArray(value)) invalid();
  const ids = new Set<string>();
  for (const edition of value) {
    assertEdition(edition);
    if (ids.has(edition.id)) invalid();
    ids.add(edition.id);
  }
}
function assertModel(value: unknown): asserts value is ZlozModelDocumentV2 {
  if (
    !record(value) ||
    !fields(value, ['id', 'name', 'snapshot', 'editions', 'origin']) ||
    !text(value.id) ||
    !text(value.name)
  )
    invalid();
  assertConnectionDocument(value.snapshot);
  assertEditions(value.editions);
  const origin = value.origin;
  if (origin !== null) {
    if (
      !record(origin) ||
      !fields(origin, ['modelId', 'modelName', 'edition']) ||
      !text(origin.modelId) ||
      !text(origin.modelName) ||
      origin.modelId === value.id
    )
      invalid();
    assertEdition(origin.edition);
  }
}
/** Validate typed data before JSON encoding; detach and deeply freeze without inferring mode. */
export function captureEditionV2(edition: ZlozEditionV2): ZlozEditionV2 {
  assertEdition(edition);
  const value: unknown = JSON.parse(JSON.stringify(edition));
  assertEdition(value);
  return freeze(value);
}
export function parseEditionsV2(json: string): readonly ZlozEditionV2[] {
  let value: unknown;
  // oxlint-disable-next-line linteffect/no-try-catch -- Peer-free JSON boundary translates syntax errors into the core error contract.
  try {
    value = JSON.parse(json);
  } catch {
    return invalid();
  }
  if (
    !record(value) ||
    !fields(value, ['format', 'version', 'editions']) ||
    value.format !== 'foldkit-zloz-editions' ||
    value.version !== 2
  )
    invalid();
  assertEditions(value.editions);
  return freeze(value.editions);
}
export function serializeEditionsV2(editions: readonly ZlozEditionV2[]): string {
  assertEditions(editions);
  const checked = parseEditionsV2(
    JSON.stringify({ format: 'foldkit-zloz-editions', version: 2, editions }),
  );
  return JSON.stringify({ format: 'foldkit-zloz-editions', version: 2, editions: checked });
}
export function parseModelDocumentV2(json: string): ZlozModelDocumentV2 {
  let value: unknown;
  // oxlint-disable-next-line linteffect/no-try-catch -- Peer-free JSON boundary translates syntax errors into the core error contract.
  try {
    value = JSON.parse(json);
  } catch {
    return invalid();
  }
  if (
    !record(value) ||
    !fields(value, ['format', 'version', 'document']) ||
    value.format !== 'foldkit-zloz-model' ||
    value.version !== 2
  )
    invalid();
  assertModel(value.document);
  return freeze(value.document);
}
export function captureModelDocumentV2(document: ZlozModelDocumentV2): ZlozModelDocumentV2 {
  assertModel(document);
  return parseModelDocumentV2(
    JSON.stringify({ format: 'foldkit-zloz-model', version: 2, document }),
  );
}
export function serializeModelDocumentV2(document: ZlozModelDocumentV2): string {
  return JSON.stringify({
    format: 'foldkit-zloz-model',
    version: 2,
    document: captureModelDocumentV2(document),
  });
}

// Guard the original snapshot before v1 structural constructors can omit newer fields.
function upgradeSnapshot(snapshot: ZlozSnapshot): ZlozConnectionDocument {
  if (!record(snapshot) || !fields(snapshot, ['graph', 'viewport'])) invalid();
  return captureConnectionDocument({ ...snapshot, connectionMode: 'strict' });
}
/** Explicit v1 migration only. Existing v2 snapshots reject rather than being reset to strict. */
export function upgradeEditionsToV2(editions: readonly ZlozEdition[]): readonly ZlozEditionV2[] {
  const checked = parseEditions(serializeEditions(editions));
  return freeze(
    checked.map((edition, index) =>
      captureEditionV2({ ...edition, snapshot: upgradeSnapshot(editions[index]!.snapshot) }),
    ),
  );
}
export function upgradeModelDocumentToV2(document: ZlozModelDocument): ZlozModelDocumentV2 {
  const checked = captureModelDocument(document);
  return captureModelDocumentV2({
    ...checked,
    snapshot: upgradeSnapshot(document.snapshot),
    editions: upgradeEditionsToV2(document.editions),
    origin:
      checked.origin === null
        ? null
        : {
            ...checked.origin,
            edition: {
              ...checked.origin.edition,
              snapshot: upgradeSnapshot(document.origin!.edition.snapshot),
            },
          },
  });
}

type Projection =
  | Readonly<{ type: 'blocked'; findings: readonly ZlozV2DowngradeFinding[] }>
  | Readonly<{
      type: 'reviewable';
      snapshot: ZlozSnapshot;
      findings: readonly ZlozV2DowngradeFinding[];
    }>;
function project(snapshot: ZlozConnectionDocument, path: string): Projection {
  const plan = planConnectionDocumentDowngrade(snapshot);
  return plan.type === 'blocked'
    ? {
        type: 'blocked',
        findings: [
          {
            code: 'loose-edges-unrepresentable',
            path,
            edgeIds: plan.incompatibleEdges,
            reason: plan.reason,
          },
        ],
      }
    : {
        type: 'reviewable',
        snapshot: plan.snapshot,
        findings: plan.losses.map((loss) => ({ ...loss, path })),
      };
}
type EditionProjection =
  | Readonly<{ type: 'blocked'; findings: readonly ZlozV2DowngradeFinding[] }>
  | Readonly<{
      type: 'reviewable';
      edition: ZlozEdition;
      findings: readonly ZlozV2DowngradeFinding[];
    }>;
function projectEdition(edition: ZlozEditionV2, path: string): EditionProjection {
  const result = project(edition.snapshot, path);
  return result.type === 'blocked'
    ? result
    : {
        type: 'reviewable',
        edition: captureEdition({ id: edition.id, name: edition.name, snapshot: result.snapshot }),
        findings: result.findings,
      };
}
function requireEdition(projection: EditionProjection): ZlozEdition {
  if (projection.type === 'blocked') invalid();
  return projection.edition;
}
/** Whole archive review: no partial archive, retyped ports, dropped edges or implicit consent. */
export function planEditionsV2Downgrade(
  editions: readonly ZlozEditionV2[],
): ZlozEditionsV2DowngradePlan {
  const source = parseEditionsV2(serializeEditionsV2(editions));
  const projections = source.map((edition, index) =>
    projectEdition(edition, `/editions/${index}/snapshot`),
  );
  const findings = projections.flatMap((item) => item.findings);
  if (projections.some((item) => item.type === 'blocked'))
    return freeze({ type: 'blocked', source, findings });
  return freeze({
    type: 'reviewable',
    source,
    findings,
    editions: projections.map(requireEdition),
  });
}
/** Inspect present, every edition and pinned origin before exposing any prospective v1 document. */
export function planModelDocumentV2Downgrade(
  document: ZlozModelDocumentV2,
): ZlozModelV2DowngradePlan {
  const source = captureModelDocumentV2(document);
  const current = project(source.snapshot, '/snapshot');
  const editions = source.editions.map((edition, index) =>
    projectEdition(edition, `/editions/${index}/snapshot`),
  );
  const origin =
    source.origin === null
      ? null
      : {
          modelId: source.origin.modelId,
          modelName: source.origin.modelName,
          ...projectEdition(source.origin.edition, '/origin/edition/snapshot'),
        };
  const findings = [
    ...current.findings,
    ...editions.flatMap((item) => item.findings),
    ...(origin?.findings ?? []),
  ];
  if (
    current.type === 'blocked' ||
    editions.some((item) => item.type === 'blocked') ||
    (origin !== null && origin.type === 'blocked')
  )
    return freeze({ type: 'blocked', source, findings });
  return freeze({
    type: 'reviewable',
    source,
    findings,
    document: captureModelDocument({
      id: source.id,
      name: source.name,
      snapshot: current.snapshot,
      editions: editions.map(requireEdition),
      origin:
        origin === null
          ? null
          : {
              modelId: origin.modelId,
              modelName: origin.modelName,
              edition: requireEdition(origin),
            },
    }),
  });
}
