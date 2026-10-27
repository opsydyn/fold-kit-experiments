import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Match, Option } from 'effect';
import type { Attribute, Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../labelledEnvironment';
import { bodyLabels, bodyOf } from './bodies';
import {
  categoryIds,
  categoryLabels,
  demoNotice,
  type RadarEntry,
  relationshipLabels,
  relationshipTypes,
  ringIds,
  ringLabels,
} from './data';
import { eggReadout, isEggKey, isMonolithKey } from './easter';
import { countRings, type RadarPosition } from './layout';
import { Message } from './message';
import { cameraMarker, minimapPoint, quarterPath, ringRadius } from './minimap';
import {
  CategoryFilter,
  type PointerInput,
  clusterOfLabel,
  editionOf,
  editionsOf,
  filtersOf,
  type Model,
  positionOf,
  presentOf,
  relationshipsOf,
  visibleOf,
} from './model';
import { type Relation, relationsOf } from './relations';
import { categoryCss, relationshipCss, relationshipLines, sceneFor } from './scene';
import { shellRadius } from './space';
import { changesIn } from './timeline';
import { trailOf } from './trail';

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Class('e3-button'), h.Type('button'), h.OnClick(message)], [label]);

const describe = (entry: RadarEntry): string =>
  `${entry.name} · ${categoryLabels[entry.category]} · ${ringLabels[entry.ring]}`;

/** What to do, in the reader's own gestures. */
const hints = {
  hover: 'Hover a blip to read it · click to pin · double-click to fly there · drag to look round',
  touch: 'Tap a blip to read it · double-tap to fly there · drag to look round',
} as const satisfies Readonly<Record<PointerInput, string>>;

/** The hovered entry, else the pinned one, else a hint. */
const entryReadout = (model: Model): string =>
  Option.match(
    Option.flatMap(
      Option.orElse(model.hovered, () => model.selected),
      (id) => positionOf(model, id),
    ),
    {
      onNone: () => hints[model.input],
      onSome: ({ entry }) => describe(entry),
    },
  );

/** An Easter egg under the pointer speaks first; otherwise the entries do. */
const readout = (model: Model): string =>
  Option.getOrElse(eggReadout(model), () => entryReadout(model));

/** The pointer over an egg is the egg's; over anything else, a blip's. */
const enteredAt = (key: string): Message =>
  Match.value(isEggKey(key)).pipe(
    Match.when(true, () => Message.HoveredEgg({ key })),
    Match.orElse(() => Message.HoveredBlip({ key })),
  );

const leftAt = (key: string): Message =>
  Match.value(isEggKey(key)).pipe(
    Match.when(true, () => Message.LeftEgg({ key })),
    Match.orElse(() => Message.LeftBlip({ key })),
  );

const categoryOf = (value: string): CategoryFilter =>
  Option.getOrElse(
    Option.fromNullishOr(CategoryFilter.literals.find((category) => category === value)),
    () => 'all' as const,
  );

/** A titled group of the sidebar's controls, with any of its own actions beside the title. */
const panelSection = (
  h: HtmlBuilder<Message>,
  title: string,
  children: ReadonlyArray<Html>,
  actions: ReadonlyArray<Html> = [],
): Html =>
  h.section(
    [h.Class('e3-panel-section'), h.AriaLabel(title)],
    [
      h.div(
        [h.Class('e3-panel-heading-row')],
        [h.h2([h.Class('e3-panel-heading')], [title]), ...actions],
      ),
      ...children,
    ],
  );

/** A small text action in a section's heading row. */
const headingAction = (
  h: HtmlBuilder<Message>,
  attributes: ReadonlyArray<Attribute<Message>>,
  label: string,
): Html => h.button([h.Class('e3-heading-action'), h.Type('button'), ...attributes], [label]);

/** A small square button whose name is spoken and shown on hover, its face a glyph. */
const iconButton = (
  h: HtmlBuilder<Message>,
  glyph: string,
  label: string,
  message: Message,
): Html =>
  h.button(
    [
      h.Class('e3-button e3-icon-button'),
      h.Type('button'),
      h.AriaLabel(label),
      h.Title(label),
      h.OnClick(message),
    ],
    [glyph],
  );

