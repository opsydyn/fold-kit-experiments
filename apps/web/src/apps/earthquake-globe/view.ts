import { interpolateRgbBasis } from '@opsydyn/foldkit-viz/math/color';
import { linear } from '@opsydyn/foldkit-viz/math/scale';
import { geoGraticule } from '@opsydyn/foldkit-viz/shape/geo';
import { clipGlobeLine, projectGlobePoint, type GlobeView } from '@opsydyn/foldkit-viz/shape/globe';
import { Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import type { DecodedSnapshot, Earthquake } from './data';
import { Message } from './message';
import type { Model } from './model';
import { globeEvents, GlobePointerMount } from './mount';

import * as styles from './globe.css';

const magnitudeRadius = linear({ domain: [-1, 8], range: [3, 10], clamp: true });
const depthColour = interpolateRgbBasis(['#35c7b1', '#eda847', '#dd596f']);
const graticule = geoGraticule(30);
const handledKeys = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  '+',
  '=',
  '-',
  'Home',
]);
const utc = (time: number) => new Date(time).toISOString();
const value = (number: number | null, unit = '') =>
  number === null ? 'Unknown' : `${number}${unit}`;

function control(h: HtmlBuilder<Message>, label: string, symbol: string, message: Message): Html {
  return h.button(
    [
      h.Class(styles.iconButton),
      h.Type('button'),
      h.AriaLabel(label),
      h.Title(label),
      h.OnClick(message),
    ],
    [h.span([h.Attribute('aria-hidden', 'true')], [symbol])],
  );
}

function scene(model: Model, snapshot: DecodedSnapshot, h: HtmlBuilder<Message>): Html {
  const view: GlobeView = { center: model.center, radius: 260 * model.zoom, translate: [300, 300] };
  const pointer = globeEvents.withMessage(h);
  const grid =
    graticule.type === 'GeometryCollection'
      ? graticule.geometries.flatMap((line) =>
          line.type === 'LineString' ? clipGlobeLine(line.coordinates, view) : [],
        )
      : [];
  const marks = snapshot.events.flatMap((event) => {
    const point = projectGlobePoint([event.longitude, event.latitude], view);
    if (!point.visible || point.x < 0 || point.x > 600 || point.y < 0 || point.y > 600) return [];
    const label = `Select earthquake ${event.id}`;
    const selected = event.id === model.selectedId;
    const fill =
      event.magnitude === null
        ? 'none'
        : event.depthKm === null
          ? 'var(--page-text)'
          : depthColour(Math.max(0, Math.min(700, event.depthKm)) / 700);
    return [
      h.g(
        [
          h.Key(event.id),
          h.Attribute('data-event-id', event.id),
          h.Role('button'),
          h.Tabindex(0),
          h.AriaLabel(label),
          h.AriaPressed(String(selected)),
          h.OnClick(Message.ClickedMarker({ id: event.id, keyboard: false })),
          h.OnKeyDownPreventDefault((key) =>
            key === 'Enter' || key === ' '
              ? Option.some(Message.ClickedMarker({ id: event.id, keyboard: true }))
              : Option.none(),
          ),
          h.Style({ cursor: 'pointer' }),
        ],
        [
          h.title(
            [],
            [
              `${event.place ?? event.id}: magnitude ${value(event.magnitude)}, depth ${value(event.depthKm, ' km')}`,
            ],
          ),
          h.circle(
            [
              h.Cx(String(point.x)),
              h.Cy(String(point.y)),
              h.R(String(event.magnitude === null ? 5 : magnitudeRadius(event.magnitude))),
              h.Fill(fill),
              h.Stroke('var(--page-text)'),
              h.StrokeWidth(selected ? '3' : '0.8'),
              h.StrokeDasharray(event.depthKm === null ? '2 2' : 'none'),
            ],
            [],
          ),
        ],
      ),
    ];
  });
  return h.svg(
    [
      h.Class(styles.globe),
      h.ViewBox('0 0 600 600'),
      h.Role('group'),
      h.Tabindex(0),
      h.AriaLabel('Earthquake globe'),
      h.Attribute('data-longitude', String(model.center[0])),
      h.Attribute('data-latitude', String(model.center[1])),
      h.Attribute('data-zoom', String(model.zoom)),
      h.OnMount(GlobePointerMount()),
      pointer.OnFoldkitGlobePointer((message) => message),
      h.OnKeyDownPreventDefault((key) =>
        handledKeys.has(key) ? Option.some(Message.PressedGlobeKey({ key })) : Option.none(),
      ),
    ],
    [
      h.title([], ['Recorded earthquake epicentres']),
      h.desc(
        [],
        [
          'Surface locations from the recorded USGS snapshot. Circle radius encodes magnitude; colour encodes depth in kilometres.',
        ],
      ),
      h.defs(
        [],
        [
          h.clipPath(
            [h.Id('earthquake-globe-disk')],
            [h.circle([h.Cx('300'), h.Cy('300'), h.R(String(view.radius))], [])],
          ),
        ],
      ),
      h.circle(
        [
          h.Cx('300'),
          h.Cy('300'),
          h.R(String(view.radius)),
          h.Fill('var(--card-bg)'),
          h.Stroke('var(--page-text)'),
          h.StrokeWidth('1'),
        ],
        [],
      ),
      h.g(
        [h.ClipPath('url(#earthquake-globe-disk)')],
        [
          ...grid.map((segment) =>
            h.path(
              [
                h.D(segment.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join('')),
                h.Fill('none'),
                h.Stroke('var(--chart-label)'),
                h.StrokeWidth('0.6'),
                h.Attribute('aria-hidden', 'true'),
              ],
              [],
            ),
          ),
          ...marks,
        ],
      ),
    ],
  );
}

