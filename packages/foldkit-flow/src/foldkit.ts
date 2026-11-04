import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';

import {
  boxBounds,
  edgePath,
  maximumZoom,
  minimapGeometry,
  minimumZoom,
  portPosition,
  screenToWorld,
} from './geometry';
import { FlowInput } from './mount';
import type { EditorEvent, EditorState, FlowEdge, FlowNode, Port } from './types';

export type FlowViewOptions<M> = Readonly<{
  /** Unique within the document; prefixes accessible descriptions and SVG markers. */
  id: string;
  label: string;
  onEvent: (event: EditorEvent) => M;
  /** Uses the host's builder; arbitrary FoldKit controls retain their normal behaviour. */
  renderNode?: (node: FlowNode, h: HtmlBuilder<M>) => Html;
  edgeAppearance?: (edge: FlowEdge) => Readonly<{
    stroke?: string;
    strokeWidth?: number;
    dashArray?: string;
  }>;
  /** Classes on the editor root, including classes produced by Pleat's cssClass(). */
  themeClassName?: string;
  resizeHandles?: boolean;
  minimap?: boolean;
  viewportControls?: boolean;
  height?: number;
}>;
function viewportControls<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  onEvent: (event: EditorEvent) => M,
): Html {
  const { surface, viewport } = state;
  const point = { x: (surface?.width ?? 0) / 2, y: (surface?.height ?? 0) / 2 };
  const unavailable = !surface || state.gesture.type !== 'idle';
  const button = (label: string, event: EditorEvent, disabled: boolean) =>
    h.button(
      [
        h.Type('button'),
        h.Disabled(disabled),
        h.OnClick(onEvent(event)),
        h.Style({
          'min-height': '44px',
          padding: '0 12px',
          color: 'var(--flow-node-color, #172033)',
          background: 'var(--flow-node-background, #fff)',
          border: '1px solid var(--flow-canvas-border, #94a3b8)',
          'border-radius': '6px',
        }),
      ],
      [label],
    );
  const step = 1.25;
  return h.div(
    [
      h.Role('group'),
      h.AriaLabel('Viewport controls'),
      h.Style({
        display: 'flex',
        gap: '8px',
        'flex-wrap': 'wrap',
        'align-items': 'center',
        'margin-bottom': '8px',
      }),
    ],
    [
      button(
        'Zoom in',
        { type: 'Zoomed', point, factor: step },
        unavailable || viewport.zoom >= maximumZoom,
      ),
      button(
        'Zoom out',
        { type: 'Zoomed', point, factor: 1 / step },
        unavailable || viewport.zoom <= minimumZoom,
      ),
      button('Fit view', { type: 'FitViewClicked' }, unavailable || state.graph.nodes.length === 0),
      h.span([], [`${Math.round(viewport.zoom * 100)}%`]),
    ],
  );
}

