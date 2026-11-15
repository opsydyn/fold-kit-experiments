/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- These versioned decoder helpers inspect owned data only; external values cross bounded ownership before field validation. */
import { parseConnectionDocument, type ZlozConnectionDocument } from './connection-document';
import type { ZlozConnectionMode } from './connection-mode';
import {
  assertDocumentViewport,
  isGraph,
  validateGraphForConnectionMode,
  validateGroupGraphV3,
  ZlozError,
} from './graph';
import {
  ownPortableData,
  PortableDataError,
  portableDataLimits,
  type PortableDataLimits,
} from './portable-data';
import { preflightPortableJson, PortableJsonError } from './portable-json';
import type { JsonValue, JsonObject, ZlozGraph, Viewport } from './types';

/** Headless v3 graph structure. Interpret only within an explicit group document capability. */
export type ZlozGroupGraphV3 = ZlozGraph;
export type ZlozGroupCapabilitiesV3 = Readonly<{ groupPorts: boolean }>;
/** Standalone authored data only; editor initialization is explicit and model/archive authority is never implied. */
export type ZlozGroupDocumentV3 = Readonly<{
  version: 3;
  coordinateSpace: 'world';
  connectionMode: ZlozConnectionMode;
  capabilities: ZlozGroupCapabilitiesV3;
  graph: ZlozGroupGraphV3;
  viewport?: Viewport;
}>;
export const groupDocumentV3Limits = portableDataLimits;
/** Limits may only tighten the built-in bounded text/ownership envelope. */
export type ZlozGroupDocumentV3Options = Readonly<{
  maxCharacters?: number;
  maxDepth?: number;
  maxValues?: number;
}>;
export type ZlozGroupDocumentV3Failure = Readonly<{
  status: 'rejected';
  code:
    | 'invalid-json'
    | 'limit-exceeded'
    | 'invalid-document'
    | 'unsupported-version'
    | 'unsupported-capability'
    | 'unsupported-coordinates';
  reason: string;
  path: string;
}>;
export type ZlozGroupDocumentV3ParseResult =
  | Readonly<{ status: 'parsed'; value: ZlozGroupDocumentV3 }>
  | ZlozGroupDocumentV3Failure;
export type ZlozGroupDowngradeFindingV3 = Readonly<{
  code: 'group-ports-not-representable';
  nodeId: string;
  path: string;
  reason: string;
}>;
export type ZlozGroupDocumentDowngradePlanV3 =
  | Readonly<{
      type: 'blocked';
      source: ZlozGroupDocumentV3;
      findings: readonly ZlozGroupDowngradeFindingV3[];
      reason: string;
    }>
  | Readonly<{
      type: 'reviewable';
      source: ZlozGroupDocumentV3;
      document: ZlozConnectionDocument;
      findings: readonly ZlozGroupDowngradeFindingV3[];
      losses: readonly Readonly<{ code: 'group-capability-removed'; reason: string }>[];
    }>;
