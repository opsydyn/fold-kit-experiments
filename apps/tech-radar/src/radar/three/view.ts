import { Mount, type View } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Effect, Match, Option, Queue, Stream } from 'effect';

import { bodyLabels, bodyOf } from './bodies';
import { comparedWith, movesOf } from './compare';
import {
  categoryIds,
  categoryLabels,
  type RadarEntry,
  relationshipLabels,
  relationshipTypes,
  ringIds,
  ringLabels,
} from './data';
import { eggReadout, isEggKey, isMonolithKey } from './easter';
import { EffectThreeStage, sceneMount } from './labelledEnvironment';
import { countRings, type RadarPosition } from './layout';
import { Message } from './message';
import { cameraMarker, minimapPoint, quarterPath, ringRadius } from './minimap';
import {
  CategoryFilter,
  type PointerInput,
  themeOf,
  clusterOfLabel,
  editionOf,
  fullPageOf,
  editionsOf,
  filtersOf,
  type IconControl,
  type Model,
  positionOf,
  presentOf,
  relationshipsOf,
  visibleOf,
} from './model';
import { type Relation, relationsOf } from './relations';
import { categoryCss, relationshipCss, relationshipLines, sceneFor } from './scene';
import { searchResults } from './search';
import type { SheetStop } from './sheet';
import { shortcuts } from './shortcuts';
import { shellRadius } from './space';
import { cssVariables, themeLabels, ThemeChoice } from './themes';
import { changesIn } from './timeline';
import { trailOf } from './trail';
import { Typeface, typefaceFrom, typefaceLabels, typeVariables } from './typefaces';

const button = (h: Html.H<Message>, label: string, message: Message) =>
  h.button.class('e3-button').attr('type', 'button').on('click', message).children(label);

const describe = (entry: RadarEntry): string =>
  `${entry.name} · ${categoryLabels[entry.category]} · ${ringLabels[entry.ring]}`;

/** What to do, in the reader's own gestures: the help popover's list. */
const hints = {
  hover: [
    'Hover a blip to read it',
    'Click to pin it',
    'Double-click to fly there',
    'Drag to look round',
    'Press ? for shortcuts',
  ],
  touch: ['Tap a blip to read it', 'Double-tap to fly there', 'Drag to look round'],
} as const satisfies Readonly<Record<PointerInput, ReadonlyArray<string>>>;

/** The hovered entry, else the pinned one. */
const entryReadout = (model: Model): Option.Option<string> =>
  Option.map(
    Option.flatMap(
      Option.orElse(model.hovered, () => model.selected),
      (id) => positionOf(model, id),
    ),
    ({ entry }) => describe(entry),
  );

/** What became of Copy link, said in the readout. */
const linkNotices = {
  copied: 'Link copied: it opens the radar on this view',
  refused: 'Couldn’t copy the link; the address bar has it',
} as const;

/**
 * An Easter egg under the pointer speaks first, then Copy link and the recorder, then
 * entries; with nothing to say the readout is empty and hidden, and the help button says how.
 */
