import { Match, Option } from 'effect';
import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozDiagnostics } from './diagnostics';
import type { ZlozMinimapContext } from './minimap-context';
export { minimapContext, type ZlozMinimapContext } from './minimap-context';
import { ZlozMinimapInput } from './mount';
import type { EditorEvent, EditorState, ZlozMinimapGeometry } from './types';
import type { ZlozViewportActions, ZlozViewportControl } from './viewport-controls';
export {
  viewportControlActions,
  type ZlozViewportActions,
  type ZlozViewportControl,
} from './viewport-controls';

/** Wheel behavior inside the canvas. Pan mode uses Ctrl/Command-wheel to zoom. */
export type ZlozWheelNavigation = 'zoom' | 'pan' | 'off';

export type ZlozViewportControlsContext = Readonly<{
  state: EditorState;
  diagnostics: ZlozDiagnostics;
  actions: ZlozViewportActions;
  selectionModeControl: boolean;
  fitSelectionControl?: boolean;
  zoomAreaControl?: boolean;
  previousViewControl?: boolean;
}>;
type Attributes<M> = Parameters<HtmlBuilder<M>['button']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['button']>[1];

/** Unstyled native button with Zloz's action semantics and accessible name. */
export function zlozViewportControl<M>(
  h: HtmlBuilder<M>,
  action: ZlozViewportControl,
  onEvent: (event: EditorEvent) => M,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      h.AriaLabel(action.label),
      h.Disabled(action.disabled),
      ...(action.pressed === undefined ? [] : [h.AriaPressed(String(action.pressed))]),
      ...(action.event.type === 'ZoomAreaModeToggled' && action.pressed && !action.disabled
        ? [
            h.OnKeyDownPreventDefault((key) =>
              key === 'Escape' ? Option.some(onEvent({ type: 'GestureCancelled' })) : Option.none(),
            ),
          ]
        : []),
      h.OnClick(onEvent(action.event)),
    ],
    children,
  );
}

/** Native navigation frame containing a coordinate plane. Attributes style the frame, including padding and borders.
 * Children use world coordinates; render the viewport rectangle with `zlozMinimapViewport` or your own SVG. Arrow keys pan (Shift accelerates),
 * Home fits, and Enter/Space center the overview. SVG stretches to the frame to preserve pointer mapping at any aspect ratio.
 */
export function zlozMinimap<M>(
  h: HtmlBuilder<M>,
  context: ZlozMinimapContext,
  onEvent: (event: EditorEvent) => M,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  const { geometry, state } = context;
  return h.button(
    [
      h.AriaLabel('Diagram overview'),
      h.Title('Arrow keys pan; Shift accelerates; Home fits; Enter or Space centers'),
      ...attributes,
      h.Type('button'),
      h.DataAttribute('flow-minimap-frame', ''),
      h.OnMount(Mount.mapMessage(ZlozMinimapInput(), (message) => onEvent(message.event))),
      h.Disabled(state.gesture.type !== 'idle'),
      h.OnKeyDownPreventDefault((key, modifiers) => {
        if (state.gesture.type !== 'idle') return Option.none();
        const step = modifiers.shiftKey ? 80 : 20;
        const nudge = (x: number, y: number) =>
          Option.some(onEvent({ type: 'ViewportNudged', delta: { x, y } }));
        return Match.value(key).pipe(
          Match.when('ArrowLeft', () => nudge(step, 0)),
          Match.when('ArrowRight', () => nudge(-step, 0)),
          Match.when('ArrowUp', () => nudge(0, step)),
          Match.when('ArrowDown', () => nudge(0, -step)),
          Match.when('Home', () => Option.some(onEvent({ type: 'FitViewClicked' }))),
          Match.orElse(() => Option.none()),
        );
      }),
    ],
    [
      h.svg(
        [
          h.DataAttribute('flow-minimap', ''),
          h.AriaHidden(true),
          h.PreserveAspectRatio('none'),
          h.ViewBox(`${geometry.x} ${geometry.y} ${geometry.width} ${geometry.height}`),
          h.Width('100%'),
          h.Height('100%'),
          h.Style({ display: 'block' }),
        ],
        children,
      ),
    ],
  );
}

/** Optional camera rectangle with caller-owned paint and Model-owned bounds. */
export function zlozMinimapViewport<M>(
  h: HtmlBuilder<M>,
  { visible }: ZlozMinimapGeometry,
  attributes: Parameters<HtmlBuilder<M>['rect']>[0],
): Html {
  return h.rect(
    [
      ...attributes,
      h.DataAttribute('flow-minimap-viewport', ''),
      h.X(String(visible.x)),
      h.Y(String(visible.y)),
      h.Width(String(visible.width)),
      h.Height(String(visible.height)),
    ],
    [],
  );
}