const findControls = (model: Model, h: HtmlBuilder<Message>): Html =>
  panelSection(h, 'Find', [
    h.div(
      [h.Class('e3-stack')],
      [
        h.input([
          h.Class('e3-text'),
          h.Type('search'),
          h.AriaLabel('Search entries'),
          h.Placeholder('Search entries'),
          h.Value(model.query),
          h.OnInput((query) => Message.ChangedQuery({ query })),
        ]),
        h.select(
          [
            h.Class('e3-text'),
            h.AriaLabel('Category'),
            h.Value(model.category),
            h.OnChange((value) => Message.ChangedCategory({ category: categoryOf(value) })),
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
  ]);

const ringControls = (model: Model, h: HtmlBuilder<Message>): Html => {
  const counts = countRings(presentOf(model), filtersOf(model));
  return panelSection(
    h,
    'Rings',
    [
      h.div(
        [h.Class('e3-grid-2')],
        ringIds.map((ring) =>
          h.button(
            [
              h.Class('e3-button'),
              h.Type('button'),
              h.AriaPressed(String(model.enabledRings.includes(ring))),
              h.OnClick(Message.ClickedRing({ ring })),
            ],
            [`${ringLabels[ring]} (${counts[ring]})`],
          ),
        ),
      ),
    ],
    [headingAction(h, [h.OnClick(Message.ClickedClearFilters())], 'Clear filters')],
  );
};

const viewControls = (h: HtmlBuilder<Message>): Html =>
  panelSection(h, 'View', [
    h.div(
      [h.Class('e3-toolbar')],
      [
        iconButton(h, '↺', 'Turn left', Message.ClickedTurn({ direction: 'left' })),
        iconButton(h, '↻', 'Turn right', Message.ClickedTurn({ direction: 'right' })),
        iconButton(h, '−', 'Zoom out', Message.ClickedZoom({ direction: 'out' })),
        iconButton(h, '+', 'Zoom in', Message.ClickedZoom({ direction: 'in' })),
      ],
    ),
    h.div(
      [h.Class('e3-grid-2')],
      [
        button(h, 'Reset view', Message.ClickedResetView()),
        button(h, 'Universe view', Message.ClickedUniverse()),
      ],
    ),
  ]);

/** The relationship key: each type's colour and line style beside its name, and a toggle. */
const relationshipLegend = (model: Model, h: HtmlBuilder<Message>): Html =>
  panelSection(
    h,
    'Relationships',
    [
      h.ul(
        [h.Class('e3-key')],
        relationshipTypes.map((type) =>
          h.li(
            [],
            [
              h.span(
                [
                  h.Class('e3-edge-swatch'),
                  h.Style({ borderTop: `3px ${relationshipLines[type]} ${relationshipCss(type)}` }),
                ],
                [],
              ),
              relationshipLabels[type],
            ],
          ),
        ),
      ),
    ],
    [
      headingAction(
        h,
        [
          h.AriaLabel('Show relationships'),
          h.AriaPressed(String(model.showRelationships)),
          h.OnClick(Message.ClickedRelationships()),
        ],
        'Show',
      ),
    ],
  );

/** One relationship of the pinned entry: choosing it pins the entry at the other end. */
const relationButton = (model: Model, h: HtmlBuilder<Message>, relation: Relation): Html =>
  h.li(
    [],
    [
      h.button(
        [
          h.Class('e3-button'),
          h.Type('button'),
          h.OnClick(Message.ClickedRelay({ to: relation.other })),
        ],
        [
          h.span(
            [
              h.Class('e3-edge-swatch'),
              h.Style({
                borderTop: `3px ${relationshipLines[relation.type]} ${relationshipCss(relation.type)}`,
              }),
            ],
            [],
          ),
          `${relation.label} · ${Option.match(positionOf(model, relation.other), {
            onNone: () => relation.other,
            onSome: ({ entry }) => entry.name,
          })}`,
        ],
      ),
      h.p([h.Class('e3-note')], [relation.note]),
    ],
  );

const relations = (model: Model, h: HtmlBuilder<Message>, id: string): ReadonlyArray<Html> =>
  Match.value(relationsOf(relationshipsOf(model), id)).pipe(
    Match.when(
      (list) => list.length === 0,
      () => [],
    ),
    Match.orElse((list) => [
      h.h4([], ['Relationships']),
      h.ul(
        [h.Class('e3-relations')],
        list.map((relation) => relationButton(model, h, relation)),
      ),
    ]),
  );

/**
 * The colour and body key: each category's swatch and the body it takes on the radar.
 * Each is also a cluster stop: choosing it flies to the category's sector. Identity also
 * rides on every label and list row, never colour alone.
 */
const legend = (h: HtmlBuilder<Message>): Html =>
  panelSection(h, 'Categories', [
    h.div(
      [h.Class('e3-stack')],
      categoryIds.map((category) =>
        h.button(
          [
            h.Class('e3-button e3-legend-button'),
            h.Type('button'),
            h.AriaLabel(`Fly to ${categoryLabels[category]}`),
            h.OnClick(Message.ClickedCluster({ category })),
          ],
          [
            h.span([h.Class('e3-swatch'), h.Style({ background: categoryCss(category) })], []),
            categoryLabels[category],
            h.span([h.Class('e3-legend-body')], [bodyLabels[bodyOf[category]]]),
          ],
        ),
      ),
    ),
  ]);

/** The pinned entry, as a card floating over the stage's top right on wide screens. */
const details = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> =>
  Option.match(
    Option.flatMap(model.selected, (id) => positionOf(model, id)),
    {
      onNone: () => [],
      onSome: ({ entry }) => [
        h.section(
          [h.Class('e3-details'), h.AriaLabel('Selected entry')],
          [
            h.h3([], [entry.name]),
            h.p([h.Class('e3-note')], [describe(entry)]),
            h.p([], [entry.description]),
            h.div(
              [h.Class('e3-controls')],
              [
                button(h, 'Fly to', Message.ClickedFlyTo({ id: entry.id })),
                h.a([h.Href(entry.sourceUrl), h.Target('_blank'), h.Rel('noopener')], ['Source']),
              ],
            ),
            ...relations(model, h, entry.id),
          ],
        ),
      ],
    },
  );

const entryRow = (model: Model, h: HtmlBuilder<Message>, position: RadarPosition): Html => {
  const { entry } = position;
  return h.tr(
    [],
    [
      h.th([h.Scope('row')], [String(position.displayNumber)]),
      h.td(
        [],
        [
          h.button(
            [
              h.Class('e3-button'),
              h.Type('button'),
              h.AriaPressed(String(Option.contains(model.selected, entry.id))),
              h.OnClick(Message.ClickedEntry({ id: entry.id })),
            ],
            [entry.name],
          ),
        ],
      ),
      h.td([], [categoryLabels[entry.category]]),
      h.td([], [ringLabels[entry.ring]]),
    ],
  );
};

const entryTable = (model: Model, h: HtmlBuilder<Message>): Html => {
  const visible = visibleOf(model);
  return h.details(
    [h.Class('e3-table')],
    [
      h.summary([], [`Entries (${visible.length} of ${presentOf(model).length})`]),
      h.div(
        [h.Class('e3-table-scroll')],
        [
          h.table(
            [],
            [
              h.caption([], ['Choose an entry to pin it and turn the radar to face it']),
              h.thead(
                [],
                [
                  h.tr(
                    [],
                    ['#', 'Entry', 'Category', 'Ring'].map((heading) =>
                      h.th([h.Scope('col')], [heading]),
                    ),
                  ),
                ],
              ),
              h.tbody(
                [],
                visible.map((position) => entryRow(model, h, position)),
              ),
            ],
          ),
        ],
      ),
    ],
  );
};

/** A click on a category's name stops at its sector; anywhere else it is a blip's. */
const clickedAt = (key: string): Message =>
  Match.value({ monolith: isMonolithKey(key), egg: isEggKey(key) }).pipe(
    Match.when({ monolith: true }, () => Message.ClickedMonolith()),
    // A tap on any other egg reads it, as a hover would: a finger cannot hover.
    Match.when({ egg: true }, () => Message.HoveredEgg({ key })),
    Match.orElse(() =>
      Option.match(clusterOfLabel(key), {
        onSome: (category) => Message.ClickedCluster({ category }),
        onNone: () => Message.ClickedBlip({ key }),
      }),
    ),
  );

/** A double-click on a category's name stops at its sector; on a blip it flies there. */
const doubleClickedAt = (key: string): Message =>
  Match.value(isEggKey(key)).pipe(
    // Its two clicks already did what an egg does; the double-click itself does nothing.
    Match.when(true, () => Message.HoveredEgg({ key })),
    Match.orElse(() =>
      Option.match(clusterOfLabel(key), {
        onSome: (category) => Message.ClickedCluster({ category }),
        onNone: () => Message.DoubleClickedBlip({ key }),
      }),
    ),
  );

/** What changed in the shown edition, or that it is where the radar began. */
const changeList = (model: Model, h: HtmlBuilder<Message>): Html => {
  const changes = changesIn(model, model.edition);
  return Match.value({ first: model.edition === 0, quiet: changes.length === 0 }).pipe(
    Match.when({ first: true }, () =>
      h.p([h.Class('e3-note'), h.AriaLive('polite')], ['Where the radar began.']),
    ),
    Match.when({ quiet: true }, () =>
      h.p([h.Class('e3-note'), h.AriaLive('polite')], ['No entries moved in this edition.']),
    ),
    Match.orElse(() =>
      h.ul(
        [h.Class('e3-timeline-changes'), h.AriaLive('polite')],
        changes.map((change) => h.li([], [change])),
      ),
    ),
  );
};

/**
 * The radar over time: play through its editions, or scrub to one, and the blips move
 * between shells as their rings changed, joining as they arrived.
 */
const timeline = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const editions = editionsOf(model);
  const shown = editionOf(model);
  const playLabel = Match.value(model.playing).pipe(
    Match.when(true, () => 'Pause'),
    Match.orElse(() => 'Play'),
  );
  return [
    h.section(
      [h.Class('e3-panel-section e3-timeline'), h.AriaLabel('Timeline')],
      [
        h.h2([h.Class('e3-panel-heading')], ['Timeline']),
        h.div(
          [h.Class('e3-controls')],
          [
            button(h, playLabel, Message.ClickedPlay()),
            h.input([
              h.Class('e3-range'),
              h.Type('range'),
              h.Min('0'),
              h.Max(String(Math.max(0, editions.length - 1))),
              h.Step('1'),
              h.Value(String(model.edition)),
              h.AriaLabel('Edition'),
              h.Attribute('aria-valuetext', `${shown.label}, ${shown.authoredOn}`),
              h.OnInput((value) => Message.ChangedEdition({ index: Number(value) })),
            ]),
            h.span([h.Class('e3-note')], [`${shown.label} · ${shown.authoredOn}`]),
          ],
        ),
        changeList(model, h),
      ],
    ),
  ].filter(() => editions.length > 1);
};

/** How a blip shows on the minimap: a small dot, or a larger ringed one when pinned. */
const dotLooks = {
  resting: { radius: '0.035', stroke: 'none' },
  pinned: { radius: '0.07', stroke: '#e8e8f0' },
} as const;

const minimapDot = (model: Model, h: HtmlBuilder<Message>, position: RadarPosition): Html => {
  const [x, y] = minimapPoint(position);
  const looks = Match.value(Option.contains(model.selected, position.entry.id)).pipe(
    Match.when(true, () => dotLooks.pinned),
    Match.orElse(() => dotLooks.resting),
  );
  return h.circle(
    [
      h.Cx(String(x)),
      h.Cy(String(y)),
      h.R(looks.radius),
      h.Fill(categoryCss(position.entry.category)),
      h.Stroke(looks.stroke),
      h.StrokeWidth('0.02'),
    ],
    [],
  );
};

/**
 * The minimap: the radar from above in the stage's corner, its quarters tinted by
 * category, the visible blips as dots (the pinned one larger), and a marker on the rim at
 * the camera's bearing. A click on a quarter stops at that cluster; the legend's chips do
 * the same from the keyboard.
 */
const minimap = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.svg(
    [
      h.Class('e3-minimap'),
      h.ViewBox('-1.08 -1.08 2.16 2.16'),
      h.Role('img'),
      h.AriaLabel('Minimap of the radar from above'),
    ],
    [
      ...categoryIds.map((category) =>
        h.path(
          [
            h.D(quarterPath(category)),
            h.Fill(categoryCss(category)),
            h.Opacity('0.12'),
            h.Class('e3-minimap-quarter'),
            h.OnClick(Message.ClickedCluster({ category })),
          ],
          [h.title([], [`Fly to ${categoryLabels[category]}`])],
        ),
      ),
      ...ringIds.map((ring) =>
        h.circle(
          [
            h.Cx('0'),
            h.Cy('0'),
            h.R(String(ringRadius(shellRadius(ring)))),
            h.Fill('none'),
            h.Stroke('#8a8aa3'),
            h.StrokeWidth('0.012'),
            h.Opacity('0.6'),
          ],
          [],
        ),
      ),
      ...visibleOf(model).map((position) => minimapDot(model, h, position)),
      h.polygon(
        [h.Points(cameraMarker(model.camera.position)), h.Fill('#e8e8f0'), h.Opacity('0.9')],
        [],
      ),
    ],
  );

/** A breadcrumb that flies somewhere; the last one marks where the camera is. */
const crumb = (h: HtmlBuilder<Message>, label: string, message: Message, current: boolean): Html =>
  h.button(
    [
      h.Class('e3-crumb'),
      h.Type('button'),
      ...[h.AriaCurrent('location')].filter(() => current),
      h.OnClick(message),
    ],
    [label],
  );

/** The trail as a breadcrumb over the stage; the last crumb is where the camera is. */
const breadcrumb = (model: Model, h: HtmlBuilder<Message>): Html => {
  const stops = trailOf(model);
  return h.nav(
    [h.Class('e3-breadcrumb'), h.AriaLabel('Location')],
    stops.flatMap((stop, index) => [
      ...[h.span([h.AriaHidden(true)], ['›'])].filter(() => index > 0),
      crumb(h, stop.label, stop.message, index === stops.length - 1),
    ]),
  );
};

/** The sidebar's header: the radar's name and the host page's links out. */
const header = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.header(
    [h.Class('e3-panel-header')],
    [
      h.h1([h.Class('e3-panel-title')], ['3D tech radar']),
      h.nav(
        [h.Class('e3-panel-links'), h.AriaLabel('Elsewhere')],
        model.links.map(({ label, href }) => h.a([h.Href(href)], [label])),
      ),
    ],
  );

/**
 * The sidebar: every control in one column beside the stage, in the order a reader
 * reaches for them, from finding an entry to the full list.
 */
const sidebar = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.aside(
    [h.Class('e3-sidebar'), h.AriaLabel('Radar controls')],
    [
      header(model, h),
      findControls(model, h),
      ringControls(model, h),
      viewControls(h),
      ...timeline(model, h),
      legend(h),
      relationshipLegend(model, h),
      entryTable(model, h),
      h.p([h.Class('e3-note')], [`${demoNotice}.`]),
    ],
  );

/**
 * The radar as a standalone app: the stage fills the screen beside the sidebar, with the
 * breadcrumb, readout, minimap and pinned entry floating over it, so nothing scrolls.
 */
const radar = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => [
  sidebar(model, h),
  h.div(
    [h.Class('e3-stage-frame')],
    [
      EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: 'e3-stage e3-stage-fill',
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onPointerEnter: ({ key }) => enteredAt(key),
          onPointerLeave: ({ key }) => leftAt(key),
          onClick: ({ key }) => clickedAt(key),
          onDoubleClick: ({ key }) => doubleClickedAt(key),
          onPointerMissed: () => Message.ClickedEmptySpace(),
          onGesture: (gesture) => Message.MadeGesture({ gesture }),
        },
        h,
      ),
      breadcrumb(model, h),
      h.p([h.Class('e3-readout e3-stage-readout'), h.AriaLive('polite')], [readout(model)]),
      minimap(model, h),
    ],
  ),
  ...details(model, h),
];

const content = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> =>
  Match.value(model.data).pipe(
    Match.tag('Ready', () => radar(model, h)),
    Match.tag('Failure', ({ reason }) => [h.p([h.Class('e3-readout')], [reason])]),
    Match.exhaustive,
  );

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: '3D tech radar — effect-three',
  body: h.div([h.Class('e3-sample e3-app')], content(model, h)),
});
