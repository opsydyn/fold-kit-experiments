import type { Html, HtmlBuilder } from 'foldkit/html';

import { gridSpacing } from './geometry';
import type { EditorState, Size, Viewport } from './types';

export type FlowBackgroundRenderContext = Readonly<{
  /** Same unique document ID supplied to flowView. */
  id: string;
  viewport: Viewport;
  surface: Size | null;
  /** Editor snap spacing in graph units. */
  spacing: number;
}>;
export type FlowBackground<M> =
  | Readonly<{ type: 'dots' | 'squares'; gap?: number; size?: number; color?: string }>
  | Readonly<{ type: 'none' }>
  | Readonly<{
      type: 'custom';
      /** Decorative HTML/SVG built with the host builder; no DOM writes or interactive controls. */
      render: (context: FlowBackgroundRenderContext, h: HtmlBuilder<M>) => Html;
    }>;

export function backgroundView<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  id: string,
  background?: FlowBackground<M>,
): Html[] {
  const preset: FlowBackground<M> = background ?? { type: 'dots' };
  if (preset.type === 'none') return [];
  const layer = { position: 'absolute', inset: '0', 'pointer-events': 'none' } as const;
  if (preset.type === 'custom')
    return [
      h.div(
        [
          h.Key('background'),
          h.DataAttribute('flow-background', 'custom'),
          h.AriaHidden(true),
          h.Style(layer),
        ],
        [
          preset.render(
            { id, viewport: state.viewport, surface: state.surface, spacing: gridSpacing },
            h,
          ),
        ],
      ),
    ];
  const gap = preset.gap ?? gridSpacing;
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
  return [
    h.div(
      [
        h.Key('background'),
        h.DataAttribute('flow-background', preset.type),
        h.AriaHidden(true),
        h.Style({
          ...layer,
          'background-image': dots
            ? `radial-gradient(circle, ${color} ${thickness}px, transparent ${thickness}px)`
            : `linear-gradient(to right, ${color} ${thickness}px, transparent ${thickness}px), linear-gradient(to bottom, ${color} ${thickness}px, transparent ${thickness}px)`,
          'background-size': `${pitch}px ${pitch}px`,
          'background-position': `${state.viewport.x - offset}px ${state.viewport.y - offset}px`,
          'background-origin': 'padding-box',
        }),
      ],
      [],
    ),
  ];
}
