/* oxlint-disable linteffect/no-return-in-arrow -- Pure composable view derivation; no effects or state publication. */
import type { Html, HtmlBuilder } from 'foldkit/html';

import { edgeEndpoints, portAnchor } from './geometry';
import type { ZlozGroupEditorPolicyV3 } from './group-editor-v3';
import { presentGroups } from './group-presentation';
import {
  groupWorkbenchBoxSelectionV3,
  groupWorkbenchGraphV3,
  type ZlozGroupWorkbenchV3,
} from './group-workbench-v3';
import { zlozPortAnchorHandle, type ZlozPortAnchorHandleRenderer } from './port-anchor-handle';
import { portEditReason } from './port-edit';
import type { Point, ResizeHandle, ZlozNode, ZlozPortAnchorSnapBypassModifier } from './types';
export type ZlozNativeResizeContextV3 = Readonly<{
  node: ZlozNode;
  handle: ResizeHandle;
  position: Point;
  disabledReason: string | null;
}>;
export type ZlozNativeInteractionOptionsV3<M> = Readonly<{
  resize?: boolean;
  portAnchors?: boolean;
  reconnect?: boolean;
  boxSelection?: boolean;
  pinchZoom?: boolean;
  portAnchorSnapBypass?: ZlozPortAnchorSnapBypassModifier;
  renderResize?: (context: ZlozNativeResizeContextV3, h: HtmlBuilder<M>) => Html | null;
  renderPortAnchor?: ZlozPortAnchorHandleRenderer<M>;
}>;
/** Native 2D resize handle; callers own styling/content while the scoped input owns gestures and arrows. */
export function zlozNativeResizeHandleV3<M>(
  h: HtmlBuilder<M>,
  context: ZlozNativeResizeContextV3,
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
  children: Parameters<HtmlBuilder<M>['button']>[1] = ['↘'],
): Html {
  return h.button(
    [
      h.Key(`resize:${context.node.id}:${context.handle}`),
      h.Type('button'),
      h.DataAttribute('flow-resize', context.node.id),
      h.DataAttribute('flow-resize-handle', context.handle),
      h.DataAttribute('zloz-native-resize', ''),
      h.AriaLabel(`Resize ${context.node.label}, ${context.handle}`),
      h.Title(context.disabledReason ?? 'Drag or use arrow keys to resize. Escape cancels.'),
      h.Disabled(context.disabledReason !== null),
      ...attributes,
      h.Style({
        position: 'absolute',
        left: `${context.position.x}px`,
        top: `${context.position.y}px`,
        transform: 'translate(-50%, -50%)',
        'min-width': '24px',
        'min-height': '24px',
        'pointer-events': 'auto',
        color: 'var(--flow-node-color, #172033)',
        background: 'var(--flow-node-background, #fff)',
        border: '1px solid var(--flow-node-border, #64748b)',
        'border-radius': '4px',
      }),
    ],
    children,
  );
}
/** Optional native interaction chrome in the world layer. Every publication still rechecks the full live plan. */
export function zlozGroupInteractionViewsV3<M>(
  h: HtmlBuilder<M>,
  model: ZlozGroupWorkbenchV3,
  options: ZlozNativeInteractionOptionsV3<M>,
  policy: ZlozGroupEditorPolicyV3 = {},
): readonly Html[] {
  const graph = groupWorkbenchGraphV3(model, policy),
    nodes = presentGroups(graph, model.collapsedGroupIds).nodes;
  const reason = model.editor.readOnly
    ? 'This diagram is read-only.'
    : model.editor.activity.type === 'busy'
      ? model.editor.activity.reason
      : null;
  const views: Html[] = [];
  for (const node of nodes.filter((n) => model.selectedNodeIds.includes(n.id))) {
    if (options.resize) {
      const protectedReason = policy.canResizeNode?.(node, model.editor.document.graph);
      const context: ZlozNativeResizeContextV3 = {
        node,
        handle: 'bottom-right',
        position: { x: node.position.x + node.size.width, y: node.position.y + node.size.height },
        disabledReason:
          reason ??
          (protectedReason == null ? null : protectedReason.trim() || 'Size is protected.'),
      };
      const custom = options.renderResize?.(context, h);
      if (custom !== null) views.push(custom ?? zlozNativeResizeHandleV3(h, context));
      if (context.disabledReason)
        views.push(
          h.p(
            [
              h.Style({
                position: 'absolute',
                left: `${node.position.x}px`,
                top: `${node.position.y + node.size.height + 24}px`,
              }),
            ],
            [context.disabledReason],
          ),
        );
    }
    if (options.portAnchors)
      for (const port of node.ports) {
        const anchor = portAnchor(port, node),
          disabledReason =
            reason ??
            portEditReason(
              { operation: 'position', node, port },
              model.editor.document.graph,
              policy.canEditPort,
            );
        const context = {
          node,
          port,
          anchor,
          position: {
            x: node.position.x + anchor.x * node.size.width + (port.side === 'left' ? -24 : 24),
            y:
              node.position.y +
              anchor.y * node.size.height +
              (port.side === 'top' ? -24 : port.side === 'bottom' ? 24 : 0),
          },
          active:
            model.gesture.type === 'anchor' &&
            model.gesture.endpoint.node === node.id &&
            model.gesture.endpoint.port === port.id,
          disabledReason,
          snapBypassModifier: options.portAnchorSnapBypass,
          snapBypassed: model.gesture.type === 'anchor' && model.gesture.bypassed,
          snappedSide: model.gesture.type === 'anchor' ? model.gesture.snap?.side : null,
          snappedCorner: model.gesture.type === 'anchor' ? model.gesture.snap?.corner : undefined,
          snappedMidpoint:
            model.gesture.type === 'anchor' ? model.gesture.snap?.midpoint : undefined,
        };
        const custom = options.renderPortAnchor?.(context, h);
        if (custom !== null)
          views.push(
            custom ??
              zlozPortAnchorHandle(
                h,
                context,
                [
                  h.Style({
                    width: '24px',
                    height: '24px',
                    background: 'var(--flow-node-background, #fff)',
                    color: 'var(--flow-node-color, #172033)',
                    border: '1px solid var(--flow-node-border, #64748b)',
                  }),
                ],
                ['⋮'],
              ),
          );
        if (disabledReason)
          views.push(
            h.p(
              [
                h.Style({
                  position: 'absolute',
                  left: `${context.position.x}px`,
                  top: `${context.position.y + 24}px`,
                }),
              ],
              [disabledReason],
            ),
          );
      }
  }
  if (options.reconnect) {
    const edge = graph.edges.find((e) => e.id === model.selectedEdgeId);
    if (edge) {
      const points = edgeEndpoints(graph, edge);
      for (const end of ['source', 'target'] as const) {
        const protectedReason = policy.canReconnect?.(edge, end, model.editor.document.graph),
          disabledReason =
            reason ??
            (protectedReason == null
              ? null
              : protectedReason.trim() || 'This endpoint is protected.');
        views.push(
          h.button(
            [
              h.Key(`reconnect:${edge.id}:${end}`),
              h.Type('button'),
              h.DataAttribute('flow-reconnect', edge.id),
              h.DataAttribute('flow-edge-end', end),
              h.Disabled(disabledReason !== null),
              h.AriaLabel(`Reconnect ${end} of ${edge.label ?? edge.id}`),
              h.Title(
                disabledReason ??
                  'Drag to another port. Escape cancels. The inspector offers keyboard reconnection.',
              ),
              h.Style({
                position: 'absolute',
                left: `${points[end].x}px`,
                top: `${points[end].y - 30}px`,
                'min-width': '24px',
                'min-height': '24px',
                color: 'var(--flow-node-color, #172033)',
                background: 'var(--flow-node-background, #fff)',
              }),
            ],
            ['↗'],
          ),
        );
        if (disabledReason)
          views.push(
            h.p(
              [
                h.Style({
                  position: 'absolute',
                  left: `${points[end].x}px`,
                  top: `${points[end].y + 24}px`,
                }),
              ],
              [disabledReason],
            ),
          );
      }
    }
  }
  const box = options.boxSelection ? groupWorkbenchBoxSelectionV3(model, policy) : null;
  if (box)
    views.push(
      h.div(
        [
          h.AriaHidden(true),
          h.DataAttribute('zloz-box-preview', ''),
          h.Style({
            position: 'absolute',
            left: `${box.bounds.left}px`,
            top: `${box.bounds.top}px`,
            width: `${box.bounds.right - box.bounds.left}px`,
            height: `${box.bounds.bottom - box.bounds.top}px`,
            border: '2px solid var(--flow-selection, #2563eb)',
            background: 'color-mix(in srgb, var(--flow-selection, #2563eb) 12%, transparent)',
            'pointer-events': 'none',
          }),
        ],
        [],
      ),
    );
  return views;
}
