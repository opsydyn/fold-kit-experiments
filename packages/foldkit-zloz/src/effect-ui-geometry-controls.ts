import type { View } from '@effect/ui';
import { Html } from '@effect/ui/html';

import type { NativePortControl } from './effect-ui-ports';
import type { ZlozPortAnchorSnapBypassModifier } from './input-message';
import { resolvePortAnchorGuides, type ZlozPortAnchorGuideContext } from './port-anchor-guides';
import {
  portAnchorHandleContexts,
  portAnchorHandleTitle,
  type ZlozPortAnchorHandleContext,
  type ZlozPortAnchorHandleOptions,
} from './port-anchor-presentation';
import type { EditorEvent, EditorPolicy, EditorState, Point, ZlozNode } from './types';
import type { ZlozEdgeWaypointAction, ZlozEdgeWaypointControlsContext } from './waypoint-controls';

const position = (point: Point) => ({ left: `${point.x}px`, top: `${point.y}px` });

export type NativePortAnchors<M> = ZlozPortAnchorHandleOptions &
  Readonly<{
    keyboardTargets?: boolean;
    guides?: boolean;
    snapBypass?: ZlozPortAnchorSnapBypassModifier | undefined;
    renderHandle?: (
      context: ZlozPortAnchorHandleContext,
      h: Html.H<M>,
    ) => NativePortControl<M> | undefined;
    renderGuide?: (
      context: ZlozPortAnchorGuideContext,
      h: Html.H<M>,
    ) => View.Content<M> | null | undefined;
  }>;

export function anchorControls<M>(
  h: Html.H<M>,
  state: EditorState,
  visibleNodes: readonly ZlozNode[],
  policy: EditorPolicy | undefined,
  options: NativePortAnchors<M>,
) {
  if (state.readOnly) return [];
  return portAnchorHandleContexts(
    state,
    visibleNodes,
    options,
    policy?.canEditPort,
    options.snapBypass,
    options.keyboardTargets,
  ).map((context) => {
    const {
      node,
      port,
      active,
      keyboardTargets,
      snappedSide,
      snappedCorner,
      snappedMidpoint,
      snapBypassed,
    } = context;
    const presentation = options.renderHandle?.(context, h);
    return h.button
      .key(`anchor:${JSON.stringify([node.id, port.id])}`)
      .class('zloz-ui-anchor-handle', presentation?.className)
      .attr('type', 'button')
      .attr('data-flow-anchor-node', node.id)
      .attr('data-flow-anchor-port', port.id)
      .attr('data-flow-anchor-bypassed', snapBypassed ? 'true' : undefined)
      .attr('data-flow-anchor-snapped', snappedSide ?? undefined)
      .attr('data-flow-anchor-corner', snappedCorner ?? undefined)
      .attr('data-flow-anchor-midpoint', snappedMidpoint ?? undefined)
      .attr('aria-label', `Position ${node.label}: ${port.label ?? port.id}`)
      .attr(
        'aria-keyshortcuts',
        keyboardTargets && !active ? 'PageDown PageUp Home End' : undefined,
      )
      .attr('title', portAnchorHandleTitle(context))
      .attr('aria-describedby', presentation?.describedBy)
      .disabled(context.disabledReason !== null)
      .style({ ...presentation?.style, ...position(context.position) })
      .children(presentation?.content ?? '⋮');
  });
}

export function anchorGuides<M>(
  h: Html.H<M>,
  state: EditorState,
  nodes: readonly ZlozNode[],
  policy: EditorPolicy | undefined,
  renderGuide: NativePortAnchors<M>['renderGuide'],
) {
  const gesture = state.gesture;
  if (gesture.type !== 'port-anchor-drag') return null;
  const svg = (tag: string) => new Html.Element<M>(tag);
  const marks = resolvePortAnchorGuides(state, nodes, policy?.canEditPort).flatMap((context) => {
    const { target, start, end, active } = context;
    const name = target.type === 'corner' ? target.corner : target.side;
    const custom = renderGuide?.(context, h);
    if (custom === null) return [];
    const mark =
      target.type === 'edge'
        ? svg('line')
            .attr('x1', String(start.x))
            .attr('y1', String(start.y))
            .attr('x2', String(end.x))
            .attr('y2', String(end.y))
            .attr('stroke-dasharray', active ? undefined : '5 3')
        : svg('circle')
            .attr('cx', String(start.x))
            .attr('cy', String(start.y))
            .attr('r', String((active ? 6 : 4) / state.viewport.zoom));
    return [
      svg('g')
        .key(`guide:${target.type}:${name}`)
        .attr('data-flow-anchor-guide', target.type)
        .attr('data-flow-anchor-guide-target', name)
        .attr('data-flow-anchor-guide-active', String(active))
        .children(custom ?? mark.attr('vector-effect', 'non-scaling-stroke').children()),
    ];
  });
  if (marks.length === 0) return null;
  return svg('svg')
    .key('anchor-guides')
    .class('zloz-ui-anchor-guides')
    .attr('aria-hidden', 'true')
    .attr('data-flow-anchor-guides', JSON.stringify(gesture.endpoint))
    .children(...marks);
}

