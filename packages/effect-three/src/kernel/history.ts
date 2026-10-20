/**
 * Undo and branching history from an immutable Model (roadmap, "Beyond parity" 4). A
 * Model's values are never changed in place, so keeping every one costs only the
 * references: a history is a tree of them. Recording after an undo starts a new branch
 * and keeps the old future as another, so nothing done is ever lost; redo follows the
 * branch last taken, and `chooseBranch` or `jumpTo` take another.
 *
 * Entries are numbered in the order they were recorded, from 0 (the first value), and
 * each names the entry it followed. Pure data with a schema (`SceneSchema.History`),
 * so a history can be saved, sent or inspected like the rest of the Model. Use it as a
 * namespace: `History.make(value)`, `History.record(history, next, 'Moved crate')`.
 *
 * @module
 */

/** A value in the history: the entry it followed, and the one redo goes to from it. */
export type HistoryEntry<A> = {
  readonly id: number;
  /** The entry this one followed, `null` for the first. */
  readonly parent: number | null;
  /** A few words for the change that made it, for a list of steps. */
  readonly label: string;
  readonly value: A;
  /** The entry redo goes to from here: the branch last taken, `null` with none. */
  readonly next: number | null;
};

export type History<A> = {
  /** Every value recorded, by id. */
  readonly entries: ReadonlyArray<HistoryEntry<A>>;
  /** The present value's id. */
  readonly current: number;
};

/** A history holding `value` alone. */
export const make = <A>(value: A, label = 'Start'): History<A> => ({
  entries: [{ id: 0, parent: null, label, value, next: null }],
  current: 0,
});

const entryOf = <A>(state: History<A>, id: number): HistoryEntry<A> => {
  const entry = state.entries[id];
  // Ids are indices, made only here: one out of range is a broken history.
  if (entry === undefined) throw new RangeError(`No history entry ${id}`);
  return entry;
};

/** The present entry. */
export const presentEntry = <A>(state: History<A>): HistoryEntry<A> =>
  entryOf(state, state.current);

/** The present value. */
export const present = <A>(state: History<A>): A => presentEntry(state).value;

const withNext = <A>(state: History<A>, id: number, next: number): History<A> => ({
  ...state,
  entries: state.entries.map((entry) => (entry.id === id ? { ...entry, next } : entry)),
});

/** `value` after the present, labelled: the new present, its own branch after an undo. */
export const record = <A>(state: History<A>, value: A, label: string): History<A> => {
  const id = state.entries.length;
  const grown: History<A> = {
    entries: [...state.entries, { id, parent: state.current, label, value, next: null }],
    current: id,
  };
  return withNext(grown, state.current, id);
};

/** Whether there is a value before the present. */
export const canUndo = <A>(state: History<A>): boolean => presentEntry(state).parent !== null;

/** Whether there is a value after the present on the branch last taken. */
export const canRedo = <A>(state: History<A>): boolean => presentEntry(state).next !== null;

/** Back one value; at the first, as it was. */
export const undo = <A>(state: History<A>): History<A> => {
  const parent = presentEntry(state).parent;
  return parent === null ? state : { ...state, current: parent };
};

/** Forward one value along the branch last taken; at its end, as it was. */
export const redo = <A>(state: History<A>): History<A> => {
  const next = presentEntry(state).next;
  return next === null ? state : { ...state, current: next };
};

/** The entries that followed the present: one per branch, in the order recorded. */
export const branches = <A>(state: History<A>): ReadonlyArray<HistoryEntry<A>> =>
  state.entries.filter((entry) => entry.parent === state.current);

/** Redo from the present goes to `id`, when it is one of the present's branches. */
export const chooseBranch = <A>(state: History<A>, id: number): History<A> =>
  branches(state).some((entry) => entry.id === id) ? withNext(state, state.current, id) : state;

/** The entries from the first to `id`, in order. */
export const pathTo = <A>(state: History<A>, id: number): ReadonlyArray<HistoryEntry<A>> => {
  const path: Array<HistoryEntry<A>> = [];
  for (let at: number | null = id; at !== null; at = entryOf(state, at).parent) {
    path.unshift(entryOf(state, at));
  }
  return path;
};

/**
 * Straight to entry `id`, wherever it is in the tree, with each step to it the branch
 * redo takes, so undoing and redoing comes back to it.
 */
export const jumpTo = <A>(state: History<A>, id: number): History<A> => {
  const path = pathTo(state, id);
  const chosen = path
    .slice(1)
    .reduce((at, entry) => withNext(at, entry.parent ?? 0, entry.id), state);
  return { ...chosen, current: id };
};

/** How many steps the present is from the first value. */
export const depth = <A>(state: History<A>): number => pathTo(state, state.current).length - 1;
