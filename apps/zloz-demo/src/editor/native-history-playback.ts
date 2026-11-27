import type { Html } from '@effect/ui/html';
import {
  editionScrubberRequest,
  playbackEditionId,
  resolveEditionPlaybackControls,
  resolveEditionScrubber,
  type ZlozPlaybackControlEvent,
} from '@opsydyn/foldkit-zloz';

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
    h.div
      .class('workbench-playback-transport')
      .attr('role', 'group')
      .attr('aria-label', 'Edition playback controls')
      .children(
        h.p
          .attr('role', 'status')
          .attr('aria-live', 'polite')
          .attr('aria-label', 'Edition playback status')
          .style({ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' })
          .children(
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
            playback.statusText,
          ),
        h.div.style({ display: 'flex', gap: '6px', flexWrap: 'wrap' }).children(
          ...(['play', 'pause', 'rewind', 'previous', 'next'] as const).map((name) => {
            const action = playback.actions[name];
            return h.button
              .key(name)
              .attr('type', 'button')
              .attr('aria-label', action.label)
              .disabled(action.disabled)
              .attr('aria-description', action.reason ?? undefined)
              .attr('title', action.reason ?? undefined)
              .style({
                display: 'inline-flex',
                gap: '6px',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: '999px',
                border: '1px solid var(--rule)',
                background: 'var(--panel)',
                color: 'var(--ink)',
              })
              .on('click', send(messages[action.event.type]()))
              .children(h.span.attr('aria-hidden', 'true').children(icons[name]), action.label);
          }),
        ),
        playback.reason &&
          h.p
            .attr('role', 'status')
            .attr('aria-live', 'polite')
            .attr('aria-label', 'Playback availability')
            .style({
              borderLeft: '2px solid var(--blue)',
              paddingLeft: '10px',
              color: 'var(--muted)',
            })
            .children(playback.reason),
      ),
    h.div
      .class('workbench-edition-scrubber')
      .attr('role', 'group')
      .attr('aria-label', 'Edition scrubber')
      .style({ padding: '12px 0', display: 'grid', gap: '8px' })
      .children(
        h.input
          .key('edition-scrubber')
          .attr('type', 'range')
          .attr('min', '0')
          .attr('max', String(Math.max(0, scrubber.entries.length - 1)))
          .attr('step', '1')
          .value(String(scrubber.current?.index ?? 0))
          .attr('aria-label', scrubber.label)
          .attr('aria-valuetext', scrubber.valueText)
          .disabled(scrubber.rangeReason !== null)
          .attr('aria-description', scrubber.rangeReason ?? undefined)
          .attr('title', scrubber.rangeReason ?? undefined)
          .style({ width: '100%', accentColor: 'var(--blue)' })
          .on('input', ({ value }) => seek(editionScrubberRequest(scrubber, value).editionId)),
        h.output
          .attr('aria-label', 'Selected edition')
          .attr('aria-live', 'off')
          .style({ display: 'block', fontWeight: '600', fontSize: '12px' })
          .children(h.span.attr('aria-hidden', 'true').children('◇ '), scrubber.valueText),
        scrubber.rangeReason &&
          h.p
            .attr('role', 'status')
            .attr('aria-live', 'polite')
            .attr('aria-label', 'Edition seek availability')
            .children(scrubber.rangeReason),
        h.button
          .attr('type', 'button')
          .attr('aria-label', 'Open edition')
          .disabled(scrubber.reason !== null || scrubber.current === null)
          .attr('aria-description', scrubber.reason ?? undefined)
          .style({ justifySelf: 'start', padding: '7px 12px', borderRadius: '999px' })
          .on('click', seek(scrubber.current?.editionId ?? null))
          .children('Open edition'),
      ),
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
