/**
 * Optional native FoldKit views and interaction primitives using the host builder.
 * @module FoldKit
 */
import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';

import {
  flowConnectionButton,
  type FlowConnectionEntry,
  type FlowConnectionsContext,
} from './connections';
export { flowConnectionButton } from './connections';
export type { FlowConnectionEntry, FlowConnectionsContext } from './connections';

import {
  flowContextAction,
  flowContextDimensionInput,
  flowContextTrigger,
  type FlowContextTrigger,
  type FlowContextMenuContext,
  type FlowContextAction,
  type FlowGroupContextActions,
} from './context-menu';
export { flowContextAction, flowContextDimensionInput, flowContextTrigger } from './context-menu';
export type {
  FlowContextAction,
  FlowContextMenuContext,
  FlowGroupContextActions,
  FlowContextTrigger,
} from './context-menu';

import {
  flowEdgeToolbarButton,
  flowEdgePathStyleSelect,
  type FlowEdgeToolbarContext,
} from './edge-toolbar';
export { flowEdgeToolbarButton, flowEdgePathStyleSelect } from './edge-toolbar';
export type { FlowEdgeToolbarAction, FlowEdgeToolbarContext } from './edge-toolbar';

import {
  nodeToolbarContext,
  nodeToolbarView,
  type FlowNodeToolbarContext,
  type FlowNodeToolbarOptions,
} from './node-toolbar';
export type {
  FlowNodeToolbarContext,
  FlowNodeToolbarOptions,
  FlowNodeToolbarPlacement,
} from './node-toolbar';

import {
  flowEdgeLabelBadge,
  flowEdgeLabelForm,
  flowEdgeLabelInput,
  flowEdgeLabelCancel,
  type FlowEdgeLabelContext,
  type FlowEdgeLabelEditorContext,
} from './edge-label';
export {
  flowEdgeLabelBadge,
  flowEdgeLabelForm,
  flowEdgeLabelInput,
  flowEdgeLabelCancel,
} from './edge-label';
export type { FlowEdgeLabelContext, FlowEdgeLabelEditorContext } from './edge-label';

import {
  flowViewportControl,
  flowMinimap,
  flowMinimapViewport,
  viewportControlActions,
  minimapContext,
  type FlowViewportControlsContext,
  type FlowMinimapContext,
  type FlowWheelNavigation,
} from './navigation';
export {
  flowViewportControl,
  flowMinimap,
  flowMinimapViewport,
  viewportControlActions,
  minimapContext,
} from './navigation';
export type {
  FlowViewportControl,
  FlowViewportActions,
  FlowViewportControlsContext,
  FlowMinimapContext,
  FlowWheelNavigation,
} from './navigation';
import {
  flowNodeFrame,
  flowGroupFrame,
  flowDragHandle,
  flowPort,
  flowResizeHandle,
  flowEdgeHitTarget,
  type FlowNodeRenderContext,
} from './composition';
export {
  flowNodeFrame,
  flowGroupFrame,
  flowDragHandle,
  flowPort,
  flowResizeHandle,
  flowEdgeHitTarget,
  flowWorldOverlayItem,
} from './composition';
export type { FlowNodeRenderContext, FlowWorldOverlayItemOptions } from './composition';

