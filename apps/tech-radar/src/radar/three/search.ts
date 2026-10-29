/**
 * The sidebar's search: a FoldKit UI Combobox over the entries. Typing filters the radar,
 * as the search box always has, and lists the entries it shows; picking one pins it and
 * turns the radar to face it, as a row of the entries table does.
 *
 * The radar's `query` stays the source of truth: tours, deep links and Clear filters set
 * it, and the Combobox's input follows it.
 *
 * @module
 */
import { Combobox } from '@foldkit/ui';
import { Match, Option } from 'effect';

import { categoryIds } from './data';
import type { RadarPosition } from './layout';
import { Message } from './message';
import { type Model, visibleOf } from './model';

/** The Combobox, its items the entries' ids. */
export const searchBox = Combobox.create<string>();

/** The entries the search lists: those the radar shows, a category at a time. */
export const searchResults = (model: Model): ReadonlyArray<RadarPosition> =>
  [...visibleOf(model)].sort(
    (a, b) => categoryIds.indexOf(a.entry.category) - categoryIds.indexOf(b.entry.category),
  );

/** The Combobox's input showing the radar's query, however the query was last set. */
export const withSearchText = (model: Model): Model =>
  Match.value(model.search.inputValue === model.query).pipe(
    Match.when(true, () => model),
    Match.orElse(() => ({ ...model, search: { ...model.search, inputValue: model.query } })),
  );

/**
 * A search Message as the move a tour records: typing as `ChangedQuery` and picking an
 * entry as `ClickedEntry`, the moves they make. Opening, closing and moving through the
 * list are not moves.
 */
export const searchMove = (message: Combobox.Message): Option.Option<Message> =>
  Match.value(message).pipe(
    Match.tag('UpdatedInputValue', ({ value }) =>
      Option.some<Message>(Message.ChangedQuery({ query: value })),
    ),
    Match.tag('SelectedItem', ({ item }) =>
      Option.some<Message>(Message.ClickedEntry({ id: item })),
    ),
    Match.orElse(() => Option.none<Message>()),
  );
