/**
 * Optional native FoldKit views and interaction primitives using the host builder.
 * @module FoldKit
 */
export {
  zlozEndpointSearchInput,
  zlozEndpointSearchClear,
  zlozEndpointSearchFeedback,
} from './endpoint-search-view';
export type { ZlozEndpointSearchViewOptions } from './endpoint-search-view';
import {
  resolveConnectionCreation,
  type ZlozConnectionCreationContext,
  type ZlozConnectionCreationOptions,
} from './connection-creation';
import { zlozConnectionCreation } from './connection-creation-view';
export {
  zlozConnectionCreation,
  zlozConnectionCreationField,
  zlozConnectionCreationSelect,
  zlozConnectionCreationReasons,
  zlozConnectionCreationCancel,
} from './connection-creation-view';
export type { ZlozConnectionCreationViewOptions } from './connection-creation-view';
import { zlozEdgeEndpointField } from './edge-endpoint';
import { resolveEdgeReconnection, type ZlozEdgeReconnectionOptions } from './edge-reconnection';
import { edgeToolbarBand } from './edge-toolbar-placement';
export {
  zlozEdgeEndpointField,
  zlozEdgeEndpointSelect,
  zlozEdgeEndpointReasons,
} from './edge-endpoint';
export type { ZlozEdgeEndpointOptions } from './edge-endpoint';

import type { ZlozPortAnchorSnapBypassModifier } from './input-message';
export type { ZlozPortAnchorSnapBypassModifier } from './input-message';
export {
  portPositionDraft,
  updatePortPositionDraft,
  portPositionFromDraft,
  portPositionEditorContext,
  zlozPortPositionEditButton,
  zlozPortPositionModeSelect,
  zlozPortPositionSideSelect,
  zlozPortPositionInput,
  zlozPortPositionSave,
  zlozPortPositionForm,
  zlozPortPositionCancel,
} from './port-position-editor';
export type {
  ZlozPortPositionDraft,
  ZlozPortPositionMode,
  ZlozPortPositionField,
  ZlozPortPositionDraftChange,
  ZlozPortPositionInputContext,
  ZlozPortPositionEditorContext,
  ZlozPortPositionFormMessages,
} from './port-position-editor';

export {
  portInspectorContext,
  portAdditionContext,
  zlozPortAddButton,
  zlozPortRemoveButton,
  zlozPortLabelEditButton,
  zlozPortLabelForm,
  zlozPortLabelInput,
  zlozPortLabelSave,
  zlozPortLabelCancel,
  zlozPortProtectionReason,
} from './port-inspector';
export type {
  ZlozPortControlContext,
  ZlozPortInspectorEntry,
  ZlozPortInspectorContext,
  ZlozPortInspectorOptions,
  ZlozPortAdditionContext,
  ZlozPortLabelFormMessages,
} from './port-inspector';

import {
  portAnchorHandleViews,
  type ZlozPortAnchorHandleOptions,
  type ZlozPortAnchorHandleRenderer,
} from './port-anchor-handle';
export { zlozPortAnchorHandle } from './port-anchor-handle';
import { portAnchorGuideViews, type ZlozPortAnchorGuideRenderer } from './port-anchor-guide';
export { zlozPortAnchorGuide } from './port-anchor-guide';
export type { ZlozPortAnchorGuideContext, ZlozPortAnchorGuideRenderer } from './port-anchor-guide';
export type {
  ZlozPortAnchorHandleContext,
  ZlozPortAnchorHandleOptions,
  ZlozPortAnchorHandleRenderer,
} from './port-anchor-handle';

import { Mount } from 'foldkit';
import { createLazy, type Html, type HtmlBuilder } from 'foldkit/html';

import type { ZlozNodeBodyCache } from './node-body-cache';
export { createZlozNodeBodyCache } from './node-body-cache';
export type { ZlozNodeBodyCache } from './node-body-cache';

import {
  zlozConnectionButton,
  type ZlozConnectionEntry,
  type ZlozConnectionsContext,
} from './connections';
export { zlozConnectionButton } from './connections';
export type { ZlozConnectionEntry, ZlozConnectionsContext } from './connections';

import {
  zlozContextAction,
  zlozContextDimensionInput,
  zlozContextTrigger,
  type ZlozContextTrigger,
  type ZlozContextMenuContext,
  type ZlozContextAction,
  type ZlozGroupContextActions,
} from './context-menu';
export { zlozContextAction, zlozContextDimensionInput, zlozContextTrigger } from './context-menu';
export type {
  ZlozContextAction,
  ZlozContextMenuContext,
  ZlozGroupContextActions,
  ZlozContextTrigger,
} from './context-menu';

import {
  zlozEdgeToolbarButton,
  zlozEdgePathStyleSelect,
  type ZlozEdgeToolbarContext,
} from './edge-toolbar';
export { zlozEdgeToolbarButton, zlozEdgePathStyleSelect } from './edge-toolbar';
export type { ZlozEdgeToolbarAction, ZlozEdgeToolbarContext } from './edge-toolbar';

import {
  nodeToolbarContext,
  nodeToolbarView,
  type ZlozNodeToolbarContext,
  type ZlozNodeToolbarOptions,
} from './node-toolbar';
export type {
  ZlozNodeToolbarContext,
  ZlozNodeToolbarOptions,
  ZlozNodeToolbarPlacement,
} from './node-toolbar';

import {
  zlozEdgeLabelBadge,
  zlozEdgeLabelForm,
  zlozEdgeLabelInput,
  zlozEdgeLabelCancel,
  type ZlozEdgeLabelContext,
  type ZlozEdgeLabelEditorContext,
} from './edge-label';
export {
  zlozEdgeLabelBadge,
  zlozEdgeLabelForm,
  zlozEdgeLabelInput,
  zlozEdgeLabelCancel,
} from './edge-label';
export type { ZlozEdgeLabelContext, ZlozEdgeLabelEditorContext } from './edge-label';

import {
  zlozViewportControl,
  zlozMinimap,
  zlozMinimapViewport,
  viewportControlActions,
  minimapContext,
  type ZlozViewportControlsContext,
  type ZlozMinimapContext,
  type ZlozWheelNavigation,
} from './navigation';
export {
  zlozViewportControl,
  zlozMinimap,
  zlozMinimapViewport,
  viewportControlActions,
  minimapContext,
} from './navigation';
export type {
  ZlozViewportControl,
  ZlozViewportActions,
  ZlozViewportControlsContext,
  ZlozMinimapContext,
  ZlozWheelNavigation,
} from './navigation';
import {
  zlozNodeFrame,
  zlozGroupFrame,
  zlozDragHandle,
  zlozResizeHandle,
  zlozEdgeHitTarget,
  type ZlozNodeRenderContext,
  type NodeControlState,
} from './composition';
export {
  zlozNodeFrame,
  zlozGroupFrame,
  zlozDragHandle,
  zlozPort,
  zlozResizeHandle,
  zlozEdgeHitTarget,
  zlozWorldOverlayItem,
} from './composition';
export type { ZlozNodeRenderContext, ZlozWorldOverlayItemOptions } from './composition';
export { zlozC4Node, zlozC4Group } from './c4-renderer';
export { zlozDddNode, zlozDddGroup } from './ddd-renderer';
export type {
  ZlozDddContentContext,
  ZlozDddContentRenderer,
  ZlozDddNodeOptions,
} from './ddd-renderer';
export type { ZlozC4ContentContext, ZlozC4ContentRenderer, ZlozC4NodeOptions } from './c4-renderer';
import {
  portLabelViews,
  type ZlozPortLabelOptions,
  type ZlozPortLabelRenderer,
} from './port-label';
import { portRenderViews, type ZlozPortRenderer } from './port-render';
export type { ZlozPortRenderContext, ZlozPortRenderer } from './port-render';
export { zlozPortLabel } from './port-label';
export type {
  ZlozPortLabelOptions,
  ZlozPortLabelContext,
  ZlozPortLabelRenderer,
} from './port-label';

import { zlozThemeStyle, type ZlozTheme } from './theme';
export { zlozLightTheme, zlozDarkTheme } from './theme';
export type { ZlozColorScheme, ZlozTheme, ZlozThemeToken, ZlozThemeTokens } from './theme';

import { backgroundView, type ZlozBackground } from './background';
import {
  resolveZlozDiagnostics,
  visuallyHidden,
  type ZlozDiagnostics,
  type ZlozDiagnosticOptions,
} from './diagnostics';
export { resolveZlozDiagnostics } from './diagnostics';
export type { ZlozDiagnostics, ZlozDiagnosticOptions } from './diagnostics';
import { resolveDeletion } from './deletion';
import { resolveEdgeGeometry, type ZlozEdgeGeometryPolicy } from './edge-geometry';
import { boxBounds, portBoundaryPosition } from './geometry';
import { resolveBoxSelection, type BoxSelectionPreview } from './selection-preview';
import { viewportItems, type ZlozViewportCulling } from './viewport-culling';
export type {
  ZlozEdgeGeometry,
  ZlozEdgeGeometryContext,
  ZlozEdgeGeometryPolicy,
} from './edge-geometry';
import {
  resolveConnectionPreview,
  type ZlozConnectionPreview,
  type ZlozConnectionGeometryPolicy,
} from './connection-preview';
export type {
  ZlozConnectionFeedback,
  ZlozConnectionPreviewContext,
  ZlozConnectionGeometryPolicy,
  ZlozConnectionPreview,
} from './connection-preview';
import { groupsInPaintOrder, presentVisibleGraph, withDescendants } from './group-presentation';
import { ZlozInput } from './mount';
import { movementReason } from './movement';
export type { ZlozBackground, ZlozBackgroundRenderContext } from './background';
import type {
  AlignmentGuide,
  BoxSelectionMatch,
  DeletionTargets,
  EditorPolicy,
  ZlozGraph,
  EditorEvent,
  EditorState,
  ZlozEdge,
  ZlozNode,
  Point,
  Size,
  Viewport,
  ResizeHandle,
} from './types';

