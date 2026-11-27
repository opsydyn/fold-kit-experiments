import type { Html, HtmlBuilder } from 'foldkit/html';

import {
  backgroundPaint,
  type ZlozBackgroundPreset,
  type ZlozBackgroundRenderContext,
} from './canvas-decoration';
import type { EditorState } from './types';

export type { ZlozBackgroundRenderContext } from './canvas-decoration';
export type ZlozBackground<M> =
  | ZlozBackgroundPreset
  | Readonly<{ type: 'none' }>
  | Readonly<{
      type: 'custom';
      /** Decorative HTML/SVG built with the host builder; no DOM writes or interactive controls. */
      render: (context: ZlozBackgroundRenderContext, h: HtmlBuilder<M>) => Html;
    }>;

export function backgroundView<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  id: string,
  background?: ZlozBackground<M>,
): Html[] {
  const preset: ZlozBackground<M> = background ?? { type: 'dots' };
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
            { id, viewport: state.viewport, surface: state.surface, spacing: state.gridSpacing },
            h,
          ),
        ],
      ),
    ];
  const paint = backgroundPaint(state, preset);
  return [
    h.div(
      [
        h.Key('background'),
        h.DataAttribute('flow-background', preset.type),
        h.AriaHidden(true),
        h.Style({
          ...layer,
          'background-image': paint.backgroundImage,
          'background-size': paint.backgroundSize,
          'background-position': paint.backgroundPosition,
          'background-origin': paint.backgroundOrigin,
        }),
      ],
      [],
    ),
  ];
}
