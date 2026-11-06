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
  flowWorldOverlayItem,
  type FlowWorldOverlayContext,
  type FlowEdgeRenderContext,
  flowEdgeLabelBadge,
  flowEdgeToolbarButton,
  flowContextAction,
  flowContextTrigger,
  flowConnectionButton,
  type FlowConnectionsContext,
  type FlowResizeReadoutContext,
  type FlowAlignmentGuideContext,
  type FlowSelectionMarqueeContext,
  type FlowCanvasHelpContext,
  type FlowCanvasStatusContext,
  flowContextDimensionInput,
  type FlowContextAction,
  type FlowContextMenuContext,
  flowEdgePathStyleSelect,
  type FlowEdgeToolbarContext,
  type FlowNodeToolbarContext,
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

export function storageDependencyEdge(
  { edge, path, stroke, dashArray, markerEnd }: FlowEdgeRenderContext,
  h: HtmlBuilder<Message>,
) {
  return edge.id === 'storage-application'
    ? h.g(
        [h.DataAttribute('storage-dependency', '')],
        [
          h.path(
            [
              h.D(path),
              h.Fill('none'),
              h.Stroke(stroke),
              h.StrokeWidth('6'),
              h.StrokeDasharray(dashArray),
              h.MarkerEnd(markerEnd),
            ],
            [],
          ),
          h.path(
            [
              h.D(path),
              h.Fill('none'),
              h.Stroke('var(--flow-background, #eef2f6)'),
              h.StrokeWidth('1.5'),
              h.StrokeDasharray(dashArray),
            ],
            [],
          ),
        ],
      )
    : undefined;
}

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
                  h.Stroke(context.selectionPreview ? '#5eead4' : selected ? '#f97316' : '#38bdf8'),
                  h.StrokeDasharray(context.selectionPreview ? '5 3' : 'none'),
                  h.StrokeWidth(selected || context.selectionPreview ? '3' : '1'),
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
        outline: context.selectionPreview ? '2px dashed var(--flow-valid-target, #0f766e)' : 'none',
        'outline-offset': '2px',
        background: context.collapsed ? 'light-dark(#dbeafe, #253b58)' : 'rgb(56 189 248 / 0.05)',
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
        background: context.selected ? '#075985' : 'light-dark(#f0f9ff, #152b3c)',
        color: context.selected ? '#fff' : 'light-dark(#0c4a6e, #bde7ff)',
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
        background: 'light-dark(#f0f9ff, #152b3c)',
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

export function releaseGateAnnotation(context: FlowWorldOverlayContext, h: HtmlBuilder<Message>) {
  const review = context.nodes.find((node) => node.id === 'review');
  if (!review) return null;
  const position = { x: review.position.x + review.size.width / 2, y: review.position.y - 14 };
  return h.div(
    [],
    [
      flowWorldOverlayItem(
        h,
        { position },
        [
          h.AriaHidden(true),
          h.DataAttribute('release-gate-leader', ''),
          h.Style({ width: '2px', height: '14px', background: '#376855' }),
        ],
        [],
      ),
      flowWorldOverlayItem(
        h,
        { position, interactive: true },
        [h.Style({ transform: 'translate(-50%, -100%)' })],
        [
          h.button(
            [
              h.Type('button'),
              h.AriaLabel('Inspect Review'),
              h.OnClick(flowEvent({ type: 'NodeSelected', id: review.id, additive: false })),
              h.Style({
                display: 'grid',
                gap: '4px',
                width: '160px',
                padding: '10px 12px',
                border: '1px solid #4f826e',
                'border-radius': '8px',
                'text-align': 'left',
                background: '#18392e',
                color: '#fff',
                'box-shadow': '0 3px 10px rgb(23 57 46 / 0.22)',
                cursor: 'pointer',
              }),
            ],
            [
              h.span(
                [h.Style({ 'font-size': '10px', 'letter-spacing': '.08em', color: '#b4ddcb' })],
                ['RELEASE GATE'],
              ),
              h.strong([h.Style({ 'font-size': '14px' })], ['Review required']),
            ],
          ),
        ],
      ),
    ],
  );
}

