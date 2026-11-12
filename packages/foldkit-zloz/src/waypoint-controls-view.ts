import type { Html, HtmlBuilder } from 'foldkit/html';
type Attributes<M> = Parameters<HtmlBuilder<M>['button']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['button']>[1];
import type { ZlozDiagnostics } from './diagnostics';
import type { EditorEvent } from './types';
import type {
  ZlozEdgeWaypointAction,
  ZlozEdgeWaypointHandleContext,
  ZlozEdgeWaypointControlsContext,
} from './waypoint-controls';

/** Native delegated handle semantics; attributes/children allow complete visual replacement. */
export function zlozEdgeWaypointHandle<M>(
  h: HtmlBuilder<M>,
  context: ZlozEdgeWaypointHandleContext,
  attributes: Attributes<M> = [],
  children: Children<M> = [],
): Html {
  return h.button(
    [
      h.Key(context.waypoint.id),
      h.Type('button'),
      h.DataAttribute('flow-waypoint', context.waypoint.id),
      h.DataAttribute('flow-waypoint-edge', context.edgeId),
      h.DataAttribute('flow-waypoint-revision', String(context.revision)),
      h.DataAttribute('flow-waypoint-step', String(context.step)),
      h.Disabled(context.reason !== null),
      h.AriaLabel(context.reason ? `${context.label}. ${context.reason}` : context.label),
      h.Title(
        context.reason ??
          'Drag or use arrow keys. Shift accelerates, Alt bypasses grid, Delete removes, Escape cancels.',
      ),
      ...attributes,
    ],
    children,
  );
}
export function zlozEdgeWaypointAction<M>(
  h: HtmlBuilder<M>,
  action: ZlozEdgeWaypointAction,
  onEvent: (event: EditorEvent) => M,
  attributes: Attributes<M> = [],
  children?: Children<M>,
): Html {
  return h.button(
    [
      h.Type('button'),
      h.Style({
        background: 'var(--flow-node-background, #fff)',
        color: 'var(--flow-node-color, #172033)',
        border: '1px solid var(--flow-node-border, #94a3b8)',
        'border-radius': '6px',
        padding: '4px 8px',
        font: 'inherit',
      }),
      ...(action.event.type === 'EdgeWaypointRemoved'
        ? [h.DataAttribute('flow-waypoint-remove', action.event.waypointId)]
        : []),
      h.Disabled(action.reason !== null),
      h.Title(action.reason ?? action.label),
      h.AriaLabel(action.reason ? `${action.label}. ${action.reason}` : action.label),
      h.OnClick(onEvent(action.event)),
      ...attributes,
    ],
    children ?? [action.label],
  );
}
/** Measurements are independently suppressible even when a host replaces the controls. */
export function zlozEdgeWaypointReadout<M>(
  h: HtmlBuilder<M>,
  handle: ZlozEdgeWaypointHandleContext,
  diagnostics: Pick<ZlozDiagnostics, 'measurements'>,
  attributes: Attributes<M> = [],
): Html | null {
  return diagnostics.measurements
    ? h.span(
        [
          h.DataAttribute('flow-waypoint-readout', handle.waypoint.id),
          h.Style({
            position: 'absolute',
            top: '18px',
            left: '0',
            transform: 'translateX(-50%)',
            'white-space': 'nowrap',
            background: 'var(--flow-resize-readout-background, #fff)',
            color: 'var(--flow-resize-readout-color, #172033)',
            'border-radius': '4px',
            padding: '2px 4px',
            'font-size': '11px',
            'pointer-events': 'none',
          }),
          ...attributes,
        ],
        [`${Math.round(handle.waypoint.position.x)}, ${Math.round(handle.waypoint.position.y)}`],
      )
    : null;
}
/** Default world-space controls. Compose the three smaller helpers for a custom design. */
export function zlozEdgeWaypoints<M>(
  h: HtmlBuilder<M>,
  context: ZlozEdgeWaypointControlsContext,
  onEvent: (event: EditorEvent) => M,
  diagnostics: Pick<ZlozDiagnostics, 'measurements' | 'instructions'>,
): Html {
  return h.div(
    [
      h.Key(context.edge.id),
      h.DataAttribute('flow-waypoint-controls', context.edge.id),
      h.Role('group'),
      h.AriaLabel(`Waypoints for ${context.edge.label ?? 'selected connection'}`),
      h.Style({ position: 'absolute', inset: '0', 'pointer-events': 'none' }),
    ],
    [
      ...context.handles.map((handle) =>
        h.div(
          [
            h.Key(handle.waypoint.id),
            h.Style({
              position: 'absolute',
              left: `${handle.waypoint.position.x}px`,
              top: `${handle.waypoint.position.y}px`,
              transform: `scale(${1 / context.zoom})`,
              width: '0',
              height: '0',
              'transform-origin': '0 0',
              'pointer-events': 'auto',
              display: 'grid',
              'justify-items': 'center',
            }),
          ],
          [
            zlozEdgeWaypointHandle(
              h,
              handle,
              [
                h.Style({
                  position: 'absolute',
                  left: '0',
                  top: '0',
                  transform: 'translate(-50%, -50%)',
                  width: '24px',
                  height: '24px',
                  padding: '0',
                  border: '2px solid var(--flow-selection, #2563eb)',
                  'border-radius': '50%',
                  background: 'var(--flow-node-background, #fff)',
                  color: 'var(--flow-node-color, #172033)',
                  cursor: handle.reason ? 'not-allowed' : 'move',
                  'touch-action': 'none',
                }),
              ],
              ['↔'],
            ),
            ...[zlozEdgeWaypointReadout(h, handle, diagnostics)].flatMap((readout) =>
              readout === null ? [] : [readout],
            ),
          ],
        ),
      ),
      h.div(
        [
          h.DataAttribute('flow-waypoint-actions', ''),
          h.DataAttribute('flow-no-drag', ''),
          h.Style({
            position: 'absolute',
            left: `${context.panel.position.x}px`,
            top: `${context.panel.position.y}px`,
            transform: `translate(-100%, -100%) scale(${1 / context.zoom})`,
            'transform-origin': 'bottom right',
            width: `${context.panel.width}px`,
            'max-height': `${context.panel.maxHeight}px`,
            overflow: 'auto',
            'box-sizing': 'border-box',
            'flex-wrap': 'wrap',
            'pointer-events': 'auto',
            display: 'flex',
            gap: '6px',
            padding: '6px',
            'border-radius': '8px',
            border: '1px solid var(--flow-edge, #64748b)',
            background: 'var(--flow-node-background, #fff)',
            color: 'var(--flow-node-color, #172033)',
            'white-space': 'normal',
          }),
        ],
        [
          zlozEdgeWaypointAction(h, context.add, onEvent),
          zlozEdgeWaypointAction(h, context.reset, onEvent),
          ...context.handles.map((handle) => zlozEdgeWaypointAction(h, handle.remove, onEvent)),
          ...(context.reason ? [h.span([], [context.reason])] : []),
          ...(diagnostics.instructions
            ? [
                h.span(
                  [],
                  [
                    context.dragging
                      ? context.bypassed
                        ? 'Free placement'
                        : 'Release to apply · Escape cancels'
                      : 'Drag bends · arrows move · Alt bypasses grid',
                  ],
                ),
              ]
            : []),
        ],
      ),
    ],
  );
}