const readout = (model: Model): string =>
  Option.getOrElse(
    Option.orElse(
      Option.orElse(
        Option.orElse(eggReadout(model), () =>
          Option.map(model.linkNotice, (notice) => linkNotices[notice]),
        ),
        () => model.tourNotice,
      ),
      () => entryReadout(model),
    ),
    () => '',
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
    .key(title)
    .class('e3-panel-section')
    .attr('aria-label', title)
    .children(
      h.div
        .class('e3-panel-heading-row')
        .children(h.h2.class('e3-panel-heading').children(title), ...actions),
      ...children,
    );

/** A small text action in a section's heading row. */
const headingAction = (h: Html.H<Message>, message: Message, label: string) =>
  h.button.class('e3-heading-action').attr('type', 'button').on('click', message).children(label);

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

/** The typeface picker, beside the theme picker. */
const typefacePicker = (model: Model, h: Html.H<Message>) =>
  h.select
    .class('e3-heading-select')
    .attr('aria-label', 'Typeface')
    .on('change', ({ value }) => Message.ChoseTypeface({ typeface: typefaceFrom(value) }))
    .children(
      ...Typeface.literals.map((typeface) =>
        h.option
          .attr('value', typeface)
          .selected(typeface === model.typeface)
          .children(typefaceLabels[typeface]),
      ),
    );

/** What each icon button shows, is called and does. */
const iconControls = {
  'turn-left': {
    glyph: '↺',
    label: 'Turn left',
    message: Message.ClickedTurn({ direction: 'left' }),
  },
  'turn-right': {
    glyph: '↻',
    label: 'Turn right',
    message: Message.ClickedTurn({ direction: 'right' }),
  },
  'zoom-out': { glyph: '−', label: 'Zoom out', message: Message.ClickedZoom({ direction: 'out' }) },
  'zoom-in': { glyph: '+', label: 'Zoom in', message: Message.ClickedZoom({ direction: 'in' }) },
} as const satisfies Readonly<
  Record<IconControl, Readonly<{ glyph: string; label: string; message: Message }>>
>;

/**
 * A small square button, its face a glyph. Its name is spoken, and a tooltip shows it on
 * hover or keyboard focus, as a `title` never does on focus or touch.
 */
const iconButton = (model: Model, h: Html.H<Message>, control: IconControl) => {
  const { glyph, label, message } = iconControls[control];
  return h.span
    .class('e3-tooltip-anchor')
    .attr('data-dismissed', Option.contains(model.dismissedTooltip, control) ? '' : undefined)
    .on('mouseleave', Message.LeftTooltip({ control }))
    .children(
      h.button
        .class('e3-button', 'e3-icon-button')
        .attr('type', 'button')
        .attr('aria-label', label)
        .on('click', message)
        .on('keydown', ({ key }) =>
          key === 'Escape' ? Message.DismissedTooltip({ control }) : undefined,
        )
        .on('blur', Message.LeftTooltip({ control }))
        .children(h.span.attr('aria-hidden', 'true').children(glyph)),
      h.span.class('e3-tooltip').attr('aria-hidden', 'true').children(label),
    );
};

const searchKeys = (model: Model, key: string): Message | undefined => {
  if (key === 'ArrowDown') return Message.MovedSearch({ offset: 1 });
  if (key === 'ArrowUp') return Message.MovedSearch({ offset: -1 });
  if (key === 'Escape' && model.searchOpen) return Message.ToggledSearch({ open: false });
  if (key !== 'Enter' || !model.searchOpen) return undefined;
  return Option.getOrUndefined(
    Option.map(model.activeSearchEntry, (id) => Message.PickedSearch({ id })),
  );
};

const searchBoxView = (model: Model, h: Html.H<Message>) => {
  const results = searchResults(model);
  const active = Option.filter(model.activeSearchEntry, (id) =>
    results.some(({ entry }) => entry.id === id),
  );
  return h.div.class('e3-search').children(
    h.div.class('e3-search-field').children(
      h.input
        .class('e3-text', 'e3-search-input')
        .attr('type', 'text')
        .attr('role', 'combobox')
        .attr('aria-label', 'Search entries')
        .attr('aria-autocomplete', 'list')
        .attr('aria-controls', 'radar-search-results')
        .attr('aria-expanded', String(model.searchOpen))
        .attr(
          'aria-activedescendant',
          model.searchOpen
            ? Option.getOrUndefined(Option.map(active, (id) => `radar-option-${id}`))
            : undefined,
        )
        .attr('placeholder', 'Search')
        .value(model.query)
        .on('input', ({ value: query }) => Message.TypedSearch({ query }))
        .on('keydown', ({ key, composing }) => (composing ? undefined : searchKeys(model, key)), {
          preventDefault: true,
        })
        .on('blur', Message.ToggledSearch({ open: false })),
      h.button
        .class('e3-search-toggle')
        .attr('type', 'button')
        .attr('tabindex', '-1')
        .attr('aria-label', 'List the entries')
        .attr('aria-expanded', String(model.searchOpen))
        .on('pointerdown', () => undefined, { preventDefault: 'always' })
        .on('click', Message.ToggledSearch({ open: !model.searchOpen }))
        .children('▾'),
    ),
    h.div
      .class('e3-search-items')
      .attr('id', 'radar-search-results')
      .attr('role', 'listbox')
      .attr('aria-label', 'Matching entries')
      .attr('hidden', model.searchOpen ? undefined : '')
      .children(
        ...categoryIds.map((category) => {
          const entries = results.filter(({ entry }) => entry.category === category);
          return entries.length === 0
            ? undefined
            : h.div
                .attr('role', 'group')
                .attr('aria-label', categoryLabels[category])
                .children(
                  h.span
                    .class('e3-search-heading')
                    .attr('aria-hidden', 'true')
                    .children(categoryLabels[category]),
                  ...entries.map(({ entry }) =>
                    h.div
                      .class('e3-search-item')
                      .attr('role', 'option')
                      .attr('id', `radar-option-${entry.id}`)
                      .attr('aria-selected', String(Option.contains(active, entry.id)))
                      .attr('data-active', Option.contains(active, entry.id) ? '' : undefined)
                      .attr(
                        'data-selected',
                        Option.contains(model.selected, entry.id) ? '' : undefined,
                      )
                      .on('pointerdown', () => undefined, { preventDefault: 'always' })
                      .on('click', Message.PickedSearch({ id: entry.id }))
                      .children(
                        h.span
                          .class('e3-search-entry')
                          .children(
                            h.span(entry.name),
                            h.span.class('e3-search-ring').children(ringLabels[entry.ring]),
                          ),
                      ),
                  ),
                );
        }),
      ),
  );
};

const findControls = (model: Model, h: Html.H<Message>) =>
  panelSection(h, 'Find', [
    h.div.class('e3-find').children(
      searchBoxView(model, h),
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
    [headingAction(h, Message.ClickedClearFilters(), 'Clear filters')],
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
          iconButton(model, h, 'turn-left'),
          iconButton(model, h, 'turn-right'),
          iconButton(model, h, 'zoom-out'),
          iconButton(model, h, 'zoom-in'),
        ),
      h.div
        .class('e3-grid-2')
        .children(
          button(h, 'Reset view', Message.ClickedResetView()),
          button(h, 'Universe view', Message.ClickedUniverse()),
        ),
    ],
    [typefacePicker(model, h), themePicker(model, h)],
  );

/**
 * Whether the relationships are drawn: a switch beside the heading, read as "Show
 * relationships". It sends the radar's own toggle, so a recorded tour still replays.
 */
const relationshipSwitch = (model: Model, h: Html.H<Message>) =>
  h.span
    .class('e3-switch')
    .children(
      h.span.class('e3-switch-label').attr('aria-hidden', 'true').children('Show'),
      h.button
        .class('e3-switch-track')
        .attr('role', 'switch')
        .attr('type', 'button')
        .attr('aria-label', 'Show relationships')
        .attr('aria-checked', String(model.showRelationships))
        .on('click', Message.ClickedRelationships())
        .children(h.span.class('e3-switch-thumb').children()),
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
    [relationshipSwitch(model, h)],
  );

/** One relationship of the pinned entry: choosing it pins the entry at the other end. */
const relationButton = (model: Model, h: Html.H<Message>, relation: Relation) =>
  h.li.children(
    h.button
      .class('e3-relation')
      .attr('type', 'button')
      .on('click', Message.ClickedRelay({ to: relation.other }))
      .children(
        h.span
          .class('e3-edge-swatch')
          .attr('aria-hidden', 'true')
          .style({
            borderTop: `3px ${relationshipLines[relation.type]} ${relationshipCss(themeOf(model), relation.type)}`,
          })
          .children(),
        h.span.children(
          h.span.class('e3-relation-type').children(`${relation.label} `),
          h.strong.children(
            Option.match(positionOf(model, relation.other), {
              onNone: () => relation.other,
              onSome: ({ entry }) => entry.name,
            }),
          ),
        ),
        h.span.class('e3-relation-note').children(relation.note),
      ),
  );

const relations = (model: Model, h: Html.H<Message>, id: string): View.Children<Message> =>
  Match.value(relationsOf(relationshipsOf(model), id)).pipe(
    Match.when(
      (list) => list.length === 0,
      () => [],
    ),
    Match.orElse((list) => [
      h.h4.children('Related'),
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

/** The pinned entry's full page, as it stood in the edition shown, when the site has one. */
const fullPageLink = (model: Model, h: Html.H<Message>, id: string): View.Children<Message> =>
  Option.match(fullPageOf(model, id), {
    onNone: () => [],
    onSome: (href) => [h.a.class('e3-full-page').attr('href', href).children('Full page')],
  });

/** Where an entry's source lives, as a short host name: "github.com". */
const hostOf = (url: string): string =>
  Option.match(Option.liftThrowable(() => new URL(url).hostname.replace(/^www\./, ''))(), {
    onNone: () => url,
    onSome: (host) => host,
  });

/**
 * The pinned entry's card: its category and ring, its name and summary, one row of actions
 * with the full page first, then what it relates to. On wide screens it floats over the
 * stage's top right (`stage`); on a phone it is the top of the controls' sheet (`sheet`),
 * where peek shows its first rows and half all of it.
 */
const details = (
  model: Model,
  h: Html.H<Message>,
  placement: 'stage' | 'sheet',
): View.Children<Message> =>
  Option.match(
    Option.flatMap(model.selected, (id) => positionOf(model, id)),
    {
      onNone: () => [],
      onSome: ({ entry }) => [
        h.section
          .key(`details-${placement}`)
          .class(`e3-details e3-details-${placement}`)
          .attr('aria-label', 'Selected entry')
          .style({ '--series': categoryCss(themeOf(model), entry.category) })
          .children(
            h.p
              .class('e3-details-meta')
              .children(
                h.span.class('e3-swatch').attr('aria-hidden', 'true').children(),
                categoryLabels[entry.category],
                h.span.class('e3-ring-badge').children(ringLabels[entry.ring]),
              ),
            h.h3.children(entry.name),
            h.p.class('e3-details-summary').children(entry.description),
            h.div
              .class('e3-details-actions')
              .children(
                ...fullPageLink(model, h, entry.id),
                button(h, 'Fly to', Message.ClickedFlyTo({ id: entry.id })),
                button(h, 'Copy link', Message.ClickedCopyLink()),
                h.button
                  .class('e3-button e3-details-more')
                  .attr('type', 'button')
                  .on('click', Message.ClickedMoreFromImmersive())
                  .children('More ↑'),
              ),
            h.p.class('e3-details-source').children(
              h.a
                .attr('href', entry.sourceUrl)
                .attr('target', '_blank')
                .attr('rel', 'noopener')
                .children(`Source · ${hostOf(entry.sourceUrl)}`),
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
  const label = `Entries (${visible.length} of ${presentOf(model).length})`;
  return h.div
    .key('Entries')
    .class('e3-table')
    .children(
      h.button
        .class('e3-table-toggle')
        .attr('type', 'button')
        .attr('aria-label', label)
        .attr('aria-controls', 'radar-entries')
        .attr('aria-expanded', String(model.entriesOpen))
        .attr('data-open', model.entriesOpen ? '' : undefined)
        .on('click', Message.ToggledEntries({ isOpen: !model.entriesOpen }))
        .children(label),
      h.div
        .class('e3-table-scroll')
        .attr('id', 'radar-entries')
        .attr('hidden', model.entriesOpen ? undefined : '')
        .children(entryList(model, h, visible)),
    );
};

/** The entries as a table: choosing one pins it and turns the radar to face it. */
const entryList = (model: Model, h: Html.H<Message>, visible: ReadonlyArray<RadarPosition>) =>
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
  );

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
const changeList = (model: Model, h: Html.H<Message>) =>
  Option.match(comparedWith(model), {
    onNone: () => editionChanges(model, h),
    onSome: (from) => comparisonChanges(model, h, from),
  });

/** What changed between the compared edition and the shown one, each a flight to its entry. */
const comparisonChanges = (model: Model, h: Html.H<Message>, from: number) => {
  const moves = movesOf(model, from);
  return moves.length === 0
    ? h.p.class('e3-note').attr('aria-live', 'polite').children('Nothing changed between them.')
    : h.ul
        .class('e3-timeline-changes e3-compare-changes')
        .attr('aria-live', 'polite')
        .children(
          ...moves.map(({ id, glyph, kind, text }) =>
            h.li.children(
              h.button
                .class('e3-since-change')
                .attr('type', 'button')
                .on('click', Message.ClickedFlyTo({ id }))
                .children(
                  h.span
                    .class(`e3-compare-glyph e3-compare-${kind}`)
                    .attr('aria-hidden', 'true')
                    .children(glyph),
                  text,
                ),
            ),
          ),
        );
};

const editionChanges = (model: Model, h: Html.H<Message>) => {
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
/**
 * Two editions side by side: pick an earlier edition to compare the shown one with, and
 * play the moves between them. Only offered when there is an earlier edition.
 */
const comparisonControls = (model: Model, h: Html.H<Message>): View.Children<Message> => {
  const editions = editionsOf(model);
  const earlier = editions.slice(0, model.edition);
  const chosen = Option.getOrElse(
    Option.map(comparedWith(model), (from) => String(from)),
    () => 'none',
  );
  const playing = Option.isSome(model.movePlayback);
  return earlier.length === 0
    ? []
    : [
        h.div.class('e3-controls e3-compare').children(
          h.select
            .class('e3-text')
            .attr('aria-label', 'Compare with an earlier edition')
            .on('change', ({ value }) =>
              Message.ChoseComparison({ index: value === 'none' ? null : Number(value) }),
            )
            .children(
              h.option
                .attr('value', 'none')
                .selected(chosen === 'none')
                .children('Compare with…'),
              ...earlier.map(({ label }, index) =>
                h.option
                  .attr('value', String(index))
                  .selected(String(index) === chosen)
                  .children(`↔ ${label}`),
              ),
            ),
          ...[
            h.button
              .class('e3-button')
              .attr('type', 'button')
              .disabled(playing || model.reducedMotion)
              .on('click', Message.ClickedPlayMoves())
              .children(playing ? 'Playing…' : '▶ Play the moves'),
          ].filter(() => Option.isSome(comparedWith(model)) || playing),
        ),
        // What the marks mean, while there is a comparison to read.
        ...[
          h.p.class('e3-compare-legend').children('▲▼ moved in or out · ✦ new · ↺ back · ◌ left'),
        ].filter(() => Option.isSome(comparedWith(model))),
      ];
};

/** The shown edition's own tour, when it changed anything and no tour is playing. */
const editionTourButton = (model: Model, h: Html.H<Message>): View.Children<Message> =>
  changesIn(model, model.edition).length > 0 && model.tour._tag !== 'Playing'
    ? [
        h.button
          .class('e3-button e3-edition-tour')
          .attr('type', 'button')
          .on('click', Message.ClickedEditionTour())
          .children(`▶ Tour the ${editionOf(model).label.toLowerCase()}`),
      ]
    : [];

const timeline = (model: Model, h: Html.H<Message>): View.Children<Message> => {
  const editions = editionsOf(model);
  const shown = editionOf(model);
  const playLabel = Match.value(model.playing).pipe(
    Match.when(true, () => 'Pause'),
    Match.orElse(() => 'Play'),
  );
  return [
    h.section
      .key('Timeline')
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
        ...comparisonControls(model, h),
        ...editionTourButton(model, h),
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

/** The help button in the breadcrumb: a popover listing the gestures for this pointer. */
const helpButton = (model: Model, h: Html.H<Message>) =>
  h.span.class('e3-help').children(
    h.button
      .class('e3-crumb', 'e3-crumb-icon', 'e3-crumb-help')
      .attr('type', 'button')
      .attr('aria-label', 'How to move round the radar')
      .attr('aria-controls', 'radar-help-panel')
      .attr('aria-expanded', String(model.helpOpen))
      .on('click', Message.ToggledHelp({ open: !model.helpOpen }))
      .children('?'),
    h.div
      .class('e3-help-panel')
      .attr('id', 'radar-help-panel')
      .popover('auto', model.helpOpen)
      .on('toggle', ({ newState }) => Message.ToggledHelp({ open: newState === 'open' }))
      .children(h.ul.children(...hints[model.input].map((hint) => h.li(hint)))),
  );

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
        .class('e3-crumb e3-crumb-icon e3-crumb-link')
        .attr('type', 'button')
        .attr('aria-label', 'Copy a link to this view')
        .attr('title', 'Copy a link to this view')
        .on('click', Message.ClickedCopyLink())
        .children('🔗'),
      h.button
        .class('e3-crumb e3-crumb-icon e3-crumb-minimap')
        .attr('type', 'button')
        .attr('aria-label', model.minimapShown ? 'Hide the minimap' : 'Show the minimap')
        .attr('aria-pressed', String(model.minimapShown))
        .on('click', Message.ClickedMinimap())
        .children('◎'),
      h.button
        .class('e3-crumb e3-crumb-icon e3-crumb-immersive')
        .attr('type', 'button')
        .attr(
          'aria-label',
          model.immersive ? 'Leave the full-screen radar' : 'Fill the screen with the radar',
        )
        .attr('title', model.immersive ? 'Leave full screen' : 'Full screen')
        .attr('aria-pressed', String(model.immersive))
        .on('click', Message.ClickedImmersive())
        .children(model.immersive ? '⤡' : '⤢'),
      helpButton(model, h),
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

/** The host page's links out, if it gave any: no empty navigation landmark otherwise. */
const linksOut = (model: Model, h: Html.H<Message>): View.Children<Message> =>
  model.links.length === 0
    ? []
    : [
        h.nav
          .class('e3-panel-links')
          .attr('aria-label', 'Elsewhere')
          .children(
            ...model.links.map(({ label, href }) => h.a.attr('href', href).children(label)),
          ),
      ];

/** What the sheet's text button does at each stop, and says. */
const sheetButtons = {
  peek: { to: 'half', label: 'More ↑' },
  half: { to: 'full', label: 'All controls ↑' },
  full: { to: 'peek', label: 'Show the radar ↓' },
} as const satisfies Readonly<Record<SheetStop, { to: SheetStop; label: string }>>;

/**
 * On a phone the sidebar is a sheet under the radar, with three stops (see sheet.ts). Its
 * handle is a strip to tap or swipe, and a button that does the same from a keyboard. The
 * handle is hidden on wider screens.
 */
const sheetGestures = Mount.makeStream('RadarSheetGestures', { args: {} }, (element: HTMLElement) =>
  Stream.callback<Message>((queue) => {
    const watch = Effect.sync(() => {
      const pressed = (event: PointerEvent) =>
        Queue.offerUnsafe(queue, Message.PressedSheetHandle({ y: event.screenY }));
      const released = (event: PointerEvent) =>
        Queue.offerUnsafe(queue, Message.ReleasedSheetHandle({ y: event.screenY }));
      element.addEventListener('pointerdown', pressed);
      element.addEventListener('pointerup', released);
      return () => {
        element.removeEventListener('pointerdown', pressed);
        element.removeEventListener('pointerup', released);
      };
    });
    return Effect.acquireRelease(watch, Effect.sync);
  }),
);

const sheetHandle = (model: Model, h: Html.H<Message>) => {
  const next = sheetButtons[model.sheet];
  return h.div
    .key('sheet-handle')
    .class('e3-sheet-handle')
    .children(
      h.div
        .class('e3-sheet-grip-area')
        .attr('aria-hidden', 'true')
        .onMount(sheetGestures())
        .children(h.span.class('e3-sheet-grip').children()),
      h.button
        .class('e3-sheet-stop')
        .attr('type', 'button')
        .on('click', Message.ChoseSheetStop({ stop: next.to }))
        .children(next.label),
    );
};

/** The sidebar's header: the radar's name, the shortcuts button and the links out. */
const header = (model: Model, h: Html.H<Message>) =>
  h.header
    .key('radar-header')
    .class('e3-panel-header')
    .children(
      h.div
        .class('e3-panel-title-row')
        .children(
          h.h1.class('e3-panel-title').children(model.title),
          h.button
            .class('e3-shortcuts-button')
            .attr('type', 'button')
            .attr('aria-label', 'Keyboard shortcuts')
            .attr('aria-expanded', String(model.shortcutsOpen))
            .on('click', Message.ClickedShortcuts())
            .children('?'),
        ),
      ...linksOut(model, h),
    );

/** What changed since the reader's last visit, until they dismiss it. */
const sinceVisitNote = (model: Model, h: Html.H<Message>): View.Children<Message> =>
  Option.match(model.sinceVisit, {
    onNone: () => [],
    onSome: ({ label, changes }) => [
      h.section
        .class('e3-since')
        .attr('aria-label', 'Since your last visit')
        .children(
          h.div
            .class('e3-since-head')
            .children(
              h.p
                .class('e3-since-title')
                .children(
                  `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} since your last visit`,
                ),
              h.button
                .class('e3-button')
                .attr('type', 'button')
                .attr('aria-label', 'Dismiss')
                .on('click', Message.ClickedDismissSinceVisit())
                .children('×'),
            ),
          h.p.class('e3-since-from').children(`You last saw the ${label.toLowerCase()}.`),
          h.ul
            .class('e3-since-list')
            .children(
              ...changes.map(({ id, text }) =>
                h.li.children(
                  h.button
                    .class('e3-since-change')
                    .attr('type', 'button')
                    .on('click', Message.ClickedFlyTo({ id }))
                    .children(text),
                ),
              ),
            ),
        ),
    ],
  });

/** The keyboard shortcuts, while `?` has them open: Esc, `?` or the button closes them. */
const shortcutList = (model: Model, h: Html.H<Message>): View.Children<Message> =>
  model.shortcutsOpen
    ? [
        h.section
          .class('e3-shortcuts')
          .attr('role', 'dialog')
          .attr('aria-labelledby', 'e3-shortcuts-title')
          .children(
            h.div
              .class('e3-shortcuts-head')
              .children(
                h.h2.attr('id', 'e3-shortcuts-title').children('Keyboard shortcuts'),
                h.button
                  .class('e3-button')
                  .attr('type', 'button')
                  .attr('aria-label', 'Close the shortcuts')
                  .on('click', Message.ClickedShortcuts())
                  .children('×'),
              ),
            h.dl.children(
              ...shortcuts.map(({ label, does }) =>
                h.div.children(h.dt.children(h.kbd.children(label)), h.dd.children(does)),
              ),
            ),
          ),
      ]
    : [];

/**
 * The sidebar: every control in one column beside the stage, in the order a reader
 * reaches for them, from finding an entry to the full list.
 */
const sidebar = (model: Model, h: Html.H<Message>) =>
  h.aside
    .key('radar-sidebar')
    .class('e3-sidebar')
    .attr('aria-label', 'Radar controls')
    .attr('data-sheet', model.sheet)
    .attr('data-pinned', String(Option.isSome(model.selected)))
    .children(
      sheetHandle(model, h),
      ...details(model, h, 'sheet'),
      header(model, h),
      findControls(model, h),
      ringControls(model, h),
      viewControls(model, h),
      ...timeline(model, h),
      legend(model, h),
      relationshipLegend(model, h),
      tourControls(model, h),
      entryTable(model, h),
    );

/**
 * The radar as a standalone app: the stage fills the screen beside the sidebar, with the
 * breadcrumb, readout, minimap and pinned entry floating over it, so nothing scrolls.
 */
const radar = (model: Model, h: Html.H<Message>): View.Children<Message> => [
  sidebar(model, h),
  h.div
    .key('radar-stage')
    .class('e3-stage-frame')
    .children(
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
      ...sinceVisitNote(model, h),
      ...shortcutList(model, h),
    ),
  ...details(model, h, 'stage'),
];

const content = (model: Model, h: Html.H<Message>): View.Children<Message> =>
  Match.value(model.data).pipe(
    Match.tag('Ready', () => radar(model, h)),
    Match.tag('Failure', ({ reason }) => [h.p.class('e3-readout').children(reason)]),
    Match.exhaustive,
  );

const radarMount = Mount.make('TechRadarReady', { args: {} }, () =>
  Effect.succeed(Message.MountedRadar()),
);

export const view = (h: Html.H<Message>, model: Model) =>
  h.div
    .class('e3-sample', 'e3-app')
    .attr('data-theme', themeOf(model))
    .attr('data-typeface', model.typeface)
    .attr('data-immersive', String(model.immersive))
    .attr('data-minimap', String(model.minimapShown))
    .style({ ...cssVariables(themeOf(model)), ...typeVariables(model.typeface) })
    .onMount(radarMount())
    .children(...content(model, h));
