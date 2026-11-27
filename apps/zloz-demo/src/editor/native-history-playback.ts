import type { Html } from '@effect/ui/html';
import {
  playbackEditionId,
  resolveEditionPlaybackControls,
  resolveEditionScrubber,
  type ZlozPlaybackControlEvent,
} from '@opsydyn/foldkit-zloz';
import {
  editionScrubber,
  editionScrubberInput,
  editionScrubberReadout,
  editionSeekButton,
  playbackControl,
  playbackControls,
  playbackReason as playbackAvailability,
  playbackStatus,
} from '@opsydyn/foldkit-zloz/effect-ui';

import { Message } from './message';
import type { Model } from './model';
import { playbackInspectionReason, playbackReason } from './playback';

const icons = { play: '▶', pause: 'Ⅱ', rewind: '↶', previous: '←', next: '→' };
const messages = {
  PlayClicked: Message.ClickedPlaybackPlay,
  PauseClicked: Message.ClickedPlaybackPause,
  RewindClicked: Message.ClickedPlaybackRewind,
  PreviousClicked: Message.ClickedPlaybackPrevious,
  NextClicked: Message.ClickedPlaybackNext,
} satisfies Record<ZlozPlaybackControlEvent['type'], () => Message>;

export function historyPlayback<M>(h: Html.H<M>, model: Model, send: (message: Message) => M) {
  const enabled = model.historyPlayback;
  const toggle = h.label.class('workbench-field').children(
    h.input
      .attr('type', 'checkbox')
      .checked(enabled !== null)
      .on('click', send(Message.ClickedPlaybackEnabled())),
    'Enable edition playback',
  );
  const group = h.div.attr('role', 'group').attr('aria-label', 'Edition playback');
  if (!enabled) return group.children(toggle);

  const { cursor, session } = enabled;
  const editionNames = new Map(model.editions.map(({ id, name }) => [id, name]));
  const currentId = playbackEditionId(cursor);
  const blockedReason = playbackInspectionReason(model);
  const playback = resolveEditionPlaybackControls(cursor, {
    blockedReason,
    automaticReason: playbackReason(model),
    editionLabel: editionNames.get(currentId ?? '') ?? 'No editions',
  });
  const scrubber = resolveEditionScrubber(cursor, {
    blockedReason,
    labelEdition: (id) => editionNames.get(id) ?? id,
  });
  const seek = (editionId: string | null) =>
    send(Message.SelectedPlaybackEdition({ modelId: model.modelIdentity.id, session, editionId }));
  return group.children(
    toggle,
    playbackControls(h, playback, (event) => send(messages[event.type]()), {
      decorate: (panel) => panel.class('workbench-playback-transport'),
      renderStatus: (context, h) =>
        playbackStatus(
          h,
          context,
          (status) =>
            status.style({ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }),
          [
            h.span
              .attr('aria-hidden', 'true')
              .style({
                background: 'var(--blue)',
                color: 'white',
                padding: '3px 7px',
                borderRadius: '4px',
                fontSize: '10px',
                letterSpacing: '0.06em',
              })
              .children('TIMELINE'),
            context.statusText,
          ],
        ),
      renderControl: (action, h, sendEvent) =>
        playbackControl(
          h,
          action,
          sendEvent,
          (button) =>
            button.style({
              display: 'inline-flex',
              gap: '6px',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: '999px',
              border: '1px solid var(--rule)',
              background: 'var(--panel)',
              color: 'var(--ink)',
            }),
          [h.span.attr('aria-hidden', 'true').children(icons[action.name]), action.label],
        ),
      renderReason: (context, h) =>
        playbackAvailability(h, context, (reason) =>
          reason.style({
            borderLeft: '2px solid var(--blue)',
            paddingLeft: '10px',
            color: 'var(--muted)',
          }),
        ),
      renderLayout: ({ controls, status, reason }, _context, h) => [
        status,
        h.div.style({ display: 'flex', gap: '6px', flexWrap: 'wrap' }).children(controls),
        reason,
      ],
    }),
    editionScrubber(h, scrubber, (request) => seek(request.editionId), {
      decorate: (panel) =>
        panel.class('workbench-edition-scrubber').style({
          padding: '12px 0',
          display: 'grid',
          gap: '8px',
        }),
      renderInput: (context, h, onSeek) =>
        editionScrubberInput(h, context, onSeek, (input) =>
          input.style({ width: '100%', accentColor: 'var(--blue)' }),
        ),
      renderReadout: (context, h) =>
        editionScrubberReadout(
          h,
          context,
          (output) => output.style({ display: 'block', fontWeight: '600', fontSize: '12px' }),
          [h.span.attr('aria-hidden', 'true').children('◇ '), context.valueText],
        ),
      renderOpen: (context, h, onSeek) =>
        editionSeekButton(h, context, onSeek, (button) =>
          button.style({ justifySelf: 'start', padding: '7px 12px', borderRadius: '999px' }),
        ),
      renderLayout: ({ input, readout, reason, open }) => [input, readout, reason, open],
    }),
    h.label.class('workbench-field').children(
      'Edition interval',
      h.select
        .attr('aria-label', 'Edition interval')
        .value(String(cursor.intervalMs))
        .on('change', ({ value }) =>
          send(Message.SelectedPlaybackInterval({ intervalMs: Number(value) })),
        )
        .children(
          h.option.attr('value', '1000').children('1 second'),
          h.option.attr('value', '2000').children('2 seconds'),
          h.option.attr('value', '4000').children('4 seconds'),
        ),
    ),
    h.p.children(
      'Automatic playback pauses for reduced motion, hidden pages and manual inspection. Previous, Next and Rewind remain available. Ghost controls below remain yours.',
    ),
  );
}
