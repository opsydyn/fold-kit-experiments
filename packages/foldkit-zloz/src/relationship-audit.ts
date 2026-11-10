import type { EventStormingEdgeArchitecture } from './architecture';
import {
  checkedEventStormingRelationshipRules,
  eventStormingRelationshipKey,
  resolveEventStormingRelationship,
  type ZlozEventStormingRelationshipDecision,
  type ZlozEventStormingRelationshipOptions,
} from './event-storming-relationships';
import type { Endpoint, ZlozGraph, ZlozEdge } from './types';
export type ZlozRelationshipAuditCode =
  | 'compatible'
  | 'unrelated'
  | Extract<ZlozEventStormingRelationshipDecision, { type: 'blocked' }>['code'];
type CompatibleAuditMeaning = Readonly<{
  code: 'compatible';
  architecture: EventStormingEdgeArchitecture;
  relationshipKey: string;
}>;
/** Every authored edge is represented; host data and callback functions are never copied into reports. */
export type ZlozEventStormingRelationshipAuditEntry = Readonly<
  {
    edgeId: string;
    edgeLabel: string | null;
    source: Endpoint;
    target: Endpoint;
    message: string;
  } & (
    | (Readonly<{ status: 'typed' }> & CompatibleAuditMeaning)
    | (Readonly<{ status: 'inferred' }> & CompatibleAuditMeaning)
    | { status: 'unrelated'; code: 'unrelated'; architecture: null; relationshipKey: null }
    | {
        status: 'blocked';
        code: Extract<ZlozEventStormingRelationshipDecision, { type: 'blocked' }>['code'];
        architecture: EventStormingEdgeArchitecture | null;
        relationshipKey: string | null;
      }
  )
>;
export type ZlozEventStormingRelationshipAudit = Readonly<{
  status: 'compatible' | 'incompatible';
  summary: Readonly<{
    edges: number;
    typed: number;
    inferred: number;
    unrelated: number;
    blocked: number;
  }>;
  entries: readonly ZlozEventStormingRelationshipAuditEntry[];
}>;
/** Read-only semantic audit. Structural document validation remains the graph codec's responsibility.
 * Entry order is canonical UTF-16 edge-ID order, independent of locale or graph-array ordering.
 * Compatible means no blocked relationships under this convention; it does not imply all edges are typed. */
export function auditEventStormingRelationships(
  graph: ZlozGraph,
  options: ZlozEventStormingRelationshipOptions = {},
): ZlozEventStormingRelationshipAudit {
  checkedEventStormingRelationshipRules(options);
  function entry(edge: ZlozEdge): ZlozEventStormingRelationshipAuditEntry {
    const result = resolveEventStormingRelationship(graph, edge, options);
    const base = {
      edgeId: edge.id,
      edgeLabel: edge.label ?? null,
      source: { node: edge.source.node, port: edge.source.port },
      target: { node: edge.target.node, port: edge.target.port },
    };
    if (result.type === 'allowed') {
      const meaning = {
        ...base,
        code: 'compatible' as const,
        message: `${result.inferred ? 'Inferred' : 'Typed'} relationship: ${result.rule.label}.`,
        architecture: { ...result.architecture },
        relationshipKey: eventStormingRelationshipKey(result.architecture),
      };
      return result.inferred ? { ...meaning, status: 'inferred' } : { ...meaning, status: 'typed' };
    }
    if (result.type === 'blocked')
      return {
        ...base,
        status: 'blocked',
        code: result.code,
        message: result.reason,
        architecture: edge.architecture ? { ...edge.architecture } : null,
        relationshipKey: edge.architecture ? eventStormingRelationshipKey(edge.architecture) : null,
      };
    return {
      ...base,
      status: 'unrelated',
      code: 'unrelated',
      message: 'This untyped connection has no event-storming meaning.',
      architecture: null,
      relationshipKey: null,
    };
  }
  const entries = [...graph.edges]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(entry);
  const summary = entries.reduce(
    (counts, entry) => ({ ...counts, [entry.status]: counts[entry.status] + 1 }),
    { edges: entries.length, typed: 0, inferred: 0, unrelated: 0, blocked: 0 },
  );
  return { status: summary.blocked === 0 ? 'compatible' : 'incompatible', summary, entries };
}
