import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import {
  categoryIds,
  categoryLabels,
  demoNotice,
  ringIds,
  ringLabels,
  type RadarDataset,
  type RadarEntry,
} from '@opsydyn/effect-three-samples/radar/data';

import { svgMarkerActivation } from '../../ui/shared/svg-scene-input';
import {
  countRings,
  filterPositions,
  layoutEntries,
  projectRadar,
  type RadarMark,
} from './geometry';
import { Message } from './message';
import type { Model } from './model';
import { RadarPointerMount } from './mount';

import * as styles from './radar.css';

const colours = {
  techniques: '#087f8c',
  tools: '#397c4a',
  platforms: '#a56500',
  'languages-frameworks': '#bb2544',
};
function control(
  h: Html.H<Message>,
  label: string,
  symbol: string,
  message: Message,
): View.Content<Message> {
  return h.button
    .attrs({ class: styles.button, type: 'button', 'aria-label': label, title: label })
    .on('click', message)
    .children(h.span.attr('aria-hidden', 'true').children(symbol));
}
function marker(mark: RadarMark, model: Model, h: Html.H<Message>): View.Content<Message> {
  const selected = model.selection._tag === 'Selected' && model.selection.id === mark.entry.id;
  return h
    .el('g')
    .attrs({
      'data-blip-id': mark.entry.id,
      role: 'button',
      tabindex: String(0),
      'aria-label': `Select ${mark.entry.name}, ${categoryLabels[mark.entry.category]}, ${ringLabels[mark.entry.ring]}`,
      'aria-pressed': String(selected),
      style: `cursor:pointer`,
    })
    .key(mark.entry.id)
    .on(
      'keydown',
      svgMarkerActivation(Message.ClickedBlip({ id: mark.entry.id, keyboard: true })),
      { preventDefault: true },
    )
    .children(markerPaint(mark, selected, h));
}
function markerPaint(
  mark: RadarMark,
  selected: boolean,
  h: Html.H<Message>,
): View.Content<Message>[] {
  return [
    h.el('title').children(`${mark.entry.name} - ${ringLabels[mark.entry.ring]}`),
    ...(selected
      ? [
          h.el('circle').attrs({
            'data-selected-outline': 'true',
            cx: String(mark.x),
            cy: String(mark.y),
            r: '25',
            fill: 'none',
            stroke: 'var(--page-text)',
            'stroke-width': '2',
          }),
        ]
      : []),
    h.el('circle').attrs({
      cx: String(mark.x),
      cy: String(mark.y),
      r: '20',
      fill: colours[mark.entry.category],
      stroke: 'var(--page-bg)',
      'stroke-width': '2',
    }),
    h
      .el('text')
      .attrs({
        x: String(mark.x),
        y: String(mark.y),
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        fill: '#ffffff',
        style: `font-size:20px;font-weight:600;pointer-events:none`,
      })
      .children(String(mark.displayNumber)),
  ];
}
function scene(model: Model, dataset: RadarDataset, h: Html.H<Message>): View.Content<Message> {
  const filters = { query: model.query, category: model.category, rings: model.enabledRings };
  const projected = projectRadar(layoutEntries(dataset.entries), filters, {
    center: model.center,
    zoom: model.zoom,
  });
  const selectedId = model.selection._tag === 'Selected' ? model.selection.id : null;
  const selectedMarks = projected.marks.filter(({ entry }) => entry.id === selectedId);
  return h
    .el('svg')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attrs({
      class: styles.globe,
      viewBox: '0 0 600 600',
      role: 'group',
      tabindex: String(0),
      'aria-label': 'Functional and AI radar',
      'data-longitude': String(model.center[0]),
      'data-latitude': String(model.center[1]),
      'data-zoom': String(model.zoom),
    })
    .onMount(RadarPointerMount())
    .children(
      h.el('title').children('Functional and AI technology radar'),
      h
        .el('desc')
        .children(
          'Four wireframe shells: Adopt, Trial, Assess, Caution. Categories: Techniques, Tools, Platforms, Languages & Frameworks.',
        ),
      h.el('defs').children(
        h
          .el('clipPath')
          .attr('id', 'functional-ai-radar-viewport')
          .children(h.el('rect').attrs({ x: '0', y: '0', width: '600', height: '600' })),
      ),
      h
        .el('g')
        .attr('clip-path', 'url(#functional-ai-radar-viewport)')
        .children(
          ...projected.shells.map((shell) =>
            h
              .el('g')
              .attrs({
                'data-shell': shell.ring,
                'aria-hidden': 'true',
                style: `pointer-events:none`,
              })
              .children(
                h.el('circle').attrs({
                  'data-shell-outline': shell.ring,
                  cx: '300',
                  cy: '300',
                  r: String(shell.radius),
                  fill: 'none',
                  stroke: 'var(--chart-label)',
                  'stroke-width': shell.ring === 'caution' ? '1.5' : '1',
                  'stroke-opacity': '0.55',
                }),
                ...shell.segments.map((segment) =>
                  h.el('path').attrs({
                    d: segment.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(''),
                    fill: 'none',
                    stroke: 'var(--chart-label)',
                    'stroke-width': shell.ring === 'caution' ? '1.5' : '1',
                    'stroke-opacity': '0.55',
                  }),
                ),
              ),
          ),
          h
            .el('g')
            .key('radar-targets')
            .children(projected.marks.map((mark) => marker(mark, model, h))),
          h
            .el('g')
            .attrs({ 'aria-hidden': 'true', style: `pointer-events:none` })
            .key('radar-selection-paint')
            .children(
              selectedMarks.map((mark) =>
                h
                  .el('g')
                  .attr('data-selected-paint-id', mark.entry.id)
                  .children(markerPaint(mark, true, h)),
              ),
            ),
        ),
    );
}
function inspection(
  model: Model,
  dataset: RadarDataset,
  h: Html.H<Message>,
): View.Content<Message> {
  const selection = model.selection;
  const selected =
    selection._tag === 'Selected'
      ? dataset.entries.find(({ id }) => id === selection.id)
      : undefined;
  const content = selected
    ? [
        h.h2.attrs({ class: styles.name, 'data-summary-name': '' }).children(selected.name),
        h.p
          .attr('class', styles.summary)
          .children(
            h.span.attr('data-summary-category', '').children(categoryLabels[selected.category]),
            h.span.attr('data-summary-ring', '').children(ringLabels[selected.ring]),
          ),
        h.p.attr('class', styles.description).children(selected.description),
        h.a
          .attrs({ href: selected.sourceUrl, target: '_blank', rel: 'noopener noreferrer' })
          .children('Project source'),
      ]
    : [
        h.p.children(
          model.selection._tag === 'Cleared'
            ? 'Selection cleared by filters'
            : 'No technology selected',
        ),
      ];
  return h.section
    .attrs({
      class: styles.details,
      role: 'region',
      'aria-label': 'Selected technology',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    })
    .children(content);
}
function row(
  entry: RadarEntry,
  displayNumber: number,
  model: Model,
  h: Html.H<Message>,
): View.Content<Message> {
  const selected = model.selection._tag === 'Selected' && model.selection.id === entry.id;
  return h.tr
    .attrs({ 'data-entry-id': entry.id, 'aria-selected': String(selected) })
    .key(entry.id)
    .children(
      h.td.children(String(displayNumber)),
      h.td.children(
        h.button
          .attrs({ type: 'button', class: styles.inspect, 'aria-label': `Inspect ${entry.name}` })
          .on('click', Message.ClickedEntryRow({ id: entry.id }))
          .children(entry.name),
      ),
      h.td.children(categoryLabels[entry.category]),
      h.td.children(ringLabels[entry.ring]),
    );
}
function ready(model: Model, dataset: RadarDataset, h: Html.H<Message>): View.Content<Message> {
  const positions = layoutEntries(dataset.entries);
  const filters = { query: model.query, category: model.category, rings: model.enabledRings };
  const matches = filterPositions(positions, filters);
  const counts = countRings(positions, filters);
  return h.div.attr('class', styles.root).children(
    h.p.attr('class', styles.notice).children(demoNotice, ` / authored ${dataset.authoredOn}`),
    h.div.attr('class', styles.filters).children(
      h.label.attr('class', styles.field).children(
        'Search technologies',
        h.input
          .attrs({ class: styles.input, type: 'search', 'aria-label': 'Search technologies' })
          .value(model.query)
          .on('input', ({ value: query }) => Message.ChangedQuery({ query })),
      ),
      h.label.attr('class', styles.field).children(
        'Category',
        h.select
          .attrs({ class: styles.input, 'aria-label': 'Category' })
          .value(model.category)
          .on('change', ({ value }) =>
            Message.ChangedCategory({
              category:
                value === 'all'
                  ? 'all'
                  : (categoryIds.find((category) => category === value) ?? model.category),
            }),
          )
          .children(
            h.option.attr('value', 'all').children('All categories'),
            ...categoryIds.map((category) =>
              h.option.attr('value', category).children(categoryLabels[category]),
            ),
          ),
      ),
    ),
    h.fieldset.attrs({ class: styles.rings, 'aria-label': 'Rings' }).children(
      ringIds.map((ring) =>
        h.label.attr('class', styles.checkLabel).children(
          h.input
            .attrs({ type: 'checkbox', 'aria-label': `${ringLabels[ring]} (${counts[ring]})` })
            .checked(model.enabledRings.includes(ring))
            .on('click', Message.ClickedRing({ ring })),
          `${ringLabels[ring]} (${counts[ring]})`,
        ),
      ),
    ),
    h.div
      .attrs({ class: styles.toolbar, role: 'group', 'aria-label': 'Radar controls' })
      .children(
        control(h, 'Turn west', '\u2190', Message.ClickedTurn({ direction: 'west' })),
        control(h, 'Turn east', '\u2192', Message.ClickedTurn({ direction: 'east' })),
        control(h, 'Turn north', '\u2191', Message.ClickedTurn({ direction: 'north' })),
        control(h, 'Turn south', '\u2193', Message.ClickedTurn({ direction: 'south' })),
        control(h, 'Zoom in', '+', Message.ClickedZoomIn()),
        control(h, 'Zoom out', '\u2212', Message.ClickedZoomOut()),
        control(h, 'Reset view', '\u21ba', Message.ClickedResetView()),
        h.output.attr('aria-label', 'Zoom').children(`${model.zoom.toFixed(2)}x`),
        h.button
          .attrs({ class: styles.clear, type: 'button' })
          .on('click', Message.ClickedClearFilters())
          .children('Clear filters'),
      ),
    h.div
      .attr('class', styles.workspace)
      .children(inspection(model, dataset, h), scene(model, dataset, h)),
    h.div.attr('class', styles.legend).children(
      categoryIds.map((category) =>
        h.span.children(
          h.span.attrs({
            class: styles.swatch,
            style: `background:${colours[category]}`,
            'aria-hidden': 'true',
          }),
          categoryLabels[category],
        ),
      ),
    ),
    h.p.attr('class', styles.notice).children('Inner to outer: Adopt / Trial / Assess / Caution'),
    h.div
      .attr('class', styles.tableScroll)
      .children(
        h.table
          .attr('class', styles.table)
          .children(
            h.caption.children(
              `${matches.length} matching ${matches.length === 1 ? 'technology' : 'technologies'}`,
            ),
            h.thead.children(
              h.tr.children(
                ['#', 'Technology', 'Category', 'Ring'].map((heading) =>
                  h.th.attr('scope', 'col').children(heading),
                ),
              ),
            ),
            h.tbody.children(
              matches.map(({ entry, displayNumber }) => row(entry, displayNumber, model, h)),
            ),
          ),
        ...(matches.length === 0
          ? [
              h.p.children(
                dataset.entries.length === 0
                  ? 'No technologies in this demo dataset'
                  : 'No matching technologies',
              ),
            ]
          : []),
      ),
  );
}
export function view(model: Model, h: Html.H<Message>): View.Content<Message> {
  return model.data._tag === 'Ready'
    ? ready(model, model.data.dataset, h)
    : h.p.attr('role', 'alert').children(`Radar unavailable: ${model.data.reason}`);
}
