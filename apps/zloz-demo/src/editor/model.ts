import { createPngReview, type ZlozPngReviewState } from '@opsydyn/foldkit-zloz';
import {
  createEditor,
  createSvgReview,
  type ZlozSvgReviewState,
  createPlacement,
  type ZlozPlacement,
  type EditorState,
  type ZlozEdition,
  type ZlozEditionPlayback,
  type ZlozHistoryReview,
  type ZlozGraph,
  type LayoutRequest,
  type ZlozAuditComparisonState,
  type ZlozDddAuditState,
  type ZlozEventStormingDddLossConsent,
  type ZlozEventStormingC4LossConsent,
  type ZlozEventStormingC4Conversion,
  type ZlozEventStormingDddConversion,
} from '@opsydyn/foldkit-zloz';
import { createReviewReader, type ZlozReviewReaderState } from '@opsydyn/foldkit-zloz-mermaid';
import {
  resolveZlozDiagnostics,
  type ZlozColorScheme,
  type ZlozDiagnostics,
  type ZlozPortPositionDraft,
} from '@opsydyn/foldkit-zloz/foldkit';
import { Schema } from 'effect';

import { createAlchemyReview, type AlchemyReviewState } from './alchemy-state';
import type { C4MappingReviewDraft } from './c4-mapping-review';
import type { WorkbenchModelIdentity, WorkbenchModelSession } from './model-sessions';
import type { PacketReviewPreview } from './packet-reader';
import type { PatchWorkbenchState } from './patch-review';
import type { ReceiptReview } from './receipt-review';