import { backgroundView, type FlowBackground } from './background';
import {
  resolveFlowDiagnostics,
  visuallyHidden,
  type FlowDiagnostics,
  type FlowDiagnosticOptions,
} from './diagnostics';
export { resolveFlowDiagnostics } from './diagnostics';
export type { FlowDiagnostics, FlowDiagnosticOptions } from './diagnostics';
import { resolveDeletion } from './deletion';
import { resolveEdgeGeometry, type FlowEdgeGeometryPolicy } from './edge-geometry';
import { portBoundaryPosition } from './geometry';
import { resolveBoxSelection, type BoxSelectionPreview } from './selection-preview';
export type {
  FlowEdgeGeometry,
  FlowEdgeGeometryContext,
  FlowEdgeGeometryPolicy,
} from './edge-geometry';
import {
  resolveConnectionPreview,
  type FlowConnectionPreview,
  type FlowConnectionGeometryPolicy,
} from './connection-preview';
export type {
  FlowConnectionFeedback,
  FlowConnectionPreviewContext,
  FlowConnectionGeometryPolicy,
  FlowConnectionPreview,
} from './connection-preview';
import { edgeIsVisible, groupsInPaintOrder, presentGroups } from './group-presentation';
import { FlowInput } from './mount';
export type { FlowBackground, FlowBackgroundRenderContext } from './background';
import type {
  AlignmentGuide,
  BoxSelectionMatch,
  DeletionTargets,
  EditorPolicy,
  FlowGraph,
  EditorEvent,
  EditorState,
  FlowEdge,
  FlowNode,
  Point,
  Size,
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

/** Geometry, core target feedback and default appearance for a decorative preview renderer. */
export type FlowConnectionRenderContext = FlowConnectionPreview &
  Readonly<{
    stroke: string;
    strokeWidth: string;
    dashArray: string;
  }>;

/** Model dimensions for the current resize readout, before any view styling. */
export type FlowResizeReadoutContext = Readonly<{
  node: FlowNode;
  phase: 'resizing' | 'selected-group';
  /** Default formatting in graph units, rounded to two decimal places. */
  widthText: string;
  heightText: string;
}>;

/** A resolved snap guide and its endpoints in the canvas world coordinate space. */
export type FlowAlignmentGuideContext = Readonly<{
  guide: AlignmentGuide;
  start: Point;
  end: Point;
  phase: 'drag' | 'resize';
  viewport: Viewport;
}>;

/** Normalized selection bounds in graph coordinates and the current camera. */
export type FlowSelectionMarqueeContext = Readonly<{
  bounds: Readonly<{
    left: number;
    top: number;
    right: number;
    bottom: number;
  }>;
  previewNodeIds: readonly string[];
  match: BoxSelectionMatch;
  viewport: Viewport;
}>;

/** Default canvas guidance and the controls it describes. */
export type FlowCanvasHelpContext = Readonly<{
  defaultText: string;
  selectionMode: boolean;
  edgeToolbar: boolean;
  readOnly: boolean;
  visible: boolean;
  wheelNavigation: FlowWheelNavigation;
}>;

/** Current canvas notice or the summary used when no notice is active. */
export type FlowCanvasStatusContext = Readonly<{
  defaultText: string;
  notice: string | null;
  nodeCount: number;
  connectionCount: number;
  visible: boolean;
}>;

/** Visible diagram presentation for a host-rendered layer in world coordinates. */
export type FlowWorldOverlayContext = Readonly<{
  /** The unique document ID supplied to flowView. */
  id: string;
  viewport: Viewport;
  surface: Size | null;
  /** Visible nodes, including the presentation bounds of collapsed groups. */
  nodes: readonly FlowNode[];
  /** Visible edges keep their authored endpoint IDs. */
  edges: readonly FlowEdge[];
  selectedNodeIds: readonly string[];
  selectedEdgeIds: readonly string[];
  readOnly: boolean;
}>;

export type FlowViewOptions<M> = FlowDiagnosticOptions &
  Readonly<{
    /** Unique within the document; prefixes accessible descriptions and SVG markers. */
    id: string;
    label: string;
    onEvent: (event: EditorEvent) => M;
    /** Host content under the world transform. Null or undefined omits the layer. */
    renderWorldOverlay?: (
      context: FlowWorldOverlayContext,
      h: HtmlBuilder<M>,
    ) => Html | null | undefined;
    /** Uses the host's builder; arbitrary FoldKit controls retain their normal behaviour. */
    renderNode?: (node: FlowNode, h: HtmlBuilder<M>) => Html;
    /** Replaces the complete measured node shell. Compose the public frame and interaction primitives. */
    renderNodeShell?: (context: FlowNodeRenderContext, h: HtmlBuilder<M>) => Html | undefined;
    /** Replaces a group boundary. Its frame retains Model-owned bounds and paint order. */
    renderGroupShell?: (context: FlowNodeRenderContext, h: HtmlBuilder<M>) => Html | undefined;
    /** Decorative SVG along Flow's path. Return undefined to use the built-in renderer. */
    renderEdge?: (context: FlowEdgeRenderContext, h: HtmlBuilder<M>) => Html | undefined;
    /** Replaces the badge at the resolved anchor. Undefined uses the default; null hides the badge. */
    renderEdgeLabel?: (context: FlowEdgeLabelContext, h: HtmlBuilder<M>) => Html | null | undefined;
    /** Replaces the active inline editor. Undefined uses the default form. */
    renderEdgeLabelEditor?: (
      context: FlowEdgeLabelEditorContext,
      h: HtmlBuilder<M>,
    ) => Html | undefined;
    /** Resolves one path and label anchor for decoration, selection and controls. */
    edgeGeometry?: FlowEdgeGeometryPolicy;
    /** Pure geometry for new connections and either end of a reconnection. */
    connectionGeometry?: FlowConnectionGeometryPolicy;
    /** Decorative SVG using the resolved preview path. Undefined keeps the default; empty SVG omits the visual. */
    renderConnection?: (
      context: FlowConnectionRenderContext,
      h: HtmlBuilder<M>,
    ) => Html | undefined;
    /** Replaces the controls layout. Undefined keeps defaults; feature gates still apply. */
    renderViewportControls?: (
      context: FlowViewportControlsContext,
      h: HtmlBuilder<M>,
    ) => Html | undefined;
    /** Replaces minimap appearance using the public navigation primitive. */
    renderMinimap?: (context: FlowMinimapContext, h: HtmlBuilder<M>) => Html | undefined;
    edgeAppearance?: (edge: FlowEdge) => Readonly<{
      stroke?: string;
      strokeWidth?: number;
      dashArray?: string;
      /** Selection corridor in world units; defaults to 12. Must be positive and finite. */
      hitWidth?: number;
    }>;
    /** Classes on the editor root, including classes produced by Pleat's cssClass(). */
    themeClassName?: string;
    /** Show a screen-sized toolbar for a single selected node in editable views. */
    nodeToolbar?: boolean | FlowNodeToolbarOptions;
    /** Replaces the toolbar contents. Undefined uses the default; null hides the toolbar. */
    renderNodeToolbar?: (
      context: FlowNodeToolbarContext,
      h: HtmlBuilder<M>,
    ) => Html | null | undefined;
    /** Show on-canvas controls for a single selected edge in editable views. */
    edgeToolbar?: boolean;
    /** Use the same pure deletion policy passed to updateEditor to disable protected actions. */
    canDelete?: EditorPolicy['canDelete'];
    /** Use the reducer's reconnection policy to omit handles for locked endpoints. */
    canReconnect?: EditorPolicy['canReconnect'];
    /** Replaces the toolbar contents. Undefined uses the default; null hides the toolbar. */
    renderEdgeToolbar?: (
      context: FlowEdgeToolbarContext,
      h: HtmlBuilder<M>,
    ) => Html | null | undefined;
    /** Replaces canvas guidance inside the existing accessible description. */
    renderCanvasHelp?: (context: FlowCanvasHelpContext, h: HtmlBuilder<M>) => Html | undefined;
    /** Replaces status content inside the existing polite live region. */
    renderCanvasStatus?: (context: FlowCanvasStatusContext, h: HtmlBuilder<M>) => Html | undefined;
    /** Replaces the list contents. The compact disclosure and accessible group stay owned by Flow. */
    renderConnections?: (context: FlowConnectionsContext, h: HtmlBuilder<M>) => Html | undefined;
    /** Enables pending node highlights and shell preview state. Defaults to true. */
    selectionPreviewHighlights?: boolean;
    /** Replaces the decorative selection marquee. Undefined uses the default; null omits it. */
    renderSelectionMarquee?: (
      context: FlowSelectionMarqueeContext,
      h: HtmlBuilder<M>,
    ) => Html | null | undefined;
    /** Enable context actions for nodes and edges in editable views. */
    contextActions?: boolean;
    /** Replaces the contents of an open node or edge context panel. Undefined uses the default. */
    renderContextMenu?: (context: FlowContextMenuContext, h: HtmlBuilder<M>) => Html | undefined;
    /** Pan near the canvas boundary while dragging nodes or connections. */
    autoPan?: boolean;
    /** Enable two-finger touch pan and pinch-to-zoom on the canvas. */
    pinchZoom?: boolean;
    /** Defaults to cursor-anchored zoom. Off leaves wheel input to the page. */
    wheelNavigation?: FlowWheelNavigation;
    /** Card width handles and corner/side handles on selected expanded groups. */
    resizeHandles?: boolean;
    /** Show Model dimensions during resizing and for selected groups with handles. Defaults to true. */
    resizeReadout?: boolean;
    /** Decorative SVG for a resolved guide. Undefined uses the default; null omits that guide. */
    renderAlignmentGuide?: (
      context: FlowAlignmentGuideContext,
      h: HtmlBuilder<M>,
    ) => Html | null | undefined;
    /** Replaces the contents of an eligible readout. Undefined uses the default; null omits it. */
    renderResizeReadout?: (
      context: FlowResizeReadoutContext,
      h: HtmlBuilder<M>,
    ) => Html | null | undefined;
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
function groupResizeTitle(
  node: FlowNode,
  snapToGrid: boolean,
  spacing: number,
  measurements: boolean,
): string {
  if (!measurements)
    return node.keepAspectRatio
      ? 'Drag to resize with locked proportions; arrow keys adjust size'
      : 'Drag to resize; arrow keys adjust size';
  const step = snapToGrid ? `${spacing}, Shift by ${spacing * 4}` : '5, Shift by 20';
  return node.keepAspectRatio
    ? `Drag to resize with locked proportions; arrow keys adjust by ${step}`
    : `Drag to resize; arrow keys adjust by ${step}`;
}
function deletionReason(
  graph: FlowGraph,
  targets: DeletionTargets,
  canDelete: EditorPolicy['canDelete'],
): string | undefined {
  if (!canDelete) return undefined;
  const decision = resolveDeletion(graph, targets, canDelete);
  return decision.type === 'blocked' ? decision.reason : undefined;
}

function deletionExplanation<M>(h: HtmlBuilder<M>, reason: string | undefined): readonly Html[] {
  return reason === undefined
    ? []
    : [h.small([h.Style({ 'flex-basis': '100%', 'overflow-wrap': 'anywhere' })], [reason])];
}

function selectedNodeActions(
  state: EditorState,
  canDelete: EditorPolicy['canDelete'],
): FlowNodeToolbarContext['actions'] {
  return {
    duplicate: { label: 'Duplicate node', event: { type: 'DuplicatePressed' } },
    deleteNode: {
      label: 'Delete node',
      event: { type: 'DeletePressed' },
      disabledReason: deletionReason(
        state.graph,
        { nodeIds: state.selectedNodes, edgeIds: state.selectedEdges },
        canDelete,
      ),
    },
  };
}

function contextMenu(
  state: EditorState,
  diagnostics: FlowDiagnostics,
  canDelete: EditorPolicy['canDelete'],
): FlowContextMenuContext | undefined {
  const context = state.context;
  if (!context || state.readOnly) return undefined;
  const close: FlowContextAction = { label: 'Close', event: { type: 'ContextDismissed' } };
  const { point, id, kind } = context;
  if (kind === 'edge') {
    const edge = state.graph.edges.find((edge) => edge.id === id);
    if (!edge) return undefined;
    return {
      kind,
      edge,
      point,
      close,
      deleteEdge: {
        label: 'Delete edge',
        event: { type: 'EdgeDeleted', id },
        disabledReason: deletionReason(state.graph, { nodeIds: [], edgeIds: [id] }, canDelete),
      },
      rename: { label: 'Rename', event: { type: 'EdgeLabelEditingStarted', id } },
    };
  }

  const node = state.graph.nodes.find((node) => node.id === id);
  if (!node) return undefined;
  const collapsed = state.collapsedGroups.includes(id);
  const group: FlowGroupContextActions | undefined =
    node.kind === 'group'
      ? {
          node,
          collapsed,
          fit: { label: 'Fit group to contents', event: { type: 'GroupFitClicked', id } },
          lockProportions: {
            label: 'Lock proportions',
            event: { type: 'GroupAspectRatioToggled', id },
            pressed: node.keepAspectRatio ?? false,
          },
          showMeasurements: diagnostics.measurements,
          dimensionsDisabled: collapsed || state.gesture.type !== 'idle',
          dimensionStep: state.snapToGrid ? state.gridSpacing : 1,
          changeDimension: (dimension, value) => ({
            type: 'GroupDimensionChanged',
            id,
            dimension,
            value,
          }),
        }
      : undefined;
  return {
    kind,
    node,
    point,
    close,
    group,
    ...selectedNodeActions(state, canDelete),
  };
}

function defaultContextMenu<M>(
  h: HtmlBuilder<M>,
  context: FlowContextMenuContext,
  options: FlowViewOptions<M>,
): Html {
  const button = (action: FlowContextAction) =>
    flowContextAction(
      h,
      action,
      options.onEvent,
      [h.Style({ 'min-height': '36px', 'text-align': 'left', cursor: 'pointer' })],
      [action.label],
    );
  const group = context.kind === 'node' ? context.group : undefined;
  const helpId = `${options.id}-group-size-help`;
  return h.div(
    [
      h.Style({
        display: 'grid',
        gap: '4px',
        padding: '5px',
        border: '1px solid var(--flow-node-border, #cbd5e1)',
        'border-radius': '8px',
        background: 'var(--flow-node-background, #fff)',
        'box-shadow': '0 2px 8px rgb(0 0 0 / 0.18)',
      }),
    ],
    [
      ...(context.kind === 'node'
        ? [
            button(context.duplicate),
            ...(group
              ? [
                  button(group.fit),
                  button(group.lockProportions),
                  ...(group.showMeasurements
                    ? [
                        ...(['width', 'height'] as const).map((dimension) =>
                          h.label(
                            [
                              h.Style({
                                display: 'grid',
                                'grid-template-columns': '64px minmax(0, 1fr)',
                                'align-items': 'center',
                                gap: '8px',
                              }),
                            ],
                            [
                              dimension === 'width' ? 'Width' : 'Height',
                              flowContextDimensionInput(h, group, dimension, options.onEvent, [
                                h.AriaDescribedBy(helpId),
                                h.Style({
                                  width: '100%',
                                  'min-height': '34px',
                                  'box-sizing': 'border-box',
                                }),
                              ]),
                            ],
                          ),
                        ),
                        h.p(
                          [
                            h.Id(helpId),
                            h.Style({ margin: '4px 0', 'font-size': '12px', 'line-height': '1.4' }),
                          ],
                          [
                            group.collapsed
                              ? 'Expand the group to edit dimensions.'
                              : 'Values follow grid, limits and locked proportions.',
                          ],
                        ),
                      ]
                    : []),
                ]
              : []),
            button(context.deleteNode),
            ...deletionExplanation(h, context.deleteNode.disabledReason),
          ]
        : [
            button(context.deleteEdge),
            ...deletionExplanation(h, context.deleteEdge.disabledReason),
          ]),
      button(context.close),
    ],
  );
}

function contextPanel<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  options: FlowViewOptions<M>,
  diagnostics: FlowDiagnostics,
): readonly Html[] {
  const context = options.contextActions
    ? contextMenu(state, diagnostics, options.canDelete)
    : undefined;
  if (!context) return [];
  const group = context.kind === 'node' ? context.group : undefined;
  const width = group ? 224 : 172;
  const height = group ? (group.showMeasurements ? 336 : 228) : 130;
  const top = `clamp(4px, ${context.point.y}px, max(4px, calc(100% - ${height}px)))`;
  const id = context.kind === 'node' ? context.node.id : context.edge.id;
  return [
    h.div(
      [
        h.Key(`context:${context.kind}:${id}`),
        h.Role('group'),
        h.AriaLabel(context.kind === 'node' ? 'Node context actions' : 'Edge context actions'),
        h.Tabindex(-1),
        h.DataAttribute('flow-context-panel', ''),
        h.DataAttribute('flow-no-drag', ''),
        h.Style({
          position: 'absolute',
          left: `clamp(4px, ${context.point.x}px, max(4px, calc(100% - ${width + 4}px)))`,
          top,
          width: `min(${width}px, calc(100% - 8px))`,
          'max-height': `calc(100% - ${top} - 4px)`,
          'overflow-y': 'auto',
          'z-index': '3',
        }),
      ],
      [options.renderContextMenu?.(context, h) ?? defaultContextMenu(h, context, options)],
    ),
  ];
}

function viewportControls<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  { onEvent, selectionModeControl }: FlowViewOptions<M>,
  diagnostics: FlowDiagnostics,
): Html {
  const actions = viewportControlActions(state);
  const button = (action: typeof actions.zoomIn) =>
    flowViewportControl(
      h,
      action,
      onEvent,
      [
        h.Style({
          'min-height': '44px',
          padding: '0 12px',
          color: action.pressed
            ? 'var(--flow-control-color, #fff)'
            : 'var(--flow-node-color, #172033)',
          background: action.pressed
            ? 'var(--flow-selection, #2563eb)'
            : 'var(--flow-node-background, #fff)',
          border: '1px solid var(--flow-canvas-border, #94a3b8)',
          'border-radius': '6px',
        }),
      ],
      [action.label],
    );
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
      button(actions.zoomIn),
      button(actions.zoomOut),
      button(actions.fitView),
      ...(selectionModeControl ? [button(actions.selectionMode)] : []),
      ...(diagnostics.zoomLevel
        ? [
            h.span(
              [h.DataAttribute('flow-zoom-level', '')],
              [`${Math.round(state.viewport.zoom * 100)}%`],
            ),
          ]
        : []),
    ],
  );
}

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

