import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Match, Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

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
import { countRings, type RadarPosition } from './layout';
import { Message } from './message';
import {
  CategoryFilter,
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
import { changesIn } from './timeline';
import { trailOf } from './trail';

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Class('e3-button'), h.Type('button'), h.OnClick(message)], [label]);

const describe = (entry: RadarEntry): string =>
  `${entry.name} · ${categoryLabels[entry.category]} · ${ringLabels[entry.ring]}`;

/** The hovered entry, else the pinned one, else a hint. */
const readout = (model: Model): string =>
  Option.match(
    Option.flatMap(
      Option.orElse(model.hovered, () => model.selected),
      (id) => positionOf(model, id),
    ),
    {
      onNone: () =>
        'Hover a blip to read it. Click to pin it, double-click to fly to it; click empty space to clear. Drag to look round.',
      onSome: ({ entry }) => describe(entry),
    },
  );

const categoryOf = (value: string): CategoryFilter =>
  Option.getOrElse(
    Option.fromNullishOr(CategoryFilter.literals.find((category) => category === value)),
    () => 'all' as const,
  );

const filterControls = (model: Model, h: HtmlBuilder<Message>): Html => {
  const counts = countRings(presentOf(model), filtersOf(model));
  return h.div(
    [h.Class('e3-controls'), h.AriaLabel('Filters')],
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
      ...ringIds.map((ring) =>
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
      button(h, 'Clear filters', Message.ClickedClearFilters()),
    ],
  );
};

const viewControls = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('e3-controls'), h.AriaLabel('View')],
    [
      button(h, 'Turn left', Message.ClickedTurn({ direction: 'left' })),
      button(h, 'Turn right', Message.ClickedTurn({ direction: 'right' })),
      button(h, 'Zoom in', Message.ClickedZoom({ direction: 'in' })),
      button(h, 'Zoom out', Message.ClickedZoom({ direction: 'out' })),
      button(h, 'Reset view', Message.ClickedResetView()),
      button(h, 'Universe view', Message.ClickedUniverse()),
      h.button(
        [
          h.Class('e3-button'),
          h.Type('button'),
          h.AriaPressed(String(model.showRelationships)),
          h.OnClick(Message.ClickedRelationships()),
        ],
        ['Relationships'],
      ),
    ],
  );

/** The relationship key: each type's colour and line style beside its name. */
const relationshipLegend = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('e3-controls'), h.AriaLabel('Relationships')],
    relationshipTypes.map((type) =>
      h.span(
        [h.Class('e3-tag')],
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
  h.div(
    [h.Class('e3-controls'), h.AriaLabel('Categories')],
    categoryIds.map((category) =>
      h.button(
        [
          h.Class('e3-button'),
          h.Type('button'),
          h.AriaLabel(`Fly to ${categoryLabels[category]}`),
          h.OnClick(Message.ClickedCluster({ category })),
        ],
        [
          h.span([h.Class('e3-swatch'), h.Style({ background: categoryCss(category) })], []),
          `${categoryLabels[category]} · ${bodyLabels[bodyOf[category]]}`,
        ],
      ),
    ),
  );

const details = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> =>
  Option.match(
    Option.flatMap(model.selected, (id) => positionOf(model, id)),
    {
      onNone: () => [],
      onSome: ({ entry }) => [
        h.section(
          [h.Class('e3-stat'), h.AriaLabel('Selected entry')],
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
  );
};

/** A click on a category's name stops at its sector; anywhere else it is a blip's. */
const clickedAt = (key: string): Message =>
  Option.match(clusterOfLabel(key), {
    onSome: (category) => Message.ClickedCluster({ category }),
    onNone: () => Message.ClickedBlip({ key }),
  });

/** A double-click on a category's name stops at its sector; on a blip it flies there. */
const doubleClickedAt = (key: string): Message =>
  Option.match(clusterOfLabel(key), {
    onSome: (category) => Message.ClickedCluster({ category }),
    onNone: () => Message.DoubleClickedBlip({ key }),
  });

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
      [h.Class('e3-timeline'), h.AriaLabel('Timeline')],
      [
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

const radar = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => [
  h.div(
    [h.Class('e3-stage-frame')],
    [
      EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: 'e3-stage e3-stage-square',
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onPointerEnter: ({ key }) => Message.HoveredBlip({ key }),
          onPointerLeave: ({ key }) => Message.LeftBlip({ key }),
          onClick: ({ key }) => clickedAt(key),
          onDoubleClick: ({ key }) => doubleClickedAt(key),
          onPointerMissed: () => Message.ClickedEmptySpace(),
          onGesture: (gesture) => Message.MadeGesture({ gesture }),
        },
        h,
      ),
      breadcrumb(model, h),
    ],
  ),
  h.p([h.Class('e3-readout'), h.AriaLive('polite')], [readout(model)]),
  filterControls(model, h),
  viewControls(model, h),
  ...timeline(model, h),
  legend(h),
  relationshipLegend(h),
  ...details(model, h),
  h.p(
    [h.Class('e3-note')],
    [
      `${demoNotice}. Each ring is a shell, adopt innermost; each category owns a quarter of `,
      'the sphere. The 2D radar projects these same coordinates; here they are the scene.',
    ],
  ),
  entryTable(model, h),
];

const content = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> =>
  Match.value(model.data).pipe(
    Match.tag('Ready', () => radar(model, h)),
    Match.tag('Failure', ({ reason }) => [h.p([h.Class('e3-readout')], [reason])]),
    Match.exhaustive,
  );

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: '3D tech radar — effect-three',
  body: h.div([h.Class('e3-sample')], content(model, h)),
});