function inspection(model: Model, snapshot: DecodedSnapshot, h: HtmlBuilder<Message>): Html {
  const selected = snapshot.events.find((event) => event.id === model.selectedId);
  const content: Html[] =
    selected === undefined
      ? [h.p([], ['No earthquake selected'])]
      : [
          h.h2([h.Class(styles.heading)], [selected.place ?? selected.id]),
          h.p([], [`Magnitude ${value(selected.magnitude)}`]),
          h.p([], [`Depth ${value(selected.depthKm, ' km')}`]),
          h.p([], [`${selected.latitude}, ${selected.longitude}`]),
          h.p([], [utc(selected.timeMs)]),
          ...(selected.url === null
            ? []
            : [
                h.a(
                  [h.Href(selected.url), h.Target('_blank'), h.Rel('noopener noreferrer')],
                  ['USGS event record'],
                ),
              ]),
        ];
  return h.section(
    [
      h.Class(styles.details),
      h.AriaLabel('Selected earthquake'),
      h.Attribute('aria-live', 'polite'),
      h.Attribute('aria-atomic', 'true'),
    ],
    content,
  );
}

function row(event: Earthquake, model: Model, h: HtmlBuilder<Message>): Html {
  return h.tr(
    [h.Key(event.id), h.Attribute('aria-selected', String(event.id === model.selectedId))],
    [
      h.td(
        [],
        [
          h.button(
            [
              h.Class(styles.inspect),
              h.Type('button'),
              h.AriaLabel(`Inspect ${event.id}`),
              h.OnClick(Message.ClickedEventRow({ id: event.id })),
            ],
            [event.id],
          ),
        ],
      ),
      h.td([], [value(event.magnitude)]),
      h.td([], [value(event.depthKm)]),
      h.td([], [utc(event.timeMs)]),
      h.td([], [event.place ?? 'Unknown']),
    ],
  );
}