function defaultEdgeToolbar<M>(
  h: HtmlBuilder<M>,
  context: FlowEdgeToolbarContext,
  onEvent: FlowViewOptions<M>['onEvent'],
): Html {
  const action = (descriptor: FlowEdgeToolbarContext['actions']['rename']) =>
    flowEdgeToolbarButton(
      h,
      descriptor,
      onEvent,
      [h.Style({ 'min-height': '32px', 'font-size': '13px', cursor: 'pointer' })],
      [descriptor.label],
    );
  return h.div(
    [
      h.Style({
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
      }),
    ],
    [
      action(context.actions.rename),
      flowEdgePathStyleSelect(h, context, onEvent, [
        h.Style({ 'min-height': '32px', 'font-size': '13px' }),
      ]),
      action(context.actions.deleteEdge),
      ...deletionExplanation(h, context.actions.deleteEdge.disabledReason),
    ],
  );
}

function edgeToolbarFrame<M>(h: HtmlBuilder<M>, anchor: Point, id: string, content: Html): Html {
  const width = 256;
  return h.div(
    [
      h.Id(id),
      h.Role('group'),
      h.AriaLabel('Selected edge actions'),
      h.Tabindex(-1),
      h.DataAttribute('flow-no-drag', ''),
      h.Style({
        position: 'absolute',
        left: `clamp(6px, ${anchor.x - width / 2}px, max(6px, calc(100% - ${width + 6}px)))`,
        top: `clamp(6px, ${anchor.y}px, max(6px, calc(100% - 82px)))`,
        width: `min(${width}px, calc(100% - 12px))`,
        'z-index': '1',
      }),
    ],
    [content],
  );
}

