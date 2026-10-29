/**
 * Magic words: typed into the radar's search, each summons an Easter egg. Most filter
 * nothing, since no entry is named by one; the stack's own names (FoldKit, Effect) are
 * entries too, so they still find them while their eggs play.
 */
import { Option } from 'effect';

import type { MonolithState } from './model';

export const magicWords = [
  'monolith',
  'microservices',
  '42',
  'cobol',
  'kafka',
  'astro',
  'foldkit',
  'effect',
] as const;
export type MagicWord = (typeof magicWords)[number];

/** The words that bring the Monolith, from any view: whole, or already shattered. */
export const monolithSummons = {
  monolith: 'whole',
  microservices: 'shattered',
  '42': null,
  cobol: null,
  kafka: null,
  astro: null,
  foldkit: null,
  effect: null,
} as const satisfies Readonly<Record<MagicWord, MonolithState | null>>;

/** The Monolith a search calls for, in the state it is called in, if it calls for one. */
export const summonedMonolith = (query: string): Option.Option<MonolithState> =>
  Option.flatMap(summoned(query), (word) => Option.fromNullishOr(monolithSummons[word]));

/** What a search is told in the readout, if its word has an answer. */
export const answers = {
  monolith: null,
  microservices: null,
  '42': 'Deep Thought has computed the answer. The question is still being worked on. Ask the probe that is still running.',
  cobol: null,
  kafka: 'Kafka: one append-only log, replayed along every Builds on edge in turn',
  astro: 'Astro: zero JavaScript by default. Only the islands move.',
  foldkit: null,
  effect: null,
} as const satisfies Readonly<Record<MagicWord, string | null>>;

/** Words that name entries too: they still search for them while their eggs play. */
const stillSearches: ReadonlySet<MagicWord> = new Set(['foldkit', 'effect']);

/** The query the radar filters by: a magic word filters nothing, unless it names an entry. */
export const filterQuery = (query: string): string =>
  Option.match(summoned(query), {
    onNone: () => query,
    onSome: (word) => (stillSearches.has(word) ? query : ''),
  });

/** The egg a search summons: the whole query, trimmed and in any case, must be the word. */
export const summoned = (query: string): Option.Option<MagicWord> => {
  const typed = query.trim().toLowerCase();
  return Option.fromNullishOr(magicWords.find((word) => word === typed));
};
