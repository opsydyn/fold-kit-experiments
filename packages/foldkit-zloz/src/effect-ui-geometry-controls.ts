import { Html } from '@effect/ui/html';

import { portPosition } from './geometry';
import { resolvePortAnchorGuides } from './port-anchor-guides';
import { portEditReason } from './port-edit';
import type { EditorEvent, EditorPolicy, EditorState, Point, ZlozNode } from './types';
import type { ZlozEdgeWaypointAction, ZlozEdgeWaypointControlsContext } from './waypoint-controls';

const position = (point: Point) => ({ left: `${point.x}px`, top: `${point.y}px` });

export function anchorControls<M>(
  h: Html.H<M>,
  state: EditorState,
  visibleNodes: readonly ZlozNode[],
  policy: EditorPolicy | undefined,
  keyboardTargets: boolean,
) {
  if (state.readOnly) return [];
  const selected = new Set(state.selectedNodes);
  const drag = state.gesture.type === 'port-anchor-drag' ? state.gesture : undefined;
  return visibleNodes
    .filter((node) => node.kind !== 'group' && selected.has(node.id))
    .flatMap((node) =>
      node.ports.map((port) => {
        const point = portPosition(node, port.id);
        const active = drag?.endpoint.node === node.id && drag.endpoint.port === port.id;
        const reason = portEditReason(
          { operation: 'position', node, port },
          state.graph,
          policy?.canEditPort,
        );
        return h.button
          .key(`anchor:${JSON.stringify([node.id, port.id])}`)
          .class('zloz-ui-anchor-handle')
          .attr('type', 'button')
          .attr('data-flow-anchor-node', node.id)
          .attr('data-flow-anchor-port', port.id)
          .attr('data-flow-anchor-bypassed', active && drag.snapBypassed ? 'true' : undefined)
          .attr('data-flow-anchor-snapped', active ? (drag.snappedSide ?? undefined) : undefined)
          .attr('data-flow-anchor-corner', active ? (drag.snappedCorner ?? undefined) : undefined)
          .attr(
            'data-flow-anchor-midpoint',
            active ? (drag.snappedMidpoint ?? undefined) : undefined,
          )
          .attr('aria-label', `Position ${node.label}: ${port.label ?? port.id}`)
          .attr(
            'aria-keyshortcuts',
            keyboardTargets && !active ? 'PageDown PageUp Home End' : undefined,
          )
          .attr(
            'title',
            reason ?? 'Drag to position. Arrow keys move 1%. Shift moves 10%. Escape cancels.',
          )
          .disabled(reason !== null)
          .style(
            position({
              x: point.x + (port.side === 'left' ? -18 : 18),
              y: point.y + (port.side === 'bottom' ? 18 : -18),
            }),
          )
          .children('⋮');
      }),
    );
}

export function anchorGuides<M>(
  state: EditorState,
  nodes: readonly ZlozNode[],
  policy?: EditorPolicy,
) {
  const gesture = state.gesture;
  if (gesture.type !== 'port-anchor-drag') return null;
  const guides = resolvePortAnchorGuides(state, nodes, policy?.canEditPort);
  if (guides.length === 0) return null;
  const svg = (tag: string) => new Html.Element<M>(tag);
  return svg('svg')
    .key('anchor-guides')
    .class('zloz-ui-anchor-guides')
    .attr('aria-hidden', 'true')
    .attr('data-flow-anchor-guides', JSON.stringify(gesture.endpoint))
    .children(
      ...guides.map(({ target, start, end, active }) => {
        const side = target.type === 'corner' ? target.corner : target.side;
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
        return mark
          .key(`guide:${target.type}:${side}`)
          .attr('data-flow-anchor-guide', target.type)
          .attr('data-flow-anchor-guide-target', side)
          .attr('data-flow-anchor-guide-active', String(active))
          .attr('vector-effect', 'non-scaling-stroke');
      }),
    );
}

export type NativeWaypointOptions<M> = Readonly<{
  onEdit: (event: EditorEvent) => M;
  measurements?: boolean;
  instructions?: boolean;
}>;

export function waypointControls<M>(
  h: Html.H<M>,
  context: ZlozEdgeWaypointControlsContext,
  options: NativeWaypointOptions<M>,
) {
  const inverseZoom = 1 / context.zoom;
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
    .attr('data-flow-waypoint-controls', context.edge.id)
    .attr('role', 'group')
    .attr('aria-label', `Waypoints for ${context.edge.label ?? 'selected connection'}`)
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
              .children('↔'),
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
