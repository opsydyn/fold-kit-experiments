import type { EditorEvent, ZlozEdgeWaypointControlsContext } from '@opsydyn/foldkit-zloz';
import {
  zlozEdgeWaypointAction,
  zlozEdgeWaypointHandle,
  zlozEdgeWaypointReadout,
  type ZlozDiagnostics,
} from '@opsydyn/foldkit-zloz/foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';

/** Host-owned artwork composed from package-owned controls and diagnostics. */
export function customWaypointControls<M>(
  context: ZlozEdgeWaypointControlsContext & Readonly<{ diagnostics: ZlozDiagnostics }>,
  builder: HtmlBuilder<M>,
  onEvent: (event: EditorEvent) => M,
): Html {
  return builder.div(
    [
      builder.DataAttribute('workbench-bend-studio', ''),
      builder.Style({ position: 'absolute', inset: '0', 'pointer-events': 'none' }),
    ],
    [
      ...context.handles.map((handle) =>
        builder.div(
          [
            builder.Key(handle.waypoint.id),
            builder.Style({
              position: 'absolute',
              left: `${handle.waypoint.position.x}px`,
              top: `${handle.waypoint.position.y}px`,
              transform: `scale(${1 / context.zoom})`,
              width: '0',
              height: '0',
              'transform-origin': '0 0',
              display: 'grid',
              gap: '5px',
              'justify-items': 'center',
              'pointer-events': 'auto',
            }),
          ],
          [
            zlozEdgeWaypointHandle(
              builder,
              handle,
              [
                builder.Style({
                  position: 'absolute',
                  left: '0',
                  top: '0',
                  transform: 'translate(-50%, -50%)',
                  width: '32px',
                  height: '32px',
                  'border-radius': '8px',
                  border: '2px dashed var(--flow-selection)',
                  background: 'var(--flow-node-background)',
                  color: 'var(--flow-selection)',
                  cursor: 'move',
                }),
              ],
              ['◆'],
            ),
            ...[zlozEdgeWaypointReadout(builder, handle, context.diagnostics)].flatMap((readout) =>
              readout === null ? [] : [readout],
            ),
          ],
        ),
      ),
      builder.div(
        [
          builder.DataAttribute('flow-no-drag', ''),
          builder.Style({
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
            padding: '10px 12px',
            'border-radius': '12px',
            border: '2px solid var(--flow-selection)',
            background: 'var(--flow-node-background)',
            color: 'var(--flow-node-color)',
            'pointer-events': 'auto',
            display: 'flex',
            gap: '8px',
            'align-items': 'center',
            'white-space': 'normal',
          }),
        ],
        [
          builder.strong([], ['Routing studio']),
          zlozEdgeWaypointAction(builder, context.add, onEvent),
          ...context.handles.map((handle) =>
            zlozEdgeWaypointAction(builder, handle.remove, onEvent),
          ),
          zlozEdgeWaypointAction(builder, context.reset, onEvent),
          ...(context.reason ? [builder.span([], [context.reason])] : []),
          ...(context.diagnostics.instructions
            ? [
                builder.span(
                  [],
                  [
                    context.dragging && context.bypassed
                      ? 'Free placement'
                      : 'Drag ◆ · arrows · Alt for free placement',
                  ],
                ),
              ]
            : []),
        ],
      ),
    ],
  );
}
