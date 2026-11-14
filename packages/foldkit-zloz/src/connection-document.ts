import { resolveConnectionPortPair, type ZlozConnectionMode } from './connection-mode';
import {
  assertDocumentViewport,
  isGraph,
  validateGraphForConnectionMode,
  ZlozError,
} from './graph';
import type { ZlozGraph, ZlozSnapshot, Viewport } from './types';

/** Standalone authored v2 data, not an EditorState or a model/edition/receipt archive. */
export type ZlozConnectionDocument = Readonly<{
  version: 2;
  connectionMode: ZlozConnectionMode;
  graph: ZlozGraph;
  viewport?: Viewport;
}>;
/** Unversioned construction input. An explicit existing mode is preserved; absence defaults to strict. */
export type ZlozConnectionDocumentInput = ZlozSnapshot &
  Readonly<{ connectionMode?: ZlozConnectionMode }>;
export type ZlozConnectionDowngradeLoss = Readonly<{
  code: 'loose-mode-removed';
  reason: string;
}>;
/** Review data only: no file output, port rewrites, mode edit, current consent or Apply permission. */
export type ZlozConnectionDowngradePlan =
  | Readonly<{
      type: 'blocked';
      source: ZlozConnectionDocument;
      incompatibleEdges: readonly string[];
      reason: string;
    }>
  | Readonly<{
      type: 'reviewable';
      source: ZlozConnectionDocument;
      snapshot: ZlozSnapshot;
      losses: readonly ZlozConnectionDowngradeLoss[];
    }>;

type DocumentFields = Readonly<{
  version?: unknown;
  connectionMode?: unknown;
  graph?: unknown;
  viewport?: unknown;
}>;
function record(value: unknown): value is DocumentFields {
  return (
    typeof value === 'object' &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}
function fields(value: DocumentFields, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function freeze<T>(value: T): T {
  if ((record(value) || Array.isArray(value)) && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
/** @internal Shared v2 snapshot validator for canonical model/edition boundaries. */
export function assertConnectionDocument(value: unknown): asserts value is ZlozConnectionDocument {
  if (
    !record(value) ||
    !fields(value, ['version', 'connectionMode', 'graph', 'viewport']) ||
    value.version !== 2 ||
    (value.connectionMode !== 'strict' && value.connectionMode !== 'loose') ||
    !isGraph(value.graph) ||
    !Object.keys(value.graph).every((key) => ['nodes', 'edges'].includes(key))
  )
    throw new ZlozError(
      'invalid-graph',
      'Expected an explicit v2 strict or loose connection document',
    );
  validateGraphForConnectionMode(value.graph, value.connectionMode);
  if ('viewport' in value) {
    assertDocumentViewport(value.viewport);
    if (!Object.keys(value.viewport).every((key) => ['x', 'y', 'zoom'].includes(key)))
      throw new ZlozError('invalid-graph', 'Unsupported v2 viewport field');
  }
}
/** Strict v2-only boundary. Upgrade v1 explicitly with captureConnectionDocument(parseSnapshot(text)). */
export function parseConnectionDocument(text: string): ZlozConnectionDocument {
  const value: unknown = JSON.parse(text);
  assertConnectionDocument(value);
  return freeze(value);
}
/** Validate before detaching; no mode is inferred from edge kinds. Default construction is strict. */
export function captureConnectionDocument({
  graph,
  viewport,
  connectionMode = 'strict',
}: ZlozConnectionDocumentInput): ZlozConnectionDocument {
  validateGraphForConnectionMode(graph, connectionMode);
  const base = { version: 2 as const, connectionMode, graph };
  if (viewport === undefined) return parseConnectionDocument(JSON.stringify(base));
  assertDocumentViewport(viewport);
  return parseConnectionDocument(JSON.stringify({ ...base, viewport }));
}
/** Revalidate a typed record, including the explicit envelope, before emitting v2 JSON. */
export function serializeConnectionDocument(document: ZlozConnectionDocument): string {
  // Validate authored JSON values before encoding, so nonfinite data cannot turn into null.
  assertConnectionDocument(document);
  return JSON.stringify(parseConnectionDocument(JSON.stringify(document)));
}
/** A v1 downgrade is a separate review. Never manufactures ports or silently changes their kinds. */
export function planConnectionDocumentDowngrade(
  document: ZlozConnectionDocument,
): ZlozConnectionDowngradePlan {
  const source = parseConnectionDocument(serializeConnectionDocument(document));
  const nodes = new Map(source.graph.nodes.map((node) => [node.id, node]));
  const incompatibleEdges = source.graph.edges
    .filter(
      (edge) =>
        resolveConnectionPortPair({
          sourceKind: nodes
            .get(edge.source.node)
            ?.ports.find((port) => port.id === edge.source.port)?.kind,
          targetKind: nodes
            .get(edge.target.node)
            ?.ports.find((port) => port.id === edge.target.port)?.kind,
        }).type === 'incompatible',
    )
    .map((edge) => edge.id)
    .sort();
  if (incompatibleEdges.length)
    return freeze({
      type: 'blocked',
      source,
      incompatibleEdges,
      reason:
        'These ordered connections cannot be represented by v1 strict ports. No downgrade snapshot is available.',
    });
  const snapshot: ZlozSnapshot =
    source.viewport === undefined
      ? { graph: source.graph }
      : { graph: source.graph, viewport: source.viewport };
  const losses: readonly ZlozConnectionDowngradeLoss[] =
    source.connectionMode === 'loose'
      ? [
          {
            code: 'loose-mode-removed',
            reason:
              'A v1 snapshot does not retain loose connection semantics. Review this change to future authoring before explicitly saving the strict snapshot.',
          },
        ]
      : [];
  return freeze({ type: 'reviewable', source, snapshot, losses });
}
