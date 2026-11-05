import { Option } from 'effect';
import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';

import { backgroundView, type FlowBackground } from './background';
import {
  boxBounds,
  edgeGeometry,
  groupBoundaryPoint,
  maximumZoom,
  minimapGeometry,
  minimumZoom,
  portPosition,
  screenToWorld,
} from './geometry';
import { edgeIsVisible, groupsInPaintOrder, presentGroups } from './group-presentation';
import { FlowInput } from './mount';
export type { FlowBackground, FlowBackgroundRenderContext } from './background';
import type {
  EdgePathStyle,
  EditorEvent,
  EditorState,
  FlowEdge,
  FlowNode,
  Point,
  Port,
  Viewport,
  ResizeHandle,
} from './types';

export type FlowEdgeRenderContext = Readonly<{
  edge: FlowEdge;
  path: string;
  labelPosition: Point | undefined;
  selected: boolean;
  stroke: string;
  strokeWidth: string;
  dashArray: string;
  markerEnd: string;
}>;

export type FlowViewOptions<M> = Readonly<{
  /** Unique within the document; prefixes accessible descriptions and SVG markers. */
  id: string;
  label: string;
  onEvent: (event: EditorEvent) => M;
  /** Uses the host's builder; arbitrary FoldKit controls retain their normal behaviour. */
  renderNode?: (node: FlowNode, h: HtmlBuilder<M>) => Html;
  /** Decorative SVG along Flow's path. Return undefined to use the built-in renderer. */
  renderEdge?: (context: FlowEdgeRenderContext, h: HtmlBuilder<M>) => Html | undefined;
  edgeAppearance?: (edge: FlowEdge) => Readonly<{
    stroke?: string;
    strokeWidth?: number;
    dashArray?: string;
  }>;
  /** Classes on the editor root, including classes produced by Pleat's cssClass(). */
  themeClassName?: string;
  /** Show on-canvas controls for a single selected edge in editable views. */
  edgeToolbar?: boolean;
  /** Enable context actions for nodes and edges in editable views. */
  contextActions?: boolean;
  /** Pan near the canvas boundary while dragging nodes or connections. */
  autoPan?: boolean;
  /** Enable two-finger touch pan and pinch-to-zoom on the canvas. */
  pinchZoom?: boolean;
  /** Card width handles and corner/side handles on selected expanded groups. */
  resizeHandles?: boolean;
  /** Show Model dimensions during resizing and for selected groups with handles. Defaults to true. */
  resizeReadout?: boolean;
  minimap?: boolean;
  viewportControls?: boolean;
  /** Include a box selection toggle in the viewport controls. */
  selectionModeControl?: boolean;
  height?: number;
  /** Decorative background, independent of snapping. Defaults to dots. */
  background?: FlowBackground<M>;
}>;
const resizeHandles: readonly ResizeHandle[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'top',
  'right',
  'bottom',
  'left',
];
function groupResizeTitle(node: FlowNode, snapToGrid: boolean, spacing: number): string {
  const step = snapToGrid ? `${spacing}, Shift by ${spacing * 4}` : '5, Shift by 20';
  return node.keepAspectRatio
    ? `Drag to resize with locked proportions; arrow keys adjust by ${step}`
    : `Drag to resize; arrow keys adjust by ${step}`;
}
function contextPanel<M>(h: HtmlBuilder<M>, state: EditorState, options: FlowViewOptions<M>) {
  const context = state.context;
  if (!options.contextActions || state.readOnly || !context) return [];
  const group =
    context.kind === 'node'
      ? state.graph.nodes.find((node) => node.id === context.id && node.kind === 'group')
      : undefined;
  const width = group ? 224 : 172;
  const height = group ? 228 : 130;
  const button = (label: string, event: EditorEvent, pressed?: boolean) =>
    h.button(
      [
        h.Type('button'),
        h.OnClick(options.onEvent(event)),
        ...(pressed === undefined ? [] : [h.AriaPressed(String(pressed))]),
        h.Style({ 'min-height': '36px', 'text-align': 'left', cursor: 'pointer' }),
      ],
      [label],
    );
  return [
    h.div(
      [
        h.Key(`context:${context.kind}:${context.id}`),
        h.Role('group'),
        h.AriaLabel(context.kind === 'node' ? 'Node context actions' : 'Edge context actions'),
        h.DataAttribute('flow-context-panel', ''),
        h.DataAttribute('flow-no-drag', ''),
        h.Style({
          position: 'absolute',
          left: `clamp(4px, ${context.point.x}px, max(4px, calc(100% - ${width + 4}px)))`,
          top: `clamp(4px, ${context.point.y}px, max(4px, calc(100% - ${height}px)))`,
          width: `min(${width}px, calc(100% - 8px))`,
          'box-sizing': 'border-box',
          display: 'grid',
          gap: '4px',
          padding: '5px',
          border: '1px solid var(--flow-node-border, #cbd5e1)',
          'border-radius': '8px',
          background: 'var(--flow-node-background, #fff)',
          'box-shadow': '0 2px 8px rgb(0 0 0 / 0.18)',
          'z-index': '3',
        }),
      ],
      [
        ...(context.kind === 'node'
          ? [
              button('Duplicate node', { type: 'DuplicatePressed' }),
              ...(group
                ? [
                    button('Fit group to contents', { type: 'GroupFitClicked', id: group.id }),
                    button(
                      'Lock proportions',
                      { type: 'GroupAspectRatioToggled', id: group.id },
                      group.keepAspectRatio ?? false,
                    ),
                  ]
                : []),
              button('Delete node', { type: 'DeletePressed' }),
            ]
          : [button('Delete edge', { type: 'EdgeDeleted', id: context.id })]),
        button('Close', { type: 'ContextDismissed' }),
      ],
    ),
  ];
}