export function compactNodeToolbar(context: FlowNodeToolbarContext, h: HtmlBuilder<Message>) {
  return h.div(
    [
      h.Class('compact-node-actions'),
      h.Style({
        display: 'flex',
        'align-items': 'center',
        gap: '6px',
        padding: '5px',
        'border-radius': '10px',
        background: '#17392e',
        color: '#fff',
        'box-shadow': '0 3px 10px rgb(23 57 46 / 0.25)',
      }),
    ],
    [
      h.span(
        [h.Style({ 'font-size': '12px', 'font-weight': '600', padding: '0 6px' })],
        [context.node.label],
      ),
      ...[context.actions.duplicate, context.actions.deleteNode].map((action, index) =>
        flowContextAction(
          h,
          action,
          flowEvent,
          [
            h.Style({
              'min-height': '36px',
              padding: '0 10px',
              border: '1px solid #bfd2c8',
              'border-radius': '6px',
              background:
                index === 0 ? 'light-dark(#edf7f1, #254436)' : 'light-dark(#fff2ed, #402c28)',
              color: index === 0 ? 'light-dark(#17392e, #d8f7e8)' : 'light-dark(#842c20, #ffc4b7)',
              opacity: action.disabledReason === undefined ? '1' : '0.65',
            }),
          ],
          [index === 0 ? 'Duplicate' : 'Delete'],
        ),
      ),
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
        background: 'light-dark(#f0f9ff, #152b3c)',
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
          background: 'light-dark(#fff, #1c2d3c)',
          color: 'light-dark(#0c4a6e, #bde7ff)',
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
            background: 'light-dark(#fee2e2, #49262f)',
            color: 'light-dark(#991b1b, #ffc2c8)',
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
          background: action.pressed ? '#3730a3' : 'light-dark(#fff, #2e2d48)',
          color: action.pressed ? '#fff' : 'light-dark(#312e81, #d9d6ff)',
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
        background: 'light-dark(#eef2ff, #282940)',
        color: 'light-dark(#312e81, #d9d6ff)',
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
                  ...(group.resizeDisabledReason === undefined
                    ? []
                    : [h.small([], [group.resizeDisabledReason])]),
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
            background: entry.selected
              ? 'light-dark(#dbeafe, #253b58)'
              : 'light-dark(#f8fafc, #1b2d3d)',
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
                color: 'light-dark(#1e3a8a, #c4d9ff)',
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
                      background: 'light-dark(#fff, #1c2d3c)',
                      color: 'light-dark(#1e3a8a, #c4d9ff)',
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
          background: 'light-dark(#fff7ed, #462d1e)',
          color: 'light-dark(#7c2d12, #ffd9ba)',
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

export function endpointAlignmentGuide(
  context: FlowAlignmentGuideContext,
  h: HtmlBuilder<Message>,
) {
  const { start, end, phase, viewport } = context;
  const color = phase === 'drag' ? 'var(--flow-valid-target)' : 'light-dark(#be185d, #f5a6d0)';
  const dot = (point: Point) =>
    h.circle(
      [h.Cx(String(point.x)), h.Cy(String(point.y)), h.R(String(4 / viewport.zoom)), h.Fill(color)],
      [],
    );
  return h.g(
    [h.Class('endpoint-alignment-guide'), h.DataAttribute('guide-phase', phase)],
    [
      h.line(
        [
          h.X1(String(start.x)),
          h.Y1(String(start.y)),
          h.X2(String(end.x)),
          h.Y2(String(end.y)),
          h.Stroke(color),
          h.StrokeWidth('2'),
          h.Style({ 'vector-effect': 'non-scaling-stroke' }),
        ],
        [],
      ),
      dot(start),
      dot(end),
    ],
  );
}

export function hatchedSelectionMarquee(
  context: FlowSelectionMarqueeContext,
  h: HtmlBuilder<Message>,
) {
  return h.div(
    [
      h.Class('hatched-selection-marquee'),
      h.Style({
        position: 'absolute',
        inset: '0',
        border: `${2 / context.viewport.zoom}px dashed var(--flow-valid-target, #0f766e)`,
        'border-radius': '8px',
        background: 'repeating-linear-gradient(135deg, #14b8a629 0 4px, #ccfbf125 4px 12px)',
        'box-sizing': 'border-box',
      }),
    ],
    [],
  );
}

export function canvasHelpCard(context: FlowCanvasHelpContext, h: HtmlBuilder<Message>) {
  return h.div(
    [
      h.Class('canvas-help-card'),
      h.Style({
        background: 'light-dark(#eff6ff, #192c40)',
        color: 'light-dark(#1e3a8a, #c4d9ff)',
        padding: '10px 14px',
        margin: '8px 0',
        border: '1px solid #bfdbfe',
        'border-radius': '10px',
        'line-height': '1.45',
      }),
    ],
    [
      h.strong([], ['Canvas controls']),
      h.p([h.Style({ margin: '4px 0 0' })], [context.defaultText]),
    ],
  );
}

export function canvasStatusCard(context: FlowCanvasStatusContext, h: HtmlBuilder<Message>) {
  const summary = `${context.nodeCount} ${context.nodeCount === 1 ? 'node' : 'nodes'} · ${context.connectionCount} ${context.connectionCount === 1 ? 'connection' : 'connections'}`;
  return h.span(
    [
      h.Class('canvas-status-card'),
      h.Style({
        display: 'inline-block',
        color: 'light-dark(#0f4c3a, #b9efda)',
        background: 'light-dark(#d1fae5, #1f4537)',
        padding: '4px 10px',
        margin: '6px 0',
        'border-radius': '999px',
      }),
    ],
    [context.notice ?? summary],
  );
}
