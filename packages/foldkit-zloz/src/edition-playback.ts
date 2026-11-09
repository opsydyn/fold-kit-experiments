import { ZlozError } from './graph';

type Timing = Readonly<{ intervalMs: number; reducedMotion: boolean }>;
type Position = Readonly<{ editionIds: readonly [string, ...string[]]; index: number }>;
/** Session-only cursor. Hosts retain editions/graphs and own the clock and lifecycle. */
export type ZlozEditionPlayback = Timing &
  (
    | Readonly<{ status: 'empty' }>
    | (Position & Readonly<{ status: 'paused' }>)
    | (Position & Readonly<{ status: 'playing'; elapsedMs: number }>)
  );
export type ZlozEditionPlaybackOptions = Readonly<{
  intervalMs?: number;
  /** Defaults true until the host supplies the reader's preference. */
  reducedMotion?: boolean;
}>;
export type ZlozEditionPlaybackEvent =
  | Readonly<{
      type: 'PlayClicked' | 'PauseClicked' | 'RewindClicked' | 'PreviousClicked' | 'NextClicked';
    }>
  | Readonly<{ type: 'EditionSelected'; id: string }>
  | Readonly<{ type: 'IntervalChanged'; intervalMs: number }>
  | Readonly<{ type: 'ReducedMotionChanged'; reducedMotion: boolean }>
  | Readonly<{ type: 'Elapsed'; milliseconds: number }>;
function validEditionId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function checkInterval(intervalMs: number): void {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0)
    throw new ZlozError('invalid-edit', 'Playback interval must be positive and finite.');
}
/** Explicit opt-in. Identity/order are pinned; replace the controller when the edition collection changes. */
export function createEditionPlayback(
  ids: readonly string[],
  options: ZlozEditionPlaybackOptions = {},
): ZlozEditionPlayback {
  const intervalMs = options.intervalMs ?? 2000;
  checkInterval(intervalMs);
  if (ids.some((id) => !validEditionId(id)) || new Set(ids).size !== ids.length)
    throw new ZlozError('invalid-edit', 'Playback edition IDs must be nonempty and unique.');
  const timing = { intervalMs, reducedMotion: options.reducedMotion ?? true };
  const [first, ...rest] = ids;
  return first === undefined
    ? { ...timing, status: 'empty' }
    : {
        ...timing,
        status: 'paused',
        editionIds: Object.freeze([first, ...rest] as const),
        index: 0,
      };
}
export function playbackEditionId(playback: ZlozEditionPlayback): string | null {
  return playback.status === 'empty' ? null : playback.editionIds[playback.index]!;
}
/** Null permits automatic play; manual stepping remains available with reduced motion. */
export function editionPlaybackReason(playback: ZlozEditionPlayback): string | null {
  if (playback.status === 'empty' || playback.editionIds.length < 2)
    return 'At least two editions are needed for automatic playback.';
  return playback.reducedMotion
    ? 'Automatic playback is paused for reduced motion. Use Previous, Next or Rewind.'
    : null;
}
function pauseAt(
  playback: Exclude<ZlozEditionPlayback, { status: 'empty' }>,
  index: number,
): ZlozEditionPlayback {
  if (playback.status === 'paused' && index === playback.index) return playback;
  return {
    status: 'paused',
    editionIds: playback.editionIds,
    index,
    intervalMs: playback.intervalMs,
    reducedMotion: playback.reducedMotion,
  };
}
/** At most one edition advances per elapsed event; overshoot is discarded to avoid catch-up bursts. */
export function updateEditionPlayback(
  playback: ZlozEditionPlayback,
  event: ZlozEditionPlaybackEvent,
): ZlozEditionPlayback {
  if (event.type === 'ReducedMotionChanged') {
    const next =
      event.reducedMotion && playback.status !== 'empty'
        ? pauseAt(playback, playback.index)
        : playback;
    return next.reducedMotion === event.reducedMotion
      ? next
      : { ...next, reducedMotion: event.reducedMotion };
  }
  if (event.type === 'IntervalChanged') {
    checkInterval(event.intervalMs);
    const next = playback.status === 'empty' ? playback : pauseAt(playback, playback.index);
    return next.intervalMs === event.intervalMs ? next : { ...next, intervalMs: event.intervalMs };
  }
  if (playback.status === 'empty') return playback;
  switch (event.type) {
    case 'PlayClicked':
      return editionPlaybackReason(playback) !== null || playback.status === 'playing'
        ? playback
        : {
            ...playback,
            status: 'playing',
            elapsedMs: 0,
            index: playback.index === playback.editionIds.length - 1 ? 0 : playback.index,
          };
    case 'PauseClicked':
      return pauseAt(playback, playback.index);
    case 'RewindClicked':
      return pauseAt(playback, 0);
    case 'PreviousClicked':
      return pauseAt(playback, Math.max(0, playback.index - 1));
    case 'NextClicked':
      return pauseAt(playback, Math.min(playback.editionIds.length - 1, playback.index + 1));
    case 'EditionSelected': {
      const index = playback.editionIds.indexOf(event.id);
      return index < 0 ? playback : pauseAt(playback, index);
    }
    case 'Elapsed': {
      if (playback.status !== 'playing') return playback;
      if (!Number.isFinite(event.milliseconds) || event.milliseconds < 0)
        throw new ZlozError(
          'invalid-edit',
          'Playback elapsed time must be nonnegative and finite.',
        );
      const elapsedMs = playback.elapsedMs + event.milliseconds;
      if (elapsedMs < playback.intervalMs)
        return event.milliseconds === 0 ? playback : { ...playback, elapsedMs };
      const index = Math.min(playback.index + 1, playback.editionIds.length - 1);
      return index === playback.editionIds.length - 1
        ? pauseAt(playback, index)
        : { ...playback, index, elapsedMs: 0 };
    }
  }
}