export const initialGraph: ZlozGraph = {
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
export const portSnappingGraph: ZlozGraph = {
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

export const onionGraph: ZlozGraph = {
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

export const groupedOnionGraph: ZlozGraph = {
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

export const WaypointDesign = Schema.Literals(['off', 'native', 'custom']);
export type WaypointDesign = typeof WaypointDesign.Type;
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

export const NodeDesign = Schema.Literals(['cards', 'orbits', 'c4', 'ddd', 'event-storming']);
export type NodeDesign = typeof NodeDesign.Type;

export const BackgroundStyle = Schema.Literals(['dots', 'squares', 'custom', 'none']);
export const PortSnapPriority = Schema.Literals(['corners-first', 'midpoints-first']);
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

export const PortChooserSearchField = Schema.Literals([
  'creationSource',
  'creationTarget',
  'reconnectSource',
  'reconnectTarget',
]);
export type PortChooserSearchField = typeof PortChooserSearchField.Type;
const PortChooserQueries = Schema.Struct({
  creationSource: Schema.String,
  creationTarget: Schema.String,
  reconnectSource: Schema.String,
  reconnectTarget: Schema.String,
});

export const SearchScope = Schema.Literals(['nodes', 'connections']);
export type SearchScope = typeof SearchScope.Type;

const PortLabelDraft = Schema.Struct({
  nodeId: Schema.String,
  portId: Schema.String,
  text: Schema.String,
});

const MappingReview = Schema.Struct({
  modelId: Schema.String,
  epoch: Schema.Number,
  revision: Schema.Number,
  sourceKey: Schema.String,
  selectedKey: Schema.NullOr(Schema.String),
  choices: Schema.Array(
    Schema.Struct({
      kind: Schema.Literals(['node', 'edge']),
      id: Schema.String,
      value: Schema.String,
    }),
  ),
});
export type MappingReviewDraft = typeof MappingReview.Type;

export type RetainedMappingReceipt = Readonly<{
  id: string;
  sequence: number;
  conversion: ZlozEventStormingDddConversion;
}>;

export const WorkbenchSection = Schema.Literals([
  'alchemy',
  'diagram',
  'appearance',
  'navigation',
  'ports',
  'policies',
  'inspect',
  'mapping',
  'c4mapping',
  'diagnostics',
  'export',
  'svg',
  'png',
  'review',
  'patch',
  'history',
]);
export type WorkbenchSection = typeof WorkbenchSection.Type;
export const Model = Schema.Struct({
  alchemyReview: Schema.Unknown,
  pngReview: Schema.Unknown,
  protectPngDownloads: Schema.Boolean,
  customPngReview: Schema.Boolean,
  retainedPngLayout: Schema.Boolean,
  svgReview: Schema.Unknown,
  protectSvgDownloads: Schema.Boolean,
  customSvgReview: Schema.Boolean,
  retainedSvgLayout: Schema.Boolean,
  placement: Schema.Unknown,
  customPalette: Schema.Boolean,
  c4MappingReview: Schema.NullOr(Schema.Unknown),
  c4PlanConsent: Schema.NullOr(
    Schema.Struct({ planKey: Schema.String, accepted: Schema.Literal(true) }),
  ),
  c4PlanRun: Schema.Number,
  c4Conversions: Schema.Array(Schema.Unknown),
  protectC4Apply: Schema.Boolean,
  c4ApplyNotice: Schema.String,
  mappingReview: Schema.NullOr(MappingReview),
  mappingLossConsent: Schema.NullOr(
    Schema.Struct({ planKey: Schema.String, accepted: Schema.Literal(true) }),
  ),
  mappingConsentRun: Schema.Number,
  patchWorkbench: Schema.Unknown,
  packetReader: Schema.Unknown,
  packetPreview: Schema.NullOr(Schema.Unknown),
  protectReviewOpening: Schema.Boolean,
  receiptReview: Schema.NullOr(Schema.Unknown),
  receiptRead: Schema.NullOr(
    Schema.Struct({ id: Schema.Number, modelId: Schema.String, epoch: Schema.Number }),
  ),
  receiptReadRun: Schema.Number,
  receiptReviewNotice: Schema.String,
  mappingReceipts: Schema.Array(
    Schema.Struct({ id: Schema.String, sequence: Schema.Number, conversion: Schema.Unknown }),
  ),
  mappingReceiptSequence: Schema.Number,
  protectMappingApply: Schema.Boolean,
  mappingReviewNotice: Schema.String,
  sidebarSection: WorkbenchSection,
  sidebarCollapsed: Schema.Boolean,
  keyboardPortTargets: Schema.Boolean,
  overlappingPortSnaps: Schema.Boolean,
  portAnchorGuides: Schema.Boolean,
  customPortAnchorGuides: Schema.Boolean,
  restrictedSnapTargets: Schema.Boolean,
  perPortSnapping: Schema.Boolean,
  portAnchorSnapBypass: Schema.Boolean,
  portAnchorHandles: Schema.Boolean,
  portPositionDraft: Schema.NullOr(
    Schema.Struct({ nodeId: Schema.String, portId: Schema.String, draft: Schema.Unknown }),
  ),
  protectPortEdits: Schema.Boolean,
  portLabelDraft: Schema.NullOr(PortLabelDraft),
  themePreference: Schema.NullOr(ThemePreference),
  systemColorScheme: Schema.NullOr(ColorScheme),
  minimalMode: Schema.Boolean,
  viewportCulling: Schema.Boolean,
  retainNodeViews: Schema.Boolean,
  includeCamera: Schema.Boolean,
  searchQuery: Schema.String,
  portChooserQueries: PortChooserQueries,
  searchScope: SearchScope,
  showWorldAnnotation: Schema.Boolean,
  diagnosticsEnabled: Schema.Boolean,
  diagnosticsPanelOpen: Schema.Boolean,
  mermaidPreviewOpen: Schema.Boolean,
  mermaidLossConsentRevision: Schema.NullOr(Schema.Number),
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
  mixedPortProtection: Schema.Boolean,
  socketReasonBadges: Schema.Boolean,
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
  waypointDesign: WaypointDesign,
  protectWaypointEdits: Schema.Boolean,
  edgeToolbarDesign: EdgeToolbarDesign,
  protectDddRelationships: Schema.Boolean,
  contextMapPresentation: Schema.Boolean,
  semanticRelationships: Schema.Boolean,
  customStormingRelationships: Schema.Boolean,
  workshopConventions: Schema.Boolean,
  protectWorkshopMeaning: Schema.Boolean,
  edgeLabelDesign: EdgeLabelDesign,
  edgeDesign: EdgeDesign,
  wheelNavigation: WheelNavigation,
  doubleClickZoom: Schema.Boolean,
  spaceToPan: Schema.Boolean,
  middleButtonPan: Schema.Boolean,
  navigationDesign: NavigationDesign,
  nodeDesign: NodeDesign,
  background: BackgroundStyle,
  editionImport: Schema.NullOr(Schema.Unknown),
  modelImport: Schema.NullOr(Schema.Unknown),
  protectModelImport: Schema.Boolean,
  protectPatternInsertion: Schema.Boolean,
  editionRestore: Schema.NullOr(Schema.Unknown),
  modelIdentity: Schema.Unknown,
  modelEpoch: Schema.Number,
  modelNamespace: Schema.String,
  savedModels: Schema.Unknown,
  forkName: Schema.String,
  protectEditionFork: Schema.Boolean,
  protectEditionRestore: Schema.Boolean,
  editions: Schema.Unknown,
  historyReview: Schema.NullOr(Schema.Unknown),
  historyPlayback: Schema.NullOr(Schema.Unknown),
  playbackRun: Schema.Number,
  playbackReducedMotion: Schema.NullOr(Schema.Boolean),
  playbackVisible: Schema.Boolean,
  historyBaselineId: Schema.NullOr(Schema.String),
  reviewPacketConsentKey: Schema.NullOr(Schema.String),
  auditComparison: Schema.Unknown,
  dddAudit: Schema.Unknown,
  historyChangeFilters: Schema.Struct({
    added: Schema.Boolean,
    removed: Schema.Boolean,
    changed: Schema.Boolean,
  }),
  editionName: Schema.String,
  historyGhosts: Schema.Struct({
    enabled: Schema.Boolean,
    nodes: Schema.Boolean,
    edges: Schema.Boolean,
    movements: Schema.Boolean,
  }),
  editor: Schema.Unknown,
  active: Schema.NullOr(Schema.Unknown),
  importing: Schema.NullOr(Schema.Struct({ id: Schema.Number, revision: Schema.Number })),
  sequence: Schema.Number,
  notice: Schema.String,
});
export type Model = Readonly<{
  pngReview: ZlozPngReviewState;
  protectPngDownloads: boolean;
  customPngReview: boolean;
  retainedPngLayout: boolean;
  svgReview: ZlozSvgReviewState;
  protectSvgDownloads: boolean;
  customSvgReview: boolean;
  retainedSvgLayout: boolean;
  placement: ZlozPlacement;
  customPalette: boolean;
  c4MappingReview: C4MappingReviewDraft | null;
  c4PlanConsent: ZlozEventStormingC4LossConsent | null;
  c4PlanRun: number;
  c4Conversions: readonly ZlozEventStormingC4Conversion[];
  protectC4Apply: boolean;
  c4ApplyNotice: string;
  mappingReview: MappingReviewDraft | null;
  mappingLossConsent: ZlozEventStormingDddLossConsent | null;
  mappingConsentRun: number;
  patchWorkbench: PatchWorkbenchState;
  packetReader: ZlozReviewReaderState;
  packetPreview: PacketReviewPreview | null;
  protectReviewOpening: boolean;
  alchemyReview: AlchemyReviewState;
  receiptReview: ReceiptReview | null;
  receiptRead: Readonly<{ id: number; modelId: string; epoch: number }> | null;
  receiptReadRun: number;
  receiptReviewNotice: string;
  mappingReceipts: readonly RetainedMappingReceipt[];
  mappingReceiptSequence: number;
  protectMappingApply: boolean;
  mappingReviewNotice: string;
  sidebarSection: WorkbenchSection;
  sidebarCollapsed: boolean;
  keyboardPortTargets: boolean;
  overlappingPortSnaps: boolean;
  portAnchorGuides: boolean;
  customPortAnchorGuides: boolean;
  restrictedSnapTargets: boolean;
  perPortSnapping: boolean;
  portAnchorSnapBypass: boolean;
  portAnchorHandles: boolean;
  portPositionDraft: Readonly<{
    nodeId: string;
    portId: string;
    draft: ZlozPortPositionDraft;
  }> | null;
  protectPortEdits: boolean;
  portLabelDraft: typeof PortLabelDraft.Type | null;
  themePreference: ThemePreference | null;
  systemColorScheme: ZlozColorScheme | null;
  minimalMode: boolean;
  viewportCulling: boolean;
  retainNodeViews: boolean;
  includeCamera: boolean;
  searchQuery: string;
  portChooserQueries: typeof PortChooserQueries.Type;
  searchScope: SearchScope;
  showWorldAnnotation: boolean;
  diagnosticsEnabled: boolean;
  diagnosticsPanelOpen: boolean;
  mermaidPreviewOpen: boolean;
  mermaidLossConsentRevision: number | null;
  diagnostics: ZlozDiagnostics;
  connectionDesign: ConnectionDesign;
  protectDeletions: boolean;
  lockKeyNodes: boolean;
  lockNodeSizes: boolean;
  excludeSelection: boolean;
  reconnectLock: ReconnectLock;
  portLocks: typeof PortLocks.Type;
  mixedPortProtection: boolean;
  socketReasonBadges: boolean;
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
  waypointDesign: WaypointDesign;
  protectWaypointEdits: boolean;
  edgeToolbarDesign: EdgeToolbarDesign;
  protectDddRelationships: boolean;
  contextMapPresentation: boolean;
  semanticRelationships: boolean;
  customStormingRelationships: boolean;
  workshopConventions: boolean;
  protectWorkshopMeaning: boolean;
  edgeLabelDesign: EdgeLabelDesign;
  edgeDesign: EdgeDesign;
  wheelNavigation: WheelNavigation;
  doubleClickZoom: boolean;
  spaceToPan: boolean;
  middleButtonPan: boolean;
  navigationDesign: NavigationDesign;
  nodeDesign: NodeDesign;
  background: BackgroundStyle;
  modelImport: Readonly<{ id: number; epoch: number; revision: number; graph: ZlozGraph }> | null;
  protectModelImport: boolean;
  protectPatternInsertion: boolean;
  editionImport: Readonly<{ id: number; editions: readonly ZlozEdition[] }> | null;
  editionRestore: Readonly<{ edition: ZlozEdition; expectedRevision: number }> | null;
  protectEditionRestore: boolean;
  modelIdentity: WorkbenchModelIdentity;
  modelEpoch: number;
  modelNamespace: string;
  savedModels: readonly WorkbenchModelSession[];
  forkName: string;
  protectEditionFork: boolean;
  editions: readonly ZlozEdition[];
  historyReview: ZlozHistoryReview | null;
  historyPlayback: Readonly<{
    cursor: ZlozEditionPlayback;
    editions: readonly ZlozEdition[];
    session: number;
  }> | null;
  playbackRun: number;
  playbackReducedMotion: boolean | null;
  playbackVisible: boolean;
  historyBaselineId: string | null;
  reviewPacketConsentKey: string | null;
  auditComparison: ZlozAuditComparisonState;
  dddAudit: ZlozDddAuditState;
  historyChangeFilters: Readonly<{ added: boolean; removed: boolean; changed: boolean }>;
  editionName: string;
  historyGhosts: Readonly<{ enabled: boolean; nodes: boolean; edges: boolean; movements: boolean }>;
  editor: EditorState;
  active: LayoutRequest | null;
  importing: Readonly<{ id: number; revision: number }> | null;
  sequence: number;
  notice: string;
}>;
export const init = (namespace = 'test-workbench') => ({
  model: {
    patchWorkbench: {
      scope: '',
      run: 0,
      pending: null,
      patch: null,
      consent: null,
      receipts: [],
      notice: '',
      protected: false,
      custom: false,
    },
    packetReader: createReviewReader(`root:${namespace}/0`),
    packetPreview: null,
    protectReviewOpening: false,
    pngReview: createPngReview(`root:${namespace}/0`),
    protectPngDownloads: false,
    customPngReview: false,
    retainedPngLayout: false,
    svgReview: createSvgReview(`root:${namespace}/0`),
    protectSvgDownloads: false,
    customSvgReview: false,
    retainedSvgLayout: false,
    placement: createPlacement(`root:${namespace}/0`),
    customPalette: false,
    c4MappingReview: null,
    c4PlanConsent: null,
    c4PlanRun: 0,
    c4Conversions: [],
    protectC4Apply: false,
    c4ApplyNotice: '',
    mappingReview: null,
    mappingLossConsent: null,
    mappingConsentRun: 0,
    alchemyReview: createAlchemyReview(),
    receiptReview: null,
    receiptRead: null,
    receiptReadRun: 0,
    receiptReviewNotice: '',
    mappingReceipts: [],
    mappingReceiptSequence: 0,
    protectMappingApply: false,
    mappingReviewNotice: '',
    sidebarSection: 'diagram',
    sidebarCollapsed: false,
    keyboardPortTargets: false,
    overlappingPortSnaps: false,
    portAnchorGuides: false,
    customPortAnchorGuides: false,
    restrictedSnapTargets: false,
    perPortSnapping: false,
    portAnchorSnapBypass: false,
    portAnchorHandles: false,
    portPositionDraft: null,
    protectPortEdits: false,
    portLabelDraft: null,
    themePreference: null,
    systemColorScheme: null,
    minimalMode: false,
    viewportCulling: false,
    retainNodeViews: false,
    includeCamera: false,
    searchQuery: '',
    portChooserQueries: {
      creationSource: '',
      creationTarget: '',
      reconnectSource: '',
      reconnectTarget: '',
    },
    searchScope: 'nodes' as const,
    showWorldAnnotation: false,
    diagnosticsEnabled: true,
    diagnosticsPanelOpen: false,
    mermaidPreviewOpen: false,
    mermaidLossConsentRevision: null,
    diagnostics: resolveZlozDiagnostics({}),
    connectionDesign: 'dashed',
    protectDeletions: false,
    lockKeyNodes: false,
    lockNodeSizes: false,
    excludeSelection: false,
    reconnectLock: 'none',
    portLocks: { draftOutput: false, publishInput: false },
    mixedPortProtection: false,
    socketReasonBadges: false,
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
    waypointDesign: 'native',
    protectWaypointEdits: false,
    protectDddRelationships: false,
    contextMapPresentation: true,
    semanticRelationships: false,
    customStormingRelationships: false,
    workshopConventions: false,
    protectWorkshopMeaning: false,
    edgeLabelDesign: 'standard',
    edgeDesign: 'default',
    wheelNavigation: 'zoom',
    doubleClickZoom: true,
    spaceToPan: true,
    middleButtonPan: true,
    navigationDesign: 'standard',
    nodeDesign: 'cards',
    background: 'dots',
    editionImport: null,
    modelImport: null,
    protectModelImport: false,
    protectPatternInsertion: false,
    editionRestore: null,
    protectEditionRestore: false,
    modelIdentity: { id: `root:${namespace}`, name: 'Working model', origin: null },
    modelEpoch: 0,
    modelNamespace: namespace,
    savedModels: [],
    forkName: '',
    protectEditionFork: false,
    editions: [],
    historyReview: null,
    historyPlayback: null,
    playbackRun: 0,
    playbackReducedMotion: null,
    playbackVisible: false,
    historyBaselineId: null,
    reviewPacketConsentKey: null,
    dddAudit: {
      baselineId: null,
      selectedId: null,
      filters: { introduced: true, resolved: true, persisting: true },
    },
    auditComparison: {
      baselineId: null,
      selectedId: null,
      filters: { introduced: true, resolved: true, persisting: true },
    },
    historyChangeFilters: { added: true, removed: true, changed: true },
    editionName: '',
    historyGhosts: { enabled: false, nodes: true, edges: true, movements: true },
    editor: createEditor(initialGraph, { snapToAlignment: true }),
    active: null,
    importing: null,
    sequence: 0,
    notice: '',
  } satisfies Model,
});
