import type { ZlozConnectionMode } from './connection-mode';
import { isNode, isEdge, isGraph, validateGraphForConnectionMode, ZlozError } from './graph';
import { ownPortableData, PortableDataError, portableDataLimits } from './portable-data';
import type { JsonObject, JsonValue, ZlozGraph, ZlozNode, ZlozEdge } from './types';

/** Host-owned graph identity and incarnation. Revision must remain monotonic through Undo. */
export type ZlozModellingPatchSource = Readonly<{
  modelId: string;
  sessionId: string;
  revision: number;
  graph: ZlozGraph;
}>;
/** Unsigned assertions for review, never credentials or authority. */
export type ZlozModellingPatchProvenance = Readonly<{
  actor: Readonly<{ kind: 'human' | 'agent' | 'tool'; id: string }>;
  reason: string;
  references: readonly Readonly<{ kind: string; id: string }>[];
}>;
export type ZlozModellingPatchOperation = Readonly<{ id: string }> &
  (
    | Readonly<{ type: 'node.add' | 'node.replace'; node: ZlozNode }>
    | Readonly<{ type: 'node.remove'; nodeId: string }>
    | Readonly<{ type: 'edge.add' | 'edge.replace'; edge: ZlozEdge }>
    | Readonly<{ type: 'edge.remove'; edgeId: string }>
  );
/** Complete graph proposal; no merge semantics, implicit cascades, generated IDs or editor state. */
export type ZlozModellingPatch<
  V extends 1 | 2 = 1,
  S extends ZlozModellingPatchSource = ZlozModellingPatchSource,
> = Readonly<{
  format: 'foldkit-zloz-patch';
  version: V;
  id: string;
  source: S;
  provenance: ZlozModellingPatchProvenance;
  operations: readonly ZlozModellingPatchOperation[];
}>;
export type ZlozModellingPatchChange = Readonly<{ operationId: string; id: string }> &
  (
    | Readonly<{ entity: 'node'; before: ZlozNode | null; after: ZlozNode | null }>
    | Readonly<{ entity: 'edge'; before: ZlozEdge | null; after: ZlozEdge | null }>
  );
/** Conservative disclosure of overwritten/removed authored values; not consent. */
export type ZlozModellingPatchLoss = Readonly<{
  operationId: string;
  entity: 'node' | 'edge';
  id: string;
  code: 'entity-removed' | 'fields-replaced';
  fields: readonly string[];
}>;
export type ZlozModellingPatchFinding = Readonly<{
  severity: 'error' | 'warning' | 'info';
  code:
    | 'invalid-patch'
    | 'source-changed'
    | 'duplicate-target'
    | 'missing-target'
    | 'existing-target'
    | 'invalid-graph'
    | 'policy'
    | 'no-op'
    | 'authored-data-loss';
  operationId: string | null;
  /** JSON Pointer into the proposal, or /graph for final-graph validation. */
  path: string;
  message: string;
}>;
export type ZlozModellingPatchCandidate<
  V extends 1 | 2 = 1,
  S extends ZlozModellingPatchSource = ZlozModellingPatchSource,
> = Readonly<{
  patch: ZlozModellingPatch<V, S>;
  graph: ZlozGraph;
  changes: readonly ZlozModellingPatchChange[];
  losses: readonly ZlozModellingPatchLoss[];
}>;
export type ZlozModellingPatchPreview<
  V extends 1 | 2 = 1,
  S extends ZlozModellingPatchSource = ZlozModellingPatchSource,
> =
  | Readonly<{ type: 'rejected'; findings: readonly ZlozModellingPatchFinding[] }>
  | (ZlozModellingPatchCandidate<V, S> &
      Readonly<{ type: 'reviewable' | 'blocked'; findings: readonly ZlozModellingPatchFinding[] }>);
/** Pure live review policies, separate from portable proposals and future editor Apply policies. */
export type ZlozModellingPatchOptions<
  V extends 1 | 2 = 1,
  S extends ZlozModellingPatchSource = ZlozModellingPatchSource,
