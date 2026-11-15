import { serializeGraph, ZlozError } from './graph';
import { copyMeasuredBounds, completeMeasuredBounds, measurementIsCurrent } from './measurement';
import type { EditorState, LayoutEdgeLabel } from './types';
/** Transient request. Use a fresh ID for every run; renderKey covers host renderer/content/theme changes. */
export type ZlozLabelMeasurementRequest = Readonly<{
  requestId: string;
  revision: number;
  renderKey: string;
  source: string;
  edgeIds: readonly string[];
}>;
export type ZlozLabelMeasurementResult = Readonly<{
  requestId: string;
  revision: number;
  renderKey: string;
}> &
  (
    | Readonly<{ type: 'measured'; labels: readonly LayoutEdgeLabel[] }>
    | Readonly<{ type: 'failed'; reason: string }>
  );
export type ZlozLabelMeasurements =
  | Readonly<{ type: 'idle' }>
  | Readonly<{ type: 'pending'; request: ZlozLabelMeasurementRequest }>
  | Readonly<{
      type: 'ready';
      request: ZlozLabelMeasurementRequest;
      labels: readonly LayoutEdgeLabel[];
    }>
  | Readonly<{ type: 'failed'; request: ZlozLabelMeasurementRequest; reason: string }>;
export type ZlozLabelMeasurementContext =
  | Readonly<{ type: 'ready'; edgeLabels: readonly LayoutEdgeLabel[] }>
  | Readonly<{ type: 'pending'; reason: string }>
  | Readonly<{ type: 'unavailable'; reason: string }>;
/** Does not edit the graph, start browser effects or arrange automatically. Store this state in your Model. */
export function startLabelMeasurement(
  editor: EditorState,
  requestId: string,
  renderKey: string,
  edgeIds: readonly string[] = editor.graph.edges.map((e) => e.id),
): ZlozLabelMeasurements {
  if (
    !requestId.trim() ||
    !renderKey.trim() ||
    new Set(edgeIds).size !== edgeIds.length ||
    edgeIds.some((id) => !editor.graph.edges.some((e) => e.id === id))
  )
    throw new ZlozError(
      'invalid-layout',
      'Label measurement requires a fresh nonempty identity, render key and unique existing edges',
    );
  return {
    type: 'pending',
    request: {
      requestId,
      renderKey,
      revision: editor.revision,
      source: serializeGraph(editor.graph),
      edgeIds: [...edgeIds],
    },
  };
}
/** Ignore old completions before inspecting their payload. Current invalid or partial batches fail atomically. */
export function updateLabelMeasurements(
  editor: EditorState,
  state: ZlozLabelMeasurements,
  renderKey: string,
  result: ZlozLabelMeasurementResult,
): ZlozLabelMeasurements {
  if (
    state.type !== 'pending' ||
    !measurementIsCurrent(editor, state.request, renderKey) ||
    result.requestId !== state.request.requestId ||
    result.revision !== state.request.revision ||
    result.renderKey !== state.request.renderKey
  )
    return state;
  const request = state.request;
  if (result.type === 'failed') return { type: 'failed', request, reason: result.reason };
  if (!completeMeasuredBounds(request.edgeIds, result.labels))
    return {
      type: 'failed',
      request,
      reason: 'Measurement must contain every requested label once with positive finite bounds.',
    };
  return { type: 'ready', request, labels: copyMeasuredBounds(result.labels) };
}
/** Recheck freshness immediately before creating the layout request; no partial or stale bounds escape. */
export function resolveLabelMeasurements(
  editor: EditorState,
  state: ZlozLabelMeasurements,
  renderKey: string,
): ZlozLabelMeasurementContext {
  if (state.type === 'idle')
    return { type: 'unavailable', reason: 'Measure rendered labels first.' };
  if (!measurementIsCurrent(editor, state.request, renderKey))
    return { type: 'unavailable', reason: 'Preview or renderer changed. Measure labels again.' };
  if (state.type === 'failed') return { type: 'unavailable', reason: state.reason };
  if (state.type === 'pending')
    return {
      type: 'pending',
      reason: 'Measuring rendered labels… Cancel to keep the previous preview.',
    };
  return { type: 'ready', edgeLabels: copyMeasuredBounds(state.labels) };
}
