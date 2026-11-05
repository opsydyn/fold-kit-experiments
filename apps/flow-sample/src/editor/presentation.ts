import {
  portBoundaryPosition,
  type Endpoint,
  type EditorEvent,
  type FlowGraph,
  type FlowNode,
  type Point,
  type Port,
} from '@opsydyn/foldkit-flow';
import {
  flowDragHandle,
  flowEdgeLabelBadge,
  flowEdgeToolbarButton,
  flowContextAction,
  flowContextTrigger,
  flowConnectionButton,
  type FlowConnectionsContext,
  type FlowResizeReadoutContext,
  flowContextDimensionInput,
  type FlowContextAction,
  type FlowContextMenuContext,
  flowEdgePathStyleSelect,
  type FlowEdgeToolbarContext,
  flowEdgeLabelForm,
  flowEdgeLabelInput,
  flowEdgeLabelCancel,
  type FlowEdgeLabelContext,
  type FlowEdgeLabelEditorContext,
  flowGroupFrame,
  flowNodeFrame,
  flowPort,
  flowResizeHandle,
  type FlowNodeRenderContext,
} from '@opsydyn/foldkit-flow/foldkit';
import type { HtmlBuilder } from 'foldkit/html';

import { Message } from './message';

/** A complete shell composed exclusively from supported package primitives. */
export function orbitNode(context: FlowNodeRenderContext, h: HtmlBuilder<Message>) {
  const selected = context.state.selectedNodes.includes(context.node.id);
  return flowNodeFrame(
    h,
    context,
    [h.Class('orbit-node'), h.Style({ height: `${context.node.size.width}px`, color: '#fff' })],
    [
      flowDragHandle(
        h,
        context,
        [
          h.Style({
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            padding: '0',
            border: '0',
            background: 'transparent',
            color: 'inherit',
            'border-radius': '50%',
            cursor: context.state.readOnly ? 'pointer' : 'grab',
          }),
        ],
        [
          h.svg(
            [
              h.ViewBox('0 0 100 100'),
              h.Width('100%'),
              h.Height('100%'),
              h.AriaHidden(true),
              h.Style({ display: 'block', 'pointer-events': 'none' }),
            ],
            [
              h.circle(
                [
                  h.Cx('50'),
                  h.Cy('50'),
                  h.R('48'),
                  h.Fill('#172554'),
                  h.Stroke(selected ? '#f97316' : '#38bdf8'),
                  h.StrokeWidth(selected ? '3' : '1'),
                ],
                [],
              ),
              h.circle(
                [
                  h.Cx('50'),
                  h.Cy('50'),
                  h.R('41'),
                  h.Fill('none'),
                  h.Stroke('#38bdf8'),
                  h.StrokeWidth('0.4'),
                  h.StrokeDasharray('2 3'),
                ],
                [],
              ),
            ],
          ),
          h.span(
            [
              h.Style({
                position: 'absolute',
                inset: '28px',
                display: 'grid',
                'place-items': 'center',
                'font-size': '16px',
                'font-weight': '700',
                'line-height': '1.3',
                'pointer-events': 'none',
              }),
            ],
            [context.node.label],
          ),
        ],
      ),
      ...(context.resizeHandles.length
        ? [
            flowResizeHandle(
              h,
              context,
              'right',
              [
                h.Style({
                  position: 'absolute',
                  bottom: '6px',
                  left: 'calc(50% - 14px)',
                  width: '28px',
                  height: '28px',
                  padding: '0',
                  background: '#172554',
                  color: '#7dd3fc',
                  border: '1px solid #7dd3fc',
                  'border-radius': '50%',
                  cursor: 'ew-resize',
                }),
              ],
              ['↔'],
            ),
          ]
        : []),
      ...context.node.ports.map((port) =>
        flowPort(
          h,
          context,
          port,
          [
            h.Style({
              width: '28px',
              height: '28px',
              padding: '0',
              border: '2px solid #172554',
              'border-radius': '6px',
              background: port.kind === 'output' ? '#fb923c' : '#7dd3fc',
              color: '#172554',
              'font-weight': '700',
              cursor: 'crosshair',
            }),
          ],
          [port.kind === 'output' ? '→' : '←'],
        ),
      ),
    ],
  );
}

