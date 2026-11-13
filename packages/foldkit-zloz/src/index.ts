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
export { resolveEdgeWaypointEdit } from './edge-waypoint-edit';
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
  fitNodes,
  minimapGeometry,
  portAnchor,
  portPosition,
  portBoundaryPosition,
  screenToWorld,
  zoomAt,
  edgePath,
} from './geometry';
export { layoutRequest, validateLayoutRequest, applyLayout, applyPreviewLayout } from './layout';
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
export {
  createEditionPlayback,
  updateEditionPlayback,
  playbackEditionId,
  editionPlaybackReason,
} from './edition-playback';
export type {
  ZlozEditionPlayback,
  ZlozEditionPlaybackOptions,
  ZlozEditionPlaybackEvent,
} from './edition-playback';
export { resolveEditionPlaybackControls } from './playback-controls';
export type {
  ZlozPlaybackControlName,
  ZlozPlaybackControlEvent,
  ZlozPlaybackControl,
  ZlozPlaybackControlsContext,
  ZlozPlaybackControlsOptions,
} from './playback-controls';
export {
  resolveEditionScrubber,
  editionScrubberRequest,
  resolveEditionSeek,
} from './edition-scrubber';
export type {
  ZlozEditionSeekRequest,
  ZlozEditionSeekDecision,
  ZlozEditionScrubberEntry,
  ZlozEditionScrubberOptions,
  ZlozEditionScrubberContext,
} from './edition-scrubber';

export {
  resolveHistoryComparisonControls,
  resolveHistoryComparisonRequest,
} from './history-comparison-controls';
export type {
  ZlozHistoryGhostPart,
  ZlozHistoryGhostVisibility,
  ZlozComparisonEdition,
  ZlozHistoryComparisonControlsState,
  ZlozHistoryComparisonRequest,
  ZlozHistoryComparisonControlsOptions,
  ZlozHistoryComparisonDecision,
  ZlozComparisonChoice,
  ZlozHistoryBaselineControl,
  ZlozHistoryGhostControl,
  ZlozHistoryComparisonControlsContext,
} from './history-comparison-controls';

export {
  resolveHistoryChangeNavigator,
  resolveHistoryChangeFocus,
  resolveHistoryChangeStep,
} from './history-change-navigator';
export type {
  ZlozHistoryChangeCursor,
  ZlozHistoryChangeStepDirection,
  ZlozHistoryChangeKind,
  ZlozHistoryChangeFilters,
  ZlozHistoryChangeItem,
  ZlozHistoryChangeFocusRequest,
  ZlozHistoryChangeEntry,
  ZlozHistoryChangeFilter,
  ZlozHistoryChangeNavigatorOptions,
  ZlozHistoryChangeNavigatorContext,
  ZlozHistoryChangeFocusTarget,
  ZlozHistoryChangeFocusDecision,
} from './history-change-navigator';

export {
  isEdgeArchitecture,
  isEventStormingEdgeArchitecture,
  isDddEdgeArchitecture,
} from './architecture';
export type { DddEdgeArchitecture } from './architecture';
export {
  dddRelationshipRules,
  dddRelationshipKey,
  resolveDddRelationship,
  dddRelationshipPolicy,
} from './ddd-relationships';
export type {
  ZlozDddRelationship,
  ZlozDddRelationshipRule,
  ZlozDddRelationshipOptions,
  ZlozDddRelationshipDecision,
} from './ddd-relationships';
export {
  eventStormingRelationshipRules,
  eventStormingRelationshipKey,
  eventStormingParticipantRole,
  resolveEventStormingRelationship,
  eventStormingRelationshipPolicy,
} from './event-storming-relationships';
export type {
  EventStormingParticipantRole,
  ZlozEventStormingRelationshipRule,
  ZlozEventStormingRelationshipOptions,
  ZlozEventStormingRelationshipDecision,
} from './event-storming-relationships';
export { createEventStormingPattern } from './patterns';