export type ZlozEdgeRenderContext = Readonly<{
  edge: ZlozEdge;
  path: string;
  labelPosition: Point | undefined;
  selected: boolean;
  stroke: string;
  strokeWidth: string;
  dashArray: string;
  markerEnd: string;
}>;

/** Geometry, core target feedback and default appearance for a decorative preview renderer. */
export type ZlozConnectionRenderContext = ZlozConnectionPreview &
  Readonly<{
    stroke: string;
    strokeWidth: string;
    dashArray: string;
  }>;

/** Model dimensions for the current resize readout, before any view styling. */
export type ZlozResizeReadoutContext = Readonly<{
  node: ZlozNode;
  phase: 'resizing' | 'selected-group';
  /** Default formatting in graph units, rounded to two decimal places. */
  widthText: string;
  heightText: string;
}>;

/** A resolved snap guide and its endpoints in the canvas world coordinate space. */
export type ZlozAlignmentGuideContext = Readonly<{
  guide: AlignmentGuide;
  start: Point;
  end: Point;
  phase: 'drag' | 'resize';
  viewport: Viewport;
}>;

/** Normalized selection bounds in graph coordinates and the current camera. */
export type ZlozSelectionMarqueeContext = Readonly<{
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

/** Normalized world bounds of the pending camera fit. */
export type ZlozZoomAreaMarqueeContext = Readonly<{
  bounds: Readonly<ReturnType<typeof boxBounds>>;
  viewport: Viewport;
}>;

/** Default canvas guidance and the controls it describes. */
export type ZlozCanvasHelpContext = Readonly<{
  defaultText: string;
  selectionMode: boolean;
  zoomAreaActive?: boolean;
  edgeToolbar: boolean;
  readOnly: boolean;
  visible: boolean;
  wheelNavigation: ZlozWheelNavigation;
  doubleClickZoom?: boolean;
  spaceToPan?: boolean;
  middleButtonPan?: boolean;
}>;

/** Current canvas notice or the summary used when no notice is active. */
export type ZlozCanvasStatusContext = Readonly<{
  defaultText: string;
  notice: string | null;
  nodeCount: number;
  connectionCount: number;
  visible: boolean;
}>;

/** Visible diagram presentation for a host-rendered layer in world coordinates. */
export type ZlozWorldOverlayContext = Readonly<{
  /** The unique document ID supplied to zlozView. */
  id: string;
  viewport: Viewport;
  surface: Size | null;
  /** Visible nodes, including the presentation bounds of collapsed groups. */
  nodes: readonly ZlozNode[];
  /** Visible edges keep their authored endpoint IDs. */
  edges: readonly ZlozEdge[];
  selectedNodeIds: readonly string[];
  selectedEdgeIds: readonly string[];
  readOnly: boolean;
}>;

export type { ZlozViewportCulling } from './viewport-culling';

/** Native parts are already gated and themed. Place each at most once; retain the canvas's accessible help. */
export type ZlozViewLayoutParts = Readonly<{
  canvas: Html;
  /** Focus target for native skip links in host layouts. */
  canvasId: string;
  help: Html;
  controls: Html | null;
  creation: Html | null;
  minimap: Html | null;
  status: Html;
  connections: Html;
}>;

export type ZlozViewOptions<M> = ZlozDiagnosticOptions &
  Readonly<{
    /** Unique within the document; prefixes accessible descriptions and SVG markers. */
    id: string;
    label: string;
    onEvent: (event: EditorEvent) => M;
    /** Host content under the world transform. Null or undefined omits the layer. */
    renderWorldOverlay?: (
      context: ZlozWorldOverlayContext,
      h: HtmlBuilder<M>,
    ) => Html | null | undefined;
    /** Uses the host's builder; arbitrary FoldKit controls retain their normal behaviour. */
    renderNode?: (node: ZlozNode, h: HtmlBuilder<M>) => Html;
    /** Replaces a port control. Compose zlozPort for native behavior; undefined keeps the default. */
    renderPort?: ZlozPortRenderer<M> | undefined;
    /** Opt in to decorative port labels at their canonical world anchors. */
    portLabels?: boolean | ZlozPortLabelOptions;
    /** Opt in to separate anchor drag handles for selected visible ports. */
    portAnchorHandles?: boolean | ZlozPortAnchorHandleOptions;
    /** Opt-in temporary snap bypass; captured at pointer-down. Undefined keeps modifier keys unchanged. */
    portAnchorSnapBypassModifier?: ZlozPortAnchorSnapBypassModifier | undefined;
    /** Opt-in Page Down/Up target cycling and Home/End first/last on focused anchor handles. */
    portAnchorKeyboardTargets?: boolean | undefined;
    renderPortAnchorHandle?: ZlozPortAnchorHandleRenderer<M>;
    /** Opt-in permitted-target guides during anchor dragging. Follows alignment-guide diagnostics. */
    portAnchorGuides?: boolean | undefined;
    /** Decorative SVG in world coordinates; undefined uses the native guide, null hides it. */
    renderPortAnchorGuide?: ZlozPortAnchorGuideRenderer<M> | undefined;
    canEditPort?: EditorPolicy['canEditPort'];
    /** Replaces a complete label. Compose zlozPortLabel to retain anchoring. Null hides it. */
    renderPortLabel?: ZlozPortLabelRenderer<M>;
    /** Per-canvas FoldKit lazy slot for built-in nodes, including pending creation feedback. */
    nodeViewCache?: ReturnType<typeof createLazy> | undefined;
    /** Per-canvas built-in body slots; native/custom ports and port policies stay live. */
    nodeBodyCache?: ZlozNodeBodyCache | undefined;
    /** Replaces the complete measured node shell. Compose the public frame and interaction primitives. */
    renderNodeShell?:
      | ((context: ZlozNodeRenderContext, h: HtmlBuilder<M>) => Html | undefined)
      | undefined;
    /** Replaces a group boundary. Its frame retains Model-owned bounds and paint order. */
    renderGroupShell?: (context: ZlozNodeRenderContext, h: HtmlBuilder<M>) => Html | undefined;
    /** Decorative SVG along Zloz's path. Return undefined to use the built-in renderer. */
    renderEdge?: (context: ZlozEdgeRenderContext, h: HtmlBuilder<M>) => Html | undefined;
    /** Replaces the badge at the resolved anchor. Undefined uses the default; null hides the badge. */
    renderEdgeLabel?: (context: ZlozEdgeLabelContext, h: HtmlBuilder<M>) => Html | null | undefined;
    /** Replaces the active inline editor. Undefined uses the default form. */
    renderEdgeLabelEditor?: (
      context: ZlozEdgeLabelEditorContext,
      h: HtmlBuilder<M>,
    ) => Html | undefined;
    /** Resolves one path and label anchor for decoration, selection and controls. */
    edgeGeometry?: ZlozEdgeGeometryPolicy;
    /** Pure geometry for new connections and either end of a reconnection. */
    connectionGeometry?: ZlozConnectionGeometryPolicy;
    /** Decorative SVG using the resolved preview path. Undefined keeps the default; empty SVG omits the visual. */
    renderConnection?: (
      context: ZlozConnectionRenderContext,
      h: HtmlBuilder<M>,
    ) => Html | undefined;
    /** Replaces the controls layout. Undefined keeps defaults; feature gates still apply. */
    renderViewportControls?: (
      context: ZlozViewportControlsContext,
      h: HtmlBuilder<M>,
    ) => Html | undefined;
    /** Replaces minimap appearance using the public navigation primitive. */
    renderMinimap?: (context: ZlozMinimapContext, h: HtmlBuilder<M>) => Html | undefined;
    edgeAppearance?: (edge: ZlozEdge) => Readonly<{
      stroke?: string;
      strokeWidth?: number;
      dashArray?: string;
      /** Selection corridor in world units; defaults to 12. Must be positive and finite. */
      hitWidth?: number;
    }>;
    /** Classes on the editor root, including classes produced by Pleat's cssClass(). */
    themeClassName?: string;
    /** Scoped token overrides and optional native color scheme. */
    theme?: ZlozTheme;
    /** Show a screen-sized toolbar for a single selected node in editable views. */
    nodeToolbar?: boolean | ZlozNodeToolbarOptions;
    /** Replaces the toolbar contents. Undefined uses the default; null hides the toolbar. */
    renderNodeToolbar?: (
      context: ZlozNodeToolbarContext,
      h: HtmlBuilder<M>,
    ) => Html | null | undefined;
    /** Show on-canvas controls for a single selected edge in editable views. */
    edgeToolbar?: boolean;
    /** Opt-in endpoint choosers in the selected-edge toolbar. Requires edgeToolbar. */
    edgeReconnection?: boolean | ZlozEdgeReconnectionOptions;
    /** Opt-in source/target creation panel outside the canvas, independent of optional diagnostics. */
    connectionCreation?: boolean | ZlozConnectionCreationOptions;
    /** Replace the creation panel. Undefined uses native defaults; null omits it. */
    renderConnectionCreation?: (
      context: ZlozConnectionCreationContext,
      h: HtmlBuilder<M>,
    ) => Html | null | undefined;
    /** Pass the same global connection policy used by updateEditor for candidate feedback. */
    canConnect?: EditorPolicy['canConnect'];
    /** Use the same pure deletion policy passed to updateEditor to disable protected actions. */
    canDelete?: EditorPolicy['canDelete'];
    /** Use the reducer's reconnection policy to omit handles for locked endpoints. */
    canReconnect?: EditorPolicy['canReconnect'];
    /** Use the reducer's port policy to disable built-in and composed port controls. */
    canConnectPort?: EditorPolicy['canConnectPort'];
    /** Use the reducer's movement policy to show locked handles. */
    canMoveNode?: EditorPolicy['canMoveNode'];
    /** Use the reducer's resize policy to hide locked handles and disable dimension controls. */
    canResizeNode?: EditorPolicy['canResizeNode'];
    canSelectNode?: EditorPolicy['canSelectNode'];
    canSelectEdge?: EditorPolicy['canSelectEdge'];
    /** Replaces the toolbar contents. Undefined uses the default; null hides the toolbar. */
    renderEdgeToolbar?: (
      context: ZlozEdgeToolbarContext,
      h: HtmlBuilder<M>,
    ) => Html | null | undefined;
    /** Replaces canvas guidance inside the existing accessible description. */
    renderCanvasHelp?: (context: ZlozCanvasHelpContext, h: HtmlBuilder<M>) => Html | undefined;
    /** Replaces status content inside the existing polite live region. */
    renderCanvasStatus?: (context: ZlozCanvasStatusContext, h: HtmlBuilder<M>) => Html | undefined;
    /** Replaces the list contents. The compact disclosure and accessible group stay owned by Zloz. */
    renderConnections?: (context: ZlozConnectionsContext, h: HtmlBuilder<M>) => Html | undefined;
    /** Enables pending node highlights and shell preview state. Defaults to true. */
    selectionPreviewHighlights?: boolean;
    /** Replaces the decorative selection marquee. Undefined uses the default; null omits it. */
    renderSelectionMarquee?: (
      context: ZlozSelectionMarqueeContext,
      h: HtmlBuilder<M>,
    ) => Html | null | undefined;
    /** Replaces the Zoom to area marquee. Undefined uses the default; null omits it. */
    renderZoomAreaMarquee?: (
      context: ZlozZoomAreaMarqueeContext,
      h: HtmlBuilder<M>,
    ) => Html | null | undefined;
    /** Enable context actions for nodes and edges in editable views. */
    contextActions?: boolean;
    /** Replaces the contents of an open node or edge context panel. Undefined uses the default. */
    renderContextMenu?: (context: ZlozContextMenuContext, h: HtmlBuilder<M>) => Html | undefined;
    /** Pan near the canvas boundary while dragging nodes or connections. */
    autoPan?: boolean;
    /** Snap new connections near an eligible port within this CSS-pixel radius. Defaults to exact hits only. */
    connectionDropRadius?: number;
    /** Snap reconnections within this CSS-pixel radius. Defaults to connectionDropRadius. */
    reconnectionDropRadius?: number;
    /** Enable two-finger touch pan and pinch-to-zoom on the canvas. */
    pinchZoom?: boolean;
    /** Defaults to cursor-anchored zoom. Off leaves wheel input to the page. */
    wheelNavigation?: ZlozWheelNavigation;
    /** Opt in to 1.25× background double-click zoom, or provide a finite multiplier greater than 1. */
    doubleClickZoom?: boolean | number;
    /** Hold Space with the canvas focused to pan from the background. Defaults to false. */
    spaceToPan?: boolean;
    /** Pan by dragging the canvas background with the middle button. Defaults to false. */
    middleButtonPan?: boolean;
    /** Card width handles and corner/side handles on selected expanded groups. */
    resizeHandles?: boolean;
    /** Show Model dimensions during resizing and for selected groups with handles. Defaults to true. */
    resizeReadout?: boolean;
    /** Decorative SVG for a resolved guide. Undefined uses the default; null omits that guide. */
    renderAlignmentGuide?: (
      context: ZlozAlignmentGuideContext,
      h: HtmlBuilder<M>,
    ) => Html | null | undefined;
    /** Replaces the contents of an eligible readout. Undefined uses the default; null omits it. */
    renderResizeReadout?: (
      context: ZlozResizeReadoutContext,
      h: HtmlBuilder<M>,
    ) => Html | null | undefined;
    minimap?: boolean;
    /** Mount only canvas items near the measured viewport. Disabled by default. */
    viewportCulling?: ZlozViewportCulling;
    viewportControls?: boolean;
    /** Include Fit selection in the viewport controls. */
    fitSelectionControl?: boolean;
    /** Include the one-shot Zoom to area toggle in the viewport controls. */
    zoomAreaControl?: boolean;
    /** Include Back to previous view in the viewport controls. */
    previousViewControl?: boolean;
    /** Include a box selection toggle in the viewport controls. */
    selectionModeControl?: boolean;
    /** Numeric pixels (default 440), or fill a bounded host layout. */
    height?: number | 'fill';
    /** Arrange native parts inside the themed root without copying their interaction protocol. */
    renderLayout?: (parts: ZlozViewLayoutParts, h: HtmlBuilder<M>) => Html;
    /** Decorative background, independent of snapping. Defaults to dots. */
    background?: ZlozBackground<M>;
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
  node: ZlozNode,
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
  graph: ZlozGraph,
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
): ZlozNodeToolbarContext['actions'] {
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
  diagnostics: ZlozDiagnostics,
  canDelete: EditorPolicy['canDelete'],
  canResizeNode: EditorPolicy['canResizeNode'],
): ZlozContextMenuContext | undefined {
  const context = state.context;
  if (!context || state.readOnly) return undefined;
  const close: ZlozContextAction = { label: 'Close', event: { type: 'ContextDismissed' } };
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
  const resizeDisabledReason = canResizeNode?.(node, state.graph) ?? undefined;
  const group: ZlozGroupContextActions | undefined =
    node.kind === 'group'
      ? {
          node,
          collapsed,
          fit: {
            label: 'Fit group to contents',
            event: { type: 'GroupFitClicked', id },
            disabledReason: resizeDisabledReason,
          },
          lockProportions: {
            label: 'Lock proportions',
            event: { type: 'GroupAspectRatioToggled', id },
            pressed: node.keepAspectRatio ?? false,
          },
          showMeasurements: diagnostics.measurements,
          dimensionsDisabled:
            collapsed || state.gesture.type !== 'idle' || resizeDisabledReason !== undefined,
          resizeDisabledReason,
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
  context: ZlozContextMenuContext,
  options: ZlozViewOptions<M>,
): Html {
  const button = (action: ZlozContextAction) =>
    zlozContextAction(
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
                              zlozContextDimensionInput(h, group, dimension, options.onEvent, [
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
                            group.resizeDisabledReason ??
                              (group.collapsed
                                ? 'Expand the group to edit dimensions.'
                                : 'Values follow grid, limits and locked proportions.'),
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
  options: ZlozViewOptions<M>,
  diagnostics: ZlozDiagnostics,
): readonly Html[] {
  const context = options.contextActions
    ? contextMenu(state, diagnostics, options.canDelete, options.canResizeNode)
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
  {
    onEvent,
    selectionModeControl,
    fitSelectionControl,
    zoomAreaControl,
    previousViewControl,
  }: ZlozViewOptions<M>,
  diagnostics: ZlozDiagnostics,
): Html {
  const actions = viewportControlActions(state);
  const button = (action: typeof actions.zoomIn) =>
    zlozViewportControl(
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
      ...(fitSelectionControl ? [button(actions.fitSelection)] : []),
      ...(zoomAreaControl ? [button(actions.zoomArea)] : []),
      ...(previousViewControl ? [button(actions.previousView)] : []),
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
  context: ZlozEdgeToolbarContext,
  onEvent: ZlozViewOptions<M>['onEvent'],
): Html {
  const action = (descriptor: ZlozEdgeToolbarContext['actions']['rename']) =>
    zlozEdgeToolbarButton(
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
      zlozEdgePathStyleSelect(h, context, onEvent, [
        h.Style({ 'min-height': '32px', 'font-size': '13px' }),
      ]),
      action(context.actions.deleteEdge),
      ...deletionExplanation(h, context.actions.deleteEdge.disabledReason),
      ...(context.reconnection
        ? [
            zlozEdgeEndpointField(h, context.reconnection.source, onEvent, {
              idPrefix: context.reconnection.idPrefix,
            }),
            zlozEdgeEndpointField(h, context.reconnection.target, onEvent, {
              idPrefix: context.reconnection.idPrefix,
            }),
          ]
        : []),
    ],
  );
}

function edgeToolbarFrame<M>(
  h: HtmlBuilder<M>,
  anchor: Point,
  id: string,
  content: Html,
  band?: Readonly<{ top: number; height: number }>,
): Html {
  const width = band ? 320 : 256;
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
        top: band ? `${band.top}px` : `clamp(6px, ${anchor.y}px, max(6px, calc(100% - 82px)))`,
        'max-height': band ? `${band.height}px` : 'calc(100% - 12px)',
        overflow: band ? 'auto' : 'visible',
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
  options: ZlozViewOptions<M>,
  preview: BoxSelectionPreview | undefined,
): readonly Html[] {
  if (!preview) return [];
  const { bounds, previewNodeIds } = preview;
  const { viewport } = state;
  const custom = options.renderSelectionMarquee?.(
    { bounds, viewport, match: state.boxSelectionMatch, previewNodeIds },
    h,
  );
  return marqueeFrame(h, bounds, 'selection', custom);
}

function zoomAreaMarquee<M>(
  h: HtmlBuilder<M>,
  { gesture, viewport }: EditorState,
  { renderZoomAreaMarquee }: ZlozViewOptions<M>,
): readonly Html[] {
  if (gesture.type !== 'zoom-area') return [];
  const bounds = boxBounds(gesture.origin, gesture.point);
  return marqueeFrame(h, bounds, 'zoom-area', renderZoomAreaMarquee?.({ bounds, viewport }, h));
}

function marqueeFrame<M>(
  h: HtmlBuilder<M>,
  bounds: ZlozZoomAreaMarqueeContext['bounds'],
  kind: 'selection' | 'zoom-area',
  custom: Html | null | undefined,
): readonly Html[] {
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
        h.DataAttribute(`flow-${kind}-box`, ''),
        h.Style(
          custom === undefined
            ? {
                ...placement,
                border: `1px ${kind === 'zoom-area' ? 'dashed' : 'solid'} var(--flow-selection, #2563eb)`,
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
  options: ZlozViewOptions<M>,
  diagnostics: ZlozDiagnostics,
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
  options: ZlozViewOptions<M>,
  nodes: readonly ZlozNode[],
  diagnostics: ZlozDiagnostics,
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
  const context: ZlozResizeReadoutContext = {
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
  preview: ZlozConnectionPreview | undefined,
  options: ZlozViewOptions<M>,
): Html | undefined {
  if (!preview) return undefined;
  const context: ZlozConnectionRenderContext = {
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
  options: ZlozViewOptions<M>,
  state: EditorState,
  descriptionId: string,
  edgeToolbar: boolean,
  visible: boolean,
): Html {
  const zoomAreaActive = Boolean(state.zoomAreaMode) || state.gesture.type === 'zoom-area';
  const doubleClickZoom = Boolean(options.doubleClickZoom);
  const spaceToPan = options.spaceToPan === true;
  const middleButtonPan = options.middleButtonPan === true;
  const wheelNavigation = options.wheelNavigation ?? 'zoom';
  const wheelHelp =
    wheelNavigation === 'pan'
      ? 'Scroll to pan. Hold Ctrl or Command while scrolling to zoom. '
      : wheelNavigation === 'zoom'
        ? 'Scroll to zoom. '
        : '';
  const defaultText = [
    'Drag a node title to move it. ',
    zoomAreaActive
      ? 'Drag the background to zoom to an area. '
      : state.selectionMode
        ? 'Drag the background to select nodes. '
        : 'Drag the background to pan, or Shift-drag to select nodes. ',
    wheelHelp,
    ...(doubleClickZoom && !zoomAreaActive && !state.selectionMode
      ? ['Double-click the background to zoom in. ']
      : []),
    ...(spaceToPan ? ['Focus the canvas, then hold Space and drag the background to pan. '] : []),
    ...(middleButtonPan ? ['Middle-drag the background to pan. '] : []),
    'Tab to a title, then use arrow keys to move it. Drag from an output to an input, or activate the two ports in order with Enter or Space. Select an edge and drag an available endpoint handle to reconnect. Escape cancels.',
    ...(edgeToolbar
      ? [' In the Connections list, select an edge and press Up Arrow to reach its actions.']
      : []),
  ].join('');
  const custom = options.renderCanvasHelp?.(
    {
      defaultText,
      selectionMode: state.selectionMode,
      zoomAreaActive,
      readOnly: state.readOnly,
      edgeToolbar,
      wheelNavigation,
      doubleClickZoom,
      spaceToPan,
      middleButtonPan,
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
  options: ZlozViewOptions<M>,
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

function nodeContextStyles<M>(h: HtmlBuilder<M>, onNode: boolean) {
  return [
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
  ];
}

type NodeShellContext<S> = Omit<ZlozNodeRenderContext, 'state'> & { state: S };
type NodeViewOptions<M, S> = Pick<
  ZlozViewOptions<M>,
  | 'resizeHandles'
  | 'nodeBodyCache'
  | 'canMoveNode'
  | 'canResizeNode'
  | 'canSelectNode'
  | 'canConnectPort'
  | 'renderPort'
> & {
  renderNode?: ZlozViewOptions<M>['renderNode'];
  renderNodeShell?:
    | ((context: NodeShellContext<S>, h: HtmlBuilder<M>) => Html | undefined)
    | undefined;
};

function nativeResizeHandles<M>(
  h: HtmlBuilder<M>,
  context: Parameters<typeof zlozResizeHandle>[1],
  enabled: boolean,
): readonly Html[] {
  return enabled &&
    !context.state.readOnly &&
    context.selectionDisabledReason === undefined &&
    context.resizeDisabledReason === undefined
    ? [
        zlozResizeHandle(
          h,
          context,
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
    : [];
}

type NativeBodyContext = Parameters<typeof zlozDragHandle>[1] & { resizeHandles: readonly Html[] };

function nativeNodeBody<M>(
  h: HtmlBuilder<M>,
  context: NativeBodyContext,
  contextEnabled: boolean,
  renderNode: ZlozViewOptions<M>['renderNode'],
): readonly Html[] {
  return [
    zlozDragHandle(
      h,
      context,
      [
        h.Type('button'),
        h.Style({
          display: 'block',
          width: contextEnabled ? 'calc(100% - 36px)' : '100%',
          'min-height': '32px',
          'text-align': 'left',
          cursor: context.state.readOnly ? 'pointer' : 'grab',
          'font-weight': '600',
          color: 'inherit',
          background: 'transparent',
          border: 'none',
        }),
      ],
      [context.node.label],
    ),
    ...(context.contextAction ? [context.contextAction] : []),
    ...context.resizeHandles,
    ...(renderNode ? [renderNode(context.node, h)] : []),
  ];
}

function nodeBodyFrame<M>(h: HtmlBuilder<M>, node: ZlozNode, children: readonly Html[]) {
  return h.div(
    [
      h.Key('node-body'),
      h.DataAttribute('flow-node-body', node.id),
      h.Style({ display: 'contents' }),
    ],
    children,
  );
}

function retainedNodeContextTrigger<M>(
  h: HtmlBuilder<M>,
  node: ZlozNode,
  idle: boolean,
  onEvent: ZlozViewOptions<M>['onEvent'],
) {
  return zlozContextTrigger(
    h,
    {
      label: `More actions for ${node.label}`,
      expanded: false,
      disabled: !idle,
      event: {
        type: 'ContextOpened',
        context: { kind: 'node', id: node.id, point: { x: 0, y: 0 } },
        anchorToNode: true,
      },
    },
    onEvent,
    nodeContextStyles(h, true),
    ['⋯'],
  );
}

// ADR 0004: body artifacts are retained independently of live port authorization.
function retainedNodeBody<M>(
  h: HtmlBuilder<M>,
  node: ZlozNode,
  selectedNodes: readonly string[],
  readOnly: boolean,
  descriptionId: string,
  resizeHandles: boolean,
  contextEnabled: boolean,
  idle: boolean,
  onEvent: ZlozViewOptions<M>['onEvent'],
  renderNode: ZlozViewOptions<M>['renderNode'],
): Html {
  const base = {
    node,
    state: { selectedNodes, readOnly },
    descriptionId,
    diagnostics: resolveZlozDiagnostics({}),
    collapsed: false,
    dropTarget: false,
    selectionPreview: false,
  };
  const context = {
    ...base,
    contextAction: contextEnabled ? retainedNodeContextTrigger(h, node, idle, onEvent) : undefined,
    resizeHandles: nativeResizeHandles(h, base, resizeHandles),
  };
  return nodeBodyFrame(h, node, nativeNodeBody(h, context, contextEnabled, renderNode));
}

type BodyRetention<M> = Readonly<{
  cache: ZlozNodeBodyCache;
  idle: boolean;
  onEvent: ZlozViewOptions<M>['onEvent'];
}>;

function nodeViews<M, S extends NodeControlState>(
  h: HtmlBuilder<M>,
  nodes: readonly ZlozNode[],
  state: S,
  options: NodeViewOptions<M, S>,
  diagnostics: ZlozDiagnostics,
  descriptionId: string,
  contextEnabled: boolean,
  nodeContextTrigger: (node: ZlozNode) => Html,
  target: EditorState['connection'],
  previewIds?: ReadonlySet<string>,
  bodyCache?: BodyRetention<M>,
  wrapBodies = Boolean(options.nodeBodyCache),
): readonly Html[] {
  return nodes
    .filter((node) => node.kind !== 'group')
    .map((node) => {
      const resizeDisabledReason = options.canResizeNode?.(node, state.graph) ?? undefined;
      const selectionDisabledReason = options.canSelectNode?.(node, state.graph) ?? undefined;
      const base = {
        node,
        state,
        descriptionId,
        diagnostics,
        collapsed: false,
        dropTarget: false,
        selectionPreview: previewIds?.has(node.id) ?? false,
        moveDisabledReason: options.canMoveNode?.(node, state.graph) ?? undefined,
        resizeDisabledReason,
        selectionDisabledReason,
        canConnectPort: options.canConnectPort,
      };
      const context: NodeShellContext<S> = {
        ...base,
        ports: options.renderPort
          ? portRenderViews(h, base, target, options.renderPort)
          : undefined,
        contextAction:
          !bodyCache && contextEnabled && selectionDisabledReason === undefined
            ? nodeContextTrigger(node)
            : undefined,
        resizeHandles: bodyCache
          ? []
          : nativeResizeHandles(h, base, Boolean(options.resizeHandles)),
      };
      const custom = options.renderNodeShell?.(context, h);
      if (custom !== undefined) return custom;
      const body = bodyCache
        ? [
            bodyCache.cache(node, retainedNodeBody, [
              h,
              node,
              state.selectedNodes,
              state.readOnly,
              descriptionId,
              Boolean(options.resizeHandles),
              contextEnabled,
              bodyCache.idle,
              bodyCache.onEvent,
              options.renderNode,
            ]),
          ]
        : wrapBodies
          ? [nodeBodyFrame(h, node, nativeNodeBody(h, context, contextEnabled, options.renderNode))]
          : nativeNodeBody(h, context, contextEnabled, options.renderNode);
      return zlozNodeFrame(
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
        [...body, ...(context.ports ?? portRenderViews(h, base, target, undefined))],
      );
    });
}

function nodeLayerFrame<M>(h: HtmlBuilder<M>, children: readonly Html[]) {
  return h.div([h.Key('flow-node-layer'), h.Style({ display: 'contents' })], children);
}

function mountedNodeMask(authored: readonly ZlozNode[], mounted: readonly ZlozNode[]) {
  if (authored === mounted) return undefined;
  const visible = new Set(mounted);
  // Index the mask against the authored array so a new culling array can still hit the slot.
  return authored.map((node) => (visible.has(node) ? '1' : '0')).join('');
}

function retainedNodeLayer<M>(
  h: HtmlBuilder<M>,
  graph: ZlozGraph,
  mountedMask: string | undefined,
  selectedNodes: readonly string[],
  readOnly: boolean,
  connection: EditorState['connection'],
  descriptionId: string,
  resizeHandles: boolean,
  contextEnabled: boolean,
  idle: boolean,
  onEvent: ZlozViewOptions<M>['onEvent'],
  renderNode: ZlozViewOptions<M>['renderNode'],
  bodyCache: ZlozNodeBodyCache | undefined,
): Html {
  const nodeContextTrigger = (node: ZlozNode) => retainedNodeContextTrigger(h, node, idle, onEvent);
  const options = { resizeHandles, renderNode };
  return nodeLayerFrame(
    h,
    nodeViews(
      h,
      mountedMask === undefined
        ? graph.nodes
        : graph.nodes.filter((_, index) => mountedMask[index] === '1'),
      { graph, selectedNodes, readOnly, connection },
      options,
      resolveZlozDiagnostics({}),
      descriptionId,
      contextEnabled,
      nodeContextTrigger,
      null,
      undefined,
      bodyCache ? { cache: bodyCache, idle, onEvent } : undefined,
      Boolean(bodyCache),
    ),
  );
}

/** A normal FoldKit view: all state and message handling belong to its parent. */
export function zlozView<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  options: ZlozViewOptions<M>,
): Html {
  const connectionDropRadius = options.connectionDropRadius ?? 0;
  if (!Number.isFinite(connectionDropRadius) || connectionDropRadius < 0)
    throw new RangeError('Connection drop radius must be finite and non-negative');
  const reconnectionDropRadius = options.reconnectionDropRadius ?? connectionDropRadius;
  if (!Number.isFinite(reconnectionDropRadius) || reconnectionDropRadius < 0)
    throw new RangeError('Reconnection drop radius must be finite and non-negative');
  const { doubleClickZoom } = options;
  const doubleClickZoomFactor = doubleClickZoom === true ? 1.25 : doubleClickZoom;
  if (
    doubleClickZoomFactor !== undefined &&
    doubleClickZoomFactor !== false &&
    (!Number.isFinite(doubleClickZoomFactor) || doubleClickZoomFactor <= 1)
  )
    throw new RangeError('Double-click zoom factor must be finite and greater than 1');
  const diagnostics = resolveZlozDiagnostics(options);
  const presentation = presentVisibleGraph(state);
  const selectionPreview =
    state.gesture.type === 'box-selection'
      ? resolveBoxSelection(state, state.gesture, presentation.nodes, options.canSelectNode)
      : undefined;
  const previewIds = new Set(
    options.selectionPreviewHighlights === false ? [] : selectionPreview?.previewNodeIds,
  );
  const collapsedGroups = new Set(state.collapsedGroups);
  const visibleEdges = presentation.edges;
  const routes = new Map(state.routes.map((route) => [route.id, route.points]));
  const canvas = viewportItems(
    state,
    presentation,
    routes,
    Boolean(options.edgeGeometry || options.renderEdge),
    options.viewportCulling,
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
  ): ZlozContextTrigger => ({
    label: `More actions for ${label}`,
    expanded: state.context?.kind === kind && state.context.id === id,
    disabled: state.gesture.type !== 'idle',
    event: { type: 'ContextOpened', context: { kind, id, point } },
  });
  const contextTrigger = (action: ZlozContextTrigger, onNode = false) =>
    zlozContextTrigger(h, action, options.onEvent, nodeContextStyles(h, onNode), ['⋯']);
  const nodeContextTrigger = (node: ZlozNode) =>
    contextTrigger(
      contextAction('node', node.id, node.label, {
        x: state.viewport.x + (node.position.x + node.size.width) * state.viewport.zoom - 36,
        y: state.viewport.y + node.position.y * state.viewport.zoom + 44,
      }),
      node.kind !== 'group',
    );
  const dropParent = state.gesture.type === 'node-drag' ? state.gesture.dropParent : undefined;
  const moveDisabledReason = (node: ZlozNode) => {
    if (!options.canMoveNode) return undefined;
    return node.kind === 'group'
      ? movementReason(state.graph, withDescendants(state.graph, [node.id]), options.canMoveNode)
      : (options.canMoveNode(node, state.graph) ?? undefined);
  };
  const canvasNodeIds =
    canvas.nodes === presentation.nodes ? undefined : new Set(canvas.nodes.map(({ id }) => id));
  const canvasGroups = groupsInPaintOrder(presentation.nodes).filter(
    (node) => canvasNodeIds?.has(node.id) ?? true,
  );
  const boundaries = canvasGroups.map((node) => {
    const collapsed = collapsedGroups.has(node.id);
    const dropTarget = dropParent === node.id;
    const authored = collapsed
      ? (state.graph.nodes.find((item) => item.id === node.id) ?? node)
      : node;
    const resizeDisabledReason = options.canResizeNode?.(authored, state.graph) ?? undefined;
    const selectionDisabledReason = options.canSelectNode?.(authored, state.graph) ?? undefined;
    const base = {
      node,
      state,
      descriptionId,
      diagnostics,
      collapsed,
      dropTarget,
      selectionPreview: previewIds.has(node.id),
      moveDisabledReason: moveDisabledReason(node),
      resizeDisabledReason,
      selectionDisabledReason,
      canConnectPort: options.canConnectPort,
    };
    const context: ZlozNodeRenderContext = {
      ...base,
      ports: options.renderPort
        ? portRenderViews(h, base, drag?.target ?? null, options.renderPort)
        : undefined,
      contextAction:
        contextEnabled && selectionDisabledReason === undefined
          ? nodeContextTrigger(node)
          : undefined,
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
        selectionDisabledReason === undefined &&
        resizeDisabledReason === undefined &&
        state.selectedNodes.includes(node.id)
          ? resizeHandles.map((handle) =>
              zlozResizeHandle(
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
    return zlozGroupFrame(
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
        zlozDragHandle(
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
        ...(context.ports ?? []),
      ],
    );
  });
  const canRetainBodies =
    presentation.nodes === state.graph.nodes &&
    (state.gesture.type === 'idle' || state.gesture.type === 'pan') &&
    !state.context &&
    !options.renderNodeShell &&
    !options.canMoveNode &&
    !options.canResizeNode &&
    !options.canSelectNode;
  const bodyCache =
    canRetainBodies && options.nodeBodyCache
      ? {
          cache: options.nodeBodyCache,
          idle: state.gesture.type === 'idle',
          onEvent: options.onEvent,
        }
      : undefined;
  const canRetainNodes =
    canRetainBodies && !options.renderPort && !options.canConnectPort
      ? options.nodeViewCache
      : undefined;
  const nodes = canRetainNodes
    ? [
        canRetainNodes(retainedNodeLayer, [
          h,
          state.graph,
          mountedNodeMask(state.graph.nodes, canvas.nodes),
          state.selectedNodes,
          state.readOnly,
          state.connection,
          descriptionId,
          Boolean(options.resizeHandles),
          Boolean(contextEnabled),
          state.gesture.type === 'idle',
          options.onEvent,
          options.renderNode,
          options.nodeBodyCache,
        ]),
      ]
    : nodeViews(
        h,
        canvas.nodes,
        state,
        options,
        diagnostics,
        descriptionId,
        Boolean(contextEnabled),
        nodeContextTrigger,
        drag?.target ?? null,
        previewIds,
        bodyCache,
        Boolean(options.nodeBodyCache),
      );
  const nodeLayer = options.nodeViewCache && !canRetainNodes ? [nodeLayerFrame(h, nodes)] : nodes;
  const markerId = `${options.id}-arrow`;
  const edgeGeometries = canvas.edges.map((edge) => ({
    edge,
    selectionDisabledReason: options.canSelectEdge?.(edge, state.graph) ?? undefined,
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
    const context: ZlozEdgeRenderContext = {
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
        zlozEdgeHitTarget(h, { edge, path, hitWidth: appearance?.hitWidth ?? 12 }),
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
  const edgeLabels = edgeGeometries.flatMap(({ edge, labelPosition, selectionDisabledReason }) => {
    const selected = state.selectedEdges.includes(edge.id);
    const labelEditable = !state.readOnly && selectionDisabledReason === undefined;
    const draft =
      labelEditable && state.edgeLabelDraft?.id === edge.id ? state.edgeLabelDraft : null;
    if (!labelPosition || (!draft && !edge.label && (!labelEditable || !selected))) return [];
    const context: ZlozEdgeLabelContext = {
      edge,
      labelPosition,
      description: `${edge.source.node}:${edge.source.port} → ${edge.target.node}:${edge.target.port}`,
      selectionDisabledReason,
      selected,
      readOnly: state.readOnly,
    };
    const { onEvent } = options;
    const editor = draft ? { ...context, draft: draft.text } : null;
    const content = editor
      ? (options.renderEdgeLabelEditor?.(editor, h) ??
        zlozEdgeLabelForm(
          h,
          editor,
          onEvent,
          [h.Style({ ...chipStyle, display: 'flex', gap: '4px', 'max-width': 'none' })],
          [
            zlozEdgeLabelInput(h, editor, onEvent, []),
            h.button([h.Type('submit')], ['Save label']),
            zlozEdgeLabelCancel(h, editor, onEvent, [], ['Cancel']),
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
            'pointer-events': labelEditable ? 'auto' : 'none',
            'z-index': draft ? '2' : 'auto',
          }),
        ],
        [
          content ??
            zlozEdgeLabelBadge(
              h,
              context,
              onEvent,
              [h.Style({ ...chipStyle, cursor: labelEditable ? 'pointer' : 'inherit' })],
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
  const toolbarContext: ZlozEdgeToolbarContext | undefined =
    activeEdge?.labelPosition && !state.edgeLabelDraft && !drag && !state.context
      ? {
          edge: activeEdge.edge,
          labelPosition: activeEdge.labelPosition,
          reconnection: options.edgeReconnection
            ? {
                idPrefix: `${encodeURIComponent(options.id)}-toolbar-endpoint`,
                source: resolveEdgeReconnection(
                  state,
                  activeEdge.edge.id,
                  'source',
                  options,
                  options.edgeReconnection === true ? {} : options.edgeReconnection,
                )!,
                target: resolveEdgeReconnection(
                  state,
                  activeEdge.edge.id,
                  'target',
                  options,
                  options.edgeReconnection === true ? {} : options.edgeReconnection,
                )!,
              }
            : undefined,
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
  const pixelHeight = options.height === 'fill' ? 440 : (options.height ?? 440);
  const toolbarContent = toolbarContext && options.renderEdgeToolbar?.(toolbarContext, h);
  const toolbar =
    toolbarContext && toolbarContent !== null
      ? edgeToolbarFrame(
          h,
          edgeToolbarPosition(
            toolbarContext.labelPosition,
            state.viewport,
            reconnectPoints,
            state.surface?.height ?? pixelHeight,
          ),
          toolbarId,
          toolbarContent ?? defaultEdgeToolbar(h, toolbarContext, options.onEvent),
          toolbarContext.reconnection
            ? edgeToolbarBand(
                state.surface?.height ?? pixelHeight,
                reconnectPoints.map((point) => state.viewport.y + point.y * state.viewport.zoom),
                9 * state.viewport.zoom + 6,
              )
            : undefined,
        )
      : null;
  const connections = () => {
    const nodeLabels = new Map(state.graph.nodes.map((node) => [node.id, node.label]));
    const compact = !diagnostics.connectionList;
    const entries = visibleEdges.map((edge): ZlozConnectionEntry => {
      const selectionDisabledReason = options.canSelectEdge?.(edge, state.graph) ?? undefined;
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
        selectionDisabledReason,
        contextAction:
          contextEnabled && selectionDisabledReason === undefined
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
            const selection = zlozConnectionButton(h, entry, options.onEvent, [], [entry.label]);
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
  const creationContext = options.connectionCreation
    ? resolveConnectionCreation(
        state,
        options,
        options.connectionCreation === true ? {} : options.connectionCreation,
      )
    : undefined;
  const creationContent = creationContext && options.renderConnectionCreation?.(creationContext, h);

  const fillSize = { height: '100%', flex: '1 1 0', 'min-height': '0', 'box-sizing': 'border-box' };
  const pixelSize = { height: `${pixelHeight}px` };
  const surfaceSize = options.height === 'fill' ? fillSize : pixelSize;
  const themeStyles = zlozThemeStyle(options.theme ?? {});
  const rootStyles =
    options.height === 'fill'
      ? {
          ...themeStyles,
          height: '100%',
          'min-height': '0',
          display: 'flex',
          'flex-direction': 'column',
        }
      : themeStyles;
  const help = canvasHelpView(
    h,
    options,
    state,
    descriptionId,
    toolbarEnabled,
    diagnostics.instructions,
  );
  const controlParts = options.viewportControls
    ? [
        options.renderViewportControls?.(
          {
            state,
            diagnostics,
            actions: viewportControlActions(state),
            selectionModeControl: Boolean(options.selectionModeControl),
            fitSelectionControl: Boolean(options.fitSelectionControl),
            zoomAreaControl: Boolean(options.zoomAreaControl),
            previousViewControl: Boolean(options.previousViewControl),
          },
          h,
        ) ?? viewportControls(h, state, options, diagnostics),
      ]
    : [];
  const creationParts =
    creationContext && creationContent !== null
      ? [
          creationContent ??
            zlozConnectionCreation(h, creationContext, options.onEvent, {
              idPrefix: `${encodeURIComponent(options.id)}-create`,
            }),
        ]
      : [];
  const minimapParts = minimap
    ? [
        options.renderMinimap?.(minimap, h) ??
          zlozMinimap(
            h,
            minimap,
            options.onEvent,
            [
              h.Key('minimap'),
              h.Style({
                position: options.renderLayout ? 'relative' : 'absolute',
                right: options.renderLayout ? 'auto' : '10px',
                bottom: options.renderLayout ? 'auto' : '10px',
                width: options.renderLayout ? '100%' : 'min(160px, 34%)',
                height: options.renderLayout ? '150px' : 'auto',
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
              zlozMinimapViewport(h, minimap.geometry, [
                h.Fill('none'),
                h.Stroke('var(--flow-selection, #2563eb)'),
                h.Style({ 'vector-effect': 'non-scaling-stroke' }),
              ]),
            ],
          ),
      ]
    : [];
  const canvasPart = h.div(
    [
      h.Key('surface'),
      h.Id(`${options.id}-surface`),
      h.DataAttribute('flow-surface', options.id),
      h.DataAttribute('flow-readonly', String(state.readOnly)),
      h.DataAttribute('flow-grid-snap', String(state.snapToGrid)),
      h.DataAttribute('flow-grid-spacing', String(state.gridSpacing)),
      h.DataAttribute('flow-auto-pan', String(options.autoPan ?? false)),
      h.DataAttribute('flow-connection-drop-radius', String(connectionDropRadius)),
      h.DataAttribute('flow-reconnection-drop-radius', String(reconnectionDropRadius)),
      h.DataAttribute('flow-pinch-zoom', String(options.pinchZoom ?? false)),
      h.DataAttribute('flow-wheel-navigation', options.wheelNavigation ?? 'zoom'),
      h.DataAttribute('flow-double-click-zoom', String(doubleClickZoomFactor || '')),
      h.DataAttribute('flow-space-to-pan', String(options.spaceToPan === true)),
      h.DataAttribute('flow-middle-button-pan', String(options.middleButtonPan === true)),
      h.DataAttribute(
        'flow-anchor-keyboard-targets',
        String(options.portAnchorKeyboardTargets === true),
      ),
      h.DataAttribute('flow-port-anchor-snap-bypass', options.portAnchorSnapBypassModifier ?? ''),
      h.DataAttribute(
        'flow-fit-animation',
        state.fitViewTransition.type === 'fitting' ? String(state.fitViewTransition.id) : '',
      ),
      h.DataAttribute('flow-selection-mode', String(state.selectionMode)),
      h.DataAttribute('flow-zoom-area-mode', String(Boolean(state.zoomAreaMode))),
      h.DataAttribute('flow-context-actions', String(Boolean(contextEnabled))),
      h.Tabindex(0),
      h.Role('group'),
      h.AriaLabel(options.label),
      h.AriaDescribedBy(descriptionId),
      h.OnMount(Mount.mapMessage(ZlozInput(), (message) => options.onEvent(message.event))),
      h.Style({
        position: 'relative',
        overflow: 'hidden',
        ...surfaceSize,
        width: '100%',
        'touch-action': 'none',
        cursor:
          (options.spaceToPan || options.middleButtonPan) && state.gesture.type === 'pan'
            ? 'grabbing'
            : state.selectionMode || state.zoomAreaMode || state.gesture.type === 'zoom-area'
              ? 'crosshair'
              : 'inherit',
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
                    [h.path([h.D('M0,0 L10,5 L0,10 Z'), h.Fill('var(--flow-edge, #64748b)')], [])],
                  ),
                ],
              ),
              ...edges,
              ...alignmentGuideViews(h, state, options, diagnostics),
              ...handles,
              ...(previewView ? [previewView] : []),
            ],
          ),
          ...nodeLayer,
          ...(options.portAnchorGuides && diagnostics.alignmentGuides
            ? portAnchorGuideViews(
                h,
                state,
                canvas.nodes,
                options.canEditPort,
                options.renderPortAnchorGuide,
              )
            : []),
          ...portAnchorHandleViews(
            h,
            state,
            canvas.nodes,
            options.portAnchorHandles,
            options.canEditPort,
            options.renderPortAnchorHandle,
            options.portAnchorSnapBypassModifier,
            options.portAnchorKeyboardTargets,
          ),
          ...portLabelViews(h, canvas.nodes, options.portLabels, options.renderPortLabel),
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
          ...zoomAreaMarquee(h, state, options),
        ],
      ),
      ...(!options.renderLayout ? minimapParts : []),
      ...resizeReadout(h, state, options, presentation.nodes, diagnostics),
      ...(toolbar ? [toolbar] : []),
      ...(selectedNodeToolbar && nodeToolbarContent !== null
        ? [nodeToolbarView(h, selectedNodeToolbar, options.onEvent, nodeToolbarContent)]
        : []),
      ...contextPanel(h, state, options, diagnostics),
    ],
  );
  const status = canvasStatusView(
    h,
    options,
    state.notice,
    presentation.nodes.length,
    visibleEdges.length,
    diagnostics.status,
  );
  const connectionParts = diagnostics.connectionList
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
                ...(state.connectionsExpanded ? [h.AriaControls(`${options.id}-connections`)] : []),
                h.OnClick(options.onEvent({ type: 'ConnectionListToggled' })),
                h.Style({ 'min-height': '36px', padding: '6px 10px' }),
              ],
              ['Connections'],
            ),
            ...(state.connectionsExpanded ? [connections()] : []),
          ],
        ),
      ];
  const parts: ZlozViewLayoutParts = {
    canvas: canvasPart,
    canvasId: `${options.id}-surface`,
    help,
    controls: controlParts[0] ?? null,
    creation: creationParts[0] ?? null,
    minimap: minimapParts[0] ?? null,
    status,
    connections: connectionParts[0]!,
  };

  return h.div(
    [
      h.Id(options.id),
      h.DataAttribute('flow-minimal', String(options.minimalMode === true)),
      h.Class(
        options.themeClassName
          ? `foldkit-zloz foldkit-flow ${options.themeClassName}`
          : 'foldkit-zloz foldkit-flow',
      ),
      ...(options.theme || options.height === 'fill' ? [h.Style(rootStyles)] : []),
    ],
    options.renderLayout
      ? [options.renderLayout(parts, h)]
      : [help, ...controlParts, ...creationParts, canvasPart, status, ...connectionParts],
  );
}

// Compatibility names for existing code; new examples use Zloz.
/** @deprecated Use zlozView. */
export { zlozView as flowView };
/** @deprecated Use zlozEndpointSearchInput. */
export { zlozEndpointSearchInput as flowEndpointSearchInput } from './endpoint-search-view';
/** @deprecated Use zlozEndpointSearchClear. */
export { zlozEndpointSearchClear as flowEndpointSearchClear } from './endpoint-search-view';
/** @deprecated Use zlozEndpointSearchFeedback. */
export { zlozEndpointSearchFeedback as flowEndpointSearchFeedback } from './endpoint-search-view';
/** @deprecated Use ZlozEndpointSearchViewOptions. */
export type { ZlozEndpointSearchViewOptions as FlowEndpointSearchViewOptions } from './endpoint-search-view';
/** @deprecated Use zlozConnectionCreation. */
export { zlozConnectionCreation as flowConnectionCreation } from './connection-creation-view';
/** @deprecated Use zlozConnectionCreationField. */
export { zlozConnectionCreationField as flowConnectionCreationField } from './connection-creation-view';
/** @deprecated Use zlozConnectionCreationSelect. */
export { zlozConnectionCreationSelect as flowConnectionCreationSelect } from './connection-creation-view';
/** @deprecated Use zlozConnectionCreationReasons. */
export { zlozConnectionCreationReasons as flowConnectionCreationReasons } from './connection-creation-view';
/** @deprecated Use zlozConnectionCreationCancel. */
export { zlozConnectionCreationCancel as flowConnectionCreationCancel } from './connection-creation-view';
/** @deprecated Use ZlozConnectionCreationViewOptions. */
export type { ZlozConnectionCreationViewOptions as FlowConnectionCreationViewOptions } from './connection-creation-view';
/** @deprecated Use zlozEdgeEndpointField. */
export { zlozEdgeEndpointField as flowEdgeEndpointField } from './edge-endpoint';
/** @deprecated Use zlozEdgeEndpointSelect. */
export { zlozEdgeEndpointSelect as flowEdgeEndpointSelect } from './edge-endpoint';
/** @deprecated Use zlozEdgeEndpointReasons. */
export { zlozEdgeEndpointReasons as flowEdgeEndpointReasons } from './edge-endpoint';
/** @deprecated Use ZlozEdgeEndpointOptions. */
export type { ZlozEdgeEndpointOptions as FlowEdgeEndpointOptions } from './edge-endpoint';
/** @deprecated Use ZlozPortAnchorSnapBypassModifier. */
export type { ZlozPortAnchorSnapBypassModifier as FlowPortAnchorSnapBypassModifier } from './types';
/** @deprecated Use zlozPortPositionEditButton. */
export { zlozPortPositionEditButton as flowPortPositionEditButton } from './port-position-editor';
/** @deprecated Use zlozPortPositionModeSelect. */
export { zlozPortPositionModeSelect as flowPortPositionModeSelect } from './port-position-editor';
/** @deprecated Use zlozPortPositionSideSelect. */
export { zlozPortPositionSideSelect as flowPortPositionSideSelect } from './port-position-editor';
/** @deprecated Use zlozPortPositionInput. */
export { zlozPortPositionInput as flowPortPositionInput } from './port-position-editor';
/** @deprecated Use zlozPortPositionSave. */
export { zlozPortPositionSave as flowPortPositionSave } from './port-position-editor';
/** @deprecated Use zlozPortPositionForm. */
export { zlozPortPositionForm as flowPortPositionForm } from './port-position-editor';
/** @deprecated Use zlozPortPositionCancel. */
export { zlozPortPositionCancel as flowPortPositionCancel } from './port-position-editor';
/** @deprecated Use ZlozPortPositionDraft. */
export type { ZlozPortPositionDraft as FlowPortPositionDraft } from './port-position-editor';
/** @deprecated Use ZlozPortPositionMode. */
export type { ZlozPortPositionMode as FlowPortPositionMode } from './port-position-editor';
/** @deprecated Use ZlozPortPositionField. */
export type { ZlozPortPositionField as FlowPortPositionField } from './port-position-editor';
/** @deprecated Use ZlozPortPositionDraftChange. */
export type { ZlozPortPositionDraftChange as FlowPortPositionDraftChange } from './port-position-editor';
/** @deprecated Use ZlozPortPositionInputContext. */
export type { ZlozPortPositionInputContext as FlowPortPositionInputContext } from './port-position-editor';
/** @deprecated Use ZlozPortPositionEditorContext. */
export type { ZlozPortPositionEditorContext as FlowPortPositionEditorContext } from './port-position-editor';
/** @deprecated Use ZlozPortPositionFormMessages. */
export type { ZlozPortPositionFormMessages as FlowPortPositionFormMessages } from './port-position-editor';
/** @deprecated Use zlozPortAddButton. */
export { zlozPortAddButton as flowPortAddButton } from './port-inspector';
/** @deprecated Use zlozPortRemoveButton. */
export { zlozPortRemoveButton as flowPortRemoveButton } from './port-inspector';
/** @deprecated Use zlozPortLabelEditButton. */
export { zlozPortLabelEditButton as flowPortLabelEditButton } from './port-inspector';
/** @deprecated Use zlozPortLabelForm. */
export { zlozPortLabelForm as flowPortLabelForm } from './port-inspector';
/** @deprecated Use zlozPortLabelInput. */
export { zlozPortLabelInput as flowPortLabelInput } from './port-inspector';
/** @deprecated Use zlozPortLabelSave. */
export { zlozPortLabelSave as flowPortLabelSave } from './port-inspector';
/** @deprecated Use zlozPortLabelCancel. */
export { zlozPortLabelCancel as flowPortLabelCancel } from './port-inspector';
/** @deprecated Use zlozPortProtectionReason. */
export { zlozPortProtectionReason as flowPortProtectionReason } from './port-inspector';
/** @deprecated Use ZlozPortControlContext. */
export type { ZlozPortControlContext as FlowPortControlContext } from './port-inspector';
/** @deprecated Use ZlozPortInspectorEntry. */
export type { ZlozPortInspectorEntry as FlowPortInspectorEntry } from './port-inspector';
/** @deprecated Use ZlozPortInspectorContext. */
export type { ZlozPortInspectorContext as FlowPortInspectorContext } from './port-inspector';
/** @deprecated Use ZlozPortInspectorOptions. */
export type { ZlozPortInspectorOptions as FlowPortInspectorOptions } from './port-inspector';
/** @deprecated Use ZlozPortAdditionContext. */
export type { ZlozPortAdditionContext as FlowPortAdditionContext } from './port-inspector';
/** @deprecated Use ZlozPortLabelFormMessages. */
export type { ZlozPortLabelFormMessages as FlowPortLabelFormMessages } from './port-inspector';
/** @deprecated Use zlozPortAnchorHandle. */
export { zlozPortAnchorHandle as flowPortAnchorHandle } from './port-anchor-handle';
/** @deprecated Use zlozPortAnchorGuide. */
export { zlozPortAnchorGuide as flowPortAnchorGuide } from './port-anchor-guide';
/** @deprecated Use ZlozPortAnchorGuideContext. */
export type { ZlozPortAnchorGuideContext as FlowPortAnchorGuideContext } from './port-anchor-guide';
/** @deprecated Use ZlozPortAnchorGuideRenderer. */
export type { ZlozPortAnchorGuideRenderer as FlowPortAnchorGuideRenderer } from './port-anchor-guide';
/** @deprecated Use ZlozPortAnchorHandleContext. */
export type { ZlozPortAnchorHandleContext as FlowPortAnchorHandleContext } from './port-anchor-handle';
/** @deprecated Use ZlozPortAnchorHandleOptions. */
export type { ZlozPortAnchorHandleOptions as FlowPortAnchorHandleOptions } from './port-anchor-handle';
/** @deprecated Use ZlozPortAnchorHandleRenderer. */
export type { ZlozPortAnchorHandleRenderer as FlowPortAnchorHandleRenderer } from './port-anchor-handle';
/** @deprecated Use createZlozNodeBodyCache. */
export { createZlozNodeBodyCache as createFlowNodeBodyCache } from './node-body-cache';
/** @deprecated Use ZlozNodeBodyCache. */
export type { ZlozNodeBodyCache as FlowNodeBodyCache } from './node-body-cache';
/** @deprecated Use zlozConnectionButton. */
export { zlozConnectionButton as flowConnectionButton } from './connections';
/** @deprecated Use ZlozConnectionEntry. */
export type { ZlozConnectionEntry as FlowConnectionEntry } from './connections';
/** @deprecated Use ZlozConnectionsContext. */
export type { ZlozConnectionsContext as FlowConnectionsContext } from './connections';
/** @deprecated Use zlozContextAction. */
export { zlozContextAction as flowContextAction } from './context-menu';
/** @deprecated Use zlozContextDimensionInput. */
export { zlozContextDimensionInput as flowContextDimensionInput } from './context-menu';
/** @deprecated Use zlozContextTrigger. */
export { zlozContextTrigger as flowContextTrigger } from './context-menu';
/** @deprecated Use ZlozContextAction. */
export type { ZlozContextAction as FlowContextAction } from './context-menu';
/** @deprecated Use ZlozContextMenuContext. */
export type { ZlozContextMenuContext as FlowContextMenuContext } from './context-menu';
/** @deprecated Use ZlozGroupContextActions. */
export type { ZlozGroupContextActions as FlowGroupContextActions } from './context-menu';
/** @deprecated Use ZlozContextTrigger. */
export type { ZlozContextTrigger as FlowContextTrigger } from './context-menu';
/** @deprecated Use zlozEdgeToolbarButton. */
export { zlozEdgeToolbarButton as flowEdgeToolbarButton } from './edge-toolbar';
/** @deprecated Use zlozEdgePathStyleSelect. */
export { zlozEdgePathStyleSelect as flowEdgePathStyleSelect } from './edge-toolbar';
/** @deprecated Use ZlozEdgeToolbarAction. */
export type { ZlozEdgeToolbarAction as FlowEdgeToolbarAction } from './edge-toolbar';
/** @deprecated Use ZlozEdgeToolbarContext. */
export type { ZlozEdgeToolbarContext as FlowEdgeToolbarContext } from './edge-toolbar';
/** @deprecated Use ZlozNodeToolbarContext. */
export type { ZlozNodeToolbarContext as FlowNodeToolbarContext } from './node-toolbar';
/** @deprecated Use ZlozNodeToolbarOptions. */
export type { ZlozNodeToolbarOptions as FlowNodeToolbarOptions } from './node-toolbar';
/** @deprecated Use ZlozNodeToolbarPlacement. */
export type { ZlozNodeToolbarPlacement as FlowNodeToolbarPlacement } from './node-toolbar';
/** @deprecated Use zlozEdgeLabelBadge. */
export { zlozEdgeLabelBadge as flowEdgeLabelBadge } from './edge-label';
/** @deprecated Use zlozEdgeLabelForm. */
export { zlozEdgeLabelForm as flowEdgeLabelForm } from './edge-label';
/** @deprecated Use zlozEdgeLabelInput. */
export { zlozEdgeLabelInput as flowEdgeLabelInput } from './edge-label';
/** @deprecated Use zlozEdgeLabelCancel. */
export { zlozEdgeLabelCancel as flowEdgeLabelCancel } from './edge-label';
/** @deprecated Use ZlozEdgeLabelContext. */
export type { ZlozEdgeLabelContext as FlowEdgeLabelContext } from './edge-label';
/** @deprecated Use ZlozEdgeLabelEditorContext. */
export type { ZlozEdgeLabelEditorContext as FlowEdgeLabelEditorContext } from './edge-label';
/** @deprecated Use zlozViewportControl. */
export { zlozViewportControl as flowViewportControl } from './navigation';
/** @deprecated Use zlozMinimap. */
export { zlozMinimap as flowMinimap } from './navigation';
/** @deprecated Use zlozMinimapViewport. */
export { zlozMinimapViewport as flowMinimapViewport } from './navigation';
/** @deprecated Use ZlozViewportControl. */
export type { ZlozViewportControl as FlowViewportControl } from './navigation';
/** @deprecated Use ZlozViewportActions. */
export type { ZlozViewportActions as FlowViewportActions } from './navigation';
/** @deprecated Use ZlozViewportControlsContext. */
export type { ZlozViewportControlsContext as FlowViewportControlsContext } from './navigation';
/** @deprecated Use ZlozMinimapContext. */
export type { ZlozMinimapContext as FlowMinimapContext } from './navigation';
/** @deprecated Use ZlozWheelNavigation. */
export type { ZlozWheelNavigation as FlowWheelNavigation } from './navigation';
/** @deprecated Use zlozNodeFrame. */
export { zlozNodeFrame as flowNodeFrame } from './composition';
/** @deprecated Use zlozGroupFrame. */
export { zlozGroupFrame as flowGroupFrame } from './composition';
/** @deprecated Use zlozDragHandle. */
export { zlozDragHandle as flowDragHandle } from './composition';
/** @deprecated Use zlozPort. */
export { zlozPort as flowPort } from './composition';
/** @deprecated Use zlozResizeHandle. */
export { zlozResizeHandle as flowResizeHandle } from './composition';
/** @deprecated Use zlozEdgeHitTarget. */
export { zlozEdgeHitTarget as flowEdgeHitTarget } from './composition';
/** @deprecated Use zlozWorldOverlayItem. */
export { zlozWorldOverlayItem as flowWorldOverlayItem } from './composition';
/** @deprecated Use ZlozNodeRenderContext. */
export type { ZlozNodeRenderContext as FlowNodeRenderContext } from './composition';
/** @deprecated Use ZlozWorldOverlayItemOptions. */
export type { ZlozWorldOverlayItemOptions as FlowWorldOverlayItemOptions } from './composition';
/** @deprecated Use zlozC4Node. */
export { zlozC4Node as flowC4Node } from './c4-renderer';
/** @deprecated Use zlozC4Group. */
export { zlozC4Group as flowC4Group } from './c4-renderer';
/** @deprecated Use ZlozC4ContentContext. */
export type { ZlozC4ContentContext as FlowC4ContentContext } from './c4-renderer';
/** @deprecated Use ZlozC4ContentRenderer. */
export type { ZlozC4ContentRenderer as FlowC4ContentRenderer } from './c4-renderer';
/** @deprecated Use ZlozC4NodeOptions. */
export type { ZlozC4NodeOptions as FlowC4NodeOptions } from './c4-renderer';
/** @deprecated Use ZlozPortRenderContext. */
export type { ZlozPortRenderContext as FlowPortRenderContext } from './port-render';
/** @deprecated Use ZlozPortRenderer. */
export type { ZlozPortRenderer as FlowPortRenderer } from './port-render';
/** @deprecated Use zlozPortLabel. */
export { zlozPortLabel as flowPortLabel } from './port-label';
/** @deprecated Use ZlozPortLabelOptions. */
export type { ZlozPortLabelOptions as FlowPortLabelOptions } from './port-label';
/** @deprecated Use ZlozPortLabelContext. */
export type { ZlozPortLabelContext as FlowPortLabelContext } from './port-label';
/** @deprecated Use ZlozPortLabelRenderer. */
export type { ZlozPortLabelRenderer as FlowPortLabelRenderer } from './port-label';
/** @deprecated Use zlozLightTheme. */
export { zlozLightTheme as flowLightTheme } from './theme';
/** @deprecated Use zlozDarkTheme. */
export { zlozDarkTheme as flowDarkTheme } from './theme';
/** @deprecated Use ZlozColorScheme. */
export type { ZlozColorScheme as FlowColorScheme } from './theme';
/** @deprecated Use ZlozTheme. */
export type { ZlozTheme as FlowTheme } from './theme';
/** @deprecated Use ZlozThemeToken. */
export type { ZlozThemeToken as FlowThemeToken } from './theme';
/** @deprecated Use ZlozThemeTokens. */
export type { ZlozThemeTokens as FlowThemeTokens } from './theme';
/** @deprecated Use ZlozDiagnostics. */
export type { ZlozDiagnostics as FlowDiagnostics } from './diagnostics';
/** @deprecated Use ZlozDiagnosticOptions. */
export type { ZlozDiagnosticOptions as FlowDiagnosticOptions } from './diagnostics';
/** @deprecated Use ZlozEdgeGeometry. */
export type { ZlozEdgeGeometry as FlowEdgeGeometry } from './edge-geometry';
/** @deprecated Use ZlozEdgeGeometryContext. */
export type { ZlozEdgeGeometryContext as FlowEdgeGeometryContext } from './edge-geometry';
/** @deprecated Use ZlozEdgeGeometryPolicy. */
export type { ZlozEdgeGeometryPolicy as FlowEdgeGeometryPolicy } from './edge-geometry';
/** @deprecated Use ZlozConnectionFeedback. */
export type { ZlozConnectionFeedback as FlowConnectionFeedback } from './connection-preview';
/** @deprecated Use ZlozConnectionPreviewContext. */
export type { ZlozConnectionPreviewContext as FlowConnectionPreviewContext } from './connection-preview';
/** @deprecated Use ZlozConnectionGeometryPolicy. */
export type { ZlozConnectionGeometryPolicy as FlowConnectionGeometryPolicy } from './connection-preview';
/** @deprecated Use ZlozConnectionPreview. */
export type { ZlozConnectionPreview as FlowConnectionPreview } from './connection-preview';
/** @deprecated Use ZlozBackground. */
export type { ZlozBackground as FlowBackground } from './background';
/** @deprecated Use ZlozBackgroundRenderContext. */
export type { ZlozBackgroundRenderContext as FlowBackgroundRenderContext } from './background';
/** @deprecated Use ZlozEdgeRenderContext. */
export type { ZlozEdgeRenderContext as FlowEdgeRenderContext };
/** @deprecated Use ZlozConnectionRenderContext. */
export type { ZlozConnectionRenderContext as FlowConnectionRenderContext };
/** @deprecated Use ZlozResizeReadoutContext. */
export type { ZlozResizeReadoutContext as FlowResizeReadoutContext };
/** @deprecated Use ZlozAlignmentGuideContext. */
export type { ZlozAlignmentGuideContext as FlowAlignmentGuideContext };
/** @deprecated Use ZlozSelectionMarqueeContext. */
export type { ZlozSelectionMarqueeContext as FlowSelectionMarqueeContext };
/** @deprecated Use ZlozZoomAreaMarqueeContext. */
export type { ZlozZoomAreaMarqueeContext as FlowZoomAreaMarqueeContext };
/** @deprecated Use ZlozCanvasHelpContext. */
export type { ZlozCanvasHelpContext as FlowCanvasHelpContext };
/** @deprecated Use ZlozCanvasStatusContext. */
export type { ZlozCanvasStatusContext as FlowCanvasStatusContext };
/** @deprecated Use ZlozWorldOverlayContext. */
export type { ZlozWorldOverlayContext as FlowWorldOverlayContext };
/** @deprecated Use ZlozViewportCulling. */
export type { ZlozViewportCulling as FlowViewportCulling } from './viewport-culling';
/** @deprecated Use ZlozViewLayoutParts. */
export type { ZlozViewLayoutParts as FlowViewLayoutParts };
/** @deprecated Use ZlozViewOptions. */
export type { ZlozViewOptions as FlowViewOptions };

/** @deprecated Use resolveZlozDiagnostics. */
export { resolveZlozDiagnostics as resolveFlowDiagnostics } from './diagnostics';

export { zlozHistoryGhosts } from './history-ghosts';
export type { ZlozHistoryGhostOptions } from './history-ghosts';
export { zlozEventStormingNode } from './event-storming-renderer';
export type {
  ZlozEventStormingContentContext,
  ZlozEventStormingContentRenderer,
  ZlozEventStormingNodeOptions,
} from './event-storming-renderer';
export {
  zlozPlaybackControls,
  zlozPlaybackControl,
  zlozPlaybackStatus,
  zlozPlaybackReason,
} from './playback-controls-view';
export type {
  ZlozPlaybackTextOptions,
  ZlozPlaybackControlsParts,
  ZlozPlaybackControlsViewOptions,
} from './playback-controls-view';
export {
  zlozEditionScrubber,
  zlozEditionScrubberInput,
  zlozEditionScrubberReadout,
  zlozEditionScrubberReason,
  zlozEditionSeekButton,
} from './edition-scrubber-view';
export type {
  ZlozEditionScrubberParts,
  ZlozEditionScrubberViewOptions,
} from './edition-scrubber-view';

export {
  zlozHistoryComparisonControls,
  zlozHistoryBaselineSelect,
  zlozHistoryGhostToggle,
  zlozHistoryComparisonStatus,
  zlozHistoryComparisonReason,
} from './history-comparison-controls-view';
export type {
  ZlozHistoryComparisonTextOptions,
  ZlozHistoryComparisonControlsParts,
  ZlozHistoryComparisonControlsViewOptions,
} from './history-comparison-controls-view';