export type NativeWaypointOptions<M> = Readonly<{
  onEdit: (event: EditorEvent) => M;
  measurements?: boolean;
  instructions?: boolean;
  presentation?: Readonly<{ className: string; heading: string; marker: string }> | undefined;
}>;

export function waypointControls<M>(
  h: Html.H<M>,
  context: ZlozEdgeWaypointControlsContext,
  options: NativeWaypointOptions<M>,
) {
  const inverseZoom = 1 / context.zoom;
  const presentation = options.presentation;
  const action = ({ label, event, reason }: ZlozEdgeWaypointAction) =>
    h.button
      .key(event.type === 'EdgeWaypointRemoved' ? `remove:${event.waypointId}` : label)
      .attr('type', 'button')
      .attr(
        'data-flow-waypoint-remove',
        event.type === 'EdgeWaypointRemoved' ? event.waypointId : undefined,
      )
      .attr('title', reason ?? label)
      .disabled(reason !== null)
      .on('click', options.onEdit(event))
      .children(label);
  return h.div
    .key(`waypoints:${context.edge.id}`)
    .class(presentation?.className)
    .attr('data-flow-waypoint-controls', context.edge.id)
    .attr('role', 'group')
    .attr(
      'aria-label',
      presentation?.heading ?? `Waypoints for ${context.edge.label ?? 'selected connection'}`,
    )
    .children(
      ...context.handles.map((handle) =>
        h.div
          .key(handle.waypoint.id)
          .class('zloz-ui-waypoint')
          .style({ ...position(handle.waypoint.position), transform: `scale(${inverseZoom})` })
          .children(
            h.button
              .class('zloz-ui-waypoint-handle')
              .attr('type', 'button')
              .attr('data-flow-waypoint', handle.waypoint.id)
              .attr('data-flow-waypoint-edge', handle.edgeId)
              .attr('data-flow-waypoint-revision', String(handle.revision))
              .attr('data-flow-waypoint-step', String(handle.step))
              .attr('aria-label', handle.label)
              .attr(
                'title',
                handle.reason ??
                  'Drag or use arrow keys. Shift accelerates, Alt bypasses grid, Delete removes, Escape cancels.',
              )
              .disabled(handle.reason !== null)
              .children(presentation?.marker ?? '↔'),
            options.measurements !== false
              ? h.span
                  .class('zloz-ui-waypoint-readout')
                  .attr('data-flow-waypoint-readout', handle.waypoint.id)
                  .children(
                    `${Math.round(handle.waypoint.position.x)}, ${Math.round(handle.waypoint.position.y)}`,
                  )
              : null,
          ),
      ),
      h.div
        .class('zloz-ui-waypoint-actions')
        .attr('data-flow-waypoint-actions', '')
        .attr('data-flow-no-drag', '')
        .style({
          ...position(context.panel.position),
          width: `${context.panel.width}px`,
          maxHeight: `${context.panel.maxHeight}px`,
          transform: `translate(-100%, -100%) scale(${inverseZoom})`,
        })
        .children(
          presentation ? h.strong.children(presentation.heading) : null,
          action(context.add),
          action(context.reset),
          ...context.handles.map(({ remove }) => action(remove)),
          context.reason ? h.span.attr('role', 'status').children(context.reason) : null,
          options.instructions !== false
            ? h.span.children(
                context.bypassed
                  ? 'Free placement'
                  : context.dragging
                    ? 'Release to apply · Escape cancels'
                    : 'Drag bends · arrows move · Alt bypasses grid',
              )
            : null,
        ),
    );
}
