import { serializeGraph, validateGraph, ZlozError } from './graph';
import { groupHeaderPosition } from './group-header';
import { completeMeasuredBounds, measurementIsCurrent, type MeasuredBounds } from './measurement';
import type { EditorState, LayoutGroupHeader, LayoutGroupHeaderSpec } from './types';

export type ZlozGroupHeaderMeasurementRequest = Readonly<{
  requestId: string;
  revision: number;
  renderKey: string;
  source: string;
  headers: readonly LayoutGroupHeaderSpec[];
  collapsedGroups: readonly string[];
}>;
export type ZlozGroupHeaderMeasurementResult = Readonly<{
  requestId: string;
  revision: number;
  renderKey: string;
}> &
  (
    | Readonly<{ type: 'measured'; headers: readonly MeasuredBounds[] }>
    | Readonly<{ type: 'failed'; reason: string }>
  );
export type ZlozGroupHeaderMeasurements =
  | Readonly<{ type: 'idle' }>
  | Readonly<{ type: 'pending'; request: ZlozGroupHeaderMeasurementRequest }>
  | Readonly<{
      type: 'ready';
      request: ZlozGroupHeaderMeasurementRequest;
      groupHeaders: readonly LayoutGroupHeader[];
    }>
  | Readonly<{ type: 'failed'; request: ZlozGroupHeaderMeasurementRequest; reason: string }>;
export type ZlozGroupHeaderMeasurementContext =
  | Readonly<{ type: 'ready'; groupHeaders: readonly LayoutGroupHeader[] }>
  | Readonly<{ type: 'pending'; reason: string }>
  | Readonly<{ type: 'unavailable'; reason: string }>;
const copyHeaders = (headers: readonly LayoutGroupHeader[]) =>
  headers.map((header) => ({
    id: header.id,
    size: { ...header.size },
    padding: { ...header.padding },
    gap: header.gap,
  }));
const copySpecs = (headers: readonly LayoutGroupHeaderSpec[]) =>
  headers.map((header) => ({ id: header.id, padding: { ...header.padding }, gap: header.gap }));
function expanded(editor: EditorState, id: string): boolean {
  const nodes = new Map(editor.graph.nodes.map((node) => [node.id, node])),
    collapsed = new Set(editor.collapsedGroups),
    seen = new Set<string>();
  let node = nodes.get(id);
  while (node) {
    if (collapsed.has(node.id) || seen.has(node.id)) return false;
    seen.add(node.id);
    node = node.parentId ? nodes.get(node.parentId) : undefined;
  }
  return true;
}
function current(
  editor: EditorState,
  request: ZlozGroupHeaderMeasurementRequest,
  key: string,
): boolean {
  return (
    measurementIsCurrent(editor, request, key) &&
    request.collapsedGroups.length === new Set(editor.collapsedGroups).size &&
    request.collapsedGroups.every((id) => editor.collapsedGroups.includes(id)) &&
    request.headers.every((header) => expanded(editor, header.id))
  );
}
/** Specs provide identity/padding/gap. Measurements supply size; no layout or Undo is started. */
export function startGroupHeaderMeasurement(
  editor: EditorState,
  requestId: string,
  renderKey: string,
  headers: readonly LayoutGroupHeaderSpec[],
): ZlozGroupHeaderMeasurements {
  if (!renderKey.trim())
    throw new ZlozError(
      'invalid-layout',
      'Group heading measurement requires a nonempty renderer key',
    );
  validateGraph(editor.graph);
  if (
    !requestId.trim() ||
    !Number.isSafeInteger(editor.revision) ||
    editor.revision < 0 ||
    new Set(headers.map((header) => header.id)).size !== headers.length
  )
    throw new ZlozError(
      'invalid-layout',
      'Group heading measurement requires a valid request identity and unique groups',
    );
  for (const header of headers) {
    const node = editor.graph.nodes.find((node) => node.id === header.id);
    if (!node) throw new ZlozError('invalid-layout', 'Missing group heading target');
    groupHeaderPosition(node, header);
  }
  if (headers.some((header) => !expanded(editor, header.id)))
    throw new ZlozError(
      'invalid-layout',
      'Expand requested groups and their ancestors before measuring headings',
    );
  return {
    type: 'pending',
    request: {
      requestId,
      renderKey,
      revision: editor.revision,
      source: serializeGraph(editor.graph),
      headers: copySpecs(headers),
      collapsedGroups: [...new Set(editor.collapsedGroups)],
    },
  };
}
/** Ignore old completions before inspecting them; current partial/invalid batches fail together. */
export function updateGroupHeaderMeasurements(
  editor: EditorState,
  state: ZlozGroupHeaderMeasurements,
  key: string,
  result: ZlozGroupHeaderMeasurementResult,
): ZlozGroupHeaderMeasurements {
  if (
    state.type !== 'pending' ||
    !current(editor, state.request, key) ||
    result.requestId !== state.request.requestId ||
    result.revision !== state.request.revision ||
    result.renderKey !== state.request.renderKey
  )
    return state;
  const request = state.request;
  if (result.type === 'failed') return { type: 'failed', request, reason: result.reason };
  if (
    !completeMeasuredBounds(
      request.headers.map((header) => header.id),
      result.headers,
    )
  )
    return {
      type: 'failed',
      request,
      reason:
        'Measurement must contain every requested group heading once with positive finite bounds.',
    };
  const bounds = new Map(result.headers.map((bound) => [bound.id, bound.size]));
  const groupHeaders: LayoutGroupHeader[] = [];
  for (const header of request.headers) {
    const size = bounds.get(header.id),
      padding = header.padding;
    if (
      !size ||
      ![
        padding.left + size.width + padding.right,
        padding.top + size.height + header.gap + padding.bottom,
      ].every(Number.isFinite)
    )
      return {
        type: 'failed',
        request,
        reason: 'Measured group heading bounds overflowed valid layout geometry.',
      };
    groupHeaders.push({ ...header, size: { ...size } });
  }
  return { type: 'ready', request, groupHeaders: copyHeaders(groupHeaders) };
}

/** Recheck before starting layout and again before publication. Layout revision changes require another measurement. */
export function resolveGroupHeaderMeasurements(
  editor: EditorState,
  state: ZlozGroupHeaderMeasurements,
  key: string,
): ZlozGroupHeaderMeasurementContext {
  if (state.type === 'idle')
    return { type: 'unavailable', reason: 'Measure rendered group headings first.' };
  if (!current(editor, state.request, key))
    return {
      type: 'unavailable',
      reason: 'Preview, heading renderer or group visibility changed. Measure headings again.',
    };
  if (state.type === 'failed') return { type: 'unavailable', reason: state.reason };
  if (state.type === 'pending')
    return {
      type: 'pending',
      reason: 'Measuring rendered group headings… Cancel to keep the preview.',
    };
  return { type: 'ready', groupHeaders: copyHeaders(state.groupHeaders) };
}