function portStyle(port: Port) {
  switch (port.side) {
    case 'left':
      return {
        right: 'auto',
        bottom: 'auto',
        left: '-12px',
        top: `calc(${port.offset * 100}% - 12px)`,
      };
    case 'right':
      return {
        left: 'auto',
        bottom: 'auto',
        right: '-12px',
        top: `calc(${port.offset * 100}% - 12px)`,
      };
    case 'top':
      return {
        right: 'auto',
        bottom: 'auto',
        top: '-12px',
        left: `calc(${port.offset * 100}% - 12px)`,
      };
    case 'bottom':
      return {
        right: 'auto',
        top: 'auto',
        bottom: '-12px',
        left: `calc(${port.offset * 100}% - 12px)`,
      };
  }
}
/** A normal FoldKit view: all state and message handling belong to its parent. */
export function flowView<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  options: FlowViewOptions<M>,
): Html {
  const minimap =
    options.minimap && state.surface && state.graph.nodes.length > 0
      ? minimapGeometry(state.graph, state.surface, state.viewport)
      : null;
  const descriptionId = `${options.id}-help`;
  const transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.zoom})`;
  const drag = state.gesture.type === 'connection-drag' ? state.gesture : null;
  const source = state.connection;
  const sourceNode = source && state.graph.nodes.find((node) => node.id === source.node);
  const preview =
    drag && source && sourceNode
      ? {
          from: portPosition(sourceNode, source.port),
          to: screenToWorld(drag.point, state.viewport),
        }
      : null;
  const selectionBox =
    state.gesture.type === 'box-selection'
      ? boxBounds(state.gesture.origin, state.gesture.point)
      : null;
  const groups = state.graph.nodes.filter((node) => node.kind === 'group');
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  function depth(node: FlowNode): number {
    const parent = node.parentId && groupsById.get(node.parentId);
    return parent ? depth(parent) + 1 : 0;
  }
  const boundaries = groups
    .sort((a, b) => depth(a) - depth(b))
    .map((node) =>
      h.div(
        [
          h.Key(node.id),
          h.DataAttribute('flow-group', node.id),
          h.Style({
            position: 'absolute',
            left: `${node.position.x}px`,
            top: `${node.position.y}px`,
            width: `${node.size.width}px`,
            height: `${node.size.height}px`,
            'box-sizing': 'border-box',
            'border-radius': 'var(--flow-node-radius, 8px)',
            border: state.selectedNodes.includes(node.id)
              ? '2px solid var(--flow-selection, #2563eb)'
              : '2px dashed var(--flow-node-border, #64748b)',
            background: 'var(--flow-group-background, rgb(100 116 139 / 0.08))',
            'pointer-events': 'none',
          }),
        ],
        [
          h.button(
            [
              h.Type('button'),
              h.DataAttribute('flow-handle', node.id),
              h.AriaLabel(`Select ${node.label}`),
              h.AriaPressed(String(state.selectedNodes.includes(node.id))),
              h.AriaDescribedBy(descriptionId),
              h.Style({ 'pointer-events': 'auto', cursor: state.readOnly ? 'pointer' : 'grab' }),
            ],
            [node.label],
          ),
        ],
      ),
    );
  const nodes = state.graph.nodes
    .filter((node) => node.kind !== 'group')
    .map((node) =>
      h.div(
        [
          h.Key(node.id),
          h.DataAttribute('flow-node', node.id),
          h.DataAttribute('flow-x', String(node.position.x)),
          h.DataAttribute('flow-y', String(node.position.y)),
          h.Style({
            position: 'absolute',
            left: `${node.position.x}px`,
            top: `${node.position.y}px`,
            width: `${node.size.width}px`,
            'min-height': '64px',
            'box-sizing': 'border-box',
            border: state.selectedNodes.includes(node.id)
              ? '2px solid var(--flow-selection, #2563eb)'
              : '2px solid var(--flow-node-border, #64748b)',
            'border-radius': 'var(--flow-node-radius, 8px)',
            background: 'var(--flow-node-background, #fff)',
            color: 'var(--flow-node-color, #172033)',
            padding: '12px',
            'pointer-events': 'auto',
          }),
        ],
        [
          h.button(
            [
              h.Type('button'),
              h.DataAttribute('flow-handle', node.id),
              h.AriaLabel(`Select ${node.label}`),
              h.AriaPressed(String(state.selectedNodes.includes(node.id))),
              h.AriaDescribedBy(descriptionId),
              h.Style({
                display: 'block',
                width: '100%',
                'min-height': '32px',
                'text-align': 'left',
                cursor: state.readOnly ? 'pointer' : 'grab',
                'font-weight': '600',
                color: 'inherit',
                background: 'transparent',
                border: 'none',
              }),
            ],
            [node.label],
          ),
          ...(options.resizeHandles && !state.readOnly
            ? [
                h.span(
                  [
                    h.DataAttribute('flow-resize', node.id),
                    h.AriaHidden(true),
                    h.Style({
                      position: 'absolute',
                      right: '-8px',
                      bottom: '-8px',
                      width: '24px',
                      height: '24px',
                      display: 'grid',
                      'place-items': 'center',
                      cursor: 'ew-resize',
                      'touch-action': 'none',
                      'user-select': 'none',
                      color: 'var(--flow-control-color, #fff)',
                      background: 'var(--flow-resize-background, #334155)',
                      'border-radius': '6px',
                    }),
                  ],
                  ['↔'],
                ),
              ]
            : []),
          ...(options.renderNode ? [options.renderNode(node, h)] : []),
          ...node.ports.map((port) =>
            h.button(
              [
                h.Key(port.id),
                h.Type('button'),
                h.DataAttribute('flow-port', port.id),
                h.DataAttribute('flow-port-kind', port.kind),
                h.DataAttribute('flow-owner', node.id),
                h.Disabled(state.readOnly),
                h.AriaLabel(
                  `${port.kind === 'output' ? 'Connect from' : 'Connect to'} ${node.label}: ${port.label ?? port.id}`,
                ),
                h.AriaPressed(
                  String(state.connection?.node === node.id && state.connection.port === port.id),
                ),
                h.Style({
                  ...portStyle(port),
                  position: 'absolute',
                  width: '24px',
                  height: '24px',
                  padding: '0',
                  'border-radius': '50%',
                  border:
                    drag?.target?.node === node.id && drag.target.port === port.id
                      ? '3px solid var(--flow-node-color, #172033)'
                      : '2px solid var(--flow-port-border, #fff)',
                  'box-shadow':
                    drag?.target?.node === node.id && drag.target.port === port.id
                      ? '0 0 0 3px var(--flow-valid-target, #0f766e)'
                      : 'none',
                  background:
                    port.kind === 'output'
                      ? 'var(--flow-output-port, #2563eb)'
                      : 'var(--flow-input-port, #0f766e)',
                  color: 'var(--flow-control-color, #fff)',
                  cursor: 'crosshair',
                }),
              ],
              [port.kind === 'output' ? '+' : '−'],
            ),
          ),
        ],
      ),
    );
  const markerId = `${options.id}-arrow`;
  const edges = state.graph.edges.map((edge) => {
    const appearance = options.edgeAppearance?.(edge);
    return h.path(
      [
        h.Key(`edge:${edge.id}`),
        h.D(
          edgePath(state.graph, edge, state.routes.find((route) => route.id === edge.id)?.points),
        ),
        h.Fill('none'),
        h.Stroke(
          state.selectedEdges.includes(edge.id)
            ? 'var(--flow-selection, #2563eb)'
            : (appearance?.stroke ?? 'var(--flow-edge, #64748b)'),
        ),
        h.StrokeWidth(
          appearance?.strokeWidth === undefined
            ? 'var(--flow-edge-width, 3)'
            : String(appearance.strokeWidth),
        ),
        h.StrokeDasharray(appearance?.dashArray ?? 'none'),
        h.MarkerEnd(`url(#${markerId})`),
        h.DataAttribute('flow-edge', edge.id),
        h.Style({ 'pointer-events': 'stroke', cursor: 'pointer' }),
      ],
      [],
    );
  });
  const handles = state.readOnly
    ? []
    : state.graph.edges
        .filter((edge) => state.selectedEdges.includes(edge.id))
        .flatMap((edge) =>
          (['source', 'target'] as const).flatMap((end) => {
            const endpoint = edge[end];
            const node = state.graph.nodes.find((item) => item.id === endpoint.node);
            const port = node?.ports.find((item) => item.id === endpoint.port);
            if (!node || !port) return [];
            const position = portPosition(node, port.id);
            const offsets = {
              left: [-24, 0],
              right: [24, 0],
              top: [0, -24],
              bottom: [0, 24],
            } as const;
            const [x, y] = offsets[port.side];
            return [
              h.circle(
                [
                  h.Key(`reconnect:${edge.id}:${end}`),
                  h.DataAttribute('flow-reconnect', edge.id),
                  h.DataAttribute('flow-edge-end', end),
                  h.Cx(String(position.x + x)),
                  h.Cy(String(position.y + y)),
                  h.R('9'),
                  h.Fill('var(--flow-selection, #2563eb)'),
                  h.Stroke('var(--flow-port-border, #fff)'),
                  h.StrokeWidth('2'),
                  h.Style({ 'pointer-events': 'all', cursor: 'grab' }),
                ],
                [],
              ),
            ];
          }),
        );
  return h.div(
    [
      h.Id(options.id),
      h.Class(options.themeClassName ? `foldkit-flow ${options.themeClassName}` : 'foldkit-flow'),
    ],
    [
      h.p(
        [h.Id(descriptionId)],
        [
          'Drag a node title to move it. Drag the background to pan, or Shift-drag to select nodes. Scroll to zoom. Tab to a title, then use arrow keys to move it. Drag from an output to an input, or activate the two ports in order with Enter or Space. Select an edge to drag either endpoint handle. Escape cancels.',
        ],
      ),
      ...(options.viewportControls ? [viewportControls(h, state, options.onEvent)] : []),
      h.div(
        [
          h.Key('surface'),
          h.DataAttribute('flow-surface', options.id),
          h.DataAttribute('flow-readonly', String(state.readOnly)),
          h.Tabindex(0),
          h.Role('group'),
          h.AriaLabel(options.label),
          h.AriaDescribedBy(descriptionId),
          h.OnMount(Mount.mapMessage(FlowInput(), (message) => options.onEvent(message.event))),
          h.Style({
            position: 'relative',
            overflow: 'hidden',
            height: `${options.height ?? 440}px`,
            width: '100%',
            'touch-action': 'none',
            background: 'var(--flow-background, #eef2f6)',
            border: '1px solid var(--flow-canvas-border, #94a3b8)',
            'border-radius': '10px',
          }),
        ],
        [
          h.div(
            [
              h.Style({
                position: 'absolute',
                inset: '0',
                transform,
                'transform-origin': '0 0',
                'pointer-events': 'none',
              }),
            ],
            [
              ...boundaries,
              h.svg(
                [
                  h.Width('100%'),
                  h.Height('100%'),
                  h.AriaHidden(true),
                  h.Style({ position: 'absolute', overflow: 'visible', 'pointer-events': 'none' }),
                ],
                [
                  h.defs(
                    [],
                    [
                      h.marker(
                        [
                          h.Id(markerId),
                          h.ViewBox('0 0 10 10'),
                          h.RefX('9'),
                          h.RefY('5'),
                          h.MarkerWidth('6'),
                          h.MarkerHeight('6'),
                          h.Orient('auto-start-reverse'),
                        ],
                        [
                          h.path(
                            [h.D('M0,0 L10,5 L0,10 Z'), h.Fill('var(--flow-edge, #64748b)')],
                            [],
                          ),
                        ],
                      ),
                    ],
                  ),
                  ...edges,
                  ...handles,
                  ...(preview
                    ? [
                        h.path(
                          [
                            h.Key('connection-preview'),
                            h.DataAttribute('flow-connection-preview', ''),
                            h.D(
                              `M ${preview.from.x} ${preview.from.y} L ${preview.to.x} ${preview.to.y}`,
                            ),
                            h.Fill('none'),
                            h.Stroke(
                              drag?.target
                                ? 'var(--flow-valid-target, #0f766e)'
                                : 'var(--flow-selection, #2563eb)',
                            ),
                            h.StrokeWidth('3'),
                            h.StrokeDasharray('6 4'),
                          ],
                          [],
                        ),
                      ]
                    : []),
                ],
              ),
              ...nodes,
              ...(selectionBox
                ? [
                    h.div(
                      [
                        h.AriaHidden(true),
                        h.DataAttribute('flow-selection-box', ''),
                        h.Style({
                          position: 'absolute',
                          left: `${selectionBox.left}px`,
                          top: `${selectionBox.top}px`,
                          width: `${selectionBox.right - selectionBox.left}px`,
                          height: `${selectionBox.bottom - selectionBox.top}px`,
                          border: '1px solid var(--flow-selection, #2563eb)',
                          background: 'var(--flow-selection-background, rgb(37 99 235 / 0.12))',
                          'box-sizing': 'border-box',
                          'pointer-events': 'none',
                        }),
                      ],
                      [],
                    ),
                  ]
                : []),
            ],
          ),
          ...(minimap
            ? [
                h.svg(
                  [
                    h.Key('minimap'),
                    h.DataAttribute('flow-minimap', ''),
                    h.Role('img'),
                    h.AriaLabel('Diagram overview'),
                    h.ViewBox(`${minimap.x} ${minimap.y} ${minimap.width} ${minimap.height}`),
                    h.Width('160'),
                    h.Height('100'),
                    h.Style({
                      position: 'absolute',
                      right: '10px',
                      bottom: '10px',
                      width: 'min(160px, 34%)',
                      height: 'auto',
                      'aspect-ratio': '8 / 5',
                      background: 'var(--flow-node-background, #fff)',
                      'border-radius': '6px',
                      'box-shadow': '0 0 0 1px var(--flow-canvas-border, #94a3b8)',
                      cursor: 'crosshair',
                    }),
                  ],
                  [
                    ...[
                      ...state.graph.nodes.filter((node) => node.kind === 'group'),
                      ...state.graph.nodes.filter((node) => node.kind !== 'group'),
                    ].map((node) =>
                      h.rect(
                        [
                          h.Key(`mini:${node.id}`),
                          h.X(String(node.position.x)),
                          h.Y(String(node.position.y)),
                          h.Width(String(node.size.width)),
                          h.Height(String(node.size.height)),
                          h.Fill(
                            node.kind === 'group'
                              ? 'var(--flow-group-background, rgb(100 116 139 / 0.15))'
                              : 'var(--flow-node-border, #64748b)',
                          ),
                        ],
                        [],
                      ),
                    ),
                    h.rect(
                      [
                        h.DataAttribute('flow-minimap-viewport', ''),
                        h.X(String(minimap.visible.x)),
                        h.Y(String(minimap.visible.y)),
                        h.Width(String(minimap.visible.width)),
                        h.Height(String(minimap.visible.height)),
                        h.Fill('none'),
                        h.Stroke('var(--flow-selection, #2563eb)'),
                        h.Style({ 'vector-effect': 'non-scaling-stroke' }),
                      ],
                      [],
                    ),
                  ],
                ),
              ]
            : []),
        ],
      ),
      h.div(
        [h.Role('status'), h.AriaLive('polite'), h.Style({ 'min-height': '1.5em' })],
        [
          state.notice ??
            `${state.graph.nodes.length} nodes, ${state.graph.edges.length} connections`,
        ],
      ),
      h.div(
        [h.Role('group'), h.AriaLabel('Connections')],
        state.graph.edges.map((edge) =>
          h.button(
            [
              h.Key(edge.id),
              h.Type('button'),
              h.OnClick(options.onEvent({ type: 'EdgeSelected', id: edge.id, additive: false })),
              h.AriaPressed(String(state.selectedEdges.includes(edge.id))),
            ],
            [
              edge.label ??
                `${edge.source.node}:${edge.source.port} → ${edge.target.node}:${edge.target.port}`,
            ],
          ),
        ),
      ),
    ],
  );
}
