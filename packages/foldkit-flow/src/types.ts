/** JSON payloads survive save/reload; views and runtime resources stay in the host. */
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
/** Finite 2D coordinates; the owning contract specifies world units, CSS pixels or normalized fractions. */
export type Point = Readonly<{ x: number; y: number }>;
/** Positive finite dimensions, in the same coordinate system as the owning value. */
export type Size = Readonly<{ width: number; height: number }>;
/** CSS-pixel translation plus a world-to-screen zoom factor. */
export type Viewport = Readonly<Point & { zoom: number }>;
/** Inclusive positive, finite zoom limits. Equal limits fix the zoom. */
export type ZoomLimits = Readonly<{ minZoom: number; maxZoom: number }>;
/** Outward routing and reconnection direction hint. */
export type PortSide = 'left' | 'right' | 'top' | 'bottom';
/** Choose either a cardinal side offset, or normalized box coordinates. Never both. */
export type PortPosition = Readonly<{ side: PortSide }> &
  (Readonly<{ offset: number; anchor?: never }> | Readonly<{ anchor: Point; offset?: never }>);
/** Named directed anchor. Coordinates and offsets are finite fractions from 0 to 1. */
export type Port = Readonly<{
  id: string;
  kind: 'input' | 'output';
  label?: string;
}> &
  PortPosition;
/** Manual resize bounds in graph units; layout and content measurement are independent. */
export type NodeResizeLimits = Readonly<{
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}>;
/** Authored node or portless group. Positions stay in canvas coordinates when grouped. */
export type FlowNode = Readonly<{
  id: string;
  label: string;
  /** Canvas/world coordinates, independent of the viewport and parent position. */
  position: Point;
  /** Authored width; the native view measures ordinary-node content height. Group bounds are authored. */
  size: Size;
  ports: readonly Port[];
  resizeLimits?: NodeResizeLimits;
  /** Groups only: preserve the starting proportions during manual resizing. */
  keepAspectRatio?: boolean;
  kind?: 'group';
  /** A group ID. Positions are always in canvas coordinates. */
  parentId?: string;
  /** Constrain movement to the authored parent bounds. */
  extent?: 'parent';
  /** Grow the parent when this node grows beyond its bounds. */
  expandParent?: boolean;
  data?: JsonValue;
}>;
export type Endpoint = Readonly<{ node: string; port: string }>;
export type EdgePathStyle = 'straight' | 'stepped' | 'smooth';
/** The endpoint of an existing directed edge. */
export type EdgeEnd = 'source' | 'target';

/** A directed output-to-input connection with stable identity and JSON-compatible metadata. */
export type FlowEdge = Readonly<{
  id: string;
  source: Endpoint;
  target: Endpoint;
  /** Omit to use the layout route, with a straight fallback. */
  pathStyle?: EdgePathStyle;
  label?: string;
  data?: JsonValue;
}>;
/** Serializable document data. Selection, gestures, viewport and history belong to EditorState. */
export type FlowGraph = Readonly<{ nodes: readonly FlowNode[]; edges: readonly FlowEdge[] }>;
/** Versioned document content. Graph-only documents omit the camera. */
export type FlowSnapshot = Readonly<{ graph: FlowGraph; viewport?: Viewport }>;
export type EdgeRoute = Readonly<{ id: string; points: readonly Point[] }>;
export type AlignmentGuide = Readonly<{
  /** A fixed x draws a vertical guide; a fixed y draws a horizontal guide. */
  axis: 'x' | 'y';
  position: number;
  from: number;
  to: number;
}>;
/** How a box-selection gesture matches node bounds. */
export type BoxSelectionMatch = 'full' | 'partial';
export type ResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type ResizeHandle = ResizeCorner | 'top' | 'right' | 'bottom' | 'left';
/** Rejected candidate details, kept only while hovering an incompatible or disallowed port. */
export type ConnectionRejection = Readonly<{ endpoint: Endpoint; reason: string }>;
/** A nearby endpoint with optional distance in CSS pixels. Legacy endpoint-only messages remain valid. */
export type NearbyTarget = Readonly<Endpoint & { distance?: number }>;
/** Accepted and rejected targets are mutually exclusive; an absent rejection with null target means free space. */
export type ConnectionTarget =
  | Readonly<{ target: Endpoint; rejected?: never }>
  | Readonly<{ target: null; rejected?: ConnectionRejection }>;
