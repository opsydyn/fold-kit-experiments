import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { interpolateRgbBasis } from '@opsydyn/foldkit-viz/math/color';
import { linear } from '@opsydyn/foldkit-viz/math/scale';
import { geoGraticule } from '@opsydyn/foldkit-viz/shape/geo';
import { clipGlobeLine, projectGlobePoint, type GlobeView } from '@opsydyn/foldkit-viz/shape/globe';

import { svgMarkerActivation } from '../../ui/shared/svg-scene-input';
import type { DecodedSnapshot, Earthquake } from './data';
import { Message } from './message';
import type { Model } from './model';
import { GlobePointerMount } from './mount';

import * as styles from './globe.css';

const magnitudeRadius = linear({ domain: [-1, 8], range: [3, 10], clamp: true });
const depthColour = interpolateRgbBasis(['#35c7b1', '#eda847', '#dd596f']);
const graticule = geoGraticule(30);
const utc = (time: number) => new Date(time).toISOString();
const value = (number: number | null, unit = '') =>
  number === null ? 'Unknown' : `${number}${unit}`;

function control(
  h: Html.H<Message>,
  label: string,
  symbol: string,
  message: Message,
): View.Content<Message> {
  return h.button
    .attrs({ class: styles.iconButton, type: 'button', 'aria-label': label, title: label })
    .on('click', message)
    .children(h.span.attr('aria-hidden', 'true').children(symbol));
}

function scene(model: Model, snapshot: DecodedSnapshot, h: Html.H<Message>): View.Content<Message> {
  const view: GlobeView = { center: model.center, radius: 260 * model.zoom, translate: [300, 300] };
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
      h
        .el('g')
        .attrs({
          'data-event-id': event.id,
          role: 'button',
          tabindex: String(0),
          'aria-label': label,
          'aria-pressed': String(selected),
          style: `cursor:pointer`,
        })
        .key(event.id)
        .on(
          'keydown',
          svgMarkerActivation(Message.ClickedMarker({ id: event.id, keyboard: true })),
          { preventDefault: true },
        )
        .children(
          h
            .el('title')
            .children(
              `${event.place ?? event.id}: magnitude ${value(event.magnitude)}, depth ${value(event.depthKm, ' km')}`,
            ),
          h.el('circle').attrs({
            cx: String(point.x),
            cy: String(point.y),
            r: String(event.magnitude === null ? 5 : magnitudeRadius(event.magnitude)),
            fill: fill,
            stroke: 'var(--page-text)',
            'stroke-width': selected ? '3' : '0.8',
            'stroke-dasharray': event.depthKm === null ? '2 2' : 'none',
          }),
        ),
    ];
  });
  return h
    .el('svg')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attrs({
      class: styles.globe,
      viewBox: '0 0 600 600',
      role: 'group',
      tabindex: String(0),
      'aria-label': 'Earthquake globe',
      'data-longitude': String(model.center[0]),
      'data-latitude': String(model.center[1]),
      'data-zoom': String(model.zoom),
    })
    .onMount(GlobePointerMount())
    .children(
      h.el('title').children('Recorded earthquake epicentres'),
      h
        .el('desc')
        .children(
          'Surface locations from the recorded USGS snapshot. Circle radius encodes magnitude; colour encodes depth in kilometres.',
        ),
      h.el('defs').children(
        h
          .el('clipPath')
          .attr('id', 'earthquake-globe-disk')
          .children(h.el('circle').attrs({ cx: '300', cy: '300', r: String(view.radius) })),
      ),
      h.el('circle').attrs({
        cx: '300',
        cy: '300',
        r: String(view.radius),
        fill: 'var(--card-bg)',
        stroke: 'var(--page-text)',
        'stroke-width': '1',
      }),
      h
        .el('g')
        .attr('clip-path', 'url(#earthquake-globe-disk)')
        .children(
          ...grid.map((segment) =>
            h.el('path').attrs({
              d: segment.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(''),
              fill: 'none',
              stroke: 'var(--chart-label)',
              'stroke-width': '0.6',
              'aria-hidden': 'true',
            }),
          ),
          ...marks,
        ),
    );
}

function inspection(
  model: Model,
  snapshot: DecodedSnapshot,
  h: Html.H<Message>,
): View.Content<Message> {
  const selected = snapshot.events.find((event) => event.id === model.selectedId);
  const content: View.Content<Message>[] =
    selected === undefined
      ? [h.p.children('No earthquake selected')]
      : [
          h.h2.attr('class', styles.heading).children(selected.place ?? selected.id),
          h.div
            .class(styles.summary)
            .children(
              h.span.children(`Magnitude ${value(selected.magnitude)}`),
              h.span.children(`Depth ${value(selected.depthKm, ' km')}`),
            ),
          h.p.children(`${selected.latitude}, ${selected.longitude}`),
          h.p.children(utc(selected.timeMs)),
          ...(selected.url === null
            ? []
            : [
                h.a
                  .attrs({ href: selected.url, target: '_blank', rel: 'noopener noreferrer' })
                  .children('USGS event record'),
              ]),
        ];
  return h.section
    .attrs({
      class: styles.details,
      'aria-label': 'Selected earthquake',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    })
    .children(content);
}

