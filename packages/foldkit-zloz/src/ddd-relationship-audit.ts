import { copyEdgeArchitecture, type DddEdgeArchitecture } from './architecture';
import {
  checkedDddRelationshipRules,
  dddRelationshipKey,
  resolveDddRelationship,
  type ZlozDddRelationshipDecision,
  type ZlozDddRelationshipOptions,
} from './ddd-relationships';
import { validateGraph } from './graph';
import type { Endpoint, ZlozEdge, ZlozGraph } from './types';

export type ZlozDddRelationshipAuditCode =
  | 'compatible'
  | 'unrelated'
  | Extract<ZlozDddRelationshipDecision, { type: 'blocked' }>['code'];
/** Detached report data; unrelated edges never acquire inferred DDD meaning. */
export type ZlozDddRelationshipAuditEntry = Readonly<{
  edgeId: string;
  edgeLabel: string | null;
  source: Endpoint;
  target: Endpoint;
  message: string;
}> &
  (
    | Readonly<{
        status: 'typed';
        code: 'compatible';
        architecture: DddEdgeArchitecture;
        relationshipKey: string;
      }>
    | Readonly<{
        status: 'blocked';
        code: Extract<ZlozDddRelationshipDecision, { type: 'blocked' }>['code'];
        architecture: DddEdgeArchitecture;
        relationshipKey: string;
      }>
    | Readonly<{
        status: 'unrelated';
        code: 'unrelated';
        architecture: null;
        relationshipKey: null;
      }>
  );
export type ZlozDddRelationshipAudit = Readonly<{
  /** Zero blocked DDD relationships under this catalogue; not universal correctness or full coverage. */
  status: 'compatible' | 'incompatible';
  summary: Readonly<{ edges: number; typed: number; unrelated: number; blocked: number }>;
  entries: readonly ZlozDddRelationshipAuditEntry[];
}>;
/** ADR 0078: pure authored-DDD audit, without graph edits, inference, IO or UI peers.
 * Validates the typed graph and convention catalogue; malformed syntax throws rather than becoming a finding.
 * Entries use UTF-16 edge-ID order, independent of locale and graph-array ordering.
 */
export function auditDddGraphRelationships(
  graph: ZlozGraph,
  options: ZlozDddRelationshipOptions = {},
): ZlozDddRelationshipAudit {
  checkedDddRelationshipRules(options);
  function entry(edge: ZlozEdge): ZlozDddRelationshipAuditEntry {
    const base = {
      edgeId: edge.id,
      edgeLabel: edge.label ?? null,
      source: { node: edge.source.node, port: edge.source.port },
      target: { node: edge.target.node, port: edge.target.port },
    };
    if (edge.architecture?.family !== 'ddd')
      return {
        ...base,
        status: 'unrelated',
        code: 'unrelated',
        architecture: null,
        relationshipKey: null,
        message: edge.architecture
          ? 'This connection carries another architecture family, outside the DDD audit.'
          : 'This untyped connection has no declared DDD meaning.',
      };
    const architecture = copyEdgeArchitecture(edge.architecture);
    const result = resolveDddRelationship(
      graph,
      {
        sourceNodeId: edge.source.node,
        targetNodeId: edge.target.node,
        architecture,
      },
      options,
    );
    const meaning = { ...base, architecture, relationshipKey: dddRelationshipKey(architecture) };
    return result.type === 'allowed'
      ? {
          ...meaning,
          status: 'typed',
          code: 'compatible',
          message: `Typed DDD relationship: ${result.rule.label}.`,
        }
      : { ...meaning, status: 'blocked', code: result.code, message: result.reason };
  }
  const entries = [...graph.edges]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(entry);
  const summary = entries.reduce(
    (counts, item) => ({ ...counts, [item.status]: counts[item.status] + 1 }),
    { edges: entries.length, typed: 0, unrelated: 0, blocked: 0 },
  );
  return { status: summary.blocked === 0 ? 'compatible' : 'incompatible', summary, entries };
}

/** Legacy graph boundary stays strict. */
export function auditDddRelationships(
  graph: ZlozGraph,
  options: ZlozDddRelationshipOptions = {},
): ZlozDddRelationshipAudit {
  validateGraph(graph);
  return auditDddGraphRelationships(graph, options);
}
