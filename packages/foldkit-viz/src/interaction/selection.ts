export type SelectionAxis = 'x' | 'y';

export type Selection =
  | Readonly<{ _tag: 'None' }>
  | Readonly<{ _tag: 'Interval'; axis: SelectionAxis; domain: readonly [number, number] }>
  | Readonly<{ _tag: 'Keys'; keys: ReadonlyArray<string> }>;

export const SELECTION_NONE: Selection = { _tag: 'None' };

export const intervalSelection = (
  axis: SelectionAxis,
  [first, second]: readonly [number, number],
): Selection => {
  const domain: readonly [number, number] = [Math.min(first, second), Math.max(first, second)];
  return domain[0] === domain[1] ? SELECTION_NONE : { _tag: 'Interval', axis, domain };
};

export const keySelection = (keys: ReadonlyArray<string>): Selection => {
  const unique = [...new Set(keys)];
  return unique.length === 0 ? SELECTION_NONE : { _tag: 'Keys', keys: unique };
};

export const clampSelection = (
  selection: Selection,
  bounds: readonly [number, number],
): Selection => {
  if (selection._tag !== 'Interval') return selection;
  const [lower, upper] = [Math.min(...bounds), Math.max(...bounds)];
  if (selection.domain[1] <= lower || selection.domain[0] >= upper) return SELECTION_NONE;
  return intervalSelection(selection.axis, [
    Math.max(lower, selection.domain[0]),
    Math.min(upper, selection.domain[1]),
  ]);
};

export const selectionContainsValue = (
  selection: Selection,
  axis: SelectionAxis,
  value: number,
): boolean =>
  selection._tag === 'Interval' &&
  selection.axis === axis &&
  value >= selection.domain[0] &&
  value <= selection.domain[1];

export const selectionContainsKey = (selection: Selection, key: string): boolean =>
  selection._tag === 'Keys' && selection.keys.includes(key);