export function orbitGroup(context: FlowNodeRenderContext, h: HtmlBuilder<Message>) {
  const selected = context.state.selectedNodes.includes(context.node.id);
  return flowGroupFrame(
    h,
    context,
    [
      h.Class('orbit-boundary'),
      h.Style({
        border: `2px ${context.dropTarget ? 'solid' : 'dotted'} ${selected || context.dropTarget ? '#f97316' : '#38bdf8'}`,
        'border-radius': '28px',
        background: context.collapsed ? '#dbeafe' : 'rgb(56 189 248 / 0.05)',
        padding: '6px',
        display: 'flex',
        gap: '6px',
        'align-items': 'flex-start',
      }),
    ],
    [
      flowDragHandle(
        h,
        context,
        [
          h.Style({
            background: '#172554',
            color: '#fff',
            border: '0',
            'border-radius': '18px',
            padding: '8px 14px',
            'min-height': '32px',
            cursor: 'grab',
          }),
        ],
        [context.node.label],
      ),
      h.button(
        [
          h.Type('button'),
          h.AriaLabel(`${context.collapsed ? 'Expand' : 'Collapse'} ${context.node.label}`),
          h.AriaExpanded(!context.collapsed),
          h.OnClick(
            Message.ObservedFlowInput({
              message: { type: 'GroupCollapseToggled', id: context.node.id },
            }),
          ),
          h.Style({
            'pointer-events': 'auto',
            width: '34px',
            height: '34px',
            background: '#172554',
            color: '#fff',
            border: '0',
            'border-radius': '50%',
            cursor: 'pointer',
          }),
        ],
        [context.collapsed ? '+' : '−'],
      ),
      ...context.resizeHandles,
    ],
  );
}

/** One endpoint-only curve function serves finished edges and incomplete previews. */
function raisedPath({
  source,
  target,
}: Readonly<{
  source: import('@opsydyn/foldkit-flow').Point;
  target: import('@opsydyn/foldkit-flow').Point;
}>) {
  const control = { x: (source.x + target.x) / 2, y: Math.min(source.y, target.y) - 100 };
  return {
    path: `M${source.x},${source.y} Q${control.x},${control.y} ${target.x},${target.y}`,
    labelPosition: {
      x: (source.x + 2 * control.x + target.x) / 4,
      y: (source.y + 2 * control.y + target.y) / 4,
    },
  };
}

type CurveContext = Readonly<{
  graph: FlowGraph;
  source: Point;
  target: Point;
  sourceGroup: FlowNode | undefined;
  targetGroup: FlowNode | undefined;
}>;

/** Custom anchors use side-aware tangents so diagonal endpoints remain visible at the circle perimeter. */
function connectionPath(
  context: CurveContext,
  sourceEndpoint: Endpoint | null,
  targetEndpoint: Endpoint | null,
) {
  const reference = (endpoint: Endpoint | null) => {
    const node = context.graph.nodes.find((node) => node.id === endpoint?.node);
    const port = node?.ports.find((port) => port.id === endpoint?.port);
    return node && port ? { node, port } : undefined;
  };
  const sourceRef = reference(sourceEndpoint),
    targetRef = reference(targetEndpoint);
  if (
    context.sourceGroup ||
    context.targetGroup ||
    (!sourceRef?.port.anchor && !targetRef?.port.anchor)
  )
    return raisedPath(context);
  const lead = (
    point: Point,
    ref: Readonly<{ node: FlowNode; port: Port }> | undefined,
    fallback: number,
  ): Point => {
    if (!ref) return { x: point.x + fallback, y: point.y };
    const boundary = portBoundaryPosition(ref.node, ref.port.id);
    const direction = {
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
      top: { x: 0, y: -1 },
      bottom: { x: 0, y: 1 },
    }[ref.port.side];
    return { x: boundary.x + direction.x * 64, y: boundary.y + direction.y * 64 };
  };
  const { source, target } = context;
  const direction = target.x >= source.x ? 64 : -64;
  const first = lead(source, sourceRef, direction),
    second = lead(target, targetRef, -direction);
  return {
    path: `M${source.x},${source.y} C${first.x},${first.y} ${second.x},${second.y} ${target.x},${target.y}`,
    labelPosition: {
      x: (source.x + 3 * first.x + 3 * second.x + target.x) / 8,
      y: (source.y + 3 * first.y + 3 * second.y + target.y) / 8,
    },
  };
}

/** Preserve explicit authored styles and layout routing for finished edges. */
export const raisedEdge: import('@opsydyn/foldkit-flow').FlowEdgeGeometryPolicy = (context) => {
  if (context.edge.pathStyle !== undefined || context.route) return undefined;
  return connectionPath(context, context.edge.source, context.edge.target);
};