function viewportControls<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  { onEvent, selectionModeControl }: FlowViewOptions<M>,
): Html {
  const { surface, viewport } = state;
  const point = { x: (surface?.width ?? 0) / 2, y: (surface?.height ?? 0) / 2 };
  const unavailable = !surface || state.gesture.type !== 'idle';
  const button = (label: string, event: EditorEvent, disabled: boolean, pressed?: boolean) =>
    h.button(
      [
        h.Type('button'),
        h.Disabled(disabled),
        ...(pressed === undefined ? [] : [h.AriaPressed(String(pressed))]),
        h.OnClick(onEvent(event)),
        h.Style({
          'min-height': '44px',
          padding: '0 12px',
          color: pressed ? 'var(--flow-control-color, #fff)' : 'var(--flow-node-color, #172033)',
          background: pressed
            ? 'var(--flow-selection, #2563eb)'
            : 'var(--flow-node-background, #fff)',
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
      ...(selectionModeControl
        ? [button('Box select', { type: 'SelectionModeToggled' }, unavailable, state.selectionMode)]
        : []),
      h.span([], [`${Math.round(viewport.zoom * 100)}%`]),
    ],
  );
}

const pathOptions: ReadonlyArray<{ label: string; style: EdgePathStyle | null }> = [
  { label: 'Automatic', style: null },
  { label: 'Straight', style: 'straight' },
  { label: 'Stepped', style: 'stepped' },
  { label: 'Smooth', style: 'smooth' },
];

function edgeToolbarPosition(
  center: Point,
  viewport: Viewport,
  handles: readonly Point[],
  height: number,
): Point {
  const { x, y, zoom } = viewport;
  const centerY = y + center.y * zoom;
  const handleY = handles.map((point) => y + point.y * zoom);
  const clearance = 9 * zoom + 6;
  const below = Math.max(centerY + 26, ...handleY.map((point) => point + clearance));
  const above = Math.min(centerY - 26, ...handleY.map((point) => point - clearance)) - 82;
  return { x: x + center.x * zoom, y: below + 82 > height && above >= 6 ? above : below };
}

function edgeActions<M>(
  h: HtmlBuilder<M>,
  options: FlowViewOptions<M>,
  edge: FlowEdge,
  anchor: Point,
  id: string,
): Html {
  const width = 256;
  const action = (label: string, event: EditorEvent, focusTarget = false) =>
    h.button(
      [
        h.Type('button'),
        ...(focusTarget ? [h.Id(`${id}-rename`)] : []),
        h.OnClick(options.onEvent(event)),
        h.Style({ 'min-height': '32px', 'font-size': '13px', cursor: 'pointer' }),
      ],
      [label],
    );
  return h.div(
    [
      h.Id(id),
      h.Role('group'),
      h.AriaLabel('Selected edge actions'),
      h.DataAttribute('flow-no-drag', ''),
      h.Style({
        position: 'absolute',
        left: `clamp(6px, ${anchor.x - width / 2}px, max(6px, calc(100% - ${width + 6}px)))`,
        top: `clamp(6px, ${anchor.y}px, max(6px, calc(100% - 82px)))`,
        width: `min(${width}px, calc(100% - 12px))`,
        'box-sizing': 'border-box',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        'flex-wrap': 'wrap',
        gap: '4px',
        padding: '5px',
        'border-radius': '8px',
        border: '1px solid var(--flow-node-border, #cbd5e1)',
        background: 'var(--flow-node-background, #fff)',
        color: 'var(--flow-node-color, #172033)',
        'box-shadow': '0 2px 8px rgb(0 0 0 / 0.14)',
        'z-index': '1',
      }),
    ],
    [
      action('Rename', { type: 'EdgeLabelEditingStarted', id: edge.id }, true),
      h.select(
        [
          h.AriaLabel('Selected edge path style'),
          h.Style({ 'min-height': '32px', 'font-size': '13px' }),
          h.OnChange((value) =>
            options.onEvent({
              type: 'EdgePathStyleChanged',
              id: edge.id,
              pathStyle: pathOptions.find(({ style }) => style === value)?.style ?? null,
            }),
          ),
        ],
        pathOptions.map(({ label, style }) =>
          h.option(
            [h.Value(style ?? 'auto'), h.Selected((edge.pathStyle ?? null) === style)],
            [label],
          ),
        ),
      ),
      action('Delete edge', { type: 'EdgeDeleted', id: edge.id }),
    ],
  );
}

function portStyle(port: Port) {
  const offset = `calc(${port.offset * 100}% - 12px)`;
  return {
    left: { right: 'auto', bottom: 'auto', left: '-12px', top: offset },
    right: { left: 'auto', bottom: 'auto', right: '-12px', top: offset },
    top: { right: 'auto', bottom: 'auto', top: '-12px', left: offset },
    bottom: { right: 'auto', top: 'auto', bottom: '-12px', left: offset },
  }[port.side];
}

function resizeReadout<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  options: FlowViewOptions<M>,
  nodes: readonly FlowNode[],
) {
  if (options.resizeReadout === false || state.readOnly) return [];
  const gesture = state.gesture;
  const id =
    gesture.type === 'node-resize'
      ? gesture.ids[0]
      : gesture.type === 'idle' && options.resizeHandles && state.selectedNodes.length === 1
        ? state.selectedNodes[0]
        : undefined;
  const node = nodes.find(
    (node) => node.id === id && (gesture.type === 'node-resize' || node.kind === 'group'),
  );
  if (!node || state.collapsedGroups.includes(node.id)) return [];
  const width = String(Number(node.size.width.toFixed(2)));
  const height = String(Number(node.size.height.toFixed(2)));
  return [
    h.div(
      [
        h.Key('resize-readout'),
        h.DataAttribute('flow-resize-readout', node.id),
        h.Role('status'),
        h.AriaLive('polite'),
        h.AriaLabel(`${node.label} dimensions in graph units`),
        h.Title(`${node.label}: ${width} × ${height} graph units`),
        h.Style({
          position: 'absolute',
          left: '8px',
          bottom: '8px',
          'z-index': '2',
          'pointer-events': 'none',
          padding: '6px 10px',
          color: 'var(--flow-resize-readout-color, var(--flow-node-color, #172033))',
          background: 'var(--flow-resize-readout-background, var(--flow-node-background, #fff))',
          border: '1px solid var(--flow-node-border, #64748b)',
          'border-radius': '6px',
          'box-shadow': '0 1px 4px rgb(0 0 0 / 0.12)',
          'font-size': '12px',
          'font-weight': '600',
          'font-variant-numeric': 'tabular-nums',
          'line-height': '1.4',
          'white-space': 'nowrap',
        }),
      ],
      [`${width} × ${height}`],
    ),
  ];
}

/** A normal FoldKit view: all state and message handling belong to its parent. */
export function flowView<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  options: FlowViewOptions<M>,
): Html {
  const presentation = presentGroups(state.graph, state.collapsedGroups);
  const collapsedGroups = new Set(state.collapsedGroups);
  const visibleEdges = state.graph.edges.filter((edge) =>
    edgeIsVisible(edge, presentation.hiddenBy),
  );
  const minimap =
    options.minimap && state.surface && presentation.nodes.length > 0
      ? minimapGeometry(presentation, state.surface, state.viewport)
      : null;
  const descriptionId = `${options.id}-help`;
  const alignmentGuides =
    state.gesture.type === 'node-drag'
      ? state.gesture.guides
      : state.gesture.type === 'node-resize'
        ? (state.gesture.guides ?? [])
        : [];
  const transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.zoom})`;
  const drag = state.gesture.type === 'connection-drag' ? state.gesture : null;
  const source = state.connection;
  const sourceNode = source && state.graph.nodes.find((node) => node.id === source.node);
  const pointer = drag && screenToWorld(drag.point, state.viewport);
  const sourceGroup = source && presentation.hiddenBy.get(source.node);
  const preview =
    pointer && source && sourceNode
      ? {
          from: sourceGroup
            ? groupBoundaryPoint(sourceGroup, pointer)
            : portPosition(sourceNode, source.port),
          to: pointer,
        }
      : null;
  const selectionBox =
    state.gesture.type === 'box-selection'
      ? boxBounds(state.gesture.origin, state.gesture.point)
      : null;
  const contextEnabled = options.contextActions && !state.readOnly;
  const contextTrigger = (
    kind: 'node' | 'edge',
    id: string,
    label: string,
    point: Point,
    onNode = false,
  ) =>
    h.button(
      [
        h.Type('button'),
        h.AriaLabel(`More actions for ${label}`),
        h.Title('More actions'),
        h.AriaExpanded(state.context?.kind === kind && state.context.id === id),
        h.Disabled(state.gesture.type !== 'idle'),
        h.DataAttribute('flow-no-drag', ''),
        h.OnClick(options.onEvent({ type: 'ContextOpened', context: { kind, id, point } })),
        h.Style({
          position: onNode ? 'absolute' : 'relative',
          top: onNode ? '8px' : 'auto',
          right: onNode ? '8px' : 'auto',
          width: '36px',
          'min-height': '36px',
          'flex-shrink': '0',
          'pointer-events': 'auto',
          cursor: 'pointer',
        }),
      ],
      ['⋯'],
    );
  const nodeContextTrigger = (node: FlowNode) =>
    contextTrigger(
      'node',
      node.id,
      node.label,
      {
        x: state.viewport.x + (node.position.x + node.size.width) * state.viewport.zoom - 36,
        y: state.viewport.y + node.position.y * state.viewport.zoom + 44,
      },
      node.kind !== 'group',
    );
  const dropParent = state.gesture.type === 'node-drag' ? state.gesture.dropParent : undefined;
  const boundaries = groupsInPaintOrder(presentation.nodes).map((node) => {
    const collapsed = collapsedGroups.has(node.id);
    const dropTarget = dropParent === node.id;
    return h.div(
      [
        h.Key(node.id),
        h.DataAttribute('flow-group', node.id),
        h.DataAttribute('flow-collapsed', String(collapsed)),
        ...(dropTarget ? [h.DataAttribute('flow-group-drop-target', '')] : []),
        h.Style({
          position: 'absolute',
          left: `${node.position.x}px`,
          top: `${node.position.y}px`,
          width: `${node.size.width}px`,
          height: `${node.size.height}px`,
          'box-sizing': 'border-box',
          'border-radius': 'var(--flow-node-radius, 8px)',
          border: dropTarget
            ? '2px solid var(--flow-valid-target, #0f766e)'
            : state.selectedNodes.includes(node.id)
              ? '2px solid var(--flow-selection, #2563eb)'
              : '2px dashed var(--flow-node-border, #64748b)',
          background: collapsed
            ? 'var(--flow-node-background, #fff)'
            : 'var(--flow-group-background, rgb(100 116 139 / 0.08))',
          'box-shadow': dropTarget ? '0 0 0 3px var(--flow-valid-target, #0f766e)' : 'none',
          display: 'flex',
          'align-items': 'flex-start',
          gap: '4px',
          padding: '4px',
          'pointer-events': 'none',
        }),
      ],
      [
        h.button(
          [
            h.Type('button'),
            h.DataAttribute('flow-handle', node.id),
            h.AriaLabel(`Select ${node.label}`),
            h.Title(node.label),
            h.AriaPressed(String(state.selectedNodes.includes(node.id))),
            h.AriaDescribedBy(descriptionId),
            h.Style({
              'pointer-events': 'auto',
              cursor: state.readOnly ? 'pointer' : 'grab',
              overflow: 'hidden',
              'text-overflow': 'ellipsis',
              'white-space': 'nowrap',
              'min-height': '28px',
            }),
          ],
          [node.label],
        ),
        h.button(
          [
            h.Type('button'),
            h.DataAttribute('flow-no-drag', ''),
            h.AriaLabel(`${collapsed ? 'Expand' : 'Collapse'} ${node.label}`),
            h.AriaExpanded(!collapsed),
            h.OnClick(options.onEvent({ type: 'GroupCollapseToggled', id: node.id })),
            h.Style({ 'pointer-events': 'auto', cursor: 'pointer', 'min-height': '28px' }),
          ],
          [collapsed ? 'Expand' : 'Collapse'],
        ),
        ...(contextEnabled ? [nodeContextTrigger(node)] : []),
        ...(options.resizeHandles &&
        !state.readOnly &&
        !collapsed &&
        state.selectedNodes.includes(node.id)
          ? resizeHandles.map((handle) =>
              h.button(
                [
                  h.Key(handle),
                  h.Type('button'),
                  h.DataAttribute('flow-resize', node.id),
                  h.DataAttribute('flow-resize-handle', handle),
                  ...(handle.includes('-') ? [h.DataAttribute('flow-resize-corner', handle)] : []),
                  h.DataAttribute('flow-group-resize', ''),
                  h.AriaLabel(`Resize ${node.label} from ${handle.replaceAll('-', ' ')}`),
                  h.Title(groupResizeTitle(node, state.snapToGrid, state.gridSpacing)),
                  h.Style({
                    position: 'absolute',
                    ...(handle === 'top' || handle === 'bottom'
                      ? { left: 'calc(50% - 14px)', [handle]: '-8px' }
                      : handle === 'left' || handle === 'right'
                        ? { top: 'calc(50% - 14px)', [handle]: '-8px' }
                        : {
                            [handle.endsWith('left') ? 'left' : 'right']: '-8px',
                            [handle.startsWith('top') ? 'top' : 'bottom']: '-8px',
                          }),
                    width: '28px',
                    height: '28px',
                    padding: '0',
                    'pointer-events': 'auto',
                    'z-index': '3',
                    cursor:
                      handle === 'top' || handle === 'bottom'
                        ? 'ns-resize'
                        : handle === 'left' || handle === 'right'
                          ? 'ew-resize'
                          : handle === 'top-left' || handle === 'bottom-right'
                            ? 'nwse-resize'
                            : 'nesw-resize',
                    'touch-action': 'none',
                    'user-select': 'none',
                    color: 'var(--flow-control-color, #fff)',
                    background: 'var(--flow-resize-background, #334155)',
                    'border-radius': '6px',
                    border: '2px solid var(--flow-selection, #2563eb)',
                  }),
                ],
                [
                  handle === 'top' || handle === 'bottom'
                    ? '↕'
                    : handle === 'left' || handle === 'right'
                      ? '↔'
                      : handle === 'top-left' || handle === 'bottom-right'
                        ? '⤡'
                        : '⤢',
                ],
              ),
            )
          : []),
      ],
    );
  });
  const nodes = presentation.nodes
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
                width: contextEnabled ? 'calc(100% - 36px)' : '100%',
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
          ...(contextEnabled ? [nodeContextTrigger(node)] : []),
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
                  'z-index': '1',
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
  const routes = new Map(state.routes.map((route) => [route.id, route.points]));
  const edgeGeometries = visibleEdges.map((edge) => ({
    edge,
    ...edgeGeometry(state.graph, edge, routes.get(edge.id), {
      source: presentation.hiddenBy.get(edge.source.node),
      target: presentation.hiddenBy.get(edge.target.node),
    }),
  }));
  const toolbarEnabled = options.edgeToolbar && !state.readOnly;
  const toolbarId = `${encodeURIComponent(options.id)}-edge-actions`;
  const activeEdge =
    toolbarEnabled && state.selectedEdges.length === 1
      ? edgeGeometries.find(({ edge }) => edge.id === state.selectedEdges[0])
      : undefined;
  const edges = edgeGeometries.map(({ edge, path, center }) => {
    const appearance = options.edgeAppearance?.(edge);
    const selected = state.selectedEdges.includes(edge.id);
    const context: FlowEdgeRenderContext = {
      edge,
      path,
      labelPosition: center,
      selected,
      stroke: selected
        ? 'var(--flow-selection, #2563eb)'
        : (appearance?.stroke ?? 'var(--flow-edge, #64748b)'),
      strokeWidth:
        appearance?.strokeWidth === undefined
          ? 'var(--flow-edge-width, 3)'
          : String(appearance.strokeWidth),
      dashArray: appearance?.dashArray ?? 'none',
      markerEnd: `url(#${markerId})`,
    };
    const custom = options.renderEdge?.(context, h);
    const hitArea = [
      h.D(path),
      h.Fill('none'),
      h.DataAttribute('flow-edge', edge.id),
      h.Style({ 'pointer-events': 'stroke', cursor: 'pointer' }),
    ];
    if (custom !== undefined) {
      return h.g(
        [h.Key(`edge:${edge.id}`)],
        [
          h.g([h.Style({ 'pointer-events': 'none' })], [custom]),
          h.path([...hitArea, h.Stroke('transparent'), h.StrokeWidth('12')], []),
        ],
      );
    }
    return h.path(
      [
        h.Key(`edge:${edge.id}`),
        ...hitArea,
        h.Stroke(context.stroke),
        h.StrokeWidth(context.strokeWidth),
        h.StrokeDasharray(context.dashArray),
        h.MarkerEnd(context.markerEnd),
      ],
      [],
    );
  });
  const edgeLabels = edgeGeometries.flatMap(({ edge, center }) => {
    const draft = state.edgeLabelDraft?.id === edge.id ? state.edgeLabelDraft : null;
    if (!draft && !edge.label && (state.readOnly || !state.selectedEdges.includes(edge.id)))
      return [];
    if (!center) return [];
    const description = `${edge.source.node}:${edge.source.port} → ${edge.target.node}:${edge.target.port}`;
    const cancel = options.onEvent({ type: 'EdgeLabelCancelled', id: edge.id });
    const chipStyle = {
      background: 'var(--flow-node-background, #fff)',
      color: 'var(--flow-node-color, #172033)',
      border: '1px solid var(--flow-node-border, #cbd5e1)',
      'border-radius': '6px',
      padding: '3px 8px',
      'font-size': '13px',
      'max-width': '240px',
      overflow: 'hidden',
      'text-overflow': 'ellipsis',
      'white-space': 'nowrap',
    };
    return [
      h.div(
        [
          h.Key(`edge-label:${edge.id}`),
          h.DataAttribute('flow-no-drag', ''),
          h.Style({
            position: 'absolute',
            left: `${center.x}px`,
            top: `${center.y}px`,
            transform: 'translate(-50%, -50%)',
            'pointer-events': state.readOnly ? 'none' : 'auto',
            'z-index': draft ? '2' : 'auto',
          }),
        ],
        [
          draft
            ? h.form(
                [
                  h.OnSubmit(options.onEvent({ type: 'EdgeLabelSaved', id: edge.id })),
                  h.OnKeyDownPreventDefault((key) =>
                    key === 'Escape' ? Option.some(cancel) : Option.none(),
                  ),
                  h.Style({ ...chipStyle, display: 'flex', gap: '4px', 'max-width': 'none' }),
                ],
                [
                  h.input([
                    h.Type('text'),
                    h.AriaLabel(`Edge label for ${description}`),
                    h.Autofocus(true),
                    h.Value(draft.text),
                    h.OnInput((text) =>
                      options.onEvent({ type: 'EdgeLabelDraftChanged', id: edge.id, text }),
                    ),
                  ]),
                  h.button([h.Type('submit')], ['Save label']),
                  h.button([h.Type('button'), h.OnClick(cancel)], ['Cancel']),
                ],
              )
            : state.readOnly
              ? h.div([h.Style(chipStyle), h.Title(edge.label ?? '')], [edge.label ?? ''])
              : h.button(
                  [
                    h.Type('button'),
                    h.AriaLabel(
                      edge.label
                        ? `Edit edge label ${edge.label} for ${description}`
                        : `Add label for ${description}`,
                    ),
                    h.Title(edge.label ?? description),
                    h.DataAttribute('flow-context-edge', edge.id),
                    h.Style({ ...chipStyle, cursor: 'pointer' }),
                    h.OnClick(options.onEvent({ type: 'EdgeLabelEditingStarted', id: edge.id })),
                  ],
                  [edge.label || 'Add label'],
                ),
        ],
      ),
    ];
  });
  const reconnectPoints = state.readOnly
    ? []
    : visibleEdges
        .filter((edge) => state.selectedEdges.includes(edge.id))
        .flatMap((edge) =>
          (['source', 'target'] as const).flatMap((end) => {
            const endpoint = edge[end];
            if (presentation.hiddenBy.has(endpoint.node)) return [];
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
            return [{ edge, end, x: position.x + x, y: position.y + y }];
          }),
        );
  const handles = reconnectPoints.map(({ edge, end, x, y }) =>
    h.circle(
      [
        h.Key(`reconnect:${edge.id}:${end}`),
        h.DataAttribute('flow-reconnect', edge.id),
        h.DataAttribute('flow-edge-end', end),
        h.Cx(String(x)),
        h.Cy(String(y)),
        h.R('9'),
        h.Fill('var(--flow-selection, #2563eb)'),
        h.Stroke('var(--flow-port-border, #fff)'),
        h.StrokeWidth('2'),
        h.Style({ 'pointer-events': 'all', cursor: 'grab' }),
      ],
      [],
    ),
  );
  const toolbar =
    activeEdge?.center && !state.edgeLabelDraft && !drag
      ? edgeActions(
          h,
          options,
          activeEdge.edge,
          edgeToolbarPosition(
            activeEdge.center,
            state.viewport,
            reconnectPoints,
            state.surface?.height ?? options.height ?? 440,
          ),
          toolbarId,
        )
      : null;
  return h.div(
    [
      h.Id(options.id),
      h.Class(options.themeClassName ? `foldkit-flow ${options.themeClassName}` : 'foldkit-flow'),
    ],
    [
      h.p(
        [h.Id(descriptionId)],
        [
          'Drag a node title to move it. ',
          state.selectionMode
            ? 'Drag the background to select nodes. '
            : 'Drag the background to pan, or Shift-drag to select nodes. ',
          'Scroll to zoom. Tab to a title, then use arrow keys to move it. Drag from an output to an input, or activate the two ports in order with Enter or Space. Select an edge to drag either endpoint handle. Escape cancels.',
          ...(toolbarEnabled
            ? [' In the Connections list, select an edge and press Up Arrow to reach its actions.']
            : []),
        ],
      ),
      ...(options.viewportControls ? [viewportControls(h, state, options)] : []),
      h.div(
        [
          h.Key('surface'),
          h.DataAttribute('flow-surface', options.id),
          h.DataAttribute('flow-readonly', String(state.readOnly)),
          h.DataAttribute('flow-grid-snap', String(state.snapToGrid)),
          h.DataAttribute('flow-grid-spacing', String(state.gridSpacing)),
          h.DataAttribute('flow-auto-pan', String(options.autoPan ?? false)),
          h.DataAttribute('flow-pinch-zoom', String(options.pinchZoom ?? false)),
          h.DataAttribute('flow-selection-mode', String(state.selectionMode)),
          h.DataAttribute('flow-context-actions', String(Boolean(contextEnabled))),
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
            cursor: state.selectionMode ? 'crosshair' : 'inherit',
            'background-color': 'var(--flow-background, #eef2f6)',
            border: '1px solid var(--flow-canvas-border, #94a3b8)',
            'border-radius': '10px',
          }),
        ],
        [
          ...backgroundView(h, state, options.id, options.background),
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
                  ...alignmentGuides.map(({ axis, position, from, to }) =>
                    h.line(
                      [
                        h.Key(`alignment:${axis}`),
                        h.DataAttribute('flow-alignment-guide', axis),
                        h.X1(String(axis === 'x' ? position : from)),
                        h.X2(String(axis === 'x' ? position : to)),
                        h.Y1(String(axis === 'y' ? position : from)),
                        h.Y2(String(axis === 'y' ? position : to)),
                        h.Stroke('var(--flow-alignment-guide, #7c3aed)'),
                        h.StrokeWidth('2'),
                        h.StrokeDasharray('5 3'),
                        h.Style({ 'vector-effect': 'non-scaling-stroke' }),
                      ],
                      [],
                    ),
                  ),
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
              ...edgeLabels,
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
                      ...presentation.nodes.filter((node) => node.kind === 'group'),
                      ...presentation.nodes.filter((node) => node.kind !== 'group'),
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
          ...resizeReadout(h, state, options, presentation.nodes),
          ...(toolbar && !state.context ? [toolbar] : []),
          ...contextPanel(h, state, options),
        ],
      ),
      h.div(
        [h.Role('status'), h.AriaLive('polite'), h.Style({ 'min-height': '1.5em' })],
        [state.notice ?? `${presentation.nodes.length} nodes, ${visibleEdges.length} connections`],
      ),
      h.div(
        [h.Role('group'), h.AriaLabel('Connections')],
        visibleEdges.map((edge) => {
          const label =
            edge.label ??
            `${edge.source.node}:${edge.source.port} → ${edge.target.node}:${edge.target.port}`;
          const selectionButton = h.button(
            [
              h.Key(edge.id),
              h.Type('button'),
              h.OnClick(options.onEvent({ type: 'EdgeSelected', id: edge.id, additive: false })),
              h.AriaPressed(String(state.selectedEdges.includes(edge.id))),
              ...(options.contextActions && !state.readOnly
                ? [
                    h.OnKeyDownPreventDefault((key, modifiers) =>
                      key === 'ContextMenu' || (key === 'F10' && modifiers.shiftKey)
                        ? Option.some(
                            options.onEvent({
                              type: 'ContextOpened',
                              context: { kind: 'edge', id: edge.id, point: { x: 12, y: 12 } },
                            }),
                          )
                        : Option.none(),
                    ),
                  ]
                : []),
              ...(toolbar && activeEdge?.edge.id === edge.id
                ? [
                    h.AriaControls(toolbarId),
                    h.AriaKeyshortcuts('ArrowUp'),
                    h.OnKeyDownFocus((key) =>
                      key === 'ArrowUp'
                        ? Option.some({
                            focusSelector: `[id="${toolbarId}-rename"]`,
                            message: options.onEvent({
                              type: 'EdgeSelected',
                              id: edge.id,
                              additive: false,
                            }),
                          })
                        : Option.none(),
                    ),
                  ]
                : []),
            ],
            [label],
          );
          return contextEnabled
            ? h.span(
                [
                  h.Key(edge.id),
                  h.Style({ display: 'inline-flex', gap: '4px', 'margin-right': '8px' }),
                ],
                [selectionButton, contextTrigger('edge', edge.id, label, { x: 12, y: 12 })],
              )
            : selectionButton;
        }),
      ),
    ],
  );
}
