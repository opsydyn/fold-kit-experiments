import {
  revealableNodes,
  revealableEdges,
  type EditorState,
  type EditorEvent,
} from '@opsydyn/foldkit-zloz';

import { freezeData, serializeAlchemyDescriptor } from './descriptor';
import type { AlchemyFinding, AlchemyProjection } from './types';
/** Host scope identifies this review instance, not the source author's identity. */
export type AlchemyFindingNavigationOptions = Readonly<{
  scope: string;
  blockedReason?: string | null;
}>;
export type AlchemyFindingRevealRequest = Readonly<{
  scope: string;
  sourceKey: string;
  code: string;
  sourceId: string | null;
}>;
export type AlchemyFindingTarget = Readonly<{ entity: 'node' | 'edge'; id: string }>;
export type AlchemyFindingNavigationEvent = Extract<
  EditorEvent,
  {
    type:
      | 'SelectionCleared'
      | 'NodeSelected'
      | 'EdgeSelected'
      | 'NodeRevealRequested'
      | 'EdgeRevealRequested';
  }
>;
export type AlchemyFindingNavigationEntry = Readonly<{
  finding: AlchemyFinding;
  label: string;
  target: AlchemyFindingTarget | null;
  request: AlchemyFindingRevealRequest | null;
  reason: string | null;
  selected: boolean;
}>;
export type AlchemyFindingNavigator = Readonly<{
  entries: readonly AlchemyFindingNavigationEntry[];
}>;
export type AlchemyFindingRevealDecision =
  | Readonly<{ type: 'blocked'; reason: string }>
  | Readonly<{
      type: 'ready';
      label: string;
      target: AlchemyFindingTarget;
      events: readonly AlchemyFindingNavigationEvent[];
    }>;
