import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Match, Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../labelledEnvironment';
import {
  categoryIds,
  categoryLabels,
  demoNotice,
  type RadarEntry,
  ringIds,
  ringLabels,
} from './data';
import { countRings, type RadarPosition } from './layout';
import { Message } from './message';
import { CategoryFilter, filtersOf, type Model, positionOf, positionsOf, visibleOf } from './model';
import { categoryCss, sceneFor } from './scene';

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
        'Hover a blip to read it. Click to pin it; click empty space to clear. Drag to look round.',
      onSome: ({ entry }) => describe(entry),
    },
  );

const categoryOf = (value: string): CategoryFilter =>
  Option.getOrElse(
    Option.fromNullishOr(CategoryFilter.literals.find((category) => category === value)),
    () => 'all' as const,
  );

const filterControls = (model: Model, h: HtmlBuilder<Message>): Html => {
  const counts = countRings(positionsOf(model), filtersOf(model));
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

const viewControls = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('e3-controls'), h.AriaLabel('View')],
    [
      button(h, 'Turn left', Message.ClickedTurn({ direction: 'left' })),
      button(h, 'Turn right', Message.ClickedTurn({ direction: 'right' })),
      button(h, 'Reset view', Message.ClickedResetView()),
    ],
  );

/** The colour key; identity also rides on every label and list row, never colour alone. */
const legend = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('e3-controls'), h.AriaLabel('Categories')],
    categoryIds.map((category) =>
      h.span(
        [h.Class('e3-tag')],
        [
          h.span([h.Class('e3-swatch'), h.Style({ background: categoryCss(category) })], []),
          categoryLabels[category],
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
            h.a([h.Href(entry.sourceUrl), h.Target('_blank'), h.Rel('noopener')], ['Source']),
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
      h.summary([], [`Entries (${visible.length} of ${positionsOf(model).length})`]),
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

const radar = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => [
  EffectThreeFoldkit.view(
    {
      scene: sceneFor(model),
      mount: sceneMount,
      className: 'e3-stage e3-stage-square',
      onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
      onPointerEnter: ({ key }) => Message.HoveredBlip({ key }),
      onPointerLeave: ({ key }) => Message.LeftBlip({ key }),
      onClick: ({ key }) => Message.ClickedBlip({ key }),
      onPointerMissed: () => Message.ClickedEmptySpace(),
      onGesture: (gesture) => Message.MadeGesture({ gesture }),
    },
    h,
  ),
  h.p([h.Class('e3-readout'), h.AriaLive('polite')], [readout(model)]),
  filterControls(model, h),
  viewControls(h),
  legend(h),
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
