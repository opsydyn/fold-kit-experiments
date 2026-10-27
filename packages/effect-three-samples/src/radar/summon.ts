/**
 * Magic words: typed into the radar's search, each summons an Easter egg rather than
 * filtering the entries. No entry is named by one, so passing them over loses nothing.
 */
import { Option } from 'effect';

import type { MonolithState } from './model';

export const magicWords = ['monolith', 'microservices', '42', 'cobol'] as const;
export type MagicWord = (typeof magicWords)[number];

/** The words that bring the Monolith, from any view: whole, or already shattered. */
export const monolithSummons = {
  monolith: 'whole',
  microservices: 'shattered',
  '42': null,
  cobol: null,
} as const satisfies Readonly<Record<MagicWord, MonolithState | null>>;

/** The Monolith a search calls for, in the state it is called in, if it calls for one. */
export const summonedMonolith = (query: string): Option.Option<MonolithState> =>
  Option.flatMap(summoned(query), (word) => Option.fromNullishOr(monolithSummons[word]));

/** What a search is told in the readout, if its word has an answer. */
export const answers = {
  monolith: null,
  microservices: null,
  '42': 'Deep Thought has computed the answer. The question is still being worked on.',
  cobol: null,
} as const satisfies Readonly<Record<MagicWord, string | null>>;

/** The egg a search summons: the whole query, trimmed and in any case, must be the word. */
export const summoned = (query: string): Option.Option<MagicWord> => {
  const typed = query.trim().toLowerCase();
  return Option.fromNullishOr(magicWords.find((word) => word === typed));
};