function selectionMarquee<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  options: FlowViewOptions<M>,
  preview: BoxSelectionPreview | undefined,
): readonly Html[] {
  if (!preview) return [];
  const { bounds, previewNodeIds } = preview;
  const { viewport } = state;
  const custom = options.renderSelectionMarquee?.(
    { bounds, viewport, match: state.boxSelectionMatch, previewNodeIds },
    h,
  );
  if (custom === null) return [];
  const placement = {
    position: 'absolute',
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${bounds.right - bounds.left}px`,
    height: `${bounds.bottom - bounds.top}px`,
    'box-sizing': 'border-box',
    'pointer-events': 'none',
  };
  return [
    h.div(
      [
        h.AriaHidden(true),
        h.DataAttribute('flow-selection-box', ''),
        h.Style(
          custom === undefined
            ? {
                ...placement,
                border: '1px solid var(--flow-selection, #2563eb)',
                background: 'var(--flow-selection-background, rgb(37 99 235 / 0.12))',
              }
            : placement,
        ),
      ],
      custom === undefined ? [] : [custom],
    ),
  ];
}

function alignmentGuideViews<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  options: FlowViewOptions<M>,
  diagnostics: FlowDiagnostics,
): readonly Html[] {
  const { gesture, viewport } = state;
  if (
    !diagnostics.alignmentGuides ||
    (gesture.type !== 'node-drag' && gesture.type !== 'node-resize')
  )
    return [];
  return (gesture.guides ?? []).flatMap((guide) => {
    const { axis, position, from, to } = guide;
    const start = axis === 'x' ? { x: position, y: from } : { x: from, y: position };
    const end = axis === 'x' ? { x: position, y: to } : { x: to, y: position };
    const phase = gesture.type === 'node-drag' ? 'drag' : 'resize';
    const custom = options.renderAlignmentGuide?.({ guide, start, end, phase, viewport }, h);
    if (custom === null) return [];
    const attributes = [h.Key(`alignment:${axis}`), h.DataAttribute('flow-alignment-guide', axis)];
    if (custom !== undefined)
      return [h.g([...attributes, h.Style({ 'pointer-events': 'none' })], [custom])];
    return [
      h.line(
        [
          ...attributes,
          h.X1(String(start.x)),
          h.Y1(String(start.y)),
          h.X2(String(end.x)),
          h.Y2(String(end.y)),
          h.Stroke('var(--flow-alignment-guide, #7c3aed)'),
          h.StrokeWidth('2'),
          h.StrokeDasharray('5 3'),
          h.Style({ 'vector-effect': 'non-scaling-stroke' }),
        ],
        [],
      ),
    ];
  });
}

function resizeReadout<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  options: FlowViewOptions<M>,
  nodes: readonly FlowNode[],
  diagnostics: FlowDiagnostics,
) {
  if (!diagnostics.measurements || options.resizeReadout === false || state.readOnly) return [];
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
  const context: FlowResizeReadoutContext = {
    node,
    phase: gesture.type === 'node-resize' ? 'resizing' : 'selected-group',
    widthText: String(Number(node.size.width.toFixed(2))),
    heightText: String(Number(node.size.height.toFixed(2))),
  };
  const { widthText, heightText } = context;
  const content = options.renderResizeReadout?.(context, h);
  if (content === null) return [];
  return [
    h.div(
      [
        h.Key('resize-readout'),
        h.DataAttribute('flow-resize-readout', node.id),
        h.Role('status'),
        h.AriaLive('polite'),
        h.AriaLabel(`${node.label} dimensions in graph units`),
        h.Title(`${node.label}: ${widthText} × ${heightText} graph units`),
        h.Style({
          position: 'absolute',
          left: '8px',
          bottom: '8px',
          'z-index': '2',
          'pointer-events': 'none',
        }),
      ],
      [
        content ??
          h.div(
            [
              h.Style({
                padding: '6px 10px',
                color: 'var(--flow-resize-readout-color, var(--flow-node-color, #172033))',
                background:
                  'var(--flow-resize-readout-background, var(--flow-node-background, #fff))',
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
            [`${widthText} × ${heightText}`],
          ),
      ],
    ),
  ];
}

function connectionPreviewView<M>(
  h: HtmlBuilder<M>,
  preview: FlowConnectionPreview | undefined,
  options: FlowViewOptions<M>,
): Html | undefined {
  if (!preview) return undefined;
  const context: FlowConnectionRenderContext = {
    ...preview,
    stroke:
      preview.feedback.type === 'valid'
        ? 'var(--flow-valid-target, #0f766e)'
        : preview.feedback.type === 'invalid'
          ? 'var(--flow-invalid-target, #dc2626)'
          : 'var(--flow-selection, #2563eb)',
    strokeWidth: '3',
    dashArray: '6 4',
  };
  const decoration =
    options.renderConnection?.(context, h) ??
    h.path(
      [
        h.D(context.path),
        h.Fill('none'),
        h.Stroke(context.stroke),
        h.StrokeWidth(context.strokeWidth),
        h.StrokeDasharray(context.dashArray),
      ],
      [],
    );
  return h.g(
    [
      h.Key('connection-preview'),
      h.DataAttribute('flow-connection-preview', ''),
      h.DataAttribute('flow-connection-state', context.feedback.type),
      h.AriaHidden(true),
      h.Style({ 'pointer-events': 'none' }),
    ],
    [decoration],
  );
}

function canvasHelpView<M>(
  h: HtmlBuilder<M>,
  options: FlowViewOptions<M>,
  state: EditorState,
  descriptionId: string,
  edgeToolbar: boolean,
  visible: boolean,
): Html {
  const wheelNavigation = options.wheelNavigation ?? 'zoom';
  const wheelHelp =
    wheelNavigation === 'pan'
      ? 'Scroll to pan. Hold Ctrl or Command while scrolling to zoom. '
      : wheelNavigation === 'zoom'
        ? 'Scroll to zoom. '
        : '';
  const defaultText = [
    'Drag a node title to move it. ',
    state.selectionMode
      ? 'Drag the background to select nodes. '
      : 'Drag the background to pan, or Shift-drag to select nodes. ',
    wheelHelp,
    'Tab to a title, then use arrow keys to move it. Drag from an output to an input, or activate the two ports in order with Enter or Space. Select an edge and drag an available endpoint handle to reconnect. Escape cancels.',
    ...(edgeToolbar
      ? [' In the Connections list, select an edge and press Up Arrow to reach its actions.']
      : []),
  ].join('');
  const custom = options.renderCanvasHelp?.(
    {
      defaultText,
      selectionMode: state.selectionMode,
      readOnly: state.readOnly,
      edgeToolbar,
      wheelNavigation,
      visible,
    },
    h,
  );
  const attributes = [
    h.Id(descriptionId),
    h.DataAttribute('flow-help', ''),
    ...(visible ? [] : [h.Style(visuallyHidden)]),
  ];
  return custom === undefined ? h.p(attributes, [defaultText]) : h.div(attributes, [custom]);
}

function canvasStatusView<M>(
  h: HtmlBuilder<M>,
  options: FlowViewOptions<M>,
  notice: string | null,
  nodeCount: number,
  connectionCount: number,
  visible: boolean,
): Html {
  const defaultText = notice ?? `${nodeCount} nodes, ${connectionCount} connections`;
  const custom = options.renderCanvasStatus?.(
    {
      defaultText,
      notice,
      nodeCount,
      connectionCount,
      visible,
    },
    h,
  );
  return h.div(
    [
      h.DataAttribute('flow-status', ''),
      h.Role('status'),
      h.AriaLive('polite'),
      h.Style(visible ? { 'min-height': '1.5em' } : visuallyHidden),
    ],
    [custom ?? defaultText],
  );
}

/** A normal FoldKit view: all state and message handling belong to its parent. */
export function flowView<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  options: FlowViewOptions<M>,
): Html {
  const diagnostics = resolveFlowDiagnostics(options);
  const presentation = presentGroups(state.graph, state.collapsedGroups);
  const selectionPreview =
    state.gesture.type === 'box-selection'
      ? resolveBoxSelection(state, state.gesture, presentation.nodes)
      : undefined;
  const previewIds = new Set(
    options.selectionPreviewHighlights === false ? [] : selectionPreview?.previewNodeIds,
  );
  const collapsedGroups = new Set(state.collapsedGroups);
  const visibleEdges = state.graph.edges.filter((edge) =>
    edgeIsVisible(edge, presentation.hiddenBy),
  );
  const worldOverlay = options.renderWorldOverlay?.(
    {
      id: options.id,
      viewport: state.viewport,
      surface: state.surface,
      nodes: presentation.nodes,
      edges: visibleEdges,
      selectedNodeIds: state.selectedNodes,
      selectedEdgeIds: state.selectedEdges,
      readOnly: state.readOnly,
    },
    h,
  );
  const minimap = options.minimap && diagnostics.overview ? minimapContext(state) : undefined;
  const descriptionId = `${options.id}-help`;
  const transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.zoom})`;
  const drag = state.gesture.type === 'connection-drag' ? state.gesture : null;
  const preview = resolveConnectionPreview(state, options.connectionGeometry);
  const previewView = connectionPreviewView(h, preview, options);
  const contextEnabled = options.contextActions && !state.readOnly;
  const contextAction = (
    kind: 'node' | 'edge',
    id: string,
    label: string,
    point: Point,
  ): FlowContextTrigger => ({
    label: `More actions for ${label}`,
    expanded: state.context?.kind === kind && state.context.id === id,
    disabled: state.gesture.type !== 'idle',
    event: { type: 'ContextOpened', context: { kind, id, point } },
  });
  const contextTrigger = (action: FlowContextTrigger, onNode = false) =>
    flowContextTrigger(
      h,
      action,
      options.onEvent,
      [
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
      contextAction('node', node.id, node.label, {
        x: state.viewport.x + (node.position.x + node.size.width) * state.viewport.zoom - 36,
        y: state.viewport.y + node.position.y * state.viewport.zoom + 44,
      }),
      node.kind !== 'group',
    );
  const dropParent = state.gesture.type === 'node-drag' ? state.gesture.dropParent : undefined;
  const boundaries = groupsInPaintOrder(presentation.nodes).map((node) => {
    const collapsed = collapsedGroups.has(node.id);
    const dropTarget = dropParent === node.id;
    const base = {
      node,
      state,
      descriptionId,
      diagnostics,
      collapsed,
      dropTarget,
      selectionPreview: previewIds.has(node.id),
    };
    const context: FlowNodeRenderContext = {
      ...base,
      contextAction: contextEnabled ? nodeContextTrigger(node) : undefined,
      collapseToggle: h.button(
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
      resizeHandles:
        options.resizeHandles &&
        !state.readOnly &&
        !collapsed &&
        state.selectedNodes.includes(node.id)
          ? resizeHandles.map((handle) =>
              flowResizeHandle(
                h,
                base,
                handle,
                [
                  h.Key(handle),
                  h.Type('button'),
                  h.Title(
                    groupResizeTitle(
                      node,
                      state.snapToGrid,
                      state.gridSpacing,
                      diagnostics.measurements,
                    ),
                  ),
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
          : [],
    };
    const custom = options.renderGroupShell?.(context, h);
    if (custom !== undefined) return custom;
    return flowGroupFrame(
      h,
      context,
      [
        h.Style({
          'border-radius': 'var(--flow-node-radius, 8px)',
          border: dropTarget
            ? '2px solid var(--flow-valid-target, #0f766e)'
            : state.selectedNodes.includes(node.id)
              ? '2px solid var(--flow-selection, #2563eb)'
              : '2px dashed var(--flow-node-border, #64748b)',
          outline: context.selectionPreview ? '2px dashed var(--flow-selection, #2563eb)' : 'none',
          'outline-offset': '2px',
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
        flowDragHandle(
          h,
          context,
          [
            h.Type('button'),
            h.Title(node.label),
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
        context.collapseToggle!,
        ...(context.contextAction ? [context.contextAction] : []),
        ...context.resizeHandles,
      ],
    );
  });
  const nodes = presentation.nodes
    .filter((node) => node.kind !== 'group')
    .map((node) => {
      const base = {
        node,
        state,
        descriptionId,
        diagnostics,
        collapsed: false,
        dropTarget: false,
        selectionPreview: previewIds.has(node.id),
      };
      const context: FlowNodeRenderContext = {
        ...base,
        contextAction: contextEnabled ? nodeContextTrigger(node) : undefined,
        resizeHandles:
          options.resizeHandles && !state.readOnly
            ? [
                flowResizeHandle(
                  h,
                  base,
                  'right',
                  [
                    h.Style({
                      position: 'absolute',
                      right: '-8px',
                      bottom: '-8px',
                      border: 'none',
                      padding: '0',
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
            : [],
      };
      const custom = options.renderNodeShell?.(context, h);
      if (custom !== undefined) return custom;
      return flowNodeFrame(
        h,
        context,
        [
          h.Style({
            'min-height': '64px',
            border: state.selectedNodes.includes(node.id)
              ? '2px solid var(--flow-selection, #2563eb)'
              : '2px solid var(--flow-node-border, #64748b)',
            outline: context.selectionPreview
              ? '2px dashed var(--flow-selection, #2563eb)'
              : 'none',
            'outline-offset': '2px',
            'border-radius': 'var(--flow-node-radius, 8px)',
            background: 'var(--flow-node-background, #fff)',
            color: 'var(--flow-node-color, #172033)',
            padding: '12px',
            'pointer-events': 'auto',
          }),
        ],
        [
          flowDragHandle(
            h,
            context,
            [
              h.Type('button'),
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
          ...(context.contextAction ? [context.contextAction] : []),
          ...context.resizeHandles,
          ...(options.renderNode ? [options.renderNode(node, h)] : []),
          ...node.ports.map((port) =>
            flowPort(
              h,
              context,
              port,
              [
                h.Style({
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
      );
    });
  const markerId = `${options.id}-arrow`;
  const routes = new Map(state.routes.map((route) => [route.id, route.points]));
  const edgeGeometries = visibleEdges.map((edge) => ({
    edge,
    ...resolveEdgeGeometry(state.graph, edge, {
      policy: options.edgeGeometry,
      route: routes.get(edge.id),
      sourceGroup: presentation.hiddenBy.get(edge.source.node),
      targetGroup: presentation.hiddenBy.get(edge.target.node),
    }),
  }));
  const toolbarEnabled = options.edgeToolbar === true && !state.readOnly;
  const toolbarId = `${encodeURIComponent(options.id)}-edge-actions`;
  const activeEdge =
    toolbarEnabled && state.selectedEdges.length === 1
      ? edgeGeometries.find(({ edge }) => edge.id === state.selectedEdges[0])
      : undefined;
  const edges = edgeGeometries.map(({ edge, path, labelPosition }) => {
    const appearance = options.edgeAppearance?.(edge);
    const selected = state.selectedEdges.includes(edge.id);
    const context: FlowEdgeRenderContext = {
      edge,
      path,
      labelPosition,
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
    const decoration =
      custom ??
      h.path(
        [
          h.D(path),
          h.Fill('none'),
          h.Stroke(context.stroke),
          h.StrokeWidth(context.strokeWidth),
          h.StrokeDasharray(context.dashArray),
          h.MarkerEnd(context.markerEnd),
        ],
        [],
      );
    return h.g(
      [h.Key(`edge:${edge.id}`)],
      [
        h.g([h.Style({ 'pointer-events': 'none' })], [decoration]),
        flowEdgeHitTarget(h, { edge, path, hitWidth: appearance?.hitWidth ?? 12 }),
      ],
    );
  });
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
  const edgeLabels = edgeGeometries.flatMap(({ edge, labelPosition }) => {
    const selected = state.selectedEdges.includes(edge.id);
    const draft =
      !state.readOnly && state.edgeLabelDraft?.id === edge.id ? state.edgeLabelDraft : null;
    if (!labelPosition || (!draft && !edge.label && (state.readOnly || !selected))) return [];
    const context: FlowEdgeLabelContext = {
      edge,
      labelPosition,
      description: `${edge.source.node}:${edge.source.port} → ${edge.target.node}:${edge.target.port}`,
      selected,
      readOnly: state.readOnly,
    };
    const { onEvent } = options;
    const editor = draft ? { ...context, draft: draft.text } : null;
    const content = editor
      ? (options.renderEdgeLabelEditor?.(editor, h) ??
        flowEdgeLabelForm(
          h,
          editor,
          onEvent,
          [h.Style({ ...chipStyle, display: 'flex', gap: '4px', 'max-width': 'none' })],
          [
            flowEdgeLabelInput(h, editor, onEvent, []),
            h.button([h.Type('submit')], ['Save label']),
            flowEdgeLabelCancel(h, editor, onEvent, [], ['Cancel']),
          ],
        ))
      : options.renderEdgeLabel?.(context, h);
    if (content === null) return [];
    return [
      h.div(
        [
          h.Key(`edge-label:${edge.id}`),
          h.DataAttribute('flow-no-drag', ''),
          h.Style({
            position: 'absolute',
            left: `${labelPosition.x}px`,
            top: `${labelPosition.y}px`,
            transform: 'translate(-50%, -50%)',
            'pointer-events': state.readOnly ? 'none' : 'auto',
            'z-index': draft ? '2' : 'auto',
          }),
        ],
        [
          content ??
            flowEdgeLabelBadge(
              h,
              context,
              onEvent,
              [h.Style({ ...chipStyle, cursor: state.readOnly ? 'inherit' : 'pointer' })],
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
            if ((options.canReconnect?.(edge, end, state.graph) ?? null) !== null) return [];
            const endpoint = edge[end];
            if (presentation.hiddenBy.has(endpoint.node)) return [];
            const node = state.graph.nodes.find((item) => item.id === endpoint.node);
            const port = node?.ports.find((item) => item.id === endpoint.port);
            if (!node || !port) return [];
            const position = portBoundaryPosition(node, port.id);
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
  const nodeToolbarOptions = options.nodeToolbar === true ? {} : options.nodeToolbar;
  const toolbarNode =
    nodeToolbarOptions &&
    !state.readOnly &&
    state.gesture.type === 'idle' &&
    !state.context &&
    !state.connection &&
    state.selectedNodes.length === 1 &&
    state.selectedEdges.length === 0
      ? presentation.nodes.find((node) => node.id === state.selectedNodes[0])
      : undefined;
  const selectedNodeToolbar =
    toolbarNode && nodeToolbarOptions
      ? nodeToolbarContext(
          toolbarNode,
          state.viewport,
          nodeToolbarOptions,
          selectedNodeActions(state, options.canDelete),
        )
      : undefined;
  const nodeToolbarContent =
    selectedNodeToolbar && options.renderNodeToolbar?.(selectedNodeToolbar, h);
  const toolbarContext: FlowEdgeToolbarContext | undefined =
    activeEdge?.labelPosition && !state.edgeLabelDraft && !drag && !state.context
      ? {
          edge: activeEdge.edge,
          labelPosition: activeEdge.labelPosition,
          actions: {
            rename: {
              label: 'Rename',
              event: { type: 'EdgeLabelEditingStarted', id: activeEdge.edge.id },
            },
            deleteEdge: {
              label: 'Delete edge',
              event: { type: 'EdgeDeleted', id: activeEdge.edge.id },
              disabledReason: deletionReason(
                state.graph,
                { nodeIds: [], edgeIds: [activeEdge.edge.id] },
                options.canDelete,
              ),
            },
            changePathStyle: (pathStyle) => ({
              type: 'EdgePathStyleChanged',
              id: activeEdge.edge.id,
              pathStyle,
            }),
          },
        }
      : undefined;
  const toolbarContent = toolbarContext && options.renderEdgeToolbar?.(toolbarContext, h);
  const toolbar =
    toolbarContext && toolbarContent !== null
      ? edgeToolbarFrame(
          h,
          edgeToolbarPosition(
            toolbarContext.labelPosition,
            state.viewport,
            reconnectPoints,
            state.surface?.height ?? options.height ?? 440,
          ),
          toolbarId,
          toolbarContent ?? defaultEdgeToolbar(h, toolbarContext, options.onEvent),
        )
      : null;
  const connections = () => {
    const nodeLabels = new Map(state.graph.nodes.map((node) => [node.id, node.label]));
    const compact = !diagnostics.connectionList;
    const entries = visibleEdges.map((edge): FlowConnectionEntry => {
      const sourceLabel = nodeLabels.get(edge.source.node) ?? 'Source';
      const targetLabel = nodeLabels.get(edge.target.node) ?? 'Target';
      const label =
        edge.label ??
        (compact
          ? `${sourceLabel} → ${targetLabel}`
          : `${edge.source.node}:${edge.source.port} → ${edge.target.node}:${edge.target.port}`);
      return {
        edge,
        label,
        sourceLabel,
        targetLabel,
        selected: state.selectedEdges.includes(edge.id),
        contextAction: contextEnabled
          ? contextAction('edge', edge.id, label, { x: 12, y: 12 })
          : undefined,
        toolbarId: toolbar && activeEdge?.edge.id === edge.id ? toolbarId : undefined,
      };
    });
    const custom = options.renderConnections?.({ entries, compact, readOnly: state.readOnly }, h);
    return h.div(
      [
        h.Id(`${options.id}-connections`),
        h.DataAttribute('flow-connections', compact ? 'compact' : 'expanded'),
        h.Role('group'),
        h.AriaLabel('Connections'),
      ],
      custom
        ? [custom]
        : entries.map((entry) => {
            const selection = flowConnectionButton(h, entry, options.onEvent, [], [entry.label]);
            return entry.contextAction
              ? h.span(
                  [
                    h.Key(entry.edge.id),
                    h.Style({ display: 'inline-flex', gap: '4px', 'margin-right': '8px' }),
                  ],
                  [selection, contextTrigger(entry.contextAction)],
                )
              : selection;
          }),
    );
  };
  return h.div(
    [
      h.Id(options.id),
      h.DataAttribute('flow-minimal', String(options.minimalMode === true)),
      h.Class(options.themeClassName ? `foldkit-flow ${options.themeClassName}` : 'foldkit-flow'),
    ],
    [
      canvasHelpView(h, options, state, descriptionId, toolbarEnabled, diagnostics.instructions),
      ...(options.viewportControls
        ? [
            options.renderViewportControls?.(
              {
                state,
                diagnostics,
                actions: viewportControlActions(state),
                selectionModeControl: Boolean(options.selectionModeControl),
              },
              h,
            ) ?? viewportControls(h, state, options, diagnostics),
          ]
        : []),
      h.div(
        [
          h.Key('surface'),
          h.DataAttribute('flow-surface', options.id),
          h.DataAttribute('flow-readonly', String(state.readOnly)),
          h.DataAttribute('flow-grid-snap', String(state.snapToGrid)),
          h.DataAttribute('flow-grid-spacing', String(state.gridSpacing)),
          h.DataAttribute('flow-auto-pan', String(options.autoPan ?? false)),
          h.DataAttribute('flow-pinch-zoom', String(options.pinchZoom ?? false)),
          h.DataAttribute('flow-wheel-navigation', options.wheelNavigation ?? 'zoom'),
          h.DataAttribute(
            'flow-fit-animation',
            state.fitViewTransition.type === 'fitting' ? String(state.fitViewTransition.id) : '',
          ),
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
                  ...alignmentGuideViews(h, state, options, diagnostics),
                  ...handles,
                  ...(previewView ? [previewView] : []),
                ],
              ),
              ...nodes,
              ...edgeLabels,
              ...(worldOverlay === null || worldOverlay === undefined
                ? []
                : [
                    h.div(
                      [
                        h.DataAttribute('flow-world-overlay', ''),
                        h.Style({ position: 'absolute', inset: '0', 'pointer-events': 'none' }),
                      ],
                      [worldOverlay],
                    ),
                  ]),
              ...selectionMarquee(h, state, options, selectionPreview),
            ],
          ),
          ...(minimap
            ? [
                options.renderMinimap?.(minimap, h) ??
                  flowMinimap(
                    h,
                    minimap,
                    options.onEvent,
                    [
                      h.Key('minimap'),
                      h.Style({
                        position: 'absolute',
                        right: '10px',
                        bottom: '10px',
                        width: 'min(160px, 34%)',
                        height: 'auto',
                        'aspect-ratio': '8 / 5',
                        border: '0',
                        padding: '0',
                        background: 'var(--flow-node-background, #fff)',
                        'border-radius': '6px',
                        'box-shadow': '0 0 0 1px var(--flow-canvas-border, #94a3b8)',
                        cursor: 'crosshair',
                      }),
                    ],
                    [
                      ...minimap.nodes.map((node) =>
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
                      flowMinimapViewport(h, minimap.geometry, [
                        h.Fill('none'),
                        h.Stroke('var(--flow-selection, #2563eb)'),
                        h.Style({ 'vector-effect': 'non-scaling-stroke' }),
                      ]),
                    ],
                  ),
              ]
            : []),
          ...resizeReadout(h, state, options, presentation.nodes, diagnostics),
          ...(toolbar ? [toolbar] : []),
          ...(selectedNodeToolbar && nodeToolbarContent !== null
            ? [nodeToolbarView(h, selectedNodeToolbar, options.onEvent, nodeToolbarContent)]
            : []),
          ...contextPanel(h, state, options, diagnostics),
        ],
      ),
      canvasStatusView(
        h,
        options,
        state.notice,
        presentation.nodes.length,
        visibleEdges.length,
        diagnostics.status,
      ),
      ...(diagnostics.connectionList
        ? [connections()]
        : [
            h.div(
              [],
              [
                h.button(
                  [
                    h.Type('button'),
                    h.DataAttribute('flow-connections-toggle', ''),
                    h.AriaExpanded(state.connectionsExpanded),
                    ...(state.connectionsExpanded
                      ? [h.AriaControls(`${options.id}-connections`)]
                      : []),
                    h.OnClick(options.onEvent({ type: 'ConnectionListToggled' })),
                    h.Style({ 'min-height': '36px', padding: '6px 10px' }),
                  ],
                  ['Connections'],
                ),
                ...(state.connectionsExpanded ? [connections()] : []),
              ],
            ),
          ]),
    ],
  );
}