function blocked(reason: string): AlchemyFindingRevealDecision {
  return freezeData({ type: 'blocked', reason });
}
type Reviewable = Extract<AlchemyProjection, { type: 'reviewable' }>;
function liveReason(editor: EditorState, options: AlchemyFindingNavigationOptions): string | null {
  if (!options.scope.trim()) return 'A review scope is required.';
  if (options.blockedReason !== undefined && options.blockedReason !== null)
    return options.blockedReason.trim() || 'Finding navigation is protected by the host.';
  if (!editor.readOnly) return 'Finding navigation requires a read-only preview.';
  if (!editor.surface) return 'Waiting for the preview canvas measurement.';
  if (editor.gesture.type !== 'idle')
    return 'Finish the preview gesture before revealing a finding.';
  return null;
}
type SourceResolution = Pick<AlchemyFindingNavigationEntry, 'label' | 'target' | 'reason'>;
function sourceTarget(p: Reviewable, f: AlchemyFinding): SourceResolution {
  const missing = (reason: string) => ({ label: f.sourceId ?? f.code, target: null, reason });
  if (f.sourceId === null) return missing('This finding has no source fact to reveal.');
  const coverage = p.coverage.filter((c) => c.sourceId === f.sourceId);
  if (coverage.length !== 1) return missing('Source coverage is missing or ambiguous.');
  const mapping = coverage[0];
  if (mapping?.representation === 'node') {
    const declaration = p.source.declarations.find((d) => d.id === f.sourceId);
    return declaration
      ? {
          label: `${declaration.name} (${declaration.kind})`,
          target: { entity: 'node', id: declaration.id },
          reason: null,
        }
      : missing('The source declaration is missing.');
  }
  const relation = p.source.relations.find((r) => r.id === f.sourceId);
  if (!relation) return missing('The source relation is missing.');
  const from = p.source.declarations.find((d) => d.id === relation.source),
    to = p.source.declarations.find((d) => d.id === relation.target);
  const label = `${relation.kind}: ${from?.name ?? relation.source} → ${to?.name ?? relation.target}`;
  if (mapping?.representation === 'parent' && relation.kind === 'contains')
    return { label, target: { entity: 'node', id: relation.target }, reason: null };
  if (mapping?.representation === 'edge' && relation.kind !== 'contains')
    return { label, target: { entity: 'edge', id: relation.id }, reason: null };
  return missing('The source coverage does not identify a diagram representation.');
}
function targetReason(
  p: Reviewable,
  editor: EditorState,
  target: AlchemyFindingTarget,
): string | null {
  if (target.entity === 'node') {
    if (!editor.graph.nodes.some((n) => n.id === target.id))
      return 'The represented node is missing from this preview.';
    return revealableNodes(editor).some((n) => n.id === target.id)
      ? null
      : 'The represented node is hidden in this preview.';
  }
  const edge = editor.graph.edges.find((e) => e.id === target.id),
    relation = p.source.relations.find((r) => r.id === target.id);
  if (!edge || !relation) return 'The represented relation is missing from this preview.';
  if (edge.source.node !== relation.source || edge.target.node !== relation.target)
    return 'The represented relation endpoints no longer match the source fact.';
  if (
    !editor.graph.nodes.some((n) => n.id === edge.source.node) ||
    !editor.graph.nodes.some((n) => n.id === edge.target.node)
  )
    return 'The represented relation endpoints are missing.';
  return revealableEdges(editor).some((e) => e.id === target.id)
    ? null
    : 'The represented relation or its endpoints are hidden in this preview.';
}
function entries(
  p: AlchemyProjection,
  editor: EditorState,
  options: AlchemyFindingNavigationOptions,
  key: string | null,
): readonly AlchemyFindingNavigationEntry[] {
  const globalReason = liveReason(editor, options);
  return p.findings.map((f) => {
    const resolved =
      p.type === 'reviewable'
        ? sourceTarget(p, f)
        : {
            label: f.sourceId ?? f.code,
            target: null,
            reason: 'Choose a reviewable projection before revealing findings.',
          };
    const duplicate =
      p.findings.filter((other) => other.code === f.code && other.sourceId === f.sourceId)
        .length !== 1;
    const target = resolved.target;
    const reason =
      resolved.reason ??
      (duplicate ? 'The finding identity is ambiguous.' : globalReason) ??
      (p.type === 'reviewable' && target ? targetReason(p, editor, target) : null);
    return {
      finding: { ...f },
      label: resolved.label,
      target,
      request:
        key === null
          ? null
          : { scope: options.scope, sourceKey: key, code: f.code, sourceId: f.sourceId },
      reason,
      selected:
        target !== null &&
        (target.entity === 'node'
          ? editor.selectedNodes.length === 1 &&
            editor.selectedNodes[0] === target.id &&
            editor.selectedEdges.length === 0
          : editor.selectedEdges.length === 1 &&
            editor.selectedEdges[0] === target.id &&
            editor.selectedNodes.length === 0),
    };
  });
}
/** Validated projections and their matching host-owned editor; no SDK, browser or model mutations. */
export function resolveAlchemyFindingNavigator(
  projection: AlchemyProjection,
  editor: EditorState,
  options: AlchemyFindingNavigationOptions,
): AlchemyFindingNavigator {
  const key =
    projection.type === 'reviewable' ? serializeAlchemyDescriptor(projection.source) : null;
  return freezeData({ entries: entries(projection, editor, options, key) });
}
/** Recompute source identity and live availability at activation; a request grants no editing authority. */
export function resolveAlchemyFindingReveal(
  projection: AlchemyProjection,
  editor: EditorState,
  request: AlchemyFindingRevealRequest,
  options: AlchemyFindingNavigationOptions,
): AlchemyFindingRevealDecision {
  if (projection.type !== 'reviewable')
    return blocked('Choose a reviewable projection before revealing findings.');
  const key = serializeAlchemyDescriptor(projection.source);
  if (request.scope !== options.scope || request.sourceKey !== key)
    return blocked('This finding belongs to a different review or source descriptor.');
  const entry = entries(projection, editor, options, key).find(
    (e) => e.finding.code === request.code && e.finding.sourceId === request.sourceId,
  );
  if (!entry) return blocked('This finding is no longer present in the projection.');
  if (entry.reason || !entry.target)
    return blocked(entry.reason ?? 'No diagram target is available.');
  const target = entry.target;
  const events: readonly AlchemyFindingNavigationEvent[] =
    target.entity === 'node'
      ? [
          { type: 'SelectionCleared' },
          { type: 'NodeRevealRequested', id: target.id },
          { type: 'NodeSelected', id: target.id, additive: false },
        ]
      : [
          { type: 'SelectionCleared' },
          { type: 'EdgeRevealRequested', id: target.id },
          { type: 'EdgeSelected', id: target.id, additive: false },
        ];
  return freezeData({ type: 'ready', label: entry.label, target, events });
}