export {
  resolveEventStormingRelationshipControls,
  resolveEventStormingRelationshipRequest,
} from './relationship-controls';
export type {
  ZlozEventStormingRelationshipRequest,
  ZlozEventStormingRelationshipControlsOptions,
  ZlozEventStormingRelationshipChoice,
  ZlozEventStormingRelationshipInference,
  ZlozEventStormingRelationshipControlsContext,
  ZlozEventStormingRelationshipEditDecision,
} from './relationship-controls';

export { auditDddRelationships } from './ddd-relationship-audit';
export type {
  ZlozDddRelationshipAuditCode,
  ZlozDddRelationshipAuditEntry,
  ZlozDddRelationshipAudit,
} from './ddd-relationship-audit';

export { auditEventStormingRelationships } from './relationship-audit';
export type {
  ZlozRelationshipAuditCode,
  ZlozEventStormingRelationshipAuditEntry,
  ZlozEventStormingRelationshipAudit,
} from './relationship-audit';
export { compareModelEventStormingRelationships } from './relationship-audit-comparison';
export type {
  ZlozRelationshipAuditFinding,
  ZlozRelationshipAuditSource,
  ZlozRelationshipAuditSelection,
  ZlozRelationshipAuditComparison,
  ZlozRelationshipAuditComparisonDecision,
} from './relationship-audit-comparison';
export {
  resolveAuditComparisonControls,
  resolveAuditComparisonRequest,
} from './audit-comparison-controls';
export type {
  ZlozAuditFindingKind,
  ZlozAuditComparisonState,
  ZlozAuditFindingFocusRequest,
  ZlozAuditComparisonRequest,
  ZlozAuditFindingItem,
  ZlozAuditFindingEntry,
  ZlozAuditEditionControl,
  ZlozAuditFindingFilter,
  ZlozAuditComparisonControlsOptions,
  ZlozAuditComparisonControlsContext,
  ZlozAuditComparisonDecision,
} from './audit-comparison-controls';

export { resolveContextMapRelationship, createContextMapPattern } from './context-map';
export type {
  ZlozContextMapRelationship,
  ZlozContextMapParticipant,
  ZlozContextMapBadge,
} from './context-map';
export {
  resolveDddRelationshipControls,
  resolveDddRelationshipRequest,
} from './ddd-relationship-controls';
export type {
  ZlozDddRelationshipRequest,
  ZlozDddRelationshipControlsContext,
  ZlozDddRelationshipControlsOptions,
  ZlozDddRelationshipChoice,
  ZlozDddUpstreamControl,
  ZlozDddDownstreamChoice,
  ZlozDddUpstreamRole,
  ZlozDddDownstreamRole,
  ZlozDddRelationshipEditDecision,
} from './ddd-relationship-controls';

export { previewEventStormingDddMapping } from './event-storming-ddd-preview';
export type {
  ZlozEventStormingDddMappingOptions,
  ZlozEventStormingDddNodePreview,
  ZlozEventStormingDddEdgePreview,
  ZlozEventStormingDddDisclosure,
  ZlozEventStormingDddPreview,
} from './event-storming-ddd-preview';

export {
  createEventStormingDddConversionPlan,
  resolveEventStormingDddConversionConsent,
} from './event-storming-ddd-conversion-plan';
export type {
  ZlozEventStormingDddConversionSource,
  ZlozEventStormingDddConversionBlocker,
  ZlozEventStormingDddConversionChanges,
  ZlozEventStormingDddConversionPlan,
  ZlozEventStormingDddLossConsent,
  ZlozEventStormingDddConversionConsentDecision,
} from './event-storming-ddd-conversion-plan';

export {
  applyEventStormingDddConversion,
  serializeEventStormingDddConversion,
  parseEventStormingDddConversion,
} from './event-storming-ddd-apply';
export type {
  ZlozEventStormingDddConversion,
  ZlozEventStormingDddApplyPolicy,
  ZlozEventStormingDddApplyOptions,
  ZlozEventStormingDddApplyResult,
} from './event-storming-ddd-apply';

