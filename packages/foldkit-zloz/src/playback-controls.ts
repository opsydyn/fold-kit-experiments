import {
  editionPlaybackReason,
  playbackEditionId,
  type ZlozEditionPlayback,
  type ZlozEditionPlaybackEvent,
} from './edition-playback';

export type ZlozPlaybackControlName = 'play' | 'pause' | 'rewind' | 'previous' | 'next';
export type ZlozPlaybackControlEvent = Extract<
  ZlozEditionPlaybackEvent,
  { type: 'PlayClicked' | 'PauseClicked' | 'RewindClicked' | 'PreviousClicked' | 'NextClicked' }
>;
export type ZlozPlaybackControl = Readonly<{
  name: ZlozPlaybackControlName;
  label: string;
  event: ZlozPlaybackControlEvent;
  disabled: boolean;
  reason: string | null;
}>;
export type ZlozPlaybackControlsContext = Readonly<{
  playback: ZlozEditionPlayback;
  editionId: string | null;
  editionLabel: string | null;
  statusText: string;
  reason: string | null;
  actions: Readonly<Record<ZlozPlaybackControlName, ZlozPlaybackControl>>;
}>;
export type ZlozPlaybackControlsOptions = Readonly<{
  /** Host restriction on play and manual navigation. Pause remains available while playing. */
  blockedReason?: string | null;
  /** Additional host restriction on automatic play only, such as visibility or preference readiness. */
  automaticReason?: string | null;
  editionLabel?: string;
  labels?: Readonly<Partial<Record<ZlozPlaybackControlName, string>>>;
}>;
const labels = {
  play: 'Play editions',
  pause: 'Pause editions',
  rewind: 'Rewind editions',
  previous: 'Previous edition',
  next: 'Next edition',
};
function reason(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : value.trim() || 'Playback is unavailable.';
}
/** Pure view projection. Restrictions add vetoes; never treat derived actions as permission grants in an update. */
export function resolveEditionPlaybackControls(
  playback: ZlozEditionPlayback,
  options: ZlozPlaybackControlsOptions = {},
): ZlozPlaybackControlsContext {
  const blocked = reason(options.blockedReason);
  const automatic = blocked ?? reason(options.automaticReason) ?? editionPlaybackReason(playback);
  const empty = playback.status === 'empty';
  const unavailable = blocked ?? (empty ? 'No editions are available.' : null);
  const action = (
    name: ZlozPlaybackControlName,
    event: ZlozPlaybackControlEvent,
    reason: string | null,
  ): ZlozPlaybackControl => ({
    name,
    event,
    reason,
    disabled: reason !== null,
    label: options.labels?.[name]?.trim() || labels[name],
  });
  const editionId = playbackEditionId(playback);
  const editionLabel = options.editionLabel ?? editionId;
  const status = empty ? 'No editions' : playback.status === 'playing' ? 'Playing' : 'Paused';
  return {
    playback,
    editionId,
    editionLabel,
    statusText: empty || !editionLabel ? status : `${status} · ${editionLabel}`,
    reason: automatic,
    actions: {
      play: action(
        'play',
        { type: 'PlayClicked' },
        automatic ?? (playback.status === 'playing' ? 'Playback is already running.' : null),
      ),
      pause: action(
        'pause',
        { type: 'PauseClicked' },
        playback.status === 'playing' ? null : 'Playback is already paused.',
      ),
      rewind: action('rewind', { type: 'RewindClicked' }, unavailable),
      previous: action(
        'previous',
        { type: 'PreviousClicked' },
        unavailable ?? (!empty && playback.index === 0 ? 'Already at the first edition.' : null),
      ),
      next: action(
        'next',
        { type: 'NextClicked' },
        unavailable ??
          (!empty && playback.index === playback.editionIds.length - 1
            ? 'Already at the last edition.'
            : null),
      ),
    },
  };
}
