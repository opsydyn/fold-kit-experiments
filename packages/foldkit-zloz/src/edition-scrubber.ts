import {
  playbackEditionId,
  type ZlozEditionPlayback,
  type ZlozEditionPlaybackEvent,
} from './edition-playback';

/** Identity intent, not a captured ordinal or a permission grant. Null represents invalid native input. */
export type ZlozEditionSeekRequest = Readonly<{ editionId: string | null }>;
export type ZlozEditionSeekDecision =
  | Readonly<{
      type: 'ready';
      event: Extract<ZlozEditionPlaybackEvent, { type: 'EditionSelected' }>;
    }>
  | Readonly<{ type: 'blocked'; reason: string }>
  | Readonly<{ type: 'ignored' }>;
export type ZlozEditionScrubberEntry = Readonly<{
  editionId: string;
  index: number;
  label: string;
}>;
export type ZlozEditionScrubberOptions = Readonly<{
  blockedReason?: string | null;
  label?: string;
  emptyLabel?: string;
  labelEdition?: (editionId: string, index: number) => string;
  formatValueText?: (entry: ZlozEditionScrubberEntry) => string;
}>;
export type ZlozEditionScrubberContext = Readonly<{
  entries: readonly ZlozEditionScrubberEntry[];
  current: ZlozEditionScrubberEntry | null;
  label: string;
  valueText: string;
  /** Host/empty restriction. A single edition can still be opened explicitly. */
  reason: string | null;
  /** Also disables the range when there is no alternate position. */
  rangeReason: string | null;
}>;
function restriction(value: string | null | undefined): string | null {
  return value === undefined || value === null
    ? null
    : value.trim() || 'Edition seeking is unavailable.';
}
/** Manual seek is independent of automatic playback and reduced-motion restrictions. */
export function resolveEditionScrubber(
  playback: ZlozEditionPlayback,
  options: ZlozEditionScrubberOptions = {},
): ZlozEditionScrubberContext {
  const entries =
    playback.status === 'empty'
      ? []
      : playback.editionIds.map((editionId, index) => ({
          editionId,
          index,
          label: options.labelEdition?.(editionId, index).trim() || editionId,
        }));
  const current = entries.find((entry) => entry.editionId === playbackEditionId(playback)) ?? null;
  const reason =
    restriction(options.blockedReason) ??
    (entries.length === 0 ? 'No editions are available.' : null);
  return {
    entries,
    current,
    label: options.label?.trim() || 'Seek edition',
    valueText: current
      ? options.formatValueText?.(current).trim() || current.label
      : options.emptyLabel?.trim() || 'No editions',
    reason,
    rangeReason: reason ?? (entries.length === 1 ? 'Only one edition is available.' : null),
  };
}
/** Translate canonical native range values to stable IDs before dispatch; never clamp malformed input. */
export function editionScrubberRequest(
  context: ZlozEditionScrubberContext,
  value: string,
): ZlozEditionSeekRequest {
  if (context.rangeReason !== null || !/^(0|[1-9]\d*)$/u.test(value)) return { editionId: null };
  const index = Number(value);
  return {
    editionId: Number.isSafeInteger(index) ? (context.entries[index]?.editionId ?? null) : null,
  };
}
/** Resolve again against the current cursor/policy in the host update, after host session checks. */
export function resolveEditionSeek(
  playback: ZlozEditionPlayback,
  request: ZlozEditionSeekRequest,
  options: Pick<ZlozEditionScrubberOptions, 'blockedReason'> = {},
): ZlozEditionSeekDecision {
  if (
    request.editionId === null ||
    playback.status === 'empty' ||
    !playback.editionIds.includes(request.editionId)
  )
    return { type: 'ignored' };
  const reason = restriction(options.blockedReason);
  return reason === null
    ? { type: 'ready', event: { type: 'EditionSelected', id: request.editionId } }
    : { type: 'blocked', reason };
}
