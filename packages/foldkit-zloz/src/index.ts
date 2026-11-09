/**
 * Dependency-free graph, editor, geometry and layout contracts.
 * @module Core
 */
export type * from './types';
export type * from './architecture';
export type { ArchitectureNodeInput } from './architecture-node';
export { architectureNodePresets, isNodeArchitecture, isNodeAppearance } from './architecture';
export { createArchitectureNode } from './architecture-node';
/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Geometric node shapes are domain concepts here, not structural placeholder names. */
export { nodeShapeGeometry, nodeShapeBoundaryPoint, nodeShapeContainsPoint } from './node-shape';
export type { ZlozNodeShapeGeometry } from './node-shape';
/* oxlint-enable anti-slop/no-shape-in-symbol-names */
export {
  ZlozError,
  validateGraph,
  parseGraph,
  serializeGraph,
  parseSnapshot,
  serializeSnapshot,
} from './graph';
export { createEditor, updateEditor } from './editor';
export { resolveEndpointChoices } from './endpoint-search';
export type {
  ZlozSearchableEndpoint,
  ZlozEndpointSearchOptions,
  ZlozEndpointSearchContext,
  ZlozEndpointChoiceGroup,
  ZlozEndpointChoices,
} from './endpoint-search';
export { resolveConnectionCreation } from './connection-creation';
export type {
  ZlozConnectionCreationAction,
  ZlozConnectionCreationChoice,
  ZlozConnectionCreationFieldContext,
  ZlozConnectionCreationContext,
  ZlozConnectionCreationOptions,
} from './connection-creation';
export { resolveEdgeReconnection } from './edge-reconnection';
export type {
  ZlozEdgeEndpointChoice,
  ZlozEdgeReconnectionContext,
  ZlozEdgeReconnectionOptions,
} from './edge-reconnection';
export { resolveDeletion } from './deletion';
export { resolvePortRemoval } from './port-removal';
export { portEditReason } from './port-edit';
export {
  resolvePortAnchorSnap,
  resolvePortAnchorSnapSettings,
  portAnchorSnapGuideTargets,
  resolvePortAnchorTargetStep,
} from './port-anchor-snap';
export { revealableNodes, revealableEdges } from './group-presentation';
export {
  defaultFitViewPadding,
  defaultZoomLimits,
  fitViewport,
  minimapGeometry,
  portAnchor,
  portPosition,
  portBoundaryPosition,
  screenToWorld,
  zoomAt,
  edgePath,
} from './geometry';
export { layoutRequest, applyLayout } from './layout';
export { resolveEdgeGeometry } from './edge-geometry';
export type {
  ZlozEdgeGeometry,
  ZlozEdgeGeometryContext,
  ZlozEdgeGeometryPolicy,
  ZlozEdgeGeometryOptions,
} from './edge-geometry';
export { resolveConnectionPreview } from './connection-preview';
export type {
  ZlozConnectionFeedback,
  ZlozConnectionPreviewContext,
  ZlozConnectionGeometryPolicy,
  ZlozConnectionPreview,
} from './connection-preview';

