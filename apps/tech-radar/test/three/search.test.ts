import { describe, expect, test } from 'bun:test';

import { Combobox } from '@foldkit/ui';
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
const search = (message: Combobox.Message) => Message.GotSearchMessage({ message });
const typed = (value: string) => search(Combobox.Message.UpdatedInputValue({ value }));
const picked = (item: string) =>
  search(Combobox.Message.SelectedItem({ item, displayText: item, wasSelected: false }));

describe('the search box', () => {
  test('typing searches the radar as the search box always has, and opens its list', () => {
    const searching = step(start, typed('bun'));
    expect(searching.query).toBe('bun');
    expect(searching.entriesOpen).toBe(true);
    expect(searching.search.isOpen).toBe(true);
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
    expect(chosen.search.isOpen).toBe(false);
    expect(chosen.query).toBe('bun');
    expect(chosen.search.inputValue).toBe('bun');
  });

  test('follows the query however it changes: a link, a tour step or Clear filters', () => {
    const linked = init({ dataset: demoRadar, link: { q: 'effect' } }).model;
    expect(linked.search.inputValue).toBe('effect');
    const replayed = step(start, Message.ChangedQuery({ query: 'elm' }));
    expect(replayed.search.inputValue).toBe('elm');
    expect(step(replayed, Message.ClickedClearFilters()).search.inputValue).toBe('');
  });

  test('records typing and picking as the search and pick they make, not the list moves', () => {
    const recorded = steps(start, [
      Message.ClickedRecord(),
      typed('b'),
      typed('bu'),
      search(
        Combobox.Message.ActivatedItem({
          index: 0,
          activationTrigger: 'Keyboard',
          maybeImmediateSelection: Option.none(),
        }),
      ),
      picked('bun'),
    ]);
    const moves = recorded.tour._tag === 'Idle' ? [] : recorded.tour.recording.steps;
    expect(moves).toEqual([
      Message.ChangedQuery({ query: 'bu' }),
      Message.ClickedEntry({ id: 'bun' }),
    ]);
  });
});