class GroupDocumentError extends ZlozError {
  constructor(
    readonly reasonCode: ZlozGroupDocumentV3Failure['code'],
    message: string,
    readonly path: string,
  ) {
    super('invalid-graph', message);
  }
}
const record = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
function fail(code: ZlozGroupDocumentV3Failure['code'], path: string, reason: string): never {
  throw new GroupDocumentError(code, reason, path);
}
function fields(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): asserts value is JsonObject {
  if (!record(value) || required.some((k) => !Object.hasOwn(value, k)))
    fail('invalid-document', path, 'Missing required structural fields.');
  const extra = Object.keys(value).find((k) => !required.includes(k) && !optional.includes(k));
  if (extra !== undefined)
    fail(
      'invalid-document',
      `${path}/${extra.replaceAll('~', '~0').replaceAll('/', '~1')}`,
      'Unsupported structural field; use data for extension values.',
    );
}
function limitsFor(options: ZlozGroupDocumentV3Options): PortableDataLimits {
  const value = ownPortableData(options, portableDataLimits, 'Group limits');
  fields(value, [], ['maxCharacters', 'maxDepth', 'maxValues'], '/limits');
  const entry = (key: keyof PortableDataLimits) => {
    const limit = Object.hasOwn(value, key) ? value[key] : portableDataLimits[key];
    if (
      typeof limit !== 'number' ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > portableDataLimits[key]
    )
      throw new ZlozError(
        'invalid-edit',
        `${key} must be a positive integer no greater than ${portableDataLimits[key]}.`,
      );
    return limit;
  };
  return {
    maxCharacters: entry('maxCharacters'),
    maxDepth: entry('maxDepth'),
    maxValues: entry('maxValues'),
  };
}
function exactGraphFields(graph: JsonObject): void {
  fields(graph, ['nodes', 'edges'], [], '/graph');
  if (!isGraph(graph))
    fail(
      'invalid-document',
      '/graph',
      'Expected finite node geometry, valid ports, endpoints and data-only metadata.',
    );
  graph.nodes.forEach((node, i) => {
    const path = `/graph/nodes/${i}`;
    fields(
      node,
      ['id', 'label', 'position', 'size', 'ports'],
      [
        'kind',
        'parentId',
        'extent',
        'expandParent',
        'resizeLimits',
        'keepAspectRatio',
        'data',
        'architecture',
        'appearance',
      ],
      path,
    );
    fields(node.position, ['x', 'y'], [], `${path}/position`);
    fields(node.size, ['width', 'height'], [], `${path}/size`);
    if (node.resizeLimits !== undefined)
      fields(
        node.resizeLimits,
        [],
        ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'],
        `${path}/resizeLimits`,
      );
    if (node.appearance !== undefined) fields(node.appearance, ['shape'], [], `${path}/appearance`);
    node.ports.forEach((port, j) => {
      fields(port, ['id', 'kind', 'side'], ['offset', 'anchor', 'label'], `${path}/ports/${j}`);
      if (port.anchor !== undefined)
        fields(port.anchor, ['x', 'y'], [], `${path}/ports/${j}/anchor`);
    });
  });
  graph.edges.forEach((edge, i) => {
    const path = `/graph/edges/${i}`;
    fields(
      edge,
      ['id', 'source', 'target'],
      ['label', 'data', 'architecture', 'waypoints', 'pathStyle'],
      path,
    );
    fields(edge.source, ['node', 'port'], [], `${path}/source`);
    fields(edge.target, ['node', 'port'], [], `${path}/target`);
    // Waypoints and architecture descriptors already reject unknown structural fields in their shared guards.
  });
}
function checkedGraph(
  value: JsonValue | undefined,
  mode: ZlozConnectionMode,
  groupPorts: boolean,
): ZlozGroupGraphV3 {
  fields(value, ['nodes', 'edges'], [], '/graph');
  exactGraphFields(value);
  if (!isGraph(value)) fail('invalid-document', '/graph', 'Invalid group graph.');
  // oxlint-disable-next-line linteffect/no-try-catch -- Normalize only the shared validator's known graph rejection, leaving implementation defects caller-visible.
  try {
    validateGroupGraphV3(value, mode, groupPorts);
  } catch (error) {
    if (error instanceof ZlozError) fail('invalid-document', '/graph', error.message);
    throw error;
  }
  return value;
}
function camera(value: JsonValue | undefined): Viewport {
  fields(value, ['x', 'y', 'zoom'], [], '/viewport');
  // oxlint-disable-next-line linteffect/no-try-catch -- Preserve the viewport path while translating a known camera validation error.
  try {
    assertDocumentViewport(value);
  } catch (error) {
    if (error instanceof ZlozError) fail('invalid-document', '/viewport', error.message);
    throw error;
  }
  return value;
}
function captureOwned(value: JsonValue): ZlozGroupDocumentV3 {
  if (!record(value)) fail('invalid-document', '', 'Expected a v3 group document object.');
  if (
    typeof value.version !== 'number' ||
    !Number.isSafeInteger(value.version) ||
    value.version < 1
  )
    fail('invalid-document', '/version', 'Expected a positive integer version.');
  if (value.version !== 3)
    fail('unsupported-version', '/version', 'Expected standalone group document version 3.');
  fields(
    value,
    ['version', 'coordinateSpace', 'connectionMode', 'capabilities', 'graph'],
    ['viewport'],
    '',
  );
  if (typeof value.coordinateSpace !== 'string')
    fail('invalid-document', '/coordinateSpace', 'Expected a coordinate convention string.');
  if (value.coordinateSpace !== 'world')
    fail(
      'unsupported-coordinates',
      '/coordinateSpace',
      'Only explicit world coordinates are supported.',
    );
  if (value.connectionMode !== 'strict' && value.connectionMode !== 'loose')
    fail(
      'invalid-document',
      '/connectionMode',
      'Expected explicit strict or loose connection mode.',
    );
  if (!record(value.capabilities))
    fail('invalid-document', '/capabilities', 'Expected explicit group capability object.');
  if (Object.keys(value.capabilities).some((k) => k !== 'groupPorts'))
    fail('unsupported-capability', '/capabilities', 'Unknown group capability.');
  fields(value.capabilities, ['groupPorts'], [], '/capabilities');
  if (typeof value.capabilities.groupPorts !== 'boolean')
    fail(
      'invalid-document',
      '/capabilities/groupPorts',
      'Expected a boolean group port capability.',
    );
  const graph = checkedGraph(value.graph, value.connectionMode, value.capabilities.groupPorts);
  const base: Omit<ZlozGroupDocumentV3, 'viewport'> = {
    version: 3,
    coordinateSpace: 'world' as const,
    connectionMode: value.connectionMode,
    capabilities: Object.freeze({ groupPorts: value.capabilities.groupPorts }),
    graph,
  };
  return Object.freeze(
    value.viewport === undefined ? base : { ...base, viewport: camera(value.viewport) },
  );
}
function captureBounded(input: unknown, limits: PortableDataLimits): ZlozGroupDocumentV3 {
  const owned = ownPortableData(input, limits, 'Group document');
  const encoded = JSON.stringify(owned);
  if (encoded.length > limits.maxCharacters)
    fail('limit-exceeded', '', 'Group document exceeds its canonical text character budget.');
  // Match the existing codec convention: publish native JSON number canonicalization, not an in-memory value that reopens differently.
  return captureOwned(ownPortableData(JSON.parse(encoded), limits, 'Group document'));
}
/** Own/validate untrusted construction data without executing getters/toJSON. No legacy behavior is widened. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Explicit bounded document ownership boundary.
export function captureGroupDocumentV3(
  input: unknown,
  options: ZlozGroupDocumentV3Options = {},
): ZlozGroupDocumentV3 {
  return captureBounded(input, limitsFor(options));
}
/** Revalidate a complete explicit capability envelope; a valid shape alone is insufficient. */
export function validateGroupDocumentV3(
  document: ZlozGroupDocumentV3,
  options: ZlozGroupDocumentV3Options = {},
): void {
  captureGroupDocumentV3(document, options);
}
/** Tight budgets and duplicate/depth preflight run before native JSON parsing. Invalid options throw; input errors are decisions. */
export function parseGroupDocumentV3(
  text: string,
  options: ZlozGroupDocumentV3Options = {},
): ZlozGroupDocumentV3ParseResult {
  const limits = limitsFor(options);
  if (text.length > limits.maxCharacters)
    return {
      status: 'rejected',
      code: 'limit-exceeded',
      reason: 'Group document exceeds its text character budget.',
      path: '',
    };
  // oxlint-disable-next-line linteffect/no-try-catch -- The input boundary exposes typed syntax/ownership/graph failures as data, never swallowing implementation defects.
  try {
    preflightPortableJson(text, limits.maxDepth, limits.maxValues, 'Group document');
    return { status: 'parsed', value: captureBounded(JSON.parse(text), limits) };
  } catch (error) {
    if (error instanceof GroupDocumentError)
      return {
        status: 'rejected',
        code: error.reasonCode,
        reason: error.message,
        path: error.path,
      };
    if (error instanceof PortableDataError)
      return {
        status: 'rejected',
        code: error.reasonCode === 'limit-exceeded' ? 'limit-exceeded' : 'invalid-document',
        reason: error.message,
        path: error.path,
      };
    if (error instanceof PortableJsonError)
      return {
        status: 'rejected',
        code: error.code === 'invalid-data' ? 'invalid-document' : error.code,
        reason: error.message,
        path: error.path,
      };
    if (error instanceof SyntaxError)
      return {
        status: 'rejected',
        code: 'invalid-json',
        reason: 'Malformed group-document JSON.',
        path: '',
      };
    if (error instanceof ZlozError)
      return { status: 'rejected', code: 'invalid-document', reason: error.message, path: '' };
    throw error;
  }
}
/** Canonical JSON must fit the same reopening budgets; validates typed records again before encoding. */
export function serializeGroupDocumentV3(
  document: ZlozGroupDocumentV3,
  options: ZlozGroupDocumentV3Options = {},
): string {
  return JSON.stringify(captureGroupDocumentV3(document, options));
}
/** Explicit standalone v1 graph/snapshot or v2 connection upgrade, never a model/archive migration. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Strict detached legacy input ownership/validation precedes conversion.
export function upgradeGroupDocumentV3(
  input: unknown,
  options: ZlozGroupDocumentV3Options = {},
): ZlozGroupDocumentV3 {
  const limits = limitsFor(options),
    value = ownPortableData(input, limits, 'Group upgrade');
  if (!record(value))
    fail('invalid-document', '', 'Expected a standalone legacy snapshot or connection document.');
  const v2 = value.version === 2;
  if (Object.hasOwn(value, 'version') && value.version !== 1 && !v2)
    fail('unsupported-version', '/version', 'Upgrade accepts standalone v1/v2 only.');
  fields(
    value,
    ['graph', ...(v2 ? ['version', 'connectionMode'] : [])],
    ['viewport', ...(!v2 ? ['version'] : [])],
    '',
  );
  const mode = v2 ? value.connectionMode : 'strict';
  if (mode !== 'strict' && mode !== 'loose')
    fail('invalid-document', '/connectionMode', 'Invalid legacy connection mode.');
  const graph = checkedGraph(value.graph, mode, false);
  validateGraphForConnectionMode(graph, mode);
  const base = {
    version: 3,
    coordinateSpace: 'world',
    connectionMode: mode,
    capabilities: { groupPorts: false },
    graph,
  };
  return captureBounded(
    value.viewport === undefined ? base : { ...base, viewport: camera(value.viewport) },
    limits,
  );
}
/** Review only. A ported group always blocks, even without edges; future authoring capability removal is disclosed. */
export function planGroupDocumentDowngradeV3(
  document: ZlozGroupDocumentV3,
): ZlozGroupDocumentDowngradePlanV3 {
  const source = captureGroupDocumentV3(document);
  const findings = Object.freeze(
    source.graph.nodes.flatMap((node, i) =>
      node.kind === 'group' && node.ports.length > 0
        ? [
            Object.freeze({
              code: 'group-ports-not-representable' as const,
              nodeId: node.id,
              path: `/graph/nodes/${i}/ports`,
              reason:
                'V2 cannot represent authored group ports. No target or endpoint rewrite is available.',
            }),
          ]
        : [],
    ),
  );
  if (findings.length)
    return Object.freeze({
      type: 'blocked',
      source,
      findings,
      reason:
        'Remove no data implicitly: ported groups require a separately reviewed modelling change before downgrade.',
    });
  const base = { version: 2, connectionMode: source.connectionMode, graph: source.graph };
  const target = parseConnectionDocument(
    JSON.stringify(source.viewport === undefined ? base : { ...base, viewport: source.viewport }),
  );
  const losses = Object.freeze(
    source.capabilities.groupPorts
      ? [
          Object.freeze({
            code: 'group-capability-removed' as const,
            reason:
              'V2 disables future authored group ports. Review this authoring capability change before saving.',
          }),
        ]
      : [],
  );
  return Object.freeze({ type: 'reviewable', source, document: target, findings, losses });
}