function row(event: Earthquake, model: Model, h: Html.H<Message>): View.Content<Message> {
  return h.tr
    .attr('aria-selected', String(event.id === model.selectedId))
    .key(event.id)
    .children(
      h.td.children(
        h.button
          .attrs({ class: styles.inspect, type: 'button', 'aria-label': `Inspect ${event.id}` })
          .on('click', Message.ClickedEventRow({ id: event.id }))
          .children(event.id),
      ),
      h.td.children(value(event.magnitude)),
      h.td.children(value(event.depthKm)),
      h.td.children(utc(event.timeMs)),
      h.td.children(event.place ?? 'Unknown'),
    );
}

function recorded(
  model: Model,
  snapshot: DecodedSnapshot,
  h: Html.H<Message>,
): View.Content<Message> {
  const excluded = Object.values(snapshot.excluded).reduce((total, count) => total + count, 0);
  const warnings = Object.entries(snapshot.warnings)
    .map(([reason, count]) => `${reason}: ${count}`)
    .join(', ');
  return h.div.attr('class', styles.root).children(
    h.div
      .attrs({ class: styles.toolbar, role: 'group', 'aria-label': 'Globe controls' })
      .children(
        control(h, 'Turn west', '\u2190', Message.ClickedTurn({ direction: 'west' })),
        control(h, 'Turn east', '\u2192', Message.ClickedTurn({ direction: 'east' })),
        control(h, 'Turn north', '\u2191', Message.ClickedTurn({ direction: 'north' })),
        control(h, 'Turn south', '\u2193', Message.ClickedTurn({ direction: 'south' })),
        control(h, 'Zoom in', '+', Message.ClickedZoomIn()),
        control(h, 'Zoom out', '\u2212', Message.ClickedZoomOut()),
        control(h, 'Reset globe', '\u21ba', Message.ClickedReset()),
        h.output.attr('aria-label', 'Zoom').children(`${model.zoom.toFixed(2)}x`),
      ),
    h.div.attr('class', styles.workspace).children(
      h.div.children(
        scene(model, snapshot, h),
        h.div
          .attr('class', styles.legend)
          .children('Magnitude: -1 to 8 / radius 3 to 10 / hollow = unknown'),
        h.div.attr('class', styles.legend).children(
          h.span.children('Depth (km)'),
          ...[0, 350, 700].map((depth) =>
            h.span.attr('class', styles.legend).children(
              h.span.attrs({
                class: styles.swatch,
                style: `background:${depthColour(depth / 700)}`,
                'aria-hidden': 'true',
              }),
              String(depth),
            ),
          ),
          h.span.children('Dashed = unknown depth'),
        ),
      ),
      h.aside.attr('class', styles.side).children(
        h.h2.attr('class', styles.heading).children('Recorded USGS M2.5+ / seven days'),
        h.div.attr('class', styles.metadata).children(
          h.p.children(
            `${snapshot.events.length} accepted / ${excluded} excluded / ${snapshot.provenance.originalCount} original`,
          ),
          h.p.children(`Captured: ${snapshot.provenance.capturedAt}`),
          h.p.children(`Generated: ${utc(snapshot.provenance.generatedAtMs)}`),
          h.p.children(
            snapshot.window === null
              ? 'Observed-event span: empty'
              : `Observed-event span: ${utc(snapshot.window[0])} to ${utc(snapshot.window[1])}`,
          ),
          h.a
            .attrs({
              href: snapshot.provenance.sourceUrl,
              target: '_blank',
              rel: 'noopener noreferrer',
            })
            .children('USGS snapshot source'),
          ...(warnings ? [h.p.children(warnings)] : []),
          ...(excluded
            ? [
                h.p.children(
                  Object.entries(snapshot.excluded)
                    .map(([reason, count]) => `${reason}: ${count}`)
                    .join(', '),
                ),
              ]
            : []),
        ),
        inspection(model, snapshot, h),
      ),
    ),
    ...(snapshot.events.length === 0
      ? [h.p.children('No earthquakes in this recorded snapshot')]
      : []),
    h.div
      .attr('class', styles.tableScroll)
      .children(
        h.table
          .attr('class', styles.table)
          .children(
            h.caption.children('Recorded earthquakes'),
            h.thead.children(
              h.tr.children(
                ['Event', 'Magnitude', 'Depth (km)', 'Time (UTC)', 'Location'].map((label) =>
                  h.th.attr('scope', 'col').children(label),
                ),
              ),
            ),
            h.tbody.children(snapshot.events.map((event) => row(event, model, h))),
          ),
      ),
  );
}

export function view(model: Model, h: Html.H<Message>): View.Content<Message> {
  return model.data._tag === 'Failure'
    ? h.div
        .attr('role', 'alert')
        .children(
          h.p.children(model.data.reason),
          h.a.attr('href', '/charts').children('Chart gallery'),
        )
    : recorded(model, model.data.snapshot, h);
}
