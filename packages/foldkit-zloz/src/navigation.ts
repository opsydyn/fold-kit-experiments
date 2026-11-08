import { Match, Option } from 'effect';
import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozDiagnostics } from './diagnostics';
import { minimapGeometry } from './geometry';
import { groupsInPaintOrder, presentEditorGroups } from './group-presentation';
import { ZlozMinimapInput } from './mount';
import type { EditorEvent, EditorState, ZlozMinimapGeometry, ZlozNode } from './types';

/** Wheel behavior inside the canvas. Pan mode uses Ctrl/Command-wheel to zoom. */
export type ZlozWheelNavigation = 'zoom' | 'pan' | 'off';

/** A Model-derived action; consumers supply the content and appearance. */
export type ZlozViewportControl = Readonly<{
  label: string;
  event: EditorEvent;
  disabled: boolean;
  pressed?: boolean;
}>;
export type ZlozViewportActions = Readonly<{
  zoomIn: ZlozViewportControl;
  zoomOut: ZlozViewportControl;
  fitView: ZlozViewportControl;
  fitSelection: ZlozViewportControl;
  zoomArea: ZlozViewportControl;
  previousView: ZlozViewportControl;
  selectionMode: ZlozViewportControl;
}>;
export type ZlozViewportControlsContext = Readonly<{
  state: EditorState;
  diagnostics: ZlozDiagnostics;
  actions: ZlozViewportActions;
  selectionModeControl: boolean;
  fitSelectionControl?: boolean;
  zoomAreaControl?: boolean;
  previousViewControl?: boolean;
}>;
export type ZlozMinimapContext = Readonly<{
  state: EditorState;
  nodes: readonly ZlozNode[];
  geometry: ZlozMinimapGeometry;
}>;
type Attributes<M> = Parameters<HtmlBuilder<M>['button']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['button']>[1];

/** Camera controls remain available for read-only inspection. */
export function viewportControlActions(state: EditorState): ZlozViewportActions {
  const point = { x: (state.surface?.width ?? 0) / 2, y: (state.surface?.height ?? 0) / 2 };
  const unavailable = !state.surface || state.gesture.type !== 'idle';
  const nodes = state.visibility?.hiddenNodeIds?.length
    ? presentEditorGroups(state).nodes
    : state.graph.nodes;
  return {
    zoomIn: {
      label: 'Zoom in',
      event: { type: 'Zoomed', point, factor: 1.25 },
      disabled: unavailable || state.viewport.zoom >= state.zoomLimits.maxZoom,
    },
    zoomOut: {
      label: 'Zoom out',
      event: { type: 'Zoomed', point, factor: 1 / 1.25 },
      disabled: unavailable || state.viewport.zoom <= state.zoomLimits.minZoom,
    },
    fitView: {
      label: 'Fit view',
      event: { type: 'FitViewClicked' },
      disabled: unavailable || nodes.length === 0,
    },
    fitSelection: {
      label: 'Fit selection',
      event: { type: 'FitSelectionClicked' },
      disabled: unavailable || (!state.selectedNodes.length && !state.selectedEdges.length),
    },
    zoomArea: {
      label: 'Zoom to area',
      event: { type: 'ZoomAreaModeToggled' },
      disabled: unavailable,
      pressed: Boolean(state.zoomAreaMode) || state.gesture.type === 'zoom-area',
    },
    previousView: {
      label: 'Back to previous view',
      event: { type: 'PreviousViewClicked' },
      disabled: unavailable || !state.previousViewport,
    },
    selectionMode: {
      label: 'Box select',
      event: { type: 'SelectionModeToggled' },
      disabled: unavailable,
      pressed: state.selectionMode,
    },
  };
}

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

/** Collapsed-group presentation, in paint order, shared by default and custom minimaps. */
export function minimapContext(state: EditorState): ZlozMinimapContext | undefined {
  if (!state.surface) return undefined;
  const presentation = presentEditorGroups(state);
  if (!presentation.nodes.length) return undefined;
  return {
    state,
    nodes: [
      ...groupsInPaintOrder(presentation.nodes),
      ...presentation.nodes.filter((node) => node.kind !== 'group'),
    ],
    geometry: minimapGeometry(presentation, state.surface, state.viewport),
  };
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