type NodeGesture = Readonly<{
  pointer: number;
  origin: Point;
  before: FlowGraph;
  ids: readonly string[];
}>;
export type Gesture =
  | Readonly<{ type: 'idle' }>
  | (NodeGesture &
      Readonly<{
        type: 'node-drag';
        dropParent: string | null | undefined;
        guides: readonly AlignmentGuide[];
      }>)
  | (NodeGesture &
      Readonly<{
        type: 'node-resize';
        corner?: ResizeCorner;
        handle?: ResizeHandle;
        guides?: readonly AlignmentGuide[];
      }>)
  | (Readonly<{
      type: 'connection-drag';
      pointer: number;
      point: Point;
      reconnect?: Readonly<{ id: string; end: EdgeEnd }>;
    }> &
      ConnectionTarget)
  | Readonly<{ type: 'box-selection'; pointer: number; origin: Point; point: Point }>
  | Readonly<{ type: 'zoom-area'; pointer: number; origin: Point; point: Point }>
  | Readonly<{ type: 'pinch'; center: Point; distance: number; before: Viewport }>
  | Readonly<{ type: 'pan'; pointer: number; origin: Point; before: Viewport }>;
export type EditorContext = Readonly<{ kind: 'node' | 'edge'; id: string; point: Point }>;
/** Session-only visibility. Hidden groups also hide their descendants and incident edges. */
export type FlowVisibility = Readonly<{
  hiddenNodeIds?: readonly string[];
  hiddenEdgeIds?: readonly string[];
}>;

/** Host-owned editor Model. Retain the complete state returned by updateEditor; serialize graph data separately. */
export type EditorState = Readonly<{
  context: EditorContext | null;
  connectionsExpanded: boolean;
  graph: FlowGraph;
  clipboard: FlowGraph | null;
  collapsedGroups: readonly string[];
  visibility?: FlowVisibility | undefined;
  focusedNodeId?: string | null;
  edgeLabelDraft: Readonly<{ id: string; text: string }> | null;
  /** Monotonic document freshness token; Undo does not rewind it. */
  revision: number;
  viewport: Viewport;
  /** Session checkpoint captured before the most recent camera fit. */
  previousViewport?: Viewport | null;
  zoomLimits: ZoomLimits;
  fitViewPadding: number;
  /** Fit duration in milliseconds. Zero fits instantly. */
  fitViewDuration: number;
  fitViewTransition: FitViewTransition;
  surface: Size | null;
  selectedNodes: readonly string[];
  selectedEdges: readonly string[];
  connection: Endpoint | null;
  /** Required distance advantage in CSS pixels to switch a nearby snap target. Zero disables hysteresis. */
  connectionSnapHysteresis?: number;
  gesture: Gesture;
  past: readonly FlowGraph[];
  future: readonly FlowGraph[];
  historyLimit: number;
  readOnly: boolean;
  snapToGrid: boolean;
  /** Snap spacing in graph units; shared by default backgrounds. */
  gridSpacing: number;
  snapToAlignment: boolean;
  selectionMode: boolean;
  /** Whether the next background drag will fit its area. */
  zoomAreaMode?: boolean;
  boxSelectionMatch: BoxSelectionMatch;
  routes: readonly EdgeRoute[];
  notice: string | null;
}>;
/** Transient camera state. The ID identifies frames belonging to the current fit. */
export type FitViewTransition =
  | Readonly<{ type: 'idle'; id: number }>
  | Readonly<{
      type: 'fitting';
      id: number;
      from: Viewport;
      to: Viewport;
      startedAt: number | null;
    }>;
