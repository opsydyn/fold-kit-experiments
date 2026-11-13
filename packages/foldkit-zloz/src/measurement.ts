import { serializeGraph } from './graph';
import type { EditorState, Size } from './types';

export type MeasuredBounds = Readonly<{ id: string; size: Size }>;
export function copyMeasuredBounds(bounds: readonly MeasuredBounds[]): readonly MeasuredBounds[] {
  return bounds.map((bound) => ({ id: bound.id, size: { ...bound.size } }));
}
export function completeMeasuredBounds(
  ids: readonly string[],
  bounds: readonly MeasuredBounds[],
): boolean {
  const measured = new Set(bounds.map((bound) => bound.id));
  return (
    measured.size === bounds.length &&
    measured.size === ids.length &&
    ids.every((id) => measured.has(id)) &&
    bounds.every((bound) =>
      [bound.size.width, bound.size.height].every((value) => Number.isFinite(value) && value > 0),
    )
  );
}
export function measurementIsCurrent(
  editor: EditorState,
  request: Readonly<{ revision: number; renderKey: string; source: string }>,
  renderKey: string,
): boolean {
  return (
    request.revision === editor.revision &&
    request.renderKey === renderKey &&
    request.source === serializeGraph(editor.graph) &&
    editor.gesture.type === 'idle' &&
    editor.edgeLabelDraft === null
  );
}
