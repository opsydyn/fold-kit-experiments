import {
  createEditionPlayback,
  updateEditionPlayback,
  playbackEditionId,
  editionPlaybackReason,
  createHistoryReview,
  updateHistoryReview,
  type EditorEvent,
  type ZlozEditionPlaybackEvent,
} from '@opsydyn/foldkit-zloz';

import type { Message } from './message';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';

export function playbackInspectionReason(model: Model): string | null {
  return modelSessionBusy(model) ||
    model.editionRestore !== null ||
    (model.historyReview !== null && model.historyReview.editor.gesture.type !== 'idle')
    ? 'Finish active edits, imports or layout before playback.'
    : null;
}
export function playbackReason(model: Model): string | null {
  if (!model.historyPlayback) return 'Enable edition playback to use the transport.';
  if (model.playbackReducedMotion === null) return 'Waiting for the reduced-motion preference.';
  if (!model.playbackVisible) return 'Playback is paused while this page is hidden.';
  return playbackInspectionReason(model) ?? editionPlaybackReason(model.historyPlayback.cursor);
}
export function pauseHistoryPlayback(model: Model): Model {
  const playback = model.historyPlayback;
  return !playback || playback.cursor.status !== 'playing'
    ? model
    : {
        ...model,
        playbackRun: model.playbackRun + 1,
        historyPlayback: {
          ...playback,
          cursor: updateEditionPlayback(playback.cursor, { type: 'PauseClicked' }),
        },
      };
}
export function toggleHistoryPlayback(model: Model): Model {
  return {
    ...model,
    playbackRun: model.playbackRun + 1,
    historyPlayback: model.historyPlayback
      ? null
      : {
          editions: model.editions,
          cursor: initialCursor(model),
        },
  };
}
function initialCursor(model: Model) {
  const cursor = createEditionPlayback(
    model.editions.map((edition) => edition.id),
    {
      intervalMs: model.historyPlayback?.cursor.intervalMs ?? 2000,
      reducedMotion: model.playbackReducedMotion !== false,
    },
  );
  return model.historyReview
    ? updateEditionPlayback(cursor, { type: 'EditionSelected', id: model.historyReview.editionId })
    : cursor;
}
export function controlHistoryPlayback(model: Model, event: ZlozEditionPlaybackEvent): Model {
  const playback = model.historyPlayback;
  if (!playback) return model;
  if (
    event.type !== 'PauseClicked' &&
    event.type !== 'ReducedMotionChanged' &&
    event.type !== 'IntervalChanged'
  ) {
    const reason = playbackInspectionReason(model);
    if (reason !== null) return { ...pauseHistoryPlayback(model), notice: reason };
  }
  if (event.type === 'PlayClicked') {
    const reason = playbackReason(model);
    if (reason !== null) return { ...model, notice: reason };
  }
  const cursor = updateEditionPlayback(playback.cursor, event);
  const next = {
    ...model,
    historyPlayback: { ...playback, cursor },
    playbackRun: model.playbackRun + (event.type === 'Elapsed' ? 0 : 1),
  };
  if (['PauseClicked', 'ReducedMotionChanged', 'IntervalChanged'].includes(event.type)) return next;
  const id = playbackEditionId(cursor);
  if (!id || id === model.historyReview?.editionId) return next;
  const index = model.editions.findIndex((edition) => edition.id === id);
  const edition = model.editions[index];
  if (!edition) return pauseHistoryPlayback(next);
  const source = model.historyReview
    ? { ...model.editor, surface: model.historyReview.editor.surface }
    : model.editor;
  const review = createHistoryReview(edition, source);
  return {
    ...next,
    modelEpoch: model.modelEpoch + 1,
    historyReview: edition.snapshot.viewport
      ? review
      : updateHistoryReview(review, { type: 'FitViewClicked' }),
    historyBaselineId: model.editions[index - 1]?.id ?? null,
    editionRestore: null,
    notice: 'Edition playback: read-only. The working model and Undo are preserved.',
  };
}
export function tickHistoryPlayback(
  model: Model,
  input: Readonly<{ modelId: string; run: number; milliseconds: number }>,
): Model {
  const playback = model.historyPlayback;
  // Reject stale scope before inspecting elapsed payloads, including same-model return trips.
  if (
    !playback ||
    input.modelId !== model.modelIdentity.id ||
    input.run !== model.playbackRun ||
    playback.cursor.status !== 'playing'
  )
    return model;
  if (playback.editions !== model.editions || playbackReason(model) !== null)
    return pauseHistoryPlayback(model);
  return controlHistoryPlayback(model, { type: 'Elapsed', milliseconds: input.milliseconds });
}
export function reconcileHistoryPlayback(before: Model, after: Model): Model {
  if (!after.historyPlayback) return after;
  if (before.modelIdentity.id !== after.modelIdentity.id)
    return { ...after, historyPlayback: null, playbackRun: after.playbackRun + 1 };
  if (after.historyPlayback.editions !== after.editions)
    return {
      ...after,
      playbackRun: after.playbackRun + 1,
      historyPlayback: { editions: after.editions, cursor: initialCursor(after) },
    };
  return before.editor.graph !== after.editor.graph ||
    (before.historyReview !== null && after.historyReview === null)
    ? pauseHistoryPlayback(after)
    : after;
}
/** Passive measurements cannot interrupt playback; direct inspection always can. */
export function playbackInterruptedBy(message: Message): boolean {
  if (message._tag === 'ObservedZlozInput' || message._tag === 'ObservedModelInput') {
    // SAFETY: scoped canvas callbacks emit EditorEvent and the caller checks model scope first.
    const event = message.message as EditorEvent;
    return event.type !== 'SurfaceMeasured' && event.type !== 'FitViewAnimationFrame';
  }
  if (message._tag === 'SelectedWorkbenchSection') return message.section !== 'history';
  return new Set<string>([
    'ChangedForkName',
    'SelectedHistoryEdition',
    'ClickedHistoryPresent',
    'SelectedHistoryBaseline',
    'SelectedWorkingModel',
    'ClickedForkEdition',
    'ChoseModelDocumentFiles',
    'ChoseEditionArchiveFiles',
    'ClickedPreviewEditionRestore',
    'ClickedConfirmEditionRestore',
    'ClickedOrderHistory',
    'ClickedCaptureEdition',
    'SelectedExample',
    'ClickedInsertPattern',
    'ClickedLoad',
    'ChoseImportFiles',
    'ClickedArrange',
  ]).has(message._tag);
}