function recorded(model: Model, snapshot: DecodedSnapshot, h: HtmlBuilder<Message>): Html {
  const excluded = Object.values(snapshot.excluded).reduce((total, count) => total + count, 0);
  const warnings = Object.entries(snapshot.warnings)
    .map(([reason, count]) => `${reason}: ${count}`)
    .join(', ');
  return h.div(
    [h.Class(styles.root)],
    [
      h.div(
        [h.Class(styles.toolbar), h.Role('group'), h.AriaLabel('Globe controls')],
        [
          control(h, 'Turn west', '\u2190', Message.ClickedTurn({ direction: 'west' })),
          control(h, 'Turn east', '\u2192', Message.ClickedTurn({ direction: 'east' })),
          control(h, 'Turn north', '\u2191', Message.ClickedTurn({ direction: 'north' })),
          control(h, 'Turn south', '\u2193', Message.ClickedTurn({ direction: 'south' })),
          control(h, 'Zoom in', '+', Message.ClickedZoomIn()),
          control(h, 'Zoom out', '\u2212', Message.ClickedZoomOut()),
          control(h, 'Reset globe', '\u21ba', Message.ClickedReset()),
          h.output([h.AriaLabel('Zoom')], [`${model.zoom.toFixed(2)}x`]),
        ],
      ),
      h.div(
        [h.Class(styles.workspace)],
        [
          h.div(
            [],
            [
              scene(model, snapshot, h),
              h.div(
                [h.Class(styles.legend)],
                ['Magnitude: -1 to 8 / radius 3 to 10 / hollow = unknown'],
              ),
              h.div(
                [h.Class(styles.legend)],
                [
                  h.span([], ['Depth (km)']),
                  ...[0, 350, 700].map((depth) =>
                    h.span(
                      [h.Class(styles.legend)],
                      [
                        h.span(
                          [
                            h.Class(styles.swatch),
                            h.Style({ background: depthColour(depth / 700) }),
                            h.Attribute('aria-hidden', 'true'),
                          ],
                          [],
                        ),
                        String(depth),
                      ],
                    ),
                  ),
                  h.span([], ['Dashed = unknown depth']),
                ],
              ),
            ],
          ),
          h.aside(
            [h.Class(styles.side)],
            [
              h.h2([h.Class(styles.heading)], ['Recorded USGS M2.5+ / seven days']),
              h.div(
                [h.Class(styles.metadata)],
                [
                  h.p(
                    [],
                    [
                      `${snapshot.events.length} accepted / ${excluded} excluded / ${snapshot.provenance.originalCount} original`,
                    ],
                  ),
                  h.p([], [`Captured: ${snapshot.provenance.capturedAt}`]),
                  h.p([], [`Generated: ${utc(snapshot.provenance.generatedAtMs)}`]),
                  h.p(
                    [],
                    [
                      snapshot.window === null
                        ? 'Observed-event span: empty'
                        : `Observed-event span: ${utc(snapshot.window[0])} to ${utc(snapshot.window[1])}`,
                    ],
                  ),
                  h.a(
                    [
                      h.Href(snapshot.provenance.sourceUrl),
                      h.Target('_blank'),
                      h.Rel('noopener noreferrer'),
                    ],
                    ['USGS snapshot source'],
                  ),
                  ...(warnings ? [h.p([], [warnings])] : []),
                  ...(excluded
                    ? [
                        h.p(
                          [],
                          [
                            Object.entries(snapshot.excluded)
                              .map(([reason, count]) => `${reason}: ${count}`)
                              .join(', '),
                          ],
                        ),
                      ]
                    : []),
                ],
              ),
              inspection(model, snapshot, h),
            ],
          ),
        ],
      ),
      ...(snapshot.events.length === 0
        ? [h.p([], ['No earthquakes in this recorded snapshot'])]
        : []),
      h.div(
        [h.Class(styles.tableScroll)],
        [
          h.table(
            [h.Class(styles.table)],
            [
              h.caption([], ['Recorded earthquakes']),
              h.thead(
                [],
                [
                  h.tr(
                    [],
                    ['Event', 'Magnitude', 'Depth (km)', 'Time (UTC)', 'Location'].map((label) =>
                      h.th([h.Attribute('scope', 'col')], [label]),
                    ),
                  ),
                ],
              ),
              h.tbody(
                [],
                snapshot.events.map((event) => row(event, model, h)),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}

export function view(model: Model, h: HtmlBuilder<Message>): Document {
  const body =
    model.data._tag === 'Failure'
      ? h.div(
          [h.Role('alert')],
          [h.p([], [model.data.reason]), h.a([h.Href('/charts')], ['Chart gallery'])],
        )
      : recorded(model, model.data.snapshot, h);
  return { title: 'Earthquake Globe - Astro + FoldKit', body };
}