export { resolveEdgeWaypointPreview } from './waypoint-interaction';

export { resolveEdgeWaypointControls } from './waypoint-controls';
export type {
  ZlozEdgeWaypointAction,
  ZlozEdgeWaypointHandleContext,
  ZlozEdgeWaypointControlsContext,
} from './waypoint-controls';

export { createPlacement, updatePlacement, resolvePlacement, applyPlacement } from './placement';
export type {
  ZlozPlacementSource,
  ZlozPlacementAnchor,
  ZlozPlacementIntent,
  ZlozPlacementTarget,
  ZlozPlacementTargetSample,
  ZlozPlacementContext,
  ZlozPlacement,
  ZlozPlacementEvent,
  ZlozPlacementRequest,
  ZlozPlacementSnap,
  ZlozPlacementCandidate,
  ZlozPlacementPolicy,
  ZlozPlacementPreview,
  ZlozPlacementResult,
} from './placement';

export {
  resolvePlacementControls,
  updatePlacementControls,
  placementForScope,
} from './placement-controls';
export type {
  ZlozPaletteEntry,
  ZlozPalettePolicy,
  ZlozPlacementInput,
  ZlozPlacementControlsContext,
} from './placement-controls';

export { captureSvgLayout } from './svg-layout';
export type { ZlozSvgLayoutSnapshot, ZlozSvgLayoutOptions } from './svg-layout';

export { planSvgExport } from './svg-export';
export type {
  ZlozSvgBounds,
  ZlozSvgRegion,
  ZlozSvgTarget,
  ZlozSvgRenderer,
  ZlozSvgRendererOverride,
  ZlozSvgAsset,
  ZlozSvgFont,
  ZlozSvgExportOptions,
  ZlozSvgFinding,
  ZlozSvgPaint,
  ZlozSvgThemeTokens,
  ZlozSvgExportPlan,
} from './svg-export';

export { writeSvgExport } from './svg-writer';
export type {
  ZlozSvgPrimitive,
  ZlozSvgAdapterContext,
  ZlozSvgAdapter,
  ZlozSvgWriteOptions,
  ZlozSvgWriteFinding,
  ZlozSvgWriteResult,
} from './svg-writer';

export {
  createSvgReview,
  svgReviewForScope,
  resolveSvgReview,
  updateSvgReview,
} from './svg-review';
export type {
  ZlozSvgReviewPreferences,
  ZlozSvgReviewState,
  ZlozSvgReviewChoice,
  ZlozSvgReviewRegion,
  ZlozSvgReviewContext,
  ZlozSvgReviewIdentity,
  ZlozSvgReviewRequest,
  ZlozSvgDownload,
  ZlozSvgReviewControls,
  ZlozSvgReviewUpdate,
} from './svg-review';

export { validateSvgFontResource } from './svg-font';
export type {
  ZlozSvgFontResource,
  ZlozSvgFontValidation,
  ZlozSvgFontFailureCode,
} from './svg-font';

export { inspectSvgFontCoverage } from './svg-font-coverage';
export type { ZlozSvgFontCoverage } from './svg-font-coverage';

export { captureModellingPatch, dryRunModellingPatch } from './modelling-patch';
export type {
  ZlozModellingPatchSource,
  ZlozModellingPatchProvenance,
  ZlozModellingPatchOperation,
  ZlozModellingPatch,
  ZlozModellingPatchChange,
  ZlozModellingPatchLoss,
  ZlozModellingPatchFinding,
  ZlozModellingPatchCandidate,
  ZlozModellingPatchPreview,
  ZlozModellingPatchOptions,
} from './modelling-patch';

export { parseModellingPatch } from './parse-modelling-patch';
export type {
  ZlozModellingPatchParseOptions,
  ZlozModellingPatchParseResult,
} from './parse-modelling-patch';