> = Readonly<{
  blockedReason?: string | null;
  canChange?: (change: ZlozModellingPatchChange, source: S) => string | null;
  canPatch?: (candidate: ZlozModellingPatchCandidate<V, S>) => string | null;
}>;
/** @internal Shared v1 object/text budgets; text decoders may only tighten them. */
export const modellingPatchLimits = Object.freeze({
  ...portableDataLimits,
  maxOperations: 1000,
});
/** @internal Carries the existing object-boundary path into text decoder findings. */
export class PatchValidationError extends ZlozError {
  constructor(
    message: string,
    readonly path: string,
  ) {
    super('invalid-edit', message);
  }
}
function invalid(path: string, message: string): never {
  throw new PatchValidationError(message, path);
}
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
function record(v: unknown): v is JsonObject {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function exact(v: unknown, fields: readonly string[], path: string): asserts v is JsonObject {
  if (
    !record(v) ||
    Object.keys(v).length !== fields.length ||
    !fields.every((k) => Object.hasOwn(v, k))
  )
    invalid(path, 'Expected exact modelling-patch fields.');
}
/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- This bounded dependency-free object decoder is the input boundary, not an application transition. */
/** Bounded defensive object boundary. Does not parse text or execute getters/toJSON. */
export function ownedData(input: unknown): JsonValue {
  // oxlint-disable-next-line linteffect/no-try-catch -- Keep the existing patch-specific ownership error class and messages after sharing the bounded traversal.
  try {
    return ownPortableData(input);
  } catch (error) {
    if (error instanceof PortableDataError)
      throw new PatchValidationError(error.message, error.path);
    throw error;
  }
}
/** Internal comparisons only receive key-normalized owned JSON values (or absent fields). */
function dataEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function assertSource(value: unknown): asserts value is ZlozModellingPatchSource {
  exact(value, ['modelId', 'sessionId', 'revision', 'graph'], '/source');
  if (
    !text(value.modelId) ||
    !text(value.sessionId) ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0
  )
    invalid('/source', 'Source requires model/session identity and a nonnegative safe revision.');
  if (!isGraph(value.graph)) invalid('/source/graph', 'Invalid expected source graph.');
  validateGraphForConnectionMode(value.graph, 'strict');
}
/** Validate/detach/freeze an object proposal. Invalid input throws the existing ZlozError contract. */
function assertPatch<V extends 1 | 2, S extends ZlozModellingPatchSource>(
  value: unknown,
  version: V,
  checkSource: (value: unknown) => asserts value is S,
): asserts value is ZlozModellingPatch<V, S> {
  exact(value, ['format', 'version', 'id', 'source', 'provenance', 'operations'], '');
  if (value.format !== 'foldkit-zloz-patch' || value.version !== version || !text(value.id))
    invalid('', 'Unsupported patch format/version or missing identity.');
  checkSource(value.source);
  const p = value.provenance;
  exact(p, ['actor', 'reason', 'references'], '/provenance');
  exact(p.actor, ['kind', 'id'], '/provenance/actor');
  if (
    (p.actor.kind !== 'human' && p.actor.kind !== 'agent' && p.actor.kind !== 'tool') ||
    !text(p.actor.id) ||
    !text(p.reason) ||
    !Array.isArray(p.references)
  )
    invalid('/provenance', 'Patch requires actor, reason and references.');
  for (const ref of p.references) {
    exact(ref, ['kind', 'id'], '/provenance/references');
    if (!text(ref.kind) || !text(ref.id))
      invalid('/provenance/references', 'Reference kind and ID must be nonblank.');
  }
  if (
    !Array.isArray(value.operations) ||
    value.operations.length > modellingPatchLimits.maxOperations
  )
    invalid('/operations', 'Patch requires at most 1000 operations.');
  const ids = new Set<string>();
  for (const [i, op] of value.operations.entries()) {
    const path = `/operations/${i}`;
    if (!record(op) || !text(op.id) || ids.has(op.id))
      invalid(path, 'Operation IDs must be nonblank and unique.');
    ids.add(op.id);
    switch (op.type) {
      case 'node.add':
      case 'node.replace':
        exact(op, ['id', 'type', 'node'], path);
        if (!isNode(op.node)) invalid(path + '/node', 'Invalid node payload.');
        break;
      case 'edge.add':
      case 'edge.replace':
        exact(op, ['id', 'type', 'edge'], path);
        if (!isEdge(op.edge)) invalid(path + '/edge', 'Invalid edge payload.');
        break;
      case 'node.remove':
        exact(op, ['id', 'type', 'nodeId'], path);
        if (typeof op.nodeId !== 'string' || !op.nodeId.length)
          invalid(path + '/nodeId', 'Missing node ID.');
        break;
      case 'edge.remove':
        exact(op, ['id', 'type', 'edgeId'], path);
        if (typeof op.edgeId !== 'string' || !op.edgeId.length)
          invalid(path + '/edgeId', 'Missing edge ID.');
        break;
      default:
        invalid(path + '/type', 'Unsupported modelling-patch operation.');
    }
  }
}
/** Validate, own and freeze a data-only proposal. No model mutation or IO. */
export function captureModellingPatch(input: unknown): ZlozModellingPatch {
  const value = ownedData(input);
  assertPatch(value, 1, assertSource);
  return value;
}
export type ZlozModellingPatchSourceV2 = ZlozModellingPatchSource &
  Readonly<{ connectionMode: ZlozConnectionMode }>;
export type ZlozModellingPatchV2 = ZlozModellingPatch<2, ZlozModellingPatchSourceV2>;
export type ZlozModellingPatchPreviewV2 = ZlozModellingPatchPreview<2, ZlozModellingPatchSourceV2>;
export type ZlozModellingPatchOptionsV2 = ZlozModellingPatchOptions<2, ZlozModellingPatchSourceV2>;
function assertSourceV2(value: unknown): asserts value is ZlozModellingPatchSourceV2 {
  exact(value, ['modelId', 'sessionId', 'revision', 'graph', 'connectionMode'], '/source');
  if (
    !text(value.modelId) ||
    !text(value.sessionId) ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    (value.connectionMode !== 'strict' && value.connectionMode !== 'loose') ||
    !isGraph(value.graph)
  )
    invalid('/source', 'V2 source requires model/session, safe revision, explicit mode and graph.');
  validateGraphForConnectionMode(value.graph, value.connectionMode);
}
export function captureModellingPatchV2(input: unknown): ZlozModellingPatchV2 {
  const value = ownedData(input);
  assertPatch(value, 2, assertSourceV2);
  return value;
}
/* oxlint-enable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof */
const finding = (
  code: ZlozModellingPatchFinding['code'],
  message: string,
  path = '',
  operationId: string | null = null,
  severity: ZlozModellingPatchFinding['severity'] = 'error',
): ZlozModellingPatchFinding => Object.freeze({ code, message, path, operationId, severity });
const rejected = (
  findings: readonly ZlozModellingPatchFinding[],
): Extract<ZlozModellingPatchPreview, { type: 'rejected' }> =>
  Object.freeze({ type: 'rejected', findings: Object.freeze([...findings]) });
const denial = (reason: string | null | undefined) =>
  reason == null ? null : reason.trim() || 'Modelling patch is protected.';
/** Rebuild a detached proposal from current source. Never edits, imports, commits or grants Apply authority. */
function runModellingPatch<V extends 1 | 2, S extends ZlozModellingPatchSource>(
  source: S,
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Shared decoder boundary owns and validates external proposals before domain use.
  input: unknown,
  options: ZlozModellingPatchOptions<V, S>,
  checkSource: (value: unknown) => asserts value is S,
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Shared decoder boundary owns and validates external proposals before domain use.
  capture: (value: unknown) => ZlozModellingPatch<V, S>,
  modeOf: (source: S) => ZlozConnectionMode,
): ZlozModellingPatchPreview<V, S> {
  const current = ownedData(source);
  checkSource(current);
  const mode = modeOf(current);
  let patch: ZlozModellingPatch<V, S>;
  // oxlint-disable-next-line linteffect/no-try-catch -- Pure dependency-free proposal boundary turns malformed input into review findings.
  try {
    patch = capture(input);
  } catch (error) {
    if (!(error instanceof ZlozError)) throw error;
    return rejected([
      finding(
        'invalid-patch',
        error.message,
        error instanceof PatchValidationError ? error.path : '',
      ),
    ]);
  }
  if (!dataEqual(current, patch.source))
    return rejected([
      finding(
        'source-changed',
        'Model, session, revision or authored graph differs from the reviewed source.',
        '/source',
      ),
    ]);
  const nodes = new Map(current.graph.nodes.map((n) => [n.id, n])),
    edges = new Map(current.graph.edges.map((e) => [e.id, e]));
  const findings: ZlozModellingPatchFinding[] = [],
    changes: ZlozModellingPatchChange[] = [],
    losses: ZlozModellingPatchLoss[] = [],
    targets = new Set<string>();
  for (const [i, op] of patch.operations.entries()) {
    const entity = 'node' in op || 'nodeId' in op ? 'node' : 'edge';
    const id =
      'node' in op
        ? op.node.id
        : 'nodeId' in op
          ? op.nodeId
          : 'edge' in op
            ? op.edge.id
            : op.edgeId;
    const key = JSON.stringify([entity, id]),
      path = `/operations/${i}`;
    if (targets.has(key)) {
      findings.push(
        finding(
          'duplicate-target',
          'Each entity may be targeted only once per patch.',
          path,
          op.id,
        ),
      );
      continue;
    }
    targets.add(key);
    const before = entity === 'node' ? nodes.get(id) : edges.get(id);
    const adding = op.type === 'node.add' || op.type === 'edge.add';
    if (adding ? before !== undefined : before === undefined) {
      findings.push(
        finding(
          adding ? 'existing-target' : 'missing-target',
          adding
            ? 'Add requires an absent target ID.'
            : 'Replace/remove requires an existing target ID.',
          path,
          op.id,
        ),
      );
      continue;
    }
    let change: ZlozModellingPatchChange;
    if ('node' in op) {
      nodes.set(id, op.node);
      change = {
        operationId: op.id,
        entity: 'node',
        id,
        before: current.graph.nodes.find((n) => n.id === id) ?? null,
        after: op.node,
      };
    } else if ('nodeId' in op) {
      nodes.delete(id);
      change = {
        operationId: op.id,
        entity: 'node',
        id,
        before: current.graph.nodes.find((n) => n.id === id) ?? null,
        after: null,
      };
    } else if ('edge' in op) {
      edges.set(id, op.edge);
      change = {
        operationId: op.id,
        entity: 'edge',
        id,
        before: current.graph.edges.find((e) => e.id === id) ?? null,
        after: op.edge,
      };
    } else {
      edges.delete(id);
      change = {
        operationId: op.id,
        entity: 'edge',
        id,
        before: current.graph.edges.find((e) => e.id === id) ?? null,
        after: null,
      };
    }
    if (dataEqual(change.before, change.after)) {
      findings.push(
        finding('no-op', 'Replacement leaves authored data unchanged.', path, op.id, 'info'),
      );
      continue;
    }
    changes.push(Object.freeze(change));
    if (change.before) {
      const old = Object.entries(change.before),
        after = change.after;
      const nextFields = new Map(Object.entries(after ?? {}));
      const fields = old
        .filter(([key, value]) => after === null || !dataEqual(value, nextFields.get(key)))
        .map(([key]) => key)
        .sort();
      if (fields.length) {
        losses.push(
          Object.freeze({
            operationId: op.id,
            entity,
            id,
            code: after === null ? 'entity-removed' : 'fields-replaced',
            fields: Object.freeze(fields),
          }),
        );
        findings.push(
          finding(
            'authored-data-loss',
            after === null
              ? 'Authored entity will be removed.'
              : 'Previously authored fields will be replaced or removed: ' + fields.join(', '),
            path,
            op.id,
            'warning',
          ),
        );
      }
    }
  }
  if (findings.some((f) => f.severity === 'error')) return rejected(findings);
  const graph: ZlozGraph = Object.freeze({
    ...current.graph,
    nodes: Object.freeze([...nodes.values()]),
    edges: Object.freeze([...edges.values()]),
  });
  // oxlint-disable-next-line linteffect/no-try-catch -- Final combined graph invariants become findings; no partial graph is returned.
  try {
    validateGraphForConnectionMode(graph, mode);
  } catch (error) {
    if (!(error instanceof ZlozError)) throw error;
    return rejected([...findings, finding('invalid-graph', error.message, '/graph')]);
  }
  if (changes.length === 0 && !findings.some((f) => f.code === 'no-op'))
    findings.push(finding('no-op', 'Patch leaves the authored graph unchanged.', '', null, 'info'));
  const candidate: ZlozModellingPatchCandidate<V, S> = Object.freeze({
    patch,
    graph,
    changes: Object.freeze(changes),
    losses: Object.freeze(losses),
  });
  const hostReason = denial(options.blockedReason);
  if (hostReason !== null) findings.push(finding('policy', hostReason));
  for (const change of changes) {
    const reason = denial(options.canChange?.(change, current));
    if (reason !== null)
      findings.push(finding('policy', reason, '/operations', change.operationId));
  }
  const reason = denial(options.canPatch?.(candidate));
  if (reason !== null) findings.push(finding('policy', reason));
  return Object.freeze({
    ...candidate,
    type: findings.some((f) => f.severity === 'error') ? 'blocked' : 'reviewable',
    findings: Object.freeze(findings),
  });
}

/** Legacy strict proposal contract, unchanged wire version. */
export function dryRunModellingPatch(
  source: ZlozModellingPatchSource,
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Shared decoder boundary owns and validates external proposals before domain use.
  input: unknown,
  options: ZlozModellingPatchOptions = {},
): ZlozModellingPatchPreview {
  return runModellingPatch(
    source,
    input,
    options,
    assertSource,
    captureModellingPatch,
    () => 'strict',
  );
}
/** Native v2 source mode is pinned; operations never change mode or rewrite endpoint kinds. */
export function dryRunModellingPatchV2(
  source: ZlozModellingPatchSourceV2,
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Shared decoder boundary owns and validates external proposals before domain use.
  input: unknown,
  options: ZlozModellingPatchOptionsV2 = {},
): ZlozModellingPatchPreviewV2 {
  return runModellingPatch(
    source,
    input,
    options,
    assertSourceV2,
    captureModellingPatchV2,
    (current) => current.connectionMode,
  );
}
