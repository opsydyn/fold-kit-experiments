/**
 * The flight recorder: a session recorded as the reader's own moves, replayed as a guided
 * tour. Every interaction is already a Message, so a recording is just the Messages the
 * reader sent, in order, from a deep link of where they started; replaying it is a fold
 * over `update`. Drags, hovers and animation frames are left out: a tour is the named
 * moves, not mouse noise. Pacing is by kind of move, never wall-clock time, so a tour plays
 * the same every time. Pure.
 */
import { Match, Option } from 'effect';

import { categoryLabels, ringLabels } from './data';
import { idOfSaucer } from './easter';
import { invasionLength } from './invaders';
import type { Message } from './message';
import { type CategoryFilter, editionsOf, idOfBlip, type Model, positionOf } from './model';
import { themeLabels } from './themes';
import { playStep } from './timeline';

/** A recording: where it began, as a deep link, and the moves made from there. */
export type Recording = Readonly<{ start: string; steps: ReadonlyArray<Message> }>;

/**
 * The recorder: idle; recording; holding a finished recording; or playing one, with the
 * index of the next move, the time until it, and the caption of the move last made.
 */
export type Tour =
  | Readonly<{ _tag: 'Idle' }>
  | Readonly<{ _tag: 'Recording'; recording: Recording }>
  | Readonly<{ _tag: 'Ready'; recording: Recording }>
  | Readonly<{
      _tag: 'Playing';
      recording: Recording;
      next: number;
      wait: number;
      caption: string;
    }>;

export const idleTour: Tour = { _tag: 'Idle' };

/** Whether a tour is playing, so the frame clock runs. */
export const isPlaying = (tour: Tour): boolean =>
  Match.value(tour).pipe(
    Match.tag('Playing', () => true),
    Match.orElse(() => false),
  );

/** The moves a tour keeps: the reader's named intents. */
export const recordable: ReadonlySet<Message['_tag']> = new Set([
  'ClickedEntry',
  'ClickedFlyTo',
  'DoubleClickedBlip',
  'ClickedBlip',
  'ClickedEmptySpace',
  'ClickedCluster',
  'ClickedUniverse',
  'ClickedResetView',
  'ClickedTurn',
  'ClickedZoom',
  'ClickedRelay',
  'ChangedEdition',
  'ClickedPlay',
  'ChangedQuery',
  'ChangedCategory',
  'ClickedRing',
  'ClickedClearFilters',
  'ClickedRelationships',
  'ChoseTheme',
  'ClickedMonolith',
  'EnteredKonamiCode',
]);

export const isRecordable = (message: Message): boolean => recordable.has(message._tag);

/** Moves made a keystroke at a time. */
const typed: ReadonlySet<string> = new Set(['ChangedQuery']);

/**
 * A move added to a recording. Typing a search is one move, not one per keystroke: a
 * search right after a search replaces it.
 */
export const recorded = (recording: Recording, message: Message): Recording => {
  const last = recording.steps.at(-1);
  const typing = typed.has(last?._tag ?? '') && typed.has(message._tag);
  return {
    ...recording,
    steps: [...recording.steps.slice(0, recording.steps.length - Number(typing)), message],
  };
};

/** How long a tour waits before its first move. */
export const leadIn = 900;

/** The wait after a flight: long enough for the camera to land. */
const flight = 2600;

/**
 * How long a tour lingers after a move before the next: a flight until it lands, a pin or
 * a scrub long enough to read, the timeline until it has played through.
 */
export const paceOf = (model: Model, message: Message): number =>
  Match.value(message).pipe(
    Match.tags({
      ClickedEntry: () => flight,
      ClickedFlyTo: () => flight,
      DoubleClickedBlip: () => flight,
      ClickedCluster: () => flight,
      ClickedUniverse: () => flight,
      ClickedResetView: () => flight,
      ClickedRelay: () => flight,
      ClickedPlay: () => (editionsOf(model).length - model.edition) * playStep + 600,
      EnteredKonamiCode: () => invasionLength / 3,
      ClickedBlip: () => 1500,
      ClickedEmptySpace: () => 1200,
      ChangedEdition: () => 1500,
      ChoseTheme: () => 1500,
      ClickedMonolith: () => 1500,
    }),
    Match.orElse(() => 1200),
  );

const nameOf = (model: Model, id: string): string =>
  Option.match(positionOf(model, id), { onNone: () => id, onSome: ({ entry }) => entry.name });

/** What a key that is not a blip names: a saucer, or just a blip. */
const unnamed = (key: string): string =>
  Option.match(idOfSaucer(key), { onNone: () => 'a blip', onSome: () => 'a saucer' });

const blipName = (model: Model, key: string): string =>
  Option.match(idOfBlip(key), {
    onNone: () => unnamed(key),
    onSome: (id) => nameOf(model, id),
  });

const searchCaption = (query: string): string =>
  Option.match(
    Option.liftPredicate(query.trim(), (typedQuery) => typedQuery.length > 0),
    {
      onNone: () => 'Clears the search',
      onSome: (typedQuery) => `Searches for “${typedQuery}”`,
    },
  );

const categoryCaption = (category: CategoryFilter): string =>
  Match.value(category).pipe(
    Match.when('all', () => 'Shows every category'),
    Match.orElse((shown) => `Shows only ${categoryLabels[shown]}`),
  );

/** A move in words, for the caption bar, as it reads in the radar it is made in. */
export const captionOf = (model: Model, message: Message): string =>
  Match.value(message).pipe(
    Match.tags({
      ClickedEntry: ({ id }) => `Picks ${nameOf(model, id)}`,
      ClickedFlyTo: ({ id }) => `Flies to ${nameOf(model, id)}`,
      DoubleClickedBlip: ({ key }) => `Flies to ${blipName(model, key)}`,
      ClickedBlip: ({ key }) => `Pins ${blipName(model, key)}`,
      ClickedEmptySpace: () => 'Lets go of the pin',
      ClickedCluster: ({ category }) => `Stops at ${categoryLabels[category]}`,
      ClickedUniverse: () => 'Rises above the radar',
      ClickedResetView: () => 'Back to the start',
      ClickedTurn: ({ direction }) => `Turns ${direction}`,
      ClickedZoom: ({ direction }) => `Zooms ${direction}`,
      ClickedRelay: ({ to }) => `Follows a relationship to ${nameOf(model, to)}`,
      ChangedEdition: ({ index }) =>
        `Scrubs to the ${editionsOf(model)[index]?.label.toLowerCase() ?? 'timeline'}`,
      ClickedPlay: () => 'Plays the timeline',
      ChangedQuery: ({ query }) => searchCaption(query),
      ChangedCategory: ({ category }) => categoryCaption(category),
      ClickedRing: ({ ring }) => `Toggles ${ringLabels[ring]}`,
      ClickedClearFilters: () => 'Clears the filters',
      ClickedRelationships: () => 'Toggles the relationships',
      ChoseTheme: ({ choice }) => `Switches to ${themeLabels[choice]}`,
      ClickedMonolith: () => 'Touches the Monolith',
      EnteredKonamiCode: () => 'Enters the Konami code',
    }),
    Match.orElse(() => ''),
  );
