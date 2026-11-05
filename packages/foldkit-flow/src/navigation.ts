import { Match, Option } from 'effect';
import type { Html, HtmlBuilder } from 'foldkit/html';

import type { FlowDiagnostics } from './diagnostics';
import { maximumZoom, minimumZoom, minimapGeometry } from './geometry';
import { groupsInPaintOrder, presentGroups } from './group-presentation';
import type { EditorEvent, EditorState, FlowMinimapGeometry, FlowNode } from './types';

/** A Model-derived action; consumers supply the content and appearance. */
export type FlowViewportControl = Readonly<{
  label: string;
  event: EditorEvent;
  disabled: boolean;
  pressed?: boolean;
}>;
export type FlowViewportActions = Readonly<{
  zoomIn: FlowViewportControl;
  zoomOut: FlowViewportControl;
  fitView: FlowViewportControl;
  selectionMode: FlowViewportControl;
}>;
export type FlowViewportControlsContext = Readonly<{
  state: EditorState;
  diagnostics: FlowDiagnostics;
  actions: FlowViewportActions;
  selectionModeControl: boolean;
}>;
export type FlowMinimapContext = Readonly<{
  state: EditorState;
  nodes: readonly FlowNode[];
  geometry: FlowMinimapGeometry;
}>;
type Attributes<M> = Parameters<HtmlBuilder<M>['button']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['button']>[1];

/** Camera controls remain available for read-only inspection. */
export function viewportControlActions(state: EditorState): FlowViewportActions {
  const point = { x: (state.surface?.width ?? 0) / 2, y: (state.surface?.height ?? 0) / 2 };
  const unavailable = !state.surface || state.gesture.type !== 'idle';
  return {
    zoomIn: {
      label: 'Zoom in',
      event: { type: 'Zoomed', point, factor: 1.25 },
      disabled: unavailable || state.viewport.zoom >= maximumZoom,
    },
    zoomOut: {
      label: 'Zoom out',
      event: { type: 'Zoomed', point, factor: 1 / 1.25 },
      disabled: unavailable || state.viewport.zoom <= minimumZoom,
    },
    fitView: {
      label: 'Fit view',
      event: { type: 'FitViewClicked' },
      disabled: unavailable || state.graph.nodes.length === 0,
    },
    selectionMode: {
      label: 'Box select',
      event: { type: 'SelectionModeToggled' },
      disabled: unavailable,
      pressed: state.selectionMode,
    },
  };
}

/** Unstyled native button with Flow's action semantics and accessible name. */
export function flowViewportControl<M>(
  h: HtmlBuilder<M>,
  action: FlowViewportControl,
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
      h.OnClick(onEvent(action.event)),
    ],
    children,
  );
}

/** Collapsed-group presentation, in paint order, shared by default and custom minimaps. */
export function minimapContext(state: EditorState): FlowMinimapContext | undefined {
  if (!state.surface) return undefined;
  const presentation = presentGroups(state.graph, state.collapsedGroups);
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
 * Children use world coordinates; render the viewport rectangle with `flowMinimapViewport` or your own SVG. Arrow keys pan (Shift accelerates),
 * Home fits, and Enter/Space center the overview. SVG stretches to the frame to preserve pointer mapping at any aspect ratio.
 */
export function flowMinimap<M>(
  h: HtmlBuilder<M>,
  context: FlowMinimapContext,
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
export function flowMinimapViewport<M>(
  h: HtmlBuilder<M>,
  { visible }: FlowMinimapGeometry,
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