/** Reconnection drops invalidate layout routing; authored styles still use the built-in geometry. */
export const raisedConnection: import('@opsydyn/foldkit-flow').FlowConnectionGeometryPolicy = (
  context,
) => {
  if (context.edge?.pathStyle !== undefined) return undefined;
  return connectionPath(context, context.sourceEndpoint, context.targetEndpoint);
};

const flowEvent = (message: EditorEvent) => Message.ObservedFlowInput({ message });

export function edgeBadge(context: FlowEdgeLabelContext, h: HtmlBuilder<Message>) {
  return flowEdgeLabelBadge(
    h,
    context,
    flowEvent,
    [
      h.Class('custom-edge-badge'),
      h.Style({
        display: 'inline-flex',
        'align-items': 'center',
        gap: '6px',
        padding: '5px 10px',
        border: '1px solid #38bdf8',
        'border-radius': '999px',
        background: context.selected ? '#075985' : '#f0f9ff',
        color: context.selected ? '#fff' : '#0c4a6e',
        cursor: context.readOnly ? 'inherit' : 'pointer',
        'font-size': '13px',
      }),
    ],
    [
      h.span([h.AriaHidden(true)], ['↗']),
      h.span(
        [
          h.Style({
            'max-width': '180px',
            overflow: 'hidden',
            'text-overflow': 'ellipsis',
            'white-space': 'nowrap',
          }),
        ],
        [context.edge.label || 'Add label'],
      ),
    ],
  );
}

export function edgeBadgeEditor(context: FlowEdgeLabelEditorContext, h: HtmlBuilder<Message>) {
  return flowEdgeLabelForm(
    h,
    context,
    flowEvent,
    [
      h.Class('custom-edge-editor'),
      h.Style({
        display: 'flex',
        gap: '6px',
        padding: '6px',
        border: '2px solid #38bdf8',
        'border-radius': '12px',
        background: '#f0f9ff',
        'box-shadow': '0 4px 12px #0c4a6e33',
      }),
    ],
    [
      flowEdgeLabelInput(h, context, flowEvent, [
        h.Style({
          width: '145px',
          padding: '6px 8px',
          border: '1px solid #7dd3fc',
          'border-radius': '6px',
        }),
      ]),
      h.button(
        [
          h.Type('submit'),
          h.Style({
            border: '0',
            background: '#075985',
            color: '#fff',
            'border-radius': '6px',
            padding: '0 10px',
          }),
        ],
        ['Apply label'],
      ),
      flowEdgeLabelCancel(h, context, flowEvent, [], ['Discard']),
    ],
  );
}

export function compactEdgeToolbar(context: FlowEdgeToolbarContext, h: HtmlBuilder<Message>) {
  return h.div(
    [
      h.Class('compact-edge-actions'),
      h.Style({
        display: 'flex',
        gap: '6px',
        'align-items': 'center',
        'flex-wrap': 'wrap',
        width: 'fit-content',
        'max-width': '100%',
        margin: '0 auto',
        padding: '5px',
        background: '#f0f9ff',
        border: '1px solid #38bdf8',
        'border-radius': '14px',
        'box-shadow': '0 2px 8px #0c4a6e33',
      }),
    ],
    [
      flowEdgePathStyleSelect(h, context, flowEvent, [
        h.Style({
          'min-height': '36px',
          padding: '0 8px',
          border: '1px solid #7dd3fc',
          'border-radius': '9px',
          background: '#fff',
          color: '#0c4a6e',
        }),
      ]),
      flowEdgeToolbarButton(
        h,
        context.actions.deleteEdge,
        flowEvent,
        [
          h.Style({
            'min-height': '36px',
            padding: '0 12px',
            border: '0',
            'border-radius': '9px',
            background: '#fee2e2',
            color: '#991b1b',
            cursor: 'pointer',
          }),
        ],
        ['Delete edge'],
      ),
    ],
  );
}

