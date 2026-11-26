import { Option } from 'effect';

import { categoryIds } from './data';
import type { RadarPosition } from './layout';
import { type Model, visibleOf } from './model';

/** Search options are the visible entries, grouped in the same order as the radar. */
export const searchResults = (model: Model): ReadonlyArray<RadarPosition> =>
  [...visibleOf(model)].sort(
    (a, b) => categoryIds.indexOf(a.entry.category) - categoryIds.indexOf(b.entry.category),
  );

export const nextResult = (model: Model, offset: -1 | 1): Option.Option<string> => {
  const entries = searchResults(model);
  const current = entries.findIndex(({ entry }) =>
    Option.contains(model.activeSearchEntry, entry.id),
  );
  const next =
    current < 0 && offset < 0
      ? entries.length - 1
      : Math.max(0, Math.min(entries.length - 1, current + offset));
  return Option.fromNullishOr(entries[next]?.entry.id);
};
