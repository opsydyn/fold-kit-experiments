import { Mount, type View } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Effect, Match, Option } from 'effect';

import { defineLabelledSceneMount, EffectThreeStage } from '../effect-ui-scene';
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
  themeOf,
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
import { cssVariables, themeLabels, ThemeChoice } from './themes';
import { changesIn } from './timeline';
import { trailOf } from './trail';

const button = (h: Html.H<Message>, label: string, message: Message) =>
  h.button.class('e3-button').attr('type', 'button').on('click', message).children(label);

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

/** What became of Copy link, said in the readout. */
const linkNotices = {
  copied: 'Link copied: it opens the radar on this view',
  refused: 'Couldn’t copy the link; the address bar has it',
} as const;

/** An Easter egg under the pointer speaks first, then Copy link and the recorder, then entries. */
const readout = (model: Model): string =>
  Option.getOrElse(
    Option.orElse(
      Option.orElse(eggReadout(model), () =>
        Option.map(model.linkNotice, (notice) => linkNotices[notice]),
      ),
      () => model.tourNotice,
    ),
    () => entryReadout(model),
  );

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
  h: Html.H<Message>,
  title: string,
  children: View.Children<Message>,
  actions: View.Children<Message> = [],
) =>
  h.section
    .class('e3-panel-section')
    .attr('aria-label', title)
    .children(
      h.div
        .class('e3-panel-heading-row')
        .children(h.h2.class('e3-panel-heading').children(title), ...actions),
      ...children,
    );

/** A small text action in a section's heading row. */
const headingAction = (h: Html.H<Message>, message: Message) =>
  h.button.class('e3-heading-action').attr('type', 'button').on('click', message);

const choiceOf = (value: string): ThemeChoice =>
  Option.getOrElse(
    Option.fromNullishOr(ThemeChoice.literals.find((choice) => choice === value)),
    (): ThemeChoice => 'auto',
  );

/** What each choice reads as in the picker: Auto also says what it chose. */
const choiceLabel = (model: Model, choice: ThemeChoice): string =>
  Match.value(choice).pipe(
    Match.when('auto', () => `Auto (${themeLabels[themeOf(model)]})`),
    Match.orElse((picked) => themeLabels[picked]),
  );

/** The theme picker, small, beside the View heading. */
const themePicker = (model: Model, h: Html.H<Message>) =>
  h.select
    .class('e3-heading-select')
    .attr('aria-label', 'Theme')
    .on('change', ({ value }) => Message.ChoseTheme({ choice: choiceOf(value) }))
    .children(
      ...ThemeChoice.literals.map((choice) =>
        h.option
          .attr('value', choice)
          .selected(choice === model.themeChoice)
          .children(choiceLabel(model, choice)),
      ),
    );

/** A small square button whose name is spoken and shown on hover, its face a glyph. */
const iconButton = (h: Html.H<Message>, glyph: string, label: string, message: Message) =>
  h.button
    .class('e3-button e3-icon-button')
    .attr('type', 'button')
    .attr('aria-label', label)
    .attr('title', label)
    .on('click', message)
    .children(glyph);

const findControls = (model: Model, h: Html.H<Message>) =>
  panelSection(h, 'Find', [
    h.div.class('e3-find').children(
      h.input
        .class('e3-text')
        .attr('type', 'search')
        .attr('aria-label', 'Search entries')
        .attr('placeholder', 'Search')
        .value(model.query)
        .on('input', ({ value: query }) => Message.ChangedQuery({ query })),
      h.select
        .class('e3-text')
        .attr('aria-label', 'Category')
        .on('change', ({ value }) => Message.ChangedCategory({ category: categoryOf(value) }))
        .children(
          h.option
            .attr('value', 'all')
            .selected(model.category === 'all')
            .children('All categories'),
          ...categoryIds.map((category) =>
            h.option
              .attr('value', category)
              .selected(category === model.category)
              .children(categoryLabels[category]),
          ),
        ),
    ),
  ]);

const ringControls = (model: Model, h: Html.H<Message>) => {
  const counts = countRings(presentOf(model), filtersOf(model));
  return panelSection(
    h,
    'Rings',
    [
      h.div.class('e3-grid-2').children(
        ...ringIds.map((ring) =>
          h.button
            .class('e3-button')
            .attr('type', 'button')
            .attr('aria-pressed', String(model.enabledRings.includes(ring)))
            .on('click', Message.ClickedRing({ ring }))
            .children(`${ringLabels[ring]} (${counts[ring]})`),
        ),
      ),
    ],
    [headingAction(h, Message.ClickedClearFilters()).children('Clear filters')],
  );
};