// Compatibility names for existing code; new examples use Zloz.
/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Geometric shape aliases preserve the existing public contract. */
/** @deprecated Use ZlozNodeShapeGeometry. */
export type { ZlozNodeShapeGeometry as FlowNodeShapeGeometry } from './node-shape';
/** @deprecated Use ZlozError. */
export { ZlozError as FlowError } from './graph';
/** @deprecated Use ZlozSearchableEndpoint. */
export type { ZlozSearchableEndpoint as FlowSearchableEndpoint } from './endpoint-search';
/** @deprecated Use ZlozEndpointSearchOptions. */
export type { ZlozEndpointSearchOptions as FlowEndpointSearchOptions } from './endpoint-search';
/** @deprecated Use ZlozEndpointSearchContext. */
export type { ZlozEndpointSearchContext as FlowEndpointSearchContext } from './endpoint-search';
/** @deprecated Use ZlozEndpointChoiceGroup. */
export type { ZlozEndpointChoiceGroup as FlowEndpointChoiceGroup } from './endpoint-search';
/** @deprecated Use ZlozEndpointChoices. */
export type { ZlozEndpointChoices as FlowEndpointChoices } from './endpoint-search';
/** @deprecated Use ZlozConnectionCreationAction. */
export type { ZlozConnectionCreationAction as FlowConnectionCreationAction } from './connection-creation';
/** @deprecated Use ZlozConnectionCreationChoice. */
export type { ZlozConnectionCreationChoice as FlowConnectionCreationChoice } from './connection-creation';
/** @deprecated Use ZlozConnectionCreationFieldContext. */
export type { ZlozConnectionCreationFieldContext as FlowConnectionCreationFieldContext } from './connection-creation';
/** @deprecated Use ZlozConnectionCreationContext. */
export type { ZlozConnectionCreationContext as FlowConnectionCreationContext } from './connection-creation';
/** @deprecated Use ZlozConnectionCreationOptions. */
export type { ZlozConnectionCreationOptions as FlowConnectionCreationOptions } from './connection-creation';
/** @deprecated Use ZlozEdgeEndpointChoice. */
export type { ZlozEdgeEndpointChoice as FlowEdgeEndpointChoice } from './edge-reconnection';
/** @deprecated Use ZlozEdgeReconnectionContext. */
export type { ZlozEdgeReconnectionContext as FlowEdgeReconnectionContext } from './edge-reconnection';
/** @deprecated Use ZlozEdgeReconnectionOptions. */
export type { ZlozEdgeReconnectionOptions as FlowEdgeReconnectionOptions } from './edge-reconnection';
/** @deprecated Use ZlozEdgeGeometry. */
export type { ZlozEdgeGeometry as FlowEdgeGeometry } from './edge-geometry';
/** @deprecated Use ZlozEdgeGeometryContext. */
export type { ZlozEdgeGeometryContext as FlowEdgeGeometryContext } from './edge-geometry';
/** @deprecated Use ZlozEdgeGeometryPolicy. */
export type { ZlozEdgeGeometryPolicy as FlowEdgeGeometryPolicy } from './edge-geometry';
/** @deprecated Use ZlozEdgeGeometryOptions. */
export type { ZlozEdgeGeometryOptions as FlowEdgeGeometryOptions } from './edge-geometry';
/** @deprecated Use ZlozConnectionFeedback. */
export type { ZlozConnectionFeedback as FlowConnectionFeedback } from './connection-preview';
/** @deprecated Use ZlozConnectionPreviewContext. */
export type { ZlozConnectionPreviewContext as FlowConnectionPreviewContext } from './connection-preview';
/** @deprecated Use ZlozConnectionGeometryPolicy. */
export type { ZlozConnectionGeometryPolicy as FlowConnectionGeometryPolicy } from './connection-preview';
/** @deprecated Use ZlozConnectionPreview. */
export type { ZlozConnectionPreview as FlowConnectionPreview } from './connection-preview';
/** @deprecated Use ZlozPortAnchorSnapBypassModifier. */
export type { ZlozPortAnchorSnapBypassModifier as FlowPortAnchorSnapBypassModifier } from './types';
/** @deprecated Use ZlozNode. */
export type { ZlozNode as FlowNode } from './types';
/** @deprecated Use ZlozEdge. */
export type { ZlozEdge as FlowEdge } from './types';
/** @deprecated Use ZlozGraph. */
export type { ZlozGraph as FlowGraph } from './types';
/** @deprecated Use ZlozSnapshot. */
export type { ZlozSnapshot as FlowSnapshot } from './types';
/** @deprecated Use ZlozVisibility. */
export type { ZlozVisibility as FlowVisibility } from './types';
/** @deprecated Use ZlozMinimapGeometry. */
export type { ZlozMinimapGeometry as FlowMinimapGeometry } from './types';
/** @deprecated Use ZlozNodeArchitecture. */
export type { ZlozNodeArchitecture as FlowNodeArchitecture } from './architecture';
/** @deprecated Use ZlozNodeShape. */
export type { ZlozNodeShape as FlowNodeShape } from './architecture';
/** @deprecated Use ZlozNodeAppearance. */
export type { ZlozNodeAppearance as FlowNodeAppearance } from './architecture';
/* oxlint-enable anti-slop/no-shape-in-symbol-names */

export {
  isHistoryNavigationEvent,
  captureEdition,
  appendEdition,
  serializeEditions,
  parseEditions,
  createHistoryReview,
  updateHistoryReview,
  compareEditions,
} from './history';
export type {
  ZlozEdition,
  ZlozHistoryReview,
  ZlozHistoryChange,
  ZlozHistoryComparison,
} from './history';

export { mergeEditions } from './history';
export type { ZlozEditionMergeDecision } from './history';
export { resolveEditionRestore, restoreEdition } from './edition-restore';
export type {
  ZlozEditionRestorePolicy,
  ZlozEditionRestoreOptions,
  ZlozEditionRestoreDecision,
  ZlozEditionRestoreResult,
} from './edition-restore';
export {
  captureModelDocument,
  parseModelDocument,
  serializeModelDocument,
  forkEdition,
  createModelEditor,
} from './model-document';
export type {
  ZlozModelDocument,
  ZlozModelIdentity,
  ZlozModelOrigin,
  ZlozEditionForkPolicy,
  ZlozEditionForkResult,
} from './model-document';
export { createArchitecturePattern, insertPattern } from './patterns';
export type {
  ArchitecturePattern,
  ZlozPatternInsertionPolicy,
  ZlozPatternInsertionOptions,
  ZlozPatternInsertionResult,
} from './patterns';
