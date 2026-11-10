import {
  compareEditions,
  resolveHistoryChangeNavigator,
  resolveHistoryChangeFocus,
  fitNodes,
  updateHistoryReview,
  type ZlozHistoryComparison,
  type ZlozHistoryChangeFocusRequest,
} from '@opsydyn/foldkit-zloz';

import type { Model } from './model';
import { pauseHistoryPlayback, playbackInspectionReason } from './playback';

export function workbenchHistoryComparison(model: Model): ZlozHistoryComparison | null {
  const selected = model.editions.find((edition) => edition.id === model.historyReview?.editionId);
  const baseline = model.editions.find((edition) => edition.id === model.historyBaselineId);
  return selected && baseline && selected.id !== baseline.id
    ? compareEditions(baseline, selected)
    : null;
}
function navigationOptions(model: Model) {
  return {
    filters: model.historyChangeFilters,
    blockedReason: !model.historyReview
      ? 'Open an edition to inspect changes.'
      : !model.historyReview.editor.surface
        ? 'Waiting for the canvas measurement.'
        : playbackInspectionReason(model),
  };
}
export function historyChangeNavigatorContext(
  model: Model,
  comparison = workbenchHistoryComparison(model),
) {
  return resolveHistoryChangeNavigator(comparison, navigationOptions(model));
}
/** Recheck model scope, current comparison, filters and active-operation policy before changing only the review camera. */
export function focusWorkbenchHistoryChange(
  model: Model,
  input: ZlozHistoryChangeFocusRequest & Readonly<{ modelId: string; epoch: number }>,
): Model {
  const review = model.historyReview;
  if (
    input.modelId !== model.modelIdentity.id ||
    input.epoch !== model.modelEpoch ||
    !review ||
    model.sidebarSection !== 'history'
  )
    return model;
  const decision = resolveHistoryChangeFocus(
    workbenchHistoryComparison(model),
    input,
    navigationOptions(model),
  );
  if (decision.type === 'ignored') return model;
  if (decision.type === 'blocked') return { ...model, notice: decision.reason };
  const paused = pauseHistoryPlayback(model);
  if (decision.target.side === 'selected')
    return {
      ...paused,
      historyReview: updateHistoryReview(review, decision.target.event),
      notice: `Viewing ${decision.entry.summary}.`,
    };
  const { surface, fitViewPadding, zoomLimits, viewport } = review.editor;
  if (!surface) return model;
  const camera = fitNodes(
    decision.target.nodes,
    surface,
    Math.min(fitViewPadding, surface.width / 4, surface.height / 4),
    { ...zoomLimits, maxZoom: Math.min(zoomLimits.maxZoom, viewport.zoom) },
  );
  return {
    ...paused,
    historyReview: updateHistoryReview(review, { type: 'ViewportChanged', viewport: camera }),
    notice: `Viewing ${decision.entry.summary} at earlier geometry. Ghost visibility is unchanged.`,
  };
}