export function customContextMenu(context: FlowContextMenuContext, h: HtmlBuilder<Message>) {
  const button = (action: FlowContextAction) =>
    flowContextAction(
      h,
      action,
      flowEvent,
      [
        h.Style({
          'min-height': '36px',
          padding: '0 8px',
          'text-align': 'left',
          'border-radius': '7px',
          border: '1px solid #a5b4fc',
          background: action.pressed ? '#3730a3' : '#fff',
          color: action.pressed ? '#fff' : '#312e81',
          cursor: 'pointer',
        }),
      ],
      [action.label],
    );
  const group = context.kind === 'node' ? context.group : undefined;
  return h.div(
    [
      h.Class('custom-context-menu'),
      h.Style({
        display: 'grid',
        gap: '6px',
        padding: '8px',
        border: '1px solid #a5b4fc',
        'border-radius': '12px',
        background: '#eef2ff',
        color: '#312e81',
        'box-shadow': '0 4px 12px #312e8133',
      }),
    ],
    [
      h.strong(
        [],
        [context.kind === 'node' ? context.node.label : (context.edge.label ?? 'Connection')],
      ),
      ...(context.kind === 'edge'
        ? [button(context.rename), button(context.deleteEdge)]
        : [
            ...(group
              ? [
                  ...(group.showMeasurements
                    ? [
                        h.label(
                          [
                            h.Style({
                              display: 'grid',
                              'grid-template-columns': 'auto minmax(0, 1fr)',
                              gap: '8px',
                              'align-items': 'center',
                            }),
                          ],
                          [
                            'Width',
                            flowContextDimensionInput(h, group, 'width', flowEvent, [
                              h.Style({
                                width: '100%',
                                'min-height': '34px',
                                'box-sizing': 'border-box',
                              }),
                            ]),
                          ],
                        ),
                      ]
                    : []),
                  button(group.fit),
                  button(group.lockProportions),
                ]
              : []),
            button(context.duplicate),
          ]),
      button(context.close),
    ],
  );
}

export function connectionRows(context: FlowConnectionsContext, h: HtmlBuilder<Message>) {
  return h.ul(
    [
      h.Class('connection-rows'),
      h.Role('list'),
      h.Style({
        display: 'grid',
        gap: '5px',
        margin: '8px 0',
        padding: '0',
        'list-style': 'none',
        'max-width': '420px',
      }),
    ],
    context.entries.map((entry) => {
      const endpoints = `${entry.sourceLabel} → ${entry.targetLabel}`;
      const label = entry.edge.label ?? endpoints;
      return h.li(
        [
          h.Key(entry.edge.id),
          h.Style({
            display: 'flex',
            gap: '5px',
            background: entry.selected ? '#dbeafe' : '#f8fafc',
            padding: '4px',
            'border-radius': '10px',
            border: '1px solid #bfdbfe',
          }),
        ],
        [
          flowConnectionButton(
            h,
            { ...entry, label },
            flowEvent,
            [
              h.Style({
                flex: '1',
                'min-width': '0',
                display: 'grid',
                gap: '2px',
                'min-height': '38px',
                border: '0',
                padding: '4px 8px',
                'text-align': 'left',
                background: 'transparent',
                color: '#1e3a8a',
                cursor: 'pointer',
              }),
            ],
            [
              h.strong([], [label]),
              ...(!context.compact && entry.edge.label ? [h.small([], [endpoints])] : []),
            ],
          ),
          ...(entry.contextAction
            ? [
                flowContextTrigger(
                  h,
                  { ...entry.contextAction, label: `More actions for ${label}` },
                  flowEvent,
                  [
                    h.Style({
                      border: '1px solid #bfdbfe',
                      'border-radius': '8px',
                      background: '#fff',
                      color: '#1e3a8a',
                      width: '38px',
                    }),
                  ],
                  ['⋯'],
                ),
              ]
            : []),
        ],
      );
    }),
  );
}

export function labeledResizeReadout(context: FlowResizeReadoutContext, h: HtmlBuilder<Message>) {
  const dimension = (label: string, value: string) =>
    h.span(
      [
        h.Style({
          display: 'inline-flex',
          gap: '4px',
          background: '#fff7ed',
          color: '#7c2d12',
          padding: '3px 7px',
          'border-radius': '5px',
          'font-variant-numeric': 'tabular-nums',
        }),
      ],
      [label, h.strong([], [value])],
    );
  return h.div(
    [
      h.Class('labeled-resize-readout'),
      h.Style({
        display: 'flex',
        'align-items': 'center',
        'flex-wrap': 'wrap',
        gap: '6px',
        padding: '5px 7px',
        'border-radius': '9px',
        background: context.phase === 'resizing' ? '#9a3412' : '#431407',
        color: '#fff',
        'font-size': '12px',
        'box-shadow': '0 2px 8px #43140740',
      }),
    ],
    [
      h.strong([], [context.node.label]),
      dimension('Width', context.widthText),
      dimension('Height', context.heightText),
    ],
  );
}
