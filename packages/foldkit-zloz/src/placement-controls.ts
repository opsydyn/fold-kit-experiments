import { screenToWorld } from './geometry';
import { ZlozError } from './graph';
import { patternInsertionReason } from './patterns';
import {
  createPlacement,
  placementTargetFreshnessReason,
  updatePlacement,
  resolvePlacement,
  applyPlacement,
  type ZlozPlacement,
  type ZlozPlacementContext,
  type ZlozPlacementIntent,
  type ZlozPlacementPolicy,
} from './placement';
import type { Point, ZlozGraph } from './types';

export type ZlozPaletteEntry = Readonly<{ id: string; label: string; intent: ZlozPlacementIntent }>;
export type ZlozPalettePolicy = ZlozPlacementPolicy &
  Readonly<{
    canStartPlacement?: (entry: ZlozPaletteEntry, graph: ZlozGraph) => string | null;
  }>;
export type ZlozPlacementInput = Readonly<{ scope: string; generation: number }> &
  (
    | Readonly<{ type: 'PaletteEntryActivated'; id: string }>
    | Readonly<{ type: 'PlacementPointed'; point: Point; bypassed: boolean; commit: boolean }>
    | Readonly<{ type: 'PlacementNudged'; delta: Point; bypassed: boolean }>
    | Readonly<{ type: 'PlacementAccepted'; targetRevision: number }>
    | Readonly<{ type: 'PlacementDismissed' }>
  );
function catalogue(entries: readonly ZlozPaletteEntry[]) {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.id.trim() || !entry.label.trim() || ids.has(entry.id))
      throw new ZlozError(
        'invalid-edit',
        'Palette entries require unique non-blank IDs and labels.',
      );
    ids.add(entry.id);
  }
}
function startReason(
  entry: ZlozPaletteEntry,
  context: ZlozPlacementContext,
  policy: ZlozPalettePolicy,
) {
  const reason =
    patternInsertionReason(context.editor) ??
    policy.canStartPlacement?.(entry, context.editor.graph) ??
    null;
  return reason === null ? null : reason.trim() || 'Palette entry is protected.';
}
/** Projection only. Entry protection is independent of position-dependent Apply policies. */
export function resolvePlacementControls(
  placement: ZlozPlacement,
  context: ZlozPlacementContext,
  entries: readonly ZlozPaletteEntry[],
  policy: ZlozPalettePolicy = {},
) {
  catalogue(entries);
  return {
    step:
      ((
        placement.type === 'placing'
          ? (placement.intent.snapping?.grid ?? context.editor.snapToGrid)
          : context.editor.snapToGrid
      )
        ? context.editor.gridSpacing
        : 1) * context.editor.viewport.zoom,
    scope: placement.scope,
    generation: placement.generation,
    active: placement.type === 'placing',
    targetRevision: placement.type === 'placing' ? placement.targetRevision : 0,
    entries: entries.map((entry) => ({
      ...entry,
      selected:
        placement.type === 'placing' &&
        placement.intent.source.id === entry.intent.source.id &&
        placement.intent.source.type === entry.intent.source.type,
      reason: startReason(entry, context, policy),
    })),
    preview: resolvePlacement(placement, context, policy),
  };
}
export type ZlozPlacementControlsContext = ReturnType<typeof resolvePlacementControls>;
/** One host update publishes both records. Browser IO never changes the editor directly. */
export function updatePlacementControls(
  state: ZlozPlacement,
  context: ZlozPlacementContext,
  entries: readonly ZlozPaletteEntry[],
  input: ZlozPlacementInput,
  policy: ZlozPalettePolicy = {},
) {
  catalogue(entries);
  const unchanged = (notice = '') => ({ editor: context.editor, placement: state, notice });
  if (
    state.scope !== context.scope ||
    input.scope !== state.scope ||
    input.generation !== state.generation
  )
    return unchanged();
  if (
    input.type === 'PlacementAccepted' &&
    (state.type !== 'placing' || input.targetRevision !== state.targetRevision)
  )
    return unchanged('The placement target changed; review it again.');
  const identity = { scope: state.scope, generation: state.generation };
  if (input.type === 'PlacementDismissed')
    return {
      editor: context.editor,
      placement: updatePlacement(state, context, { type: 'PlacementCancelled', ...identity }),
      notice: 'Placement cancelled.',
    };
  let placement = state;
  if (input.type === 'PaletteEntryActivated') {
    const entry = entries.find((entry) => entry.id === input.id);
    if (!entry) return unchanged('This palette entry is no longer available.');
    const reason = startReason(entry, context, policy);
    if (reason !== null) return unchanged(reason);
    placement = updatePlacement(state, context, {
      type: 'PlacementStarted',
      ...identity,
      intent: entry.intent,
    });
    const surface = context.editor.surface;
    if (surface)
      placement = updatePlacement(placement, context, {
        type: 'PlacementTargetChanged',
        scope: state.scope,
        generation: placement.generation,
        target: { space: 'screen', point: { x: surface.width / 2, y: surface.height / 2 } },
      });
  } else if (state.type !== 'placing') return unchanged();
  else if (input.type === 'PlacementPointed') {
    placement = updatePlacement(state, context, {
      type: 'PlacementTargetChanged',
      ...identity,
      target: { space: 'screen', point: input.point, snapBypassed: input.bypassed },
    });
  } else if (input.type === 'PlacementNudged') {
    const freshness = placementTargetFreshnessReason(state, context);
    if (freshness !== null) return unchanged(freshness);
    const target = state.sample?.target;
    if (!target) return unchanged('Choose a placement target first.');
    const origin = state.sample?.origin;
    const local =
      target.space === 'client' && origin
        ? { x: target.point.x - origin.x, y: target.point.y - origin.y }
        : target.point;
    const position =
      target.space === 'world' ? local : screenToWorld(local, context.editor.viewport);
    placement = updatePlacement(state, context, {
      type: 'PlacementTargetChanged',
      ...identity,
      target: {
        ...target,
        space: 'world',
        point: {
          x: position.x + input.delta.x / context.editor.viewport.zoom,
          y: position.y + input.delta.y / context.editor.viewport.zoom,
        },
        snapBypassed: input.bypassed,
      },
    });
  }
  const preview = resolvePlacement(placement, context, policy);
  if (preview.type !== 'ready')
    return {
      editor: context.editor,
      placement,
      notice: preview.type === 'blocked' ? preview.reason : 'Choose a target on the canvas.',
    };
  if (input.type === 'PlacementAccepted' || (input.type === 'PlacementPointed' && input.commit)) {
    const applied = applyPlacement(placement, context, preview.request, policy);
    return {
      editor: applied.editor,
      placement: applied.placement,
      notice:
        applied.type === 'blocked'
          ? applied.reason
          : 'Fragment placed. Undo removes the complete insertion.',
    };
  }
  return {
    editor: context.editor,
    placement,
    notice:
      'Placement preview. Use arrows to move, Enter to place, Escape to cancel. Alt bypasses snapping.',
  };
}
/** Synchronize to a new host incarnation without reusing old callback identities. */
export function placementForScope(placement: ZlozPlacement, scope: string): ZlozPlacement {
  return placement.scope === scope ? placement : createPlacement(scope);
}
