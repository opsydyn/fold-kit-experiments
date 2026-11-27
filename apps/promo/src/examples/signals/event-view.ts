import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import type { CartesianLayout } from '@opsydyn/foldkit-viz/chart/cartesian';
import { resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import { symbolPath } from '@opsydyn/foldkit-viz/shape/symbol';

import { exampleTheme } from '#example/frame';

import { utc } from './derive';
import {
  eventPosition,
  selectedEvent,
  selectedEventGuide,
  visibleEventGroups,
  type EventPosition,
} from './event-derive';
import { EventFeed, type SignalEvent } from './events';
import { Message } from './message';
import type { ChartRole, ReadyModel } from './model';
import { sourceFreshness } from './quality';

const positionText = {
  InView: 'In current view',
  OutsideView: 'Outside current view',
  OutsideBounds: 'Outside available time range',
} satisfies Readonly<Record<EventPosition, string>>;
const styleFor = (event: SignalEvent) =>
  resolveSeriesStyle(
    exampleTheme,
    { stroke: exampleTheme.focus, fill: exampleTheme.background, symbol: 'diamond' },
    {},
    {
      stroke: event.style.stroke ?? exampleTheme.focus,
      fill: event.style.fill ?? exampleTheme.background,
      symbol: event.style.symbol ?? 'diamond',
      dashPattern: event.style.dashPattern ?? '',
    },
  );
export function eventGuideLayers(
  model: ReadyModel,
  role: ChartRole,
  layout: CartesianLayout,
  h: Html.H<Message>,
): ReadonlyArray<View.Content<Message>> {
  const event = selectedEvent(model),
    guide = selectedEventGuide(model, role, layout);
  if (event === null || guide === null) return [];
  const style = styleFor(event);
  return [
    h
      .el('line')
      .attr('class', 'signal-event-guide')
      .attr('data-event-guide', event.id)
      .attr('aria-label', `Selected event: ${event.id} / ${utc(event.time)} / ${event.label}`)
      .attr('x1', String(guide.x))
      .attr('x2', String(guide.x))
      .attr('y1', String(guide.top))
      .attr('y2', String(guide.bottom))
      .attr('stroke', style.stroke)
      .attr('stroke-width', '1.5')
      .attr('stroke-dasharray', style.dashPattern || '6 2 1 2')
      .children(),
  ];
}
export function eventPanel(
  model: ReadyModel,
  layout: CartesianLayout,
  h: Html.H<Message>,
): View.Content<Message> {
  const selected = selectedEvent(model),
    groups = visibleEventGroups(model, layout);
  const detail = (event: SignalEvent): View.Content<Message> => {
    const position = eventPosition(model, event);
    const observation = model.records.find((record) => record.time === event.time);
    return h.article
      .key('selected-event')
      .attr('class', 'signal-event-selected')
      .children(
        h.h3.children('Selected event'),
        h.p.attr('class', 'signal-event-identity').children(`${event.id} / ${utc(event.time)}`),
        h.p.children(`${event.kind} · ${event.label}`),
        h.p.attr('class', 'signal-reading-detail').children(positionText[position]),
        h.dl.children(
          h.div.children(
            h.dt.children('Description'),
            h.dd.children(event.description ?? 'Description unspecified'),
          ),
          h.div.children(
            h.dt.children('Source reference'),
            h.dd.children(event.sourceRef ?? 'Source reference unspecified'),
          ),
        ),
        h.p
          .attr('class', 'signal-reading-detail')
          .children(
            observation
              ? `Exact observation: ${observation.id}`
              : 'No observation at this exact timestamp',
          ),
        h.p
          .attr('class', 'signal-reading-detail')
          .children(
            'Selected-event guide = exact selected event time. Temporal proximity is context, not proof of causation.',
          ),
        h.div.attr('class', 'signal-controls').children(
          h.button
            .attr('type', 'button')
            .on('click', Message.ClickedCentreEvent())
            .disabled(position === 'OutsideBounds')
            .children('Centre event'),
          h.button
            .attr('type', 'button')
            .on('click', Message.ClickedClearEvent())
            .children('Clear event'),
        ),
      );
  };
  return h.section.attr('class', 'signal-events').children(
    h.h2.key('heading').children('Events'),
    ...EventFeed.match(model.events, {
      NotSupplied: () => [
        h.p.attr('class', 'signal-reading-detail').children('No event feed supplied'),
      ],
      Invalid: ({ error }) => [
        h.p.children('Event feed unavailable'),
        h.p.attr('class', 'signal-reading-detail').children(error),
      ],
      Ready: ({ records, snapshot }) => [
        h.p
          .key('count')
          .attr('class', 'signal-event-count')
          .children(
            `${groups.reduce((count, group) => count + group.members.length, 0)} in view / ${records.length} recorded`,
          ),
        h.p
          .key('viewport')
          .attr('class', 'signal-reading-detail')
          .children(`View: ${utc(model.viewport[0])} → ${utc(model.viewport[1])}`),
        h
          .el('svg')
          .key('lane')
          .attr('class', 'signal-event-lane')
          .attr('viewBox', `0 0 ${layout.frame.width} 52`)
          .attr('width', String(layout.frame.width))
          .attr('height', '52')
          .attr('aria-hidden', 'true')
          .children(
            h
              .el('line')
              .attr('x1', String(layout.plot.left))
              .attr('x2', String(layout.plot.right))
              .attr('y1', '26')
              .attr('y2', '26')
              .attr('stroke', exampleTheme.axis)
              .attr('stroke-dasharray', '1 4')
              .children(),
            ...groups.map((group) => {
              const first = group.members[0];
              if (!first) return null;
              const style = styleFor(first),
                bundled = group.members.length > 1;
              return h
                .el('g')
                .key(group.key)
                .attr('class', bundled ? 'signal-event-bundle' : 'signal-event-mark')
                .attr('transform', `translate(${group.x} 26)`)
                .attr('data-event-group', group.key)
                .children(
                  ...(bundled
                    ? [
                        h
                          .el('path')
                          .attr('d', symbolPath('square', 64))
                          .attr('transform', 'translate(-2 -2)')
                          .attr('fill', exampleTheme.background)
                          .attr('stroke', exampleTheme.text)
                          .attr('stroke-width', '1.5')
                          .children(),
                        h
                          .el('path')
                          .attr('d', symbolPath('square', 64))
                          .attr('transform', 'translate(2 2)')
                          .attr('fill', exampleTheme.background)
                          .attr('stroke', exampleTheme.text)
                          .attr('stroke-width', '1.5')
                          .children(),
                      ]
                    : [
                        h
                          .el('path')
                          .attr('d', symbolPath(style.symbol, 64))
                          .attr('fill', style.fill)
                          .attr('stroke', style.stroke)
                          .attr('stroke-width', '1.5')
                          .attr('stroke-dasharray', style.dashPattern)
                          .children(),
                      ]),
                );
            }),
          ),
        ...(records.length === 0
          ? [h.p.key('empty-range').children('No events recorded')]
          : groups.length === 0
            ? [h.p.key('empty-range').children('No events in this time range')]
            : []),
        h.p
          .key('bundle-legend')
          .attr('class', 'signal-reading-detail')
          .children(
            'Overlapping squares = nearby events bundled for display. Each exact record remains individually selectable below.',
          ),
        h.p
          .key('source')
          .attr('class', 'signal-reading-detail')
          .children(
            `Event source: ${sourceFreshness(snapshot)} · ${snapshot.revision} · as of ${utc(snapshot.asOf)} · updated ${utc(snapshot.updatedAt)} · stale after ${snapshot.staleAfterMs} ms`,
          ),
        h.p
          .key('announcement')
          .attr('class', 'signal-event-announcement')
          .attr('aria-live', 'polite')
          .attr('aria-atomic', 'true')
          .children(
            selected
              ? `${selected.id} / ${utc(selected.time)} / ${selected.label}`
              : 'No event selected',
          ),
        ...(selected ? [detail(selected)] : []),
        h.details
          .key('browser')
          .attr('class', 'signal-event-browser')
          .children(
            h.summary.children(`Browse events (${records.length})`),
            h.ul
              .attr('class', 'signal-event-groups')
              .attr('aria-label', 'Visible event bundles')
              .children(
                groups
                  .filter((group) => group.members.length > 1)
                  .map((group) => {
                    const first = group.members[0],
                      last = group.members.at(-1);
                    if (!first || !last) return null;
                    return h.li
                      .key(group.key)
                      .children(
                        `${group.members.length} events · ${utc(first.time)} → ${utc(last.time)}`,
                      );
                  }),
              ),
            h.ol.attr('class', 'signal-event-list').children(
              records.map((event) =>
                h.li.key(event.id).children(
                  h.div
                    .attr('class', 'signal-event-list-copy')
                    .children(
                      h.p
                        .attr('class', 'signal-event-identity')
                        .children(`${utc(event.time)} / ${event.id}`),
                      h.p.children(`${event.kind} · ${event.label}`),
                      h.p
                        .attr('class', 'signal-reading-detail')
                        .children(positionText[eventPosition(model, event)]),
                    ),
                  h.button
                    .attr('type', 'button')
                    .attr('data-event-select', event.id)
                    .on('click', Message.ClickedEvent({ key: event.id }))
                    .attr('aria-pressed', String(selected?.id === event.id))
                    .attr(
                      'aria-label',
                      `Select event ${event.id}: ${event.label} / ${event.kind} / ${utc(event.time)}`,
                    )
                    .children(selected?.id === event.id ? 'Selected event' : 'Select event'),
                ),
              ),
            ),
          ),
      ],
    }),
  );
}
