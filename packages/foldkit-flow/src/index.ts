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
export type { FlowNodeShapeGeometry } from './node-shape';
/* oxlint-enable anti-slop/no-shape-in-symbol-names */
export {
  FlowError,
  validateGraph,
  parseGraph,
  serializeGraph,
  parseSnapshot,
  serializeSnapshot,
} from './graph';
export { createEditor, updateEditor } from './editor';
export { resolveEndpointChoices } from './endpoint-search';
export type {
  FlowSearchableEndpoint,
  FlowEndpointSearchOptions,
  FlowEndpointSearchContext,
  FlowEndpointChoiceGroup,
  FlowEndpointChoices,
} from './endpoint-search';
export { resolveConnectionCreation } from './connection-creation';
export type {
  FlowConnectionCreationAction,
  FlowConnectionCreationChoice,
  FlowConnectionCreationFieldContext,
  FlowConnectionCreationContext,
  FlowConnectionCreationOptions,
} from './connection-creation';
export { resolveEdgeReconnection } from './edge-reconnection';
export type {
  FlowEdgeEndpointChoice,
  FlowEdgeReconnectionContext,
  FlowEdgeReconnectionOptions,
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
  FlowEdgeGeometry,
  FlowEdgeGeometryContext,
  FlowEdgeGeometryPolicy,
  FlowEdgeGeometryOptions,
} from './edge-geometry';
export { resolveConnectionPreview } from './connection-preview';
export type {
  FlowConnectionFeedback,
  FlowConnectionPreviewContext,
  FlowConnectionGeometryPolicy,
  FlowConnectionPreview,
} from './connection-preview';
