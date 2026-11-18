import { validateGraph } from './graph';
import type { ZlozGraph } from './types';

export const ZLOZ_COUPLING_MODEL_VERSION = 'balanced-coupling-binary/v1' as const;
export type ZlozCouplingIntegration = 'intrusive' | 'functional' | 'model' | 'contract';
export type ZlozCouplingLevel = 'low' | 'high';
export type ZlozCouplingInput<T> =
  | Readonly<{
      status: 'known';
      value: T;
      basis: 'declared' | 'observed' | 'derived';
      rationale: string;
    }>
  | Readonly<{ status: 'unknown'; reason: string }>;
export type ZlozCouplingAssessment = Readonly<{
  format: 'foldkit-zloz-coupling';
  version: 1;
  modelVersion: typeof ZLOZ_COUPLING_MODEL_VERSION;
  target: Readonly<{
    documentId: string;
    graphVersion: number;
    relationshipId: string;
    sourceNodeId: string;
    targetNodeId: string;
  }>;
  scope: Readonly<{ abstraction: string; horizon: string }>;
  inputs: Readonly<{
    integrationType: ZlozCouplingInput<ZlozCouplingIntegration>;
    strength: ZlozCouplingInput<ZlozCouplingLevel>;
    distance: ZlozCouplingInput<ZlozCouplingLevel>;
    volatility: ZlozCouplingInput<ZlozCouplingLevel>;
  }>;
}>;
export type ZlozCouplingField = keyof ZlozCouplingAssessment['inputs'];
export type ZlozCouplingContext = Readonly<{
  documentId: string;
  graphVersion: number;
  graph: ZlozGraph;
}>;
export type ZlozCouplingPattern =
  | 'low-cohesion'
  | 'loose-coupling'
  | 'high-cohesion'
  | 'tight-coupling';
type CouplingResultReference = Readonly<{
  modelVersion: typeof ZLOZ_COUPLING_MODEL_VERSION;
  target: ZlozCouplingAssessment['target'];
  scope: ZlozCouplingAssessment['scope'];
}>;
export type ZlozCouplingResult = CouplingResultReference &
  (
    | Readonly<{
        status: 'balanced';
        pattern: 'loose-coupling' | 'high-cohesion';
        basis: 'complementary-dimensions';
      }>
    | Readonly<{
        status: 'balanced';
        pattern: 'low-cohesion' | 'tight-coupling';
        basis: 'low-volatility';
      }>
    | Readonly<{
        status: 'imbalanced';
        pattern: 'low-cohesion' | 'tight-coupling';
        basis: 'matching-dimensions';
      }>
    | Readonly<{ status: 'unassessed'; missing: readonly ZlozCouplingField[] }>
    | Readonly<{
        status: 'rejected';
        code:
          | 'document-mismatch'
          | 'graph-version-mismatch'
          | 'relationship-missing'
          | 'endpoint-mismatch';
      }>
  );
export class ZlozCouplingError extends Error {
  override readonly name = 'ZlozCouplingError';
  constructor(
    readonly code: 'invalid-assessment' | 'unsupported-version' | 'invalid-context',
    message: string,
  ) {
    super(message);
  }
}

// Named candidate fields belong only to this decoder; no open unknown-valued dictionary escapes it.
type CouplingWireRecord = {
  format?: unknown;
  version?: unknown;
  modelVersion?: unknown;
  target?: unknown;
  scope?: unknown;
  inputs?: unknown;
  documentId?: unknown;
  graphVersion?: unknown;
  relationshipId?: unknown;
  sourceNodeId?: unknown;
  targetNodeId?: unknown;
  abstraction?: unknown;
  horizon?: unknown;
  integrationType?: unknown;
  strength?: unknown;
  distance?: unknown;
  volatility?: unknown;
  status?: unknown;
  value?: unknown;
  basis?: unknown;
  rationale?: unknown;
  reason?: unknown;
};
const fields = ['integrationType', 'strength', 'distance', 'volatility'] as const;
const record = (value: unknown): value is CouplingWireRecord =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const keys = (value: CouplingWireRecord, expected: readonly string[]) =>
  Object.keys(value).length === expected.length &&
  expected.every((key) => Object.hasOwn(value, key));