const viewControls = (model: Model, h: Html.H<Message>) =>
  panelSection(
    h,
    'View',
    [
      h.div
        .class('e3-toolbar')
        .children(
          iconButton(h, '↺', 'Turn left', Message.ClickedTurn({ direction: 'left' })),
          iconButton(h, '↻', 'Turn right', Message.ClickedTurn({ direction: 'right' })),
          iconButton(h, '−', 'Zoom out', Message.ClickedZoom({ direction: 'out' })),
          iconButton(h, '+', 'Zoom in', Message.ClickedZoom({ direction: 'in' })),
        ),
      h.div
        .class('e3-grid-2')
        .children(
          button(h, 'Reset view', Message.ClickedResetView()),
          button(h, 'Universe view', Message.ClickedUniverse()),
        ),
    ],
    [themePicker(model, h)],
  );

/** The relationship key: each type's colour and line style beside its name, and a toggle. */
const relationshipLegend = (model: Model, h: Html.H<Message>) =>
  panelSection(
    h,
    'Relationships',
    [
      h.ul.class('e3-key').children(
        ...relationshipTypes.map((type) =>
          h.li.children(
            h.span
              .class('e3-edge-swatch')
              .style({
                borderTop: `3px ${relationshipLines[type]} ${relationshipCss(themeOf(model), type)}`,
              })
              .children(),
            relationshipLabels[type],
          ),
        ),
      ),
    ],
    [
      headingAction(h, Message.ClickedRelationships())
        .attr('aria-label', 'Show relationships')
        .attr('aria-pressed', String(model.showRelationships))
        .children('Show'),
    ],
  );

/** One relationship of the pinned entry: choosing it pins the entry at the other end. */
const relationButton = (model: Model, h: Html.H<Message>, relation: Relation) =>
  h.li.children(
    h.button
      .class('e3-button')
      .attr('type', 'button')
      .on('click', Message.ClickedRelay({ to: relation.other }))
      .children(
        h.span
          .class('e3-edge-swatch')
          .style({
            borderTop: `3px ${relationshipLines[relation.type]} ${relationshipCss(themeOf(model), relation.type)}`,
          })
          .children(),
        `${relation.label} · ${Option.match(positionOf(model, relation.other), {
          onNone: () => relation.other,
          onSome: ({ entry }) => entry.name,
        })}`,
      ),
    h.p.class('e3-note').children(relation.note),
  );

const relations = (model: Model, h: Html.H<Message>, id: string): View.Children<Message> =>
  Match.value(relationsOf(relationshipsOf(model), id)).pipe(
    Match.when(
      (list) => list.length === 0,
      () => [],
    ),
    Match.orElse((list) => [
      h.h4.children('Relationships'),
      h.ul
        .class('e3-relations')
        .children(...list.map((relation) => relationButton(model, h, relation))),
    ]),
  );

/**
 * The colour and body key: each category's swatch and the body it takes on the radar.
 * Each is also a cluster stop: choosing it flies to the category's sector. Identity also
 * rides on every label and list row, never colour alone.
 */
const legend = (model: Model, h: Html.H<Message>) =>
  panelSection(h, 'Categories', [
    h.div.class('e3-stack').children(
      ...categoryIds.map((category) =>
        h.button
          .class('e3-button e3-legend-button')
          .attr('type', 'button')
          .attr('aria-label', `Fly to ${categoryLabels[category]}`)
          .on('click', Message.ClickedCluster({ category }))
          .children(
            h.span
              .class('e3-swatch')
              .style({ background: categoryCss(themeOf(model), category) })
              .children(),
            categoryLabels[category],
            h.span.class('e3-legend-body').children(bodyLabels[bodyOf[category]]),
          ),
      ),
    ),
  ]);