/** Initial editor preferences. History defaults to 100 entries; grid spacing defaults to 20 world units. */
export type EditorOptions = Readonly<{
  viewport?: Viewport;
  visibility?: FlowVisibility;
  /** Inclusive zoom range for camera operations. Defaults to 0.1–4. */
  zoomLimits?: ZoomLimits;
  /** Fit inset in CSS pixels, capped at a quarter of the shorter surface side. Defaults to 24. */
  fitViewPadding?: number;
  /** Opt into animated Fit view with a positive duration in milliseconds. Defaults to zero. */
  fitViewDuration?: number;
  historyLimit?: number;
  readOnly?: boolean;
  snapToGrid?: boolean;
  gridSpacing?: number;
  snapToAlignment?: boolean;
  selectionMode?: boolean;
  boxSelectionMatch?: BoxSelectionMatch;
  connectionSnapHysteresis?: number;
}>;
/** Explicit targets before group descendants and incident edges are included. */
export type DeletionTargets = Readonly<{ nodeIds: readonly string[]; edgeIds: readonly string[] }>;
/** Items the edit would remove, including cascades. Endpoints may remain in the original graph. */
export type DeletionCandidate = Readonly<{
  nodes: readonly FlowNode[];
  edges: readonly FlowEdge[];
}>;
export type DeletionDecision =
  | Readonly<{ type: 'empty' }>
  | Readonly<{ type: 'blocked'; reason: string }>
  | Readonly<{ type: 'allowed'; candidate: DeletionCandidate }>;
/** A port removal either finds nothing, is vetoed, or removes the port and these attached edges. */
export type PortRemovalDecision =
  | Readonly<{ type: 'empty' }>
  | Readonly<{ type: 'blocked'; reason: string }>
  | Readonly<{ type: 'allowed'; node: FlowNode; port: Port; edges: readonly FlowEdge[] }>;

/** Authored port capability check. Add receives the proposed port; other operations receive the current port. */
export type PortEditCandidate = Readonly<{
  operation: 'add' | 'label' | 'position' | 'remove';
  node: FlowNode;
  port: Port;
}>;