export {
  resolveModellingPatchReview,
  resolveModellingPatchAcknowledgement,
  applyModellingPatch,
} from './modelling-patch-apply';
export type {
  ZlozModellingPatchIdentity,
  ZlozModellingPatchConsent,
  ZlozModellingPatchApplyOptions,
  ZlozModellingPatchReceipt,
  ZlozModellingPatchReview,
  ZlozModellingPatchReviewRequest,
  ZlozModellingPatchApplyResult,
} from './modelling-patch-apply';

export {
  planPngExport,
  createPngReview,
  pngReviewForScope,
  resolvePngReview,
  updatePngReview,
} from './png-export';
export type {
  ZlozPngExportOptions,
  ZlozPngFinding,
  ZlozPngExportPlan,
  ZlozPngArtifact,
  ZlozPngRenderResult,
  ZlozPngExportInput,
  ZlozPngReviewContext,
  ZlozPngReviewState,
  ZlozPngReviewRequest,
  ZlozPngReviewControls,
  ZlozPngRenderPayload,
  ZlozPngDownload,
  ZlozPngReviewUpdate,
} from './png-export';

export {
  declaredConsumptionArchitecture,
  declaredConsumptionSourceRoles,
  isDeclaredConsumption,
  resolveDeclaredConsumption,
} from './declared-consumption';
export type {
  ZlozDeclaredConsumption,
  ZlozDeclaredConsumptionSourceRole,
  ZlozDeclaredConsumptionDecision,
} from './declared-consumption';

export {
  startLabelMeasurement,
  updateLabelMeasurements,
  resolveLabelMeasurements,
} from './label-measurement';
export type {
  ZlozLabelMeasurementRequest,
  ZlozLabelMeasurementResult,
  ZlozLabelMeasurements,
  ZlozLabelMeasurementContext,
} from './label-measurement';

export { resolveLayoutGroupHeader } from './group-header';

export {
  startGroupHeaderMeasurement,
  updateGroupHeaderMeasurements,
  resolveGroupHeaderMeasurements,
} from './group-header-measurement';
export type {
  ZlozGroupHeaderMeasurementRequest,
  ZlozGroupHeaderMeasurementResult,
  ZlozGroupHeaderMeasurements,
  ZlozGroupHeaderMeasurementContext,
} from './group-header-measurement';

export { compareModelDddRelationships } from './ddd-audit-comparison';
export type {
  ZlozDddRelationshipAuditFinding,
  ZlozDddRelationshipAuditSource,
  ZlozDddRelationshipAuditSelection,
  ZlozDddRelationshipAuditComparison,
  ZlozDddRelationshipAuditComparisonDecision,
} from './ddd-audit-comparison';
export { resolveDddAuditControls, resolveDddAuditRequest } from './ddd-audit-controls';
export type {
  ZlozDddAuditFindingKind,
  ZlozDddAuditState,
  ZlozDddAuditFindingFocusRequest,
  ZlozDddAuditRequest,
  ZlozDddAuditFindingItem,
  ZlozDddAuditFindingEntry,
  ZlozDddAuditEditionControl,
  ZlozDddAuditFindingFilter,
  ZlozDddAuditControlsOptions,
  ZlozDddAuditControlsContext,
  ZlozDddAuditDecision,
} from './ddd-audit-controls';

export { resolveEventStormingNodeSemantics } from './event-storming-workshop';
export type { ZlozEventStormingNodeSemantics } from './event-storming-workshop';
export type {
  EventStormingParticipantArchitecture,
  EventStormingHotspotArchitecture,
  EventStormingLaneArchitecture,
} from './architecture';

export { eventStormingWorkshopRelationshipRules } from './event-storming-relationships';

export {
  resolveEventStormingWorkshopControls,
  resolveEventStormingWorkshopRequest,
} from './workshop-controls';
export type {
  ZlozWorkshopScope,
  ZlozWorkshopRequest,
  ZlozWorkshopChoice,
  ZlozWorkshopSelect,
  ZlozWorkshopControlsContext,
  ZlozWorkshopControlsOptions,
  ZlozWorkshopDecision,
} from './workshop-controls';
export { createEventStormingWorkshopPattern } from './workshop-pattern';
