import { Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import {
  categoryIds,
  categoryLabels,
  demoNotice,
  ringIds,
  ringLabels,
  type RadarDataset,
  type RadarEntry,
} from './data';
import {
  countRings,
  filterPositions,
  layoutEntries,
  projectRadar,
  type RadarMark,
} from './geometry';
import { Message } from './message';
import type { Model } from './model';
import { radarEvents, RadarPointerMount } from './mount';

import * as styles from './radar.css';

const colours = {
  techniques: '#087f8c',
  tools: '#397c4a',
  platforms: '#a56500',
  'languages-frameworks': '#bb2544',
};
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
function control(h: HtmlBuilder<Message>, label: string, symbol: string, message: Message): Html {
  return h.button(
    [
      h.Class(styles.button),
      h.Type('button'),
      h.AriaLabel(label),
      h.Title(label),
      h.OnClick(message),
    ],
    [h.span([h.Attribute('aria-hidden', 'true')], [symbol])],
  );
}
function marker(mark: RadarMark, model: Model, h: HtmlBuilder<Message>): Html {
  const selected = model.selection._tag === 'Selected' && model.selection.id === mark.entry.id;
  return h.g(
    [
      h.Key(mark.entry.id),
      h.Attribute('data-blip-id', mark.entry.id),
      h.Role('button'),
      h.Tabindex(0),
      h.AriaLabel(
        `Select ${mark.entry.name}, ${categoryLabels[mark.entry.category]}, ${ringLabels[mark.entry.ring]}`,
      ),
      h.AriaPressed(String(selected)),
      h.OnClick(Message.ClickedBlip({ id: mark.entry.id, keyboard: false })),
      h.OnKeyDownPreventDefault((key) =>
        key === 'Enter' || key === ' '
          ? Option.some(Message.ClickedBlip({ id: mark.entry.id, keyboard: true }))
          : Option.none(),
      ),
      h.Style({ cursor: 'pointer' }),
    ],
    markerPaint(mark, selected, h),
  );
}
function markerPaint(mark: RadarMark, selected: boolean, h: HtmlBuilder<Message>): Html[] {
  return [
    h.title([], [`${mark.entry.name} - ${ringLabels[mark.entry.ring]}`]),
    ...(selected
      ? [
          h.circle(
            [
              h.Attribute('data-selected-outline', 'true'),
              h.Cx(String(mark.x)),
              h.Cy(String(mark.y)),
              h.R('25'),
              h.Fill('none'),
              h.Stroke('var(--page-text)'),
              h.StrokeWidth('2'),
            ],
            [],
          ),
        ]
      : []),
    h.circle(
      [
        h.Cx(String(mark.x)),
        h.Cy(String(mark.y)),
        h.R('20'),
        h.Fill(colours[mark.entry.category]),
        h.Stroke('var(--page-bg)'),
        h.StrokeWidth('2'),
      ],
      [],
    ),
    h.text(
      [
        h.X(String(mark.x)),
        h.Y(String(mark.y)),
        h.TextAnchor('middle'),
        h.Attribute('dominant-baseline', 'central'),
        h.Fill('#ffffff'),
        h.Style({ fontSize: '20px', fontWeight: '600', pointerEvents: 'none' }),
      ],
      [String(mark.displayNumber)],
    ),
  ];
}
function scene(model: Model, dataset: RadarDataset, h: HtmlBuilder<Message>): Html {
  const filters = { query: model.query, category: model.category, rings: model.enabledRings };
  const projected = projectRadar(layoutEntries(dataset.entries), filters, {
    center: model.center,
    zoom: model.zoom,
  });
  const pointer = radarEvents.withMessage(h);
  const selectedId = model.selection._tag === 'Selected' ? model.selection.id : null;
  const selectedMarks = projected.marks.filter(({ entry }) => entry.id === selectedId);
  return h.svg(
    [
      h.Class(styles.globe),
      h.ViewBox('0 0 600 600'),
      h.Role('group'),
      h.Tabindex(0),
      h.AriaLabel('Functional and AI radar'),
      h.Attribute('data-longitude', String(model.center[0])),
      h.Attribute('data-latitude', String(model.center[1])),
      h.Attribute('data-zoom', String(model.zoom)),
      h.OnMount(RadarPointerMount()),
      pointer.OnFoldkitRadarPointer((message) => message),
      h.OnKeyDownSelfPreventDefault((key) =>
        handledKeys.has(key) ? Option.some(Message.PressedRadarKey({ key })) : Option.none(),
      ),
    ],
    [
      h.title([], ['Functional and AI technology radar']),
      h.desc(
        [],
        [
          'Four wireframe shells: Adopt, Trial, Assess, Caution. Categories: Techniques, Tools, Platforms, Languages & Frameworks.',
        ],
      ),
      h.defs(
        [],
        [
          h.clipPath(
            [h.Id('functional-ai-radar-viewport')],
            [h.rect([h.X('0'), h.Y('0'), h.Width('600'), h.Height('600')], [])],
          ),
        ],
      ),
      h.g(
        [h.ClipPath('url(#functional-ai-radar-viewport)')],
        [
          ...projected.shells.map((shell) =>
            h.g(
              [
                h.Attribute('data-shell', shell.ring),
                h.Attribute('aria-hidden', 'true'),
                h.Style({ pointerEvents: 'none' }),
              ],
              shell.segments.map((segment) =>
                h.path(
                  [
                    h.D(segment.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join('')),
                    h.Fill('none'),
                    h.Stroke('var(--chart-label)'),
                    h.StrokeWidth(shell.ring === 'caution' ? '1.5' : '1'),
                    h.StrokeOpacity('0.55'),
                  ],
                  [],
                ),
              ),
            ),
          ),
          // Keep focusable nodes stable; only the inert selection paint moves to the foreground.
          h.g(
            [h.Key('radar-targets')],
            projected.marks.map((mark) => marker(mark, model, h)),
          ),
          h.g(
            [
              h.Key('radar-selection-paint'),
              h.Attribute('aria-hidden', 'true'),
              h.Style({ pointerEvents: 'none' }),
            ],
            selectedMarks.map((mark) =>
              h.g(
                [h.Attribute('data-selected-paint-id', mark.entry.id)],
                markerPaint(mark, true, h),
              ),
            ),
          ),
        ],
      ),
    ],
  );
}
function inspection(model: Model, dataset: RadarDataset, h: HtmlBuilder<Message>): Html {
  const selection = model.selection;
  const selected =
    selection._tag === 'Selected'
      ? dataset.entries.find(({ id }) => id === selection.id)
      : undefined;
  const content = selected
    ? [
        h.h2([h.Class(styles.name), h.Attribute('data-summary-name', '')], [selected.name]),
        h.p(
          [h.Class(styles.summary)],
          [
            h.span([h.Attribute('data-summary-category', '')], [categoryLabels[selected.category]]),
            h.span([h.Attribute('data-summary-ring', '')], [ringLabels[selected.ring]]),
          ],
        ),
        h.p([h.Class(styles.description)], [selected.description]),
        h.a(
          [h.Href(selected.sourceUrl), h.Target('_blank'), h.Rel('noopener noreferrer')],
          ['Project source'],
        ),
      ]
    : [
        h.p(
          [],
          [
            model.selection._tag === 'Cleared'
              ? 'Selection cleared by filters'
              : 'No technology selected',
          ],
        ),
      ];
  return h.section(
    [
      h.Class(styles.details),
      h.Role('region'),
      h.AriaLabel('Selected technology'),
      h.Attribute('aria-live', 'polite'),
      h.Attribute('aria-atomic', 'true'),
    ],
    content,
  );
}
function row(
  entry: RadarEntry,
  displayNumber: number,
  model: Model,
  h: HtmlBuilder<Message>,
): Html {
  const selected = model.selection._tag === 'Selected' && model.selection.id === entry.id;
  return h.tr(
    [
      h.Key(entry.id),
      h.Attribute('data-entry-id', entry.id),
      h.Attribute('aria-selected', String(selected)),
    ],
    [
      h.td([], [String(displayNumber)]),
      h.td(
        [],
        [
          h.button(
            [
              h.Type('button'),
              h.Class(styles.inspect),
              h.AriaLabel(`Inspect ${entry.name}`),
              h.OnClick(Message.ClickedEntryRow({ id: entry.id })),
            ],
            [entry.name],
          ),
        ],
      ),
      h.td([], [categoryLabels[entry.category]]),
      h.td([], [ringLabels[entry.ring]]),
    ],
  );
}
function ready(model: Model, dataset: RadarDataset, h: HtmlBuilder<Message>): Html {
  const positions = layoutEntries(dataset.entries);
  const filters = { query: model.query, category: model.category, rings: model.enabledRings };
  const matches = filterPositions(positions, filters);
  const counts = countRings(positions, filters);
  return h.div(
    [h.Class(styles.root)],
    [
      h.p([h.Class(styles.notice)], [demoNotice, ` / authored ${dataset.authoredOn}`]),
      h.div(
        [h.Class(styles.filters)],
        [
          h.label(
            [h.Class(styles.field)],
            [
              'Search technologies',
              h.input([
                h.Class(styles.input),
                h.Type('search'),
                h.AriaLabel('Search technologies'),
                h.Value(model.query),
                h.OnInput((query) => Message.ChangedQuery({ query })),
              ]),
            ],
          ),
          h.label(
            [h.Class(styles.field)],
            [
              'Category',
              h.select(
                [
                  h.Class(styles.input),
                  h.AriaLabel('Category'),
                  h.Value(model.category),
                  h.OnChange((value) =>
                    Message.ChangedCategory({
                      category:
                        value === 'all'
                          ? 'all'
                          : (categoryIds.find((category) => category === value) ?? model.category),
                    }),
                  ),
                ],
                [
                  h.option([h.Value('all')], ['All categories']),
                  ...categoryIds.map((category) =>
                    h.option([h.Value(category)], [categoryLabels[category]]),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      h.fieldset(
        [h.Class(styles.rings), h.AriaLabel('Rings')],
        ringIds.map((ring) =>
          h.label(
            [h.Class(styles.checkLabel)],
            [
              h.input([
                h.Type('checkbox'),
                h.Checked(model.enabledRings.includes(ring)),
                h.AriaLabel(`${ringLabels[ring]} (${counts[ring]})`),
                h.OnClick(Message.ClickedRing({ ring })),
              ]),
              `${ringLabels[ring]} (${counts[ring]})`,
            ],
          ),
        ),
      ),
      h.div(
        [h.Class(styles.toolbar), h.Role('group'), h.AriaLabel('Radar controls')],
        [
          control(h, 'Turn west', '\u2190', Message.ClickedTurn({ direction: 'west' })),
          control(h, 'Turn east', '\u2192', Message.ClickedTurn({ direction: 'east' })),
          control(h, 'Turn north', '\u2191', Message.ClickedTurn({ direction: 'north' })),
          control(h, 'Turn south', '\u2193', Message.ClickedTurn({ direction: 'south' })),
          control(h, 'Zoom in', '+', Message.ClickedZoomIn()),
          control(h, 'Zoom out', '\u2212', Message.ClickedZoomOut()),
          control(h, 'Reset view', '\u21ba', Message.ClickedResetView()),
          h.output([h.AriaLabel('Zoom')], [`${model.zoom.toFixed(2)}x`]),
          h.button(
            [h.Class(styles.clear), h.Type('button'), h.OnClick(Message.ClickedClearFilters())],
            ['Clear filters'],
          ),
        ],
      ),
      h.div([h.Class(styles.workspace)], [inspection(model, dataset, h), scene(model, dataset, h)]),
      h.div(
        [h.Class(styles.legend)],
        categoryIds.map((category) =>
          h.span(
            [],
            [
              h.span(
                [
                  h.Class(styles.swatch),
                  h.Style({ background: colours[category] }),
                  h.Attribute('aria-hidden', 'true'),
                ],
                [],
              ),
              categoryLabels[category],
            ],
          ),
        ),
      ),
      h.p([h.Class(styles.notice)], ['Inner to outer: Adopt / Trial / Assess / Caution']),
      h.div(
        [h.Class(styles.tableScroll)],
        [
          h.table(
            [h.Class(styles.table)],
            [
              h.caption(
                [],
                [
                  `${matches.length} matching ${matches.length === 1 ? 'technology' : 'technologies'}`,
                ],
              ),
              h.thead(
                [],
                [
                  h.tr(
                    [],
                    ['#', 'Technology', 'Category', 'Ring'].map((heading) =>
                      h.th([h.Attribute('scope', 'col')], [heading]),
                    ),
                  ),
                ],
              ),
              h.tbody(
                [],
                matches.map(({ entry, displayNumber }) => row(entry, displayNumber, model, h)),
              ),
            ],
          ),
          ...(matches.length === 0
            ? [
                h.p(
                  [],
                  [
                    dataset.entries.length === 0
                      ? 'No technologies in this demo dataset'
                      : 'No matching technologies',
                  ],
                ),
              ]
            : []),
        ],
      ),
    ],
  );
}
export function view(model: Model, h: HtmlBuilder<Message>): Document {
  return {
    title: 'Functional & AI Radar',
    body:
      model.data._tag === 'Ready'
        ? ready(model, model.data.dataset, h)
        : h.p([h.Role('alert')], [`Radar unavailable: ${model.data.reason}`]),
  };
}