const text = (value: unknown, maximum: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
const identity = (value: unknown): value is string => text(value, 256);
const revision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
const level = (value: unknown): value is ZlozCouplingLevel => value === 'low' || value === 'high';
const integration = (value: unknown): value is ZlozCouplingIntegration =>
  value === 'intrusive' || value === 'functional' || value === 'model' || value === 'contract';
function evidence<T>(
  value: unknown,
  valid: (candidate: unknown) => candidate is T,
): value is ZlozCouplingInput<T> {
  if (!record(value)) return false;
  if (value.status === 'unknown')
    return keys(value, ['status', 'reason']) && text(value.reason, 2048);
  return (
    value.status === 'known' &&
    keys(value, ['status', 'value', 'basis', 'rationale']) &&
    valid(value.value) &&
    (value.basis === 'declared' || value.basis === 'observed' || value.basis === 'derived') &&
    text(value.rationale, 2048)
  );
}
export function isCouplingAssessment(value: unknown): value is ZlozCouplingAssessment {
  if (
    !record(value) ||
    !keys(value, ['format', 'version', 'modelVersion', 'target', 'scope', 'inputs']) ||
    value.format !== 'foldkit-zloz-coupling' ||
    value.version !== 1 ||
    value.modelVersion !== ZLOZ_COUPLING_MODEL_VERSION ||
    !record(value.target) ||
    !keys(value.target, [
      'documentId',
      'graphVersion',
      'relationshipId',
      'sourceNodeId',
      'targetNodeId',
    ]) ||
    !identity(value.target.documentId) ||
    !revision(value.target.graphVersion) ||
    !identity(value.target.relationshipId) ||
    !identity(value.target.sourceNodeId) ||
    !identity(value.target.targetNodeId) ||
    !record(value.scope) ||
    !keys(value.scope, ['abstraction', 'horizon']) ||
    !text(value.scope.abstraction, 2048) ||
    !text(value.scope.horizon, 2048) ||
    !record(value.inputs) ||
    !keys(value.inputs, fields)
  )
    return false;
  return (
    evidence(value.inputs.integrationType, integration) &&
    evidence(value.inputs.strength, level) &&
    evidence(value.inputs.distance, level) &&
    evidence(value.inputs.volatility, level)
  );
}
function assertAssessment(value: unknown): asserts value is ZlozCouplingAssessment {
  if (
    record(value) &&
    ('format' in value || 'version' in value || 'modelVersion' in value) &&
    (value.format !== 'foldkit-zloz-coupling' ||
      value.version !== 1 ||
      value.modelVersion !== ZLOZ_COUPLING_MODEL_VERSION)
  )
    throw new ZlozCouplingError(
      'unsupported-version',
      'Unsupported coupling format or model version',
    );
  if (!isCouplingAssessment(value))
    throw new ZlozCouplingError('invalid-assessment', 'Invalid coupling assessment');
}
function boundedJson(json: string): void {
  if (new TextEncoder().encode(json).byteLength > 64 * 1024)
    throw new ZlozCouplingError('invalid-assessment', 'Coupling JSON exceeds 64 KiB');
}
function copyInput<T>(input: ZlozCouplingInput<T>): ZlozCouplingInput<T> {
  return input.status === 'unknown'
    ? { status: 'unknown', reason: input.reason }
    : { status: 'known', value: input.value, basis: input.basis, rationale: input.rationale };
}

/** Strict, bounded wire decoding; unsupported model identities are never silently upgraded. */
export function parseCouplingAssessment(json: string): ZlozCouplingAssessment {
  boundedJson(json);
  let value: unknown;
  // oxlint-disable-next-line linteffect/no-try-catch -- Dependency-free JSON boundary translates syntax failures into the coupling error contract.
  try {
    value = JSON.parse(json);
  } catch {
    throw new ZlozCouplingError('invalid-assessment', 'Invalid coupling assessment JSON');
  }
  assertAssessment(value);
  return value;
}

/** Stable explicit fields preserve evidence and reject extra fields instead of dropping them. */
export function serializeCouplingAssessment(assessment: ZlozCouplingAssessment): string {
  assertAssessment(assessment);
  const value = assessment;
  const json = JSON.stringify({
    format: value.format,
    version: value.version,
    modelVersion: value.modelVersion,
    target: {
      documentId: value.target.documentId,
      graphVersion: value.target.graphVersion,
      relationshipId: value.target.relationshipId,
      sourceNodeId: value.target.sourceNodeId,
      targetNodeId: value.target.targetNodeId,
    },
    scope: { abstraction: value.scope.abstraction, horizon: value.scope.horizon },
    inputs: {
      integrationType: copyInput(value.inputs.integrationType),
      strength: copyInput(value.inputs.strength),
      distance: copyInput(value.inputs.distance),
      volatility: copyInput(value.inputs.volatility),
    },
  });
  boundedJson(json);
  return json;
}

/** Read-only interpretation of explicit evidence bound to a host-supplied current graph.
 * The host owns canonical freshness/authorization; these references grant no access. */
export function evaluateCouplingAssessment(
  assessment: ZlozCouplingAssessment,
  context: ZlozCouplingContext,
): ZlozCouplingResult {
  assertAssessment(assessment);
  const document = assessment;
  if (!record(context) || !identity(context.documentId) || !revision(context.graphVersion))
    throw new ZlozCouplingError('invalid-context', 'Invalid coupling graph reference');
  const reference = {
    modelVersion: ZLOZ_COUPLING_MODEL_VERSION,
    target: { ...document.target },
    scope: { ...document.scope },
  };
  if (context.documentId !== document.target.documentId)
    return { ...reference, status: 'rejected', code: 'document-mismatch' };
  if (context.graphVersion !== document.target.graphVersion)
    return { ...reference, status: 'rejected', code: 'graph-version-mismatch' };
  validateGraph(context.graph);
  const edge = context.graph.edges.find(
    (candidate) => candidate.id === document.target.relationshipId,
  );
  if (!edge) return { ...reference, status: 'rejected', code: 'relationship-missing' };
  if (
    edge.source.node !== document.target.sourceNodeId ||
    edge.target.node !== document.target.targetNodeId
  )
    return { ...reference, status: 'rejected', code: 'endpoint-mismatch' };
  const { integrationType, strength, distance, volatility } = document.inputs;
  if (
    integrationType.status === 'unknown' ||
    strength.status === 'unknown' ||
    distance.status === 'unknown' ||
    volatility.status === 'unknown'
  )
    return {
      ...reference,
      status: 'unassessed',
      missing: fields.filter((field) => document.inputs[field].status === 'unknown'),
    };
  if (strength.value !== distance.value)
    return {
      ...reference,
      status: 'balanced',
      pattern: strength.value === 'high' ? 'high-cohesion' : 'loose-coupling',
      basis: 'complementary-dimensions',
    };
  const pattern = strength.value === 'high' ? 'tight-coupling' : 'low-cohesion';
  if (volatility.value === 'low')
    return { ...reference, status: 'balanced', pattern, basis: 'low-volatility' };
  return { ...reference, status: 'imbalanced', pattern, basis: 'matching-dimensions' };
}