/** Pure host rules evaluated by the editor. */
export type EditorPolicy = Readonly<{
  /** Return a reason to block a direct port edit, or null to allow it. Wiring uses separate connection policies. */
  canEditPort?: (candidate: PortEditCandidate, graph: FlowGraph) => string | null;
  /** Return a rejection reason, or null to accept. Reconnection excludes the replaced edge from graph. */
  canConnect?: (edge: FlowEdge, graph: FlowGraph) => string | null;
  /** Return a reason to block new connections at this endpoint, or null to allow them. */
  canConnectPort?: (endpoint: Endpoint, graph: FlowGraph) => string | null;
  /** Return a reason to lock an end, or null to allow attempts. Receives the existing edge and full graph. */
  canReconnect?: (edge: FlowEdge, end: EdgeEnd, graph: FlowGraph) => string | null;
  /** Return a rejection reason for the complete deletion, or null to accept it. */
  canDelete?: (candidate: DeletionCandidate, graph: FlowGraph) => string | null;
  /** Return a reason to block movement or null to allow it. Group moves check every descendant. */
  canMoveNode?: (node: FlowNode, graph: FlowGraph) => string | null;
  /** Return a reason to block a resize, or null to allow it. Checks any ancestors grown by that edit. */
  canResizeNode?: (node: FlowNode, graph: FlowGraph) => string | null;
  /** Return a reason to exclude this node from direct and marquee selection, or null to allow it. */
  canSelectNode?: (node: FlowNode, graph: FlowGraph) => string | null;
  /** Return a reason to exclude this edge from selection, or null to allow it. */
  canSelectEdge?: (edge: FlowEdge, graph: FlowGraph) => string | null;
}>;
/** Facts from input adapters. Positions are local CSS pixels before viewport transforms. */
export type EditorEvent =
  | Readonly<{ type: 'ContextOpened'; context: EditorContext; anchorToNode?: boolean }>
  | Readonly<{ type: 'ContextDismissed' }>
  | Readonly<{ type: 'ConnectionListToggled' }>
  | Readonly<{ type: 'NodeFocusChanged'; id: string | null }>
  | Readonly<{ type: 'NodeSelected'; id: string; additive: boolean }>
  | Readonly<{ type: 'EdgeSelected'; id: string; additive: boolean }>
  | Readonly<{ type: 'SelectionCleared' }>
  | Readonly<{ type: 'VisibilityChanged'; visibility: FlowVisibility }>
  | Readonly<{ type: 'GroupCollapseToggled'; id: string }>
  | Readonly<{ type: 'GroupFitClicked'; id: string }>
  | Readonly<{ type: 'GroupAspectRatioToggled'; id: string }>
  | Readonly<{
      type: 'GroupResizeNudged';
      id: string;
      delta: Point;
      corner?: ResizeCorner;
      handle?: ResizeHandle;
    }>
  | Readonly<{
      type: 'NodeDragStarted' | 'NodeResizeStarted';
      corner?: ResizeCorner;
      handle?: ResizeHandle;
      id: string;
      pointer: number;
      point: Point;
    }>
  | Readonly<{ type: 'BoxSelectionStarted'; pointer: number; point: Point }>
  | Readonly<{ type: 'ZoomAreaStarted'; pointer: number; point: Point }>
  | Readonly<{ type: 'PanStarted'; pointer: number; point: Point }>
  | Readonly<{
      type: 'ReconnectionDragStarted';
      id: string;
      end: EdgeEnd;
      pointer: number;
      point: Point;
    }>
  | Readonly<{ type: 'ConnectionDragStarted'; pointer: number; point: Point; endpoint: Endpoint }>
  | Readonly<{
      type: 'PointerMoved';
      pointer: number;
      point: Point;
      target?: Endpoint;
      /** Nearby rendered ports in ascending distance order, used only without an exact target. */
      nearbyTargets?: readonly NearbyTarget[];
    }>
  | Readonly<{
      type: 'DragPanned';
      pointer: number;
      point: Point;
      delta: Point;
      target?: Endpoint;
      nearbyTargets?: readonly NearbyTarget[];
    }>
  | Readonly<{ type: 'PointerReleased'; pointer: number }>
  | Readonly<{ type: 'PinchStarted' | 'PinchMoved'; center: Point; distance: number }>
  | Readonly<{ type: 'PinchEnded' }>
  | Readonly<{ type: 'GestureCancelled' }>
  | Readonly<{ type: 'GridSnapToggled' }>
  | Readonly<{ type: 'GridSpacingChanged'; spacing: number }>
  | Readonly<{ type: 'AlignmentSnapToggled' }>
  | Readonly<{ type: 'SelectionModeToggled' }>
  | Readonly<{ type: 'ZoomAreaModeToggled' }>
  | Readonly<{ type: 'BoxSelectionMatchChanged'; match: BoxSelectionMatch }>
  | Readonly<{ type: 'ConnectionSnapHysteresisChanged'; distance: number }>
  | Readonly<{ type: 'ViewportChanged'; viewport: Viewport }>
  | Readonly<{ type: 'ViewportConstraintsChanged'; zoomLimits: ZoomLimits; fitViewPadding: number }>
  | Readonly<{ type: 'ViewportNudged'; delta: Point }>
  | Readonly<{ type: 'FitViewClicked' }>
  | Readonly<{ type: 'FitSelectionClicked' }>
  | Readonly<{ type: 'PreviousViewClicked' }>
  | Readonly<{ type: 'NodeRevealRequested'; id: string }>
  | Readonly<{ type: 'EdgeRevealRequested'; id: string }>
  | Readonly<{ type: 'FitViewDurationChanged'; duration: number }>
  | Readonly<{ type: 'FitViewAnimationFrame'; id: number; time: number; reducedMotion: boolean }>
  | Readonly<{ type: 'MinimapClicked'; point: Point }>
  | Readonly<{ type: 'Zoomed'; point: Point; factor: number }>
  | Readonly<{ type: 'SelectionNudged'; delta: Point; id?: string }>
  | Readonly<{ type: 'NodeAdded'; node: FlowNode }>
  | Readonly<{ type: 'NodeLabelChanged'; id: string; label: string }>
  | Readonly<{ type: 'NodeContainmentToggled'; id: string }>
  | Readonly<{ type: 'NodeExpansionToggled'; id: string }>
  | Readonly<{ type: 'NodeResizeNudged'; id: string; delta: number }>
  | Readonly<{ type: 'NodeWidthChanged'; id: string; width: number }>
  | Readonly<{
      type: 'GroupDimensionChanged';
      id: string;
      dimension: 'width' | 'height';
      value: number;
    }>
  | Readonly<{ type: 'EdgeLabelEditingStarted'; id: string }>
  | Readonly<{ type: 'EdgeLabelDraftChanged'; id: string; text: string }>
  | Readonly<{ type: 'EdgeLabelSaved'; id: string }>
  | Readonly<{ type: 'EdgeLabelCancelled'; id: string }>
  | Readonly<{ type: 'EdgePathStyleChanged'; id: string; pathStyle: EdgePathStyle | null }>
  | Readonly<{ type: 'EdgeDataChanged'; id: string; data: JsonValue }>
  | Readonly<{ type: 'NodeMeasured'; id: string; size: Size }>
  | Readonly<{ type: 'SurfaceMeasured'; size: Size }>
  | Readonly<{ type: 'EdgeReconnected'; id: string; end: EdgeEnd; endpoint: Endpoint }>
  | Readonly<{ type: 'ConnectionCreated'; edge: FlowEdge }>
  | Readonly<{ type: 'PortAdded'; nodeId: string; port: Port }>
  | Readonly<{ type: 'PortRemoved'; endpoint: Endpoint }>
  /** Changes display text without changing endpoint identity; undefined restores the ID fallback. */
  | Readonly<{ type: 'PortLabelChanged'; endpoint: Endpoint; label: string | undefined }>
  | Readonly<{
      type: 'PortPositionsChanged';
      positions: readonly Readonly<{ endpoint: Endpoint; position: PortPosition }>[];
    }>
  | Readonly<{ type: 'PortActivated'; endpoint: Endpoint }>
  | Readonly<{ type: 'CopyPressed' }>
  | Readonly<{ type: 'PastePressed' }>
  | Readonly<{ type: 'DuplicatePressed' }>
  | Readonly<{ type: 'SelectionGrouped' }>
  | Readonly<{ type: 'SelectionUngrouped' }>
  | Readonly<{ type: 'DeletePressed' }>
  | Readonly<{ type: 'EdgeDeleted'; id: string }>
  | Readonly<{ type: 'UndoPressed' }>
  | Readonly<{ type: 'RedoPressed' }>;
/** Detached graph snapshot with request identity and document revision for stale-result protection. */
export type LayoutRequest = Readonly<{ requestId: string; revision: number; graph: FlowGraph }>;
/** Every node exactly once in world coordinates; optional sizes apply only to groups. Routes identify existing edges. */
export type LayoutResult = Readonly<{
  requestId: string;
  revision: number;
  positions: readonly Readonly<Point & { id: string; size?: Size }>[];
  routes: readonly EdgeRoute[];
}>;
/** Asynchronous computation only. The host publishes accepted results through applyLayout. */
export type LayoutEngine = (request: LayoutRequest) => Promise<LayoutResult>;

/** World extent and current camera rectangle used by every minimap renderer. */
export type FlowMinimapGeometry = Point & Size & Readonly<{ visible: Point & Size }>;
