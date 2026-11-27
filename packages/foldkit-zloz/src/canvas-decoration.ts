import type { AlignmentGuide, EditorState, Point, Size, Viewport } from './types';

export type ZlozBackgroundRenderContext = Readonly<{
  id: string;
  viewport: Viewport;
  surface: Size | null;
  spacing: number;
}>;

export type ZlozBackgroundPreset = Readonly<{
  type: 'dots' | 'squares';
  gap?: number;
  size?: number;
  color?: string;
}>;

export function backgroundPaint(state: EditorState, preset: ZlozBackgroundPreset) {
  const gap = preset.gap ?? state.gridSpacing;
  const size = preset.size ?? 1;
  if (!Number.isFinite(gap) || gap <= 0 || !Number.isFinite(size) || size <= 0)
    throw new RangeError('Background gap and size must be finite and positive');
  const pitch = gap * state.viewport.zoom;
  const thickness = size * state.viewport.zoom;
  const dots = preset.type === 'dots';
  const color =
    preset.color ??
    (dots
      ? 'var(--flow-grid-dot, var(--flow-grid-line, #94a3b855))'
      : 'var(--flow-grid-line, #94a3b855)');
  const offset = dots ? pitch / 2 : 0;
  return {
    backgroundImage: dots
      ? `radial-gradient(circle, ${color} ${thickness}px, transparent ${thickness}px)`
      : `linear-gradient(to right, ${color} ${thickness}px, transparent ${thickness}px), linear-gradient(to bottom, ${color} ${thickness}px, transparent ${thickness}px)`,
    backgroundSize: `${pitch}px ${pitch}px`,
    backgroundPosition: `${state.viewport.x - offset}px ${state.viewport.y - offset}px`,
    backgroundOrigin: 'padding-box',
  };
}

/** One model-derived alignment guide in the canvas world coordinate space. */
export type ZlozAlignmentGuideContext = Readonly<{
  guide: AlignmentGuide;
  start: Point;
  end: Point;
  phase: 'drag' | 'resize';
  viewport: Viewport;
}>;

export function alignmentGuideContexts({
  gesture,
  viewport,
}: EditorState): readonly ZlozAlignmentGuideContext[] {
  if (gesture.type !== 'node-drag' && gesture.type !== 'node-resize') return [];
  const phase = gesture.type === 'node-drag' ? 'drag' : 'resize';
  return (gesture.guides ?? []).map((guide) => {
    const { axis, position, from, to } = guide;
    const start = axis === 'x' ? { x: position, y: from } : { x: from, y: position };
    const end = axis === 'x' ? { x: position, y: to } : { x: to, y: position };
    return { guide, start, end, phase, viewport };
  });
}
