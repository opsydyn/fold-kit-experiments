import {
  createEditor,
  type EditorState,
  type FlowGraph,
  type LayoutRequest,
} from '@opsydyn/foldkit-flow';
import {
  resolveFlowDiagnostics,
  type FlowColorScheme,
  type FlowDiagnostics,
} from '@opsydyn/foldkit-flow/foldkit';
import { Schema } from 'effect';

export const initialGraph: FlowGraph = {
  nodes: [
    {
      id: 'source',
      label: 'Draft',
      position: { x: 40, y: 70 },
      size: { width: 180, height: 90 },
      ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
    },
    {
      id: 'review',
      label: 'Review',
      position: { x: 360, y: 150 },
      size: { width: 180, height: 90 },
      ports: [
        { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
        { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
      ],
    },
    {
      id: 'publish',
      label: 'Publish',
      position: { x: 640, y: 70 },
      size: { width: 180, height: 90 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
    },
  ],
  edges: [
    {
      id: 'draft-review',
      data: { deletionProtected: true },
      source: { node: 'source', port: 'out' },
      target: { node: 'review', port: 'in' },
    },
  ],
};
export const portSnappingGraph: FlowGraph = {
  nodes: [
    {
      id: 'source',
      label: 'Draft',
      position: { x: 40, y: 50 },
      size: { width: 180, height: 135 },
      ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
    },
    {
      id: 'review',
      label: 'Review',
      position: { x: 40, y: 240 },
      size: { width: 180, height: 135 },
      ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
    },
    {
      id: 'publish',
      label: 'Publish',
      position: { x: 480, y: 140 },
      size: { width: 180, height: 135 },
      ports: [
        { id: 'primary', label: 'Primary', kind: 'input', side: 'left', offset: 0.35 },
        { id: 'fallback', label: 'Fallback', kind: 'input', side: 'left', offset: 0.65 },
      ],
    },
  ],
  edges: [
    {
      id: 'review-publish',
      source: { node: 'review', port: 'out' },
      target: { node: 'publish', port: 'primary' },
    },
  ],
};

export const onionGraph: FlowGraph = {
  nodes: [
    { id: 'ui', label: 'UI adapter', position: { x: 20, y: 20 } },
    { id: 'storage', label: 'Storage adapter', position: { x: 20, y: 150 } },
    { id: 'application', label: 'Application', position: { x: 280, y: 85 } },
    {
      id: 'domain',
      label: 'Domain model',
      position: { x: 540, y: 85 },
      data: { deletionProtected: true },
    },
  ].map((node) => ({
    ...node,
    size: { width: 180, height: 90 },
    ports: [
      { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
      { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
    ],
  })),
  edges: [
    {
      id: 'ui-application',
      label: 'UI uses application use cases',
      source: { node: 'ui', port: 'out' },
      target: { node: 'application', port: 'in' },
    },
    {
      id: 'storage-application',
      label: 'Storage implements an application-owned interface',
      source: { node: 'storage', port: 'out' },
      target: { node: 'application', port: 'in' },
    },
    {
      id: 'application-domain',
      label: 'Application uses the domain model',
      source: { node: 'application', port: 'out' },
      target: { node: 'domain', port: 'in' },
    },
  ],
};

const coreMembership = new Map([
  ['application', 'core'],
  ['domain', 'core'],
]);

const groupedOffsets = new Map([['storage', 30]]);

export const groupedOnionGraph: FlowGraph = {
  ...onionGraph,
  nodes: [
    {
      id: 'system',
      kind: 'group',
      label: 'Release system',
      position: { x: 0, y: 0 },
      size: { width: 780, height: 400 },
      ports: [],
    },
    {
      id: 'core',
      kind: 'group',
      parentId: 'system',
      label: 'Application core',
      position: { x: 255, y: 74 },
      size: { width: 500, height: 232 },
      ports: [],
    },
    ...onionGraph.nodes.map((node) => ({
      ...node,
      position: {
        x: node.position.x,
        y: node.position.y + 65 + (groupedOffsets.get(node.id) ?? 0),
      },
      parentId: coreMembership.get(node.id) ?? 'system',
    })),
  ],
};

export const PortAnchorPreset = Schema.Literals(['cardinal', 'diagonal']);
export type PortAnchorPreset = typeof PortAnchorPreset.Type;

export const ConnectionDesign = Schema.Literals(['dashed', 'ribbon', 'hidden']);
export type ConnectionDesign = typeof ConnectionDesign.Type;

export const CanvasCopyDesign = Schema.Literals(['standard', 'card']);
export type CanvasCopyDesign = typeof CanvasCopyDesign.Type;

export const SelectionMarqueeDesign = Schema.Literals(['standard', 'hatched']);
export type SelectionMarqueeDesign = typeof SelectionMarqueeDesign.Type;

export const AlignmentGuideDesign = Schema.Literals(['standard', 'endpoints']);
export type AlignmentGuideDesign = typeof AlignmentGuideDesign.Type;

export const ResizeReadoutDesign = Schema.Literals(['standard', 'labeled']);
export type ResizeReadoutDesign = typeof ResizeReadoutDesign.Type;

export const ConnectionListDesign = Schema.Literals(['standard', 'rows']);
export type ConnectionListDesign = typeof ConnectionListDesign.Type;

export const ContextMenuDesign = Schema.Literals(['standard', 'panel']);
export type ContextMenuDesign = typeof ContextMenuDesign.Type;

export const NodeToolbarDesign = Schema.Literals(['off', 'standard', 'compact']);
export type NodeToolbarDesign = typeof NodeToolbarDesign.Type;

export const EdgeToolbarDesign = Schema.Literals(['standard', 'compact']);
export type EdgeToolbarDesign = typeof EdgeToolbarDesign.Type;

export const EdgeLabelDesign = Schema.Literals(['standard', 'badge']);
export type EdgeLabelDesign = typeof EdgeLabelDesign.Type;

export const PortLock = Schema.Literals(['draftOutput', 'publishInput']);
const PortLocks = Schema.Struct({ draftOutput: Schema.Boolean, publishInput: Schema.Boolean });

export const ReconnectLock = Schema.Literals(['none', 'source', 'target', 'both']);
export type ReconnectLock = typeof ReconnectLock.Type;

export const ReconnectionSnap = Schema.Literals(['match', 'exact', 'wide']);
export type ReconnectionSnap = typeof ReconnectionSnap.Type;

export const EdgeDesign = Schema.Literals(['default', 'raised']);
export type EdgeDesign = typeof EdgeDesign.Type;

export const WheelNavigation = Schema.Literals(['zoom', 'pan', 'off']);
export type WheelNavigation = typeof WheelNavigation.Type;

export const NavigationDesign = Schema.Literals(['standard', 'compact']);
export type NavigationDesign = typeof NavigationDesign.Type;

export const NodeDesign = Schema.Literals(['cards', 'orbits']);
export type NodeDesign = typeof NodeDesign.Type;

export const BackgroundStyle = Schema.Literals(['dots', 'squares', 'custom', 'none']);
export type BackgroundStyle = typeof BackgroundStyle.Type;

export const DiagnosticFlag = Schema.Literals([
  'measurements',
  'alignmentGuides',
  'zoomLevel',
  'status',
  'instructions',
  'overview',
  'connectionList',
]);
export const ColorScheme = Schema.Literals(['light', 'dark']);
export const ThemePreference = Schema.Literals(['system', 'light', 'dark']);
export type ThemePreference = typeof ThemePreference.Type;

export const SearchScope = Schema.Literals(['nodes', 'connections']);
export type SearchScope = typeof SearchScope.Type;

const PortLabelDraft = Schema.Struct({
  nodeId: Schema.String,
  portId: Schema.String,
  text: Schema.String,
});

export const Model = Schema.Struct({
  protectPortEdits: Schema.Boolean,
  portLabelDraft: Schema.NullOr(PortLabelDraft),
  themePreference: Schema.NullOr(ThemePreference),
  systemColorScheme: Schema.NullOr(ColorScheme),
  minimalMode: Schema.Boolean,
  viewportCulling: Schema.Boolean,
  retainNodeViews: Schema.Boolean,
  includeCamera: Schema.Boolean,
  searchQuery: Schema.String,
  searchScope: SearchScope,
  showWorldAnnotation: Schema.Boolean,
  diagnosticsEnabled: Schema.Boolean,
  diagnosticsPanelOpen: Schema.Boolean,
  diagnostics: Schema.Struct({
    measurements: Schema.Boolean,
    alignmentGuides: Schema.Boolean,
    zoomLevel: Schema.Boolean,
    status: Schema.Boolean,
    instructions: Schema.Boolean,
    overview: Schema.Boolean,
    connectionList: Schema.Boolean,
  }),
  connectionDesign: ConnectionDesign,
  protectDeletions: Schema.Boolean,
  lockKeyNodes: Schema.Boolean,
  lockNodeSizes: Schema.Boolean,
  excludeSelection: Schema.Boolean,
  reconnectLock: ReconnectLock,
  portLocks: PortLocks,
  snapConnections: Schema.Boolean,
  portLabels: Schema.Boolean,
  customPorts: Schema.Boolean,
  reconnectionSnap: ReconnectionSnap,
  canvasCopyDesign: CanvasCopyDesign,
  selectionMarqueeDesign: SelectionMarqueeDesign,
  alignmentGuideDesign: AlignmentGuideDesign,
  resizeReadoutDesign: ResizeReadoutDesign,
  connectionListDesign: ConnectionListDesign,
  contextMenuDesign: ContextMenuDesign,
  nodeToolbarDesign: NodeToolbarDesign,
  edgeToolbarDesign: EdgeToolbarDesign,
  edgeLabelDesign: EdgeLabelDesign,
  edgeDesign: EdgeDesign,
  wheelNavigation: WheelNavigation,
  doubleClickZoom: Schema.Boolean,
  spaceToPan: Schema.Boolean,
  middleButtonPan: Schema.Boolean,
  navigationDesign: NavigationDesign,
  nodeDesign: NodeDesign,
  background: BackgroundStyle,
  editor: Schema.Unknown,
  active: Schema.NullOr(Schema.Unknown),
  importing: Schema.NullOr(Schema.Struct({ id: Schema.Number, revision: Schema.Number })),
  sequence: Schema.Number,
  notice: Schema.String,
});
export type Model = Readonly<{
  protectPortEdits: boolean;
  portLabelDraft: typeof PortLabelDraft.Type | null;
  themePreference: ThemePreference | null;
  systemColorScheme: FlowColorScheme | null;
  minimalMode: boolean;
  viewportCulling: boolean;
  retainNodeViews: boolean;
  includeCamera: boolean;
  searchQuery: string;
  searchScope: SearchScope;
  showWorldAnnotation: boolean;
  diagnosticsEnabled: boolean;
  diagnosticsPanelOpen: boolean;
  diagnostics: FlowDiagnostics;
  connectionDesign: ConnectionDesign;
  protectDeletions: boolean;
  lockKeyNodes: boolean;
  lockNodeSizes: boolean;
  excludeSelection: boolean;
  reconnectLock: ReconnectLock;
  portLocks: typeof PortLocks.Type;
  snapConnections: boolean;
  portLabels: boolean;
  customPorts: boolean;
  reconnectionSnap: ReconnectionSnap;
  canvasCopyDesign: CanvasCopyDesign;
  selectionMarqueeDesign: SelectionMarqueeDesign;
  alignmentGuideDesign: AlignmentGuideDesign;
  resizeReadoutDesign: ResizeReadoutDesign;
  connectionListDesign: ConnectionListDesign;
  contextMenuDesign: ContextMenuDesign;
  nodeToolbarDesign: NodeToolbarDesign;
  edgeToolbarDesign: EdgeToolbarDesign;
  edgeLabelDesign: EdgeLabelDesign;
  edgeDesign: EdgeDesign;
  wheelNavigation: WheelNavigation;
  doubleClickZoom: boolean;
  spaceToPan: boolean;
  middleButtonPan: boolean;
  navigationDesign: NavigationDesign;
  nodeDesign: NodeDesign;
  background: BackgroundStyle;
  editor: EditorState;
  active: LayoutRequest | null;
  importing: Readonly<{ id: number; revision: number }> | null;
  sequence: number;
  notice: string;
}>;
export const init = () => ({
  model: {
    protectPortEdits: false,
    portLabelDraft: null,
    themePreference: null,
    systemColorScheme: null,
    minimalMode: false,
    viewportCulling: false,
    retainNodeViews: false,
    includeCamera: false,
    searchQuery: '',
    searchScope: 'nodes' as const,
    showWorldAnnotation: false,
    diagnosticsEnabled: true,
    diagnosticsPanelOpen: false,
    diagnostics: resolveFlowDiagnostics({}),
    connectionDesign: 'dashed',
    protectDeletions: false,
    lockKeyNodes: false,
    lockNodeSizes: false,
    excludeSelection: false,
    reconnectLock: 'none',
    portLocks: { draftOutput: false, publishInput: false },
    snapConnections: false,
    portLabels: false,
    customPorts: false,
    reconnectionSnap: 'match',
    canvasCopyDesign: 'standard',
    selectionMarqueeDesign: 'standard',
    alignmentGuideDesign: 'standard',
    resizeReadoutDesign: 'standard',
    connectionListDesign: 'standard',
    contextMenuDesign: 'standard',
    nodeToolbarDesign: 'off',
    edgeToolbarDesign: 'standard',
    edgeLabelDesign: 'standard',
    edgeDesign: 'default',
    wheelNavigation: 'zoom',
    doubleClickZoom: true,
    spaceToPan: true,
    middleButtonPan: true,
    navigationDesign: 'standard',
    nodeDesign: 'cards',
    background: 'dots',
    editor: createEditor(initialGraph, { snapToAlignment: true }),
    active: null,
    importing: null,
    sequence: 0,
    notice: '',
  } satisfies Model,
});