/** The pinned entry, as a card floating over the stage's top right on wide screens. */
const details = (model: Model, h: Html.H<Message>): View.Children<Message> =>
  Option.match(
    Option.flatMap(model.selected, (id) => positionOf(model, id)),
    {
      onNone: () => [],
      onSome: ({ entry }) => [
        h.section
          .class('e3-details')
          .attr('aria-label', 'Selected entry')
          .children(
            h.h3.children(entry.name),
            h.p.class('e3-note').children(describe(entry)),
            h.p.children(entry.description),
            h.div
              .class('e3-controls')
              .children(
                button(h, 'Fly to', Message.ClickedFlyTo({ id: entry.id })),
                button(h, 'Copy link', Message.ClickedCopyLink()),
                h.a
                  .attr('href', entry.sourceUrl)
                  .attr('target', '_blank')
                  .attr('rel', 'noopener')
                  .children('Source'),
              ),
            ...relations(model, h, entry.id),
          ),
      ],
    },
  );

const entryRow = (model: Model, h: Html.H<Message>, position: RadarPosition) => {
  const { entry } = position;
  return h.tr.children(
    h.th.attr('scope', 'row').children(String(position.displayNumber)),
    h.td.children(
      h.button
        .class('e3-button')
        .attr('type', 'button')
        .attr('aria-pressed', String(Option.contains(model.selected, entry.id)))
        .on('click', Message.ClickedEntry({ id: entry.id }))
        .children(entry.name),
    ),
    h.td.children(categoryLabels[entry.category]),
    h.td.children(ringLabels[entry.ring]),
  );
};

