/** JSON payloads survive save/reload; views and runtime resources stay in the host. */
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export type Point = Readonly<{ x: number; y: number }>;
export type Size = Readonly<{ width: number; height: number }>;
export type Viewport = Readonly<Point & { zoom: number }>;
export type Port = Readonly<{
  id: string;
  kind: 'input' | 'output';
  side: 'left' | 'right' | 'top' | 'bottom';
  offset: number;
  label?: string;
}>;
export type FlowNode = Readonly<{
  id: string;
  label: string;
  position: Point;
  size: Size;
  ports: readonly Port[];
  kind?: 'group';
  /** A group ID. Positions are always in canvas coordinates. */
  parentId?: string;
  data?: JsonValue;
}>;
export type Endpoint = Readonly<{ node: string; port: string }>;
export type FlowEdge = Readonly<{
  id: string;
  source: Endpoint;
  target: Endpoint;
  label?: string;
  data?: JsonValue;
}>;
export type FlowGraph = Readonly<{ nodes: readonly FlowNode[]; edges: readonly FlowEdge[] }>;
export type EdgeRoute = Readonly<{ id: string; points: readonly Point[] }>;
export type Gesture =
  | Readonly<{ type: 'idle' }>
  | Readonly<{
      type: 'node-drag' | 'node-resize';
      pointer: number;
      origin: Point;
      before: FlowGraph;
      ids: readonly string[];
    }>
  | Readonly<{
      type: 'connection-drag';
      pointer: number;
      point: Point;
      target: Endpoint | null;
      reconnect?: Readonly<{ id: string; end: 'source' | 'target' }>;
    }>
  | Readonly<{ type: 'box-selection'; pointer: number; origin: Point; point: Point }>
  | Readonly<{ type: 'pan'; pointer: number; origin: Point; before: Viewport }>;
export type EditorState = Readonly<{
  graph: FlowGraph;
  revision: number;
  viewport: Viewport;
  surface: Size | null;
  selectedNodes: readonly string[];
  selectedEdges: readonly string[];
  connection: Endpoint | null;
  gesture: Gesture;
  past: readonly FlowGraph[];
  future: readonly FlowGraph[];
  historyLimit: number;
  readOnly: boolean;
  snapToGrid: boolean;
  routes: readonly EdgeRoute[];
  notice: string | null;
}>;
export type EditorOptions = Readonly<{
  viewport?: Viewport;
  historyLimit?: number;
  readOnly?: boolean;
  snapToGrid?: boolean;
}>;
export type EditorPolicy = Readonly<{
  canConnect?: (edge: FlowEdge, graph: FlowGraph) => string | null;
}>;
/** Facts from input adapters. Positions are local CSS pixels before viewport transforms. */
export type EditorEvent =
  | Readonly<{ type: 'NodeSelected'; id: string; additive: boolean }>
  | Readonly<{ type: 'EdgeSelected'; id: string; additive: boolean }>
  | Readonly<{ type: 'SelectionCleared' }>
  | Readonly<{
      type: 'NodeDragStarted' | 'NodeResizeStarted';
      id: string;
      pointer: number;
      point: Point;
    }>
  | Readonly<{ type: 'BoxSelectionStarted'; pointer: number; point: Point }>
  | Readonly<{ type: 'PanStarted'; pointer: number; point: Point }>
  | Readonly<{
      type: 'ReconnectionDragStarted';
      id: string;
      end: 'source' | 'target';
      pointer: number;
      point: Point;
    }>
  | Readonly<{ type: 'ConnectionDragStarted'; pointer: number; point: Point; endpoint: Endpoint }>
  | Readonly<{ type: 'PointerMoved'; pointer: number; point: Point; target?: Endpoint }>
  | Readonly<{ type: 'PointerReleased'; pointer: number }>
  | Readonly<{ type: 'GestureCancelled' }>
  | Readonly<{ type: 'GridSnapToggled' }>
  | Readonly<{ type: 'ViewportChanged'; viewport: Viewport }>
  | Readonly<{ type: 'FitViewClicked' }>
  | Readonly<{ type: 'MinimapClicked'; point: Point }>
  | Readonly<{ type: 'Zoomed'; point: Point; factor: number }>
  | Readonly<{ type: 'SelectionNudged'; delta: Point }>
  | Readonly<{ type: 'NodeAdded'; node: FlowNode }>
  | Readonly<{ type: 'NodeLabelChanged'; id: string; label: string }>
  | Readonly<{ type: 'NodeWidthChanged'; id: string; width: number }>
  | Readonly<{ type: 'EdgeDataChanged'; id: string; data: JsonValue }>
  | Readonly<{ type: 'NodeMeasured'; id: string; size: Size }>
  | Readonly<{ type: 'SurfaceMeasured'; size: Size }>
  | Readonly<{ type: 'EdgeReconnected'; id: string; end: 'source' | 'target'; endpoint: Endpoint }>
  | Readonly<{ type: 'ConnectionCreated'; edge: FlowEdge }>
  | Readonly<{ type: 'PortActivated'; endpoint: Endpoint }>
  | Readonly<{ type: 'SelectionGrouped' }>
  | Readonly<{ type: 'SelectionUngrouped' }>
  | Readonly<{ type: 'DeletePressed' }>
  | Readonly<{ type: 'UndoPressed' }>
  | Readonly<{ type: 'RedoPressed' }>;
export type LayoutRequest = Readonly<{ requestId: string; revision: number; graph: FlowGraph }>;
export type LayoutResult = Readonly<{
  requestId: string;
  revision: number;
  positions: readonly Readonly<Point & { id: string; size?: Size }>[];
  routes: readonly EdgeRoute[];
}>;
export type LayoutEngine = (request: LayoutRequest) => Promise<LayoutResult>;
