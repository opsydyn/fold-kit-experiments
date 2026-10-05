import type { CartesianLayout } from '@opsydyn/foldkit-viz/chart/cartesian';
import { resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import { symbolPath } from '@opsydyn/foldkit-viz/shape/symbol';
import type { Html, HtmlBuilder } from 'foldkit/html';

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
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> {
  const event = selectedEvent(model),
    guide = selectedEventGuide(model, role, layout);
  if (event === null || guide === null) return [];
  const style = styleFor(event);
  return [
    h.line(
      [
        h.Class('signal-event-guide'),
        h.DataAttribute('event-guide', event.id),
        h.AriaLabel(`Selected event: ${event.id} / ${utc(event.time)} / ${event.label}`),
        h.X1(String(guide.x)),
        h.X2(String(guide.x)),
        h.Y1(String(guide.top)),
        h.Y2(String(guide.bottom)),
        h.Stroke(style.stroke),
        h.StrokeWidth('1.5'),
        h.StrokeDasharray(style.dashPattern || '6 2 1 2'),
      ],
      [],
    ),
  ];
}
export function eventPanel(
  model: ReadyModel,
  layout: CartesianLayout,
  h: HtmlBuilder<Message>,
): Html {
  const selected = selectedEvent(model),
    groups = visibleEventGroups(model, layout);
  const detail = (event: SignalEvent): Html => {
    const position = eventPosition(model, event);
    const observation = model.records.find((record) => record.time === event.time);
    return h.article(
      [h.Class('signal-event-selected')],
      [
        h.h3([], ['Selected event']),
        h.p([h.Class('signal-event-identity')], [`${event.id} / ${utc(event.time)}`]),
        h.p([], [`${event.kind} · ${event.label}`]),
        h.p([h.Class('signal-reading-detail')], [positionText[position]]),
        h.dl(
          [],
          [
            h.div(
              [],
              [
                h.dt([], ['Description']),
                h.dd([], [event.description ?? 'Description unspecified']),
              ],
            ),
            h.div(
              [],
              [
                h.dt([], ['Source reference']),
                h.dd([], [event.sourceRef ?? 'Source reference unspecified']),
              ],
            ),
          ],
        ),
        h.p(
          [h.Class('signal-reading-detail')],
          [
            observation
              ? `Exact observation: ${observation.id}`
              : 'No observation at this exact timestamp',
          ],
        ),
        h.p(
          [h.Class('signal-reading-detail')],
          [
            'Dash-dot guide = exact selected event time. Temporal proximity is context, not proof of causation.',
          ],
        ),
        h.div(
          [h.Class('signal-controls')],
          [
            h.button(
              [
                h.Type('button'),
                h.OnClick(Message.ClickedCentreEvent()),
                h.Disabled(position === 'OutsideBounds'),
              ],
              ['Centre event'],
            ),
            h.button([h.Type('button'), h.OnClick(Message.ClickedClearEvent())], ['Clear event']),
          ],
        ),
      ],
    );
  };
  return h.section(
    [h.Class('signal-events')],
    [
      h.h2([], ['Events']),
      ...EventFeed.match(model.events, {
        NotSupplied: () => [h.p([h.Class('signal-reading-detail')], ['No event feed supplied'])],
        Invalid: ({ error }) => [
          h.p([], ['Event feed unavailable']),
          h.p([h.Class('signal-reading-detail')], [error]),
        ],
        Ready: ({ records, snapshot }) => [
          h.p(
            [h.Class('signal-event-count')],
            [
              `${groups.reduce((count, group) => count + group.members.length, 0)} in view / ${records.length} recorded`,
            ],
          ),
          h.p(
            [h.Class('signal-reading-detail')],
            [`View: ${utc(model.viewport[0])} → ${utc(model.viewport[1])}`],
          ),
          h.svg(
            [
              h.Class('signal-event-lane'),
              h.ViewBox(`0 0 ${layout.frame.width} 52`),
              h.Width(String(layout.frame.width)),
              h.Height('52'),
              h.AriaHidden(true),
            ],
            [
              h.line(
                [
                  h.X1(String(layout.plot.left)),
                  h.X2(String(layout.plot.right)),
                  h.Y1('26'),
                  h.Y2('26'),
                  h.Stroke(exampleTheme.axis),
                  h.StrokeDasharray('1 4'),
                ],
                [],
              ),
              ...groups.map((group) => {
                const first = group.members[0];
                if (!first) return null;
                const style = styleFor(first),
                  bundled = group.members.length > 1;
                return h.g(
                  [
                    h.Key(group.key),
                    h.Class(bundled ? 'signal-event-bundle' : 'signal-event-mark'),
                    h.Transform(`translate(${group.x} 26)`),
                    h.DataAttribute('event-group', group.key),
                  ],
                  [
                    ...(bundled
                      ? [
                          h.path(
                            [
                              h.D(symbolPath('square', 64)),
                              h.Transform('translate(-2 -2)'),
                              h.Fill(exampleTheme.background),
                              h.Stroke(exampleTheme.text),
                              h.StrokeWidth('1.5'),
                            ],
                            [],
                          ),
                          h.path(
                            [
                              h.D(symbolPath('square', 64)),
                              h.Transform('translate(2 2)'),
                              h.Fill(exampleTheme.background),
                              h.Stroke(exampleTheme.text),
                              h.StrokeWidth('1.5'),
                            ],
                            [],
                          ),
                        ]
                      : [
                          h.path(
                            [
                              h.D(symbolPath(style.symbol, 64)),
                              h.Fill(style.fill),
                              h.Stroke(style.stroke),
                              h.StrokeWidth('1.5'),
                              h.StrokeDasharray(style.dashPattern),
                            ],
                            [],
                          ),
                        ]),
                  ],
                );
              }),
            ],
          ),
          ...(records.length === 0
            ? [h.p([], ['No events recorded'])]
            : groups.length === 0
              ? [h.p([], ['No events in this time range'])]
              : []),
          h.p(
            [h.Class('signal-reading-detail')],
            [
              'Overlapping squares = nearby events bundled for display. Each exact record remains individually selectable below.',
            ],
          ),
          h.p(
            [h.Class('signal-reading-detail')],
            [
              `Event source: ${sourceFreshness(snapshot)} · ${snapshot.revision} · as of ${utc(snapshot.asOf)} · updated ${utc(snapshot.updatedAt)} · stale after ${snapshot.staleAfterMs} ms`,
            ],
          ),
          h.p(
            [
              h.Class('signal-event-announcement'),
              h.AriaLive('polite'),
              h.Attribute('aria-atomic', 'true'),
            ],
            [
              selected
                ? `${selected.id} / ${utc(selected.time)} / ${selected.label}`
                : 'No event selected',
            ],
          ),
          ...(selected ? [detail(selected)] : []),
          h.details(
            [h.Class('signal-event-browser')],
            [
              h.summary([], [`Browse events (${records.length})`]),
              h.ul(
                [h.Class('signal-event-groups'), h.AriaLabel('Visible event bundles')],
                groups
                  .filter((group) => group.members.length > 1)
                  .map((group) => {
                    const first = group.members[0],
                      last = group.members.at(-1);
                    if (!first || !last) return null;
                    return h.li(
                      [h.Key(group.key)],
                      [`${group.members.length} events · ${utc(first.time)} → ${utc(last.time)}`],
                    );
                  }),
              ),
              h.ol(
                [h.Class('signal-event-list')],
                records.map((event) =>
                  h.li(
                    [h.Key(event.id)],
                    [
                      h.div(
                        [h.Class('signal-event-list-copy')],
                        [
                          h.p(
                            [h.Class('signal-event-identity')],
                            [`${utc(event.time)} / ${event.id}`],
                          ),
                          h.p([], [`${event.kind} · ${event.label}`]),
                          h.p(
                            [h.Class('signal-reading-detail')],
                            [positionText[eventPosition(model, event)]],
                          ),
                        ],
                      ),
                      h.button(
                        [
                          h.Type('button'),
                          h.DataAttribute('event-select', event.id),
                          h.OnClick(Message.ClickedEvent({ key: event.id })),
                          h.Attribute('aria-pressed', String(selected?.id === event.id)),
                          h.AriaLabel(
                            `Select event ${event.id}: ${event.label} / ${event.kind} / ${utc(event.time)}`,
                          ),
                        ],
                        [selected?.id === event.id ? 'Selected event' : 'Select event'],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      }),
    ],
  );
}