const entryTable = (model: Model, h: Html.H<Message>) => {
  const visible = visibleOf(model);
  return h.details
    .class('e3-table')
    .children(
      h.summary.children(`Entries (${visible.length} of ${presentOf(model).length})`),
      h.div
        .class('e3-table-scroll')
        .children(
          h.table.children(
            h.caption.children('Choose an entry to pin it and turn the radar to face it'),
            h.thead.children(
              h.tr.children(
                ...['#', 'Entry', 'Category', 'Ring'].map((heading) =>
                  h.th.attr('scope', 'col').children(heading),
                ),
              ),
            ),
            h.tbody.children(...visible.map((position) => entryRow(model, h, position))),
          ),
        ),
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
const changeList = (model: Model, h: Html.H<Message>) => {
  const changes = changesIn(model, model.edition);
  return Match.value({ first: model.edition === 0, quiet: changes.length === 0 }).pipe(
    Match.when({ first: true }, () =>
      h.p.class('e3-note').attr('aria-live', 'polite').children('Where the radar began.'),
    ),
    Match.when({ quiet: true }, () =>
      h.p
        .class('e3-note')
        .attr('aria-live', 'polite')
        .children('No entries moved in this edition.'),
    ),
    Match.orElse(() =>
      h.ul
        .class('e3-timeline-changes')
        .attr('aria-live', 'polite')
        .children(...changes.map((change) => h.li.children(change))),
    ),
  );
};

/**
 * The radar over time: play through its editions, or scrub to one, and the blips move
 * between shells as their rings changed, joining as they arrived.
 */
const timeline = (model: Model, h: Html.H<Message>): View.Children<Message> => {
  const editions = editionsOf(model);
  const shown = editionOf(model);
  const playLabel = Match.value(model.playing).pipe(
    Match.when(true, () => 'Pause'),
    Match.orElse(() => 'Play'),
  );
  return [
    h.section
      .class('e3-panel-section e3-timeline')
      .attr('aria-label', 'Timeline')
      .children(
        h.div
          .class('e3-panel-heading-row')
          .children(
            h.h2.class('e3-panel-heading').children('Timeline'),
            h.span.class('e3-heading-status').children(`${shown.label} · ${shown.authoredOn}`),
          ),
        h.div.class('e3-controls').children(
          button(h, playLabel, Message.ClickedPlay()),
          h.input
            .class('e3-range')
            .attr('type', 'range')
            .attr('min', '0')
            .attr('max', String(Math.max(0, editions.length - 1)))
            .attr('step', '1')
            .value(String(model.edition))
            .attr('aria-label', 'Edition')
            .attr('aria-valuetext', `${shown.label}, ${shown.authoredOn}`)
            .on('input', ({ value }) => Message.ChangedEdition({ index: Number(value) })),
        ),
        h.div
          .class('e3-timeline-log')
          .attr('tabindex', '0')
          .attr('role', 'region')
          .attr('aria-label', 'What changed in this edition')
          .children(changeList(model, h)),
      ),
  ].filter(() => editions.length > 1);
};

/** How a blip shows on the minimap: a small dot, or a larger ringed one when pinned. */
const dotLooks = {
  resting: { radius: '0.035', stroke: 'none' },
  pinned: { radius: '0.07', stroke: 'var(--text)' },
} as const;

const minimapDot = (model: Model, position: RadarPosition) => {
  const [x, y] = minimapPoint(position);
  const looks = Match.value(Option.contains(model.selected, position.entry.id)).pipe(
    Match.when(true, () => dotLooks.pinned),
    Match.orElse(() => dotLooks.resting),
  );
  return new Html.Element<Message>('circle')
    .attr('cx', String(x))
    .attr('cy', String(y))
    .attr('r', looks.radius)
    .attr('fill', categoryCss(themeOf(model), position.entry.category))
    .attr('stroke', looks.stroke)
    .attr('stroke-width', '0.02')
    .children();
};

/**
 * The minimap: the radar from above in the stage's corner, its quarters tinted by
 * category, the visible blips as dots (the pinned one larger), and a marker on the rim at
 * the camera's bearing. A click on a quarter stops at that cluster; the legend's chips do
 * the same from the keyboard.
 */
const minimap = (model: Model) =>
  new Html.Element<Message>('svg')
    .class('e3-minimap')
    .attr('viewBox', '-1.08 -1.08 2.16 2.16')
    .attr('role', 'img')
    .attr('aria-label', 'Minimap of the radar from above')
    .children(
      ...categoryIds.map((category) =>
        new Html.Element<Message>('path')
          .attr('d', quarterPath(category))
          .attr('fill', categoryCss(themeOf(model), category))
          .attr('opacity', '0.12')
          .class('e3-minimap-quarter')
          .attr('aria-label', `Fly to ${categoryLabels[category]}`)
          .on('click', Message.ClickedCluster({ category }))
          .children(),
      ),
      ...ringIds.map((ring) =>
        new Html.Element<Message>('circle')
          .attr('cx', '0')
          .attr('cy', '0')
          .attr('r', String(ringRadius(shellRadius(ring))))
          .attr('fill', 'none')
          .attr('stroke', 'var(--muted)')
          .attr('stroke-width', '0.012')
          .attr('opacity', '0.6')
          .children(),
      ),
      ...visibleOf(model).map((position) => minimapDot(model, position)),
      new Html.Element<Message>('polygon')
        .attr('points', cameraMarker(model.camera.position))
        .attr('fill', 'var(--text)')
        .attr('opacity', '0.9')
        .children(),
    );

/** A breadcrumb that flies somewhere; the last one marks where the camera is. */
const crumb = (h: Html.H<Message>, label: string, message: Message, current: boolean) =>
  h.button
    .class('e3-crumb')
    .attr('type', 'button')
    .attr('aria-current', current ? 'location' : 'false')
    .on('click', message)
    .children(label);

/** The trail as a breadcrumb over the stage; the last crumb is where the camera is. */
const breadcrumb = (model: Model, h: Html.H<Message>) => {
  const stops = trailOf(model);
  return h.nav
    .class('e3-breadcrumb')
    .attr('aria-label', 'Location')
    .children(
      ...stops.flatMap((stop, index) => [
        ...[h.span.attr('aria-hidden', 'true').children('›')].filter(() => index > 0),
        crumb(h, stop.label, stop.message, index === stops.length - 1),
      ]),
      h.button
        .class('e3-crumb e3-crumb-link')
        .attr('type', 'button')
        .attr('aria-label', 'Copy a link to this view')
        .attr('title', 'Copy a link to this view')
        .on('click', Message.ClickedCopyLink())
        .children('🔗'),
    );
};

/** What the recorder offers, by its state: record, then play, save or load a tour. */
const tourButtons = (model: Model, h: Html.H<Message>): View.Children<Message> =>
  Match.value(model.tour).pipe(
    Match.tag('Idle', () => [
      button(h, '● Record', Message.ClickedRecord()),
      button(h, 'Load…', Message.ClickedLoadTour()),
    ]),
    Match.tag('Recording', () => [button(h, '■ Stop', Message.ClickedStopRecording())]),
    Match.tag('Ready', () => [
      button(h, '▶ Play', Message.ClickedPlayTour()),
      button(h, '● Record', Message.ClickedRecord()),
      button(h, 'Save', Message.ClickedSaveTour()),
      button(h, 'Load…', Message.ClickedLoadTour()),
    ]),
    Match.tag('Playing', () => [button(h, '■ Stop tour', Message.ClickedStopTour())]),
    Match.exhaustive,
  );

/** The recorder's state in words, beside its heading. */
const tourStatus = (model: Model): string =>
  Match.value(model.tour).pipe(
    Match.tag('Idle', () => 'Record one to replay or share'),
    Match.tag('Recording', ({ recording }) => `Recording · ${recording.steps.length} moves`),
    Match.tag('Ready', ({ recording }) => `${recording.steps.length} moves ready`),
    Match.tag('Playing', ({ recording, next }) => `Move ${next} of ${recording.steps.length}`),
    Match.exhaustive,
  );

/**
 * The flight recorder: your moves, recorded as you make them, replayed as a guided tour
 * with a caption for each; saved as a file to send.
 */
const tourControls = (model: Model, h: Html.H<Message>) =>
  panelSection(
    h,
    'Tour',
    [h.div.class('e3-controls e3-tour-controls').children(...tourButtons(model, h))],
    [h.span.class('e3-heading-status').attr('aria-live', 'polite').children(tourStatus(model))],
  );

/** While a tour plays, the move just made, in words, over the stage. */
const tourCaption = (model: Model, h: Html.H<Message>): View.Children<Message> =>
  Match.value(model.tour).pipe(
    Match.tag('Playing', ({ caption }) => [
      h.p.class('e3-tour-caption').attr('aria-live', 'polite').children(caption),
    ]),
    Match.orElse(() => []),
  );

/** The sidebar's header: the radar's name and the host page's links out. */
const header = (model: Model, h: Html.H<Message>) =>
  h.header.class('e3-panel-header').children(
    h.h1.class('e3-panel-title').children('3D tech radar'),
    h.nav
      .class('e3-panel-links')
      .attr('aria-label', 'Elsewhere')
      .children(...model.links.map(({ label, href }) => h.a.attr('href', href).children(label))),
  );

/**
 * The sidebar: every control in one column beside the stage, in the order a reader
 * reaches for them, from finding an entry to the full list.
 */
const sidebar = (model: Model, h: Html.H<Message>) =>
  h.aside
    .class('e3-sidebar')
    .attr('aria-label', 'Radar controls')
    .children(
      header(model, h),
      findControls(model, h),
      ringControls(model, h),
      viewControls(model, h),
      ...timeline(model, h),
      legend(model, h),
      relationshipLegend(model, h),
      tourControls(model, h),
      entryTable(model, h),
      h.p.class('e3-note').children(`${demoNotice}.`),
    );

/**
 * The radar as a standalone app: the stage fills the screen beside the sidebar, with the
 * breadcrumb, readout, minimap and pinned entry floating over it, so nothing scrolls.
 */
const radar = (model: Model, h: Html.H<Message>): View.Children<Message> => [
  sidebar(model, h),
  h.div.class('e3-stage-frame').children(
    EffectThreeStage(h)
      .class('e3-stage', 'e3-stage-fill')
      .on('scene-pointer-enter', ({ key }) => enteredAt(key))
      .on('scene-pointer-leave', ({ key }) => leftAt(key))
      .on('scene-click', ({ key }) => clickedAt(key))
      .on('scene-double-click', ({ key }) => doubleClickedAt(key))
      .on('scene-pointer-missed', Message.ClickedEmptySpace())
      .on('scene-gesture', ({ gesture }) => Message.MadeGesture({ gesture }))
      .onMount(
        Mount.map(sceneMount({ scene: sceneFor(model) }), (lifecycle) =>
          Message.ReceivedSceneLifecycle({ lifecycle }),
        ),
      )
      .children(),
    breadcrumb(model, h),
    ...tourCaption(model, h),
    h.p.class('e3-readout e3-stage-readout').attr('aria-live', 'polite').children(readout(model)),
    minimap(model),
  ),
  ...details(model, h),
];

const content = (model: Model, h: Html.H<Message>): View.Children<Message> =>
  Match.value(model.data).pipe(
    Match.tag('Ready', () => radar(model, h)),
    Match.tag('Failure', ({ reason }) => [h.p.class('e3-readout').children(reason)]),
    Match.exhaustive,
  );

const sceneMount = defineLabelledSceneMount();
const radarMount = Mount.make('ThreeRadarReady', { args: {} }, () =>
  Effect.succeed(Message.MountedRadar()),
);

export const view = (h: Html.H<Message>, model: Model) =>
  h.div
    .class('e3-sample', 'e3-app')
    .attr('data-theme', themeOf(model))
    .style(cssVariables(themeOf(model)))
    .onMount(radarMount())
    .children(...content(model, h));
