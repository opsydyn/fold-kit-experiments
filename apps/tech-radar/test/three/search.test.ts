import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { Message } from '../../src/radar/three/message';
import type { Model } from '../../src/radar/three/model';
import { searchResults } from '../../src/radar/three/search';
import { init, update } from '../../src/radar/three/update';
import { demoRadar } from '../../src/test/fixture';

const start = init({ dataset: demoRadar }).model;
const step = (model: Model, message: Message): Model => update(model, message).model;
const steps = (model: Model, messages: ReadonlyArray<Message>): Model =>
  messages.reduce(step, model);
const typed = (query: string) => Message.TypedSearch({ query });
const picked = (id: string) => Message.PickedSearch({ id });

describe('the search box', () => {
  test('typing searches the radar as the search box always has, and opens its list', () => {
    const searching = step(start, typed('bun'));
    expect(searching.query).toBe('bun');
    expect(searching.entriesOpen).toBe(true);
    expect(searching.searchOpen).toBe(true);
    expect(searchResults(searching).map(({ entry }) => entry.id)).toContain('bun');
  });

  test('lists what the radar shows, a category at a time', () => {
    const categories = searchResults(start).map(({ entry }) => entry.category);
    const changes = categories.filter((category, index) => category !== categories[index - 1]);
    expect(new Set(changes).size).toBe(changes.length);
  });

  test('picking an entry pins it and closes the list, keeping the search', () => {
    const chosen = steps(start, [typed('bun'), picked('bun')]);
    expect(chosen.selected).toEqual(Option.some('bun'));
    expect(chosen.searchOpen).toBe(false);
    expect(chosen.query).toBe('bun');
    expect(chosen.query).toBe('bun');
  });

  test('follows the query however it changes: a link, a tour step or Clear filters', () => {
    const linked = init({ dataset: demoRadar, link: { q: 'effect' } }).model;
    expect(linked.query).toBe('effect');
    const replayed = step(start, Message.ChangedQuery({ query: 'elm' }));
    expect(replayed.query).toBe('elm');
    expect(step(replayed, Message.ClickedClearFilters()).query).toBe('');
  });

  test('highlights a matching option from the keyboard and clears it on close', () => {
    const searching = step(start, typed('bun'));
    const moved = step(searching, Message.MovedSearch({ offset: 1 }));
    expect(moved.activeSearchEntry).toEqual(Option.some('bun'));
    const closed = step(moved, Message.ToggledSearch({ open: false }));
    expect(closed.searchOpen).toBe(false);
    expect(closed.activeSearchEntry).toEqual(Option.none());
  });

  test('records typing and picking as the search and pick they make, not the list moves', () => {
    const recorded = steps(start, [
      Message.ClickedRecord(),
      typed('b'),
      typed('bu'),
      Message.MovedSearch({ offset: 1 }),
      picked('bun'),
    ]);
    const moves = recorded.tour._tag === 'Idle' ? [] : recorded.tour.recording.steps;
    expect(moves).toEqual([
      Message.ChangedQuery({ query: 'bu' }),
      Message.ClickedEntry({ id: 'bun' }),
    ]);
  });
});
