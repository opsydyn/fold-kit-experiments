/**
 * The radar's keyboard shortcuts: one table that both the key bindings and the list `?`
 * opens are built from, so the two never disagree. They are ignored while typing in a
 * field, as FoldKit's key bindings are.
 */
import { Schema } from 'effect';

export const Shortcut = Schema.Literals([
  'focus-search',
  'next-entry',
  'previous-entry',
  'next-edition',
  'previous-edition',
  'fly-to',
  'open-page',
  'reset-view',
  'clear',
  'toggle-help',
]);
export type Shortcut = typeof Shortcut.Type;

/** Each shortcut's keys, as FoldKit binds them, and how the list shows them. */
export const shortcuts: ReadonlyArray<
  Readonly<{ shortcut: Shortcut; keys: ReadonlyArray<string>; label: string; does: string }>
> = [
  { shortcut: 'focus-search', keys: ['/'], label: '/', does: 'Search' },
  { shortcut: 'next-entry', keys: ['J'], label: 'J', does: 'Next entry' },
  { shortcut: 'previous-entry', keys: ['K'], label: 'K', does: 'Previous entry' },
  { shortcut: 'fly-to', keys: ['F'], label: 'F', does: 'Fly to the pinned entry' },
  { shortcut: 'open-page', keys: ['O'], label: 'O', does: "Open the pinned entry's page" },
  { shortcut: 'next-edition', keys: [']'], label: ']', does: 'Next edition' },
  { shortcut: 'previous-edition', keys: ['['], label: '[', does: 'Previous edition' },
  { shortcut: 'reset-view', keys: ['R'], label: 'R', does: 'Reset the view' },
  { shortcut: 'clear', keys: ['Escape'], label: 'Esc', does: 'Unpin, or close this list' },
  // `?` is Shift and `/` on most layouts (some report the `/`), and a key of its own on some.
  {
    shortcut: 'toggle-help',
    keys: ['?', 'Shift+?', 'Shift+/'],
    label: '?',
    does: 'Show these shortcuts',
  },
];
