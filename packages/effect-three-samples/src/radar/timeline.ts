/**
 * The radar over time: what changed in each edition, said in words for the timeline, and
 * how long playback lingers on each. Pure, so it is tested without a browser.
 */
import { Match, Option } from 'effect';

import { type RadarEntry, type Ring, ringLabels } from './data';
import { type Edition, editionsOf, type Model } from './model';

/** How long playback shows each edition before moving on, in milliseconds. */
export const playStep = 2200;

const ringIn = (edition: Edition, id: string, current: Ring): Ring => edition.rings[id] ?? current;
const presentIn = (edition: Edition, id: string): boolean => !edition.absent.includes(id);

/** One entry's change from the edition before, in words, or nothing if it held still. */
const changeOf = (before: Edition, now: Edition, entry: RadarEntry): ReadonlyArray<string> => {
  const was = ringIn(before, entry.id, entry.ring);
  const is = ringIn(now, entry.id, entry.ring);
  return Match.value({
    joined: !presentIn(before, entry.id) && presentIn(now, entry.id),
    left: presentIn(before, entry.id) && !presentIn(now, entry.id),
    moved: presentIn(now, entry.id) && was !== is,
  }).pipe(
    Match.when({ joined: true }, () => [`${entry.name} joined in ${ringLabels[is]}`]),
    Match.when({ left: true }, () => [`${entry.name} left the radar`]),
    Match.when({ moved: true }, () => [
      `${entry.name} moved from ${ringLabels[was]} to ${ringLabels[is]}`,
    ]),
    Match.orElse(() => []),
  );
};

/** What changed in the `index`th edition since the one before it; nothing for the first. */
export const changesIn = (model: Model, index: number): ReadonlyArray<string> => {
  const editions = editionsOf(model);
  const pair = Option.all([
    Option.fromNullishOr(editions[index - 1]),
    Option.fromNullishOr(editions[index]),
  ]);
  const entries = Match.value(model.data).pipe(
    Match.tag('Ready', ({ dataset }) => dataset.entries),
    Match.orElse((): ReadonlyArray<RadarEntry> => []),
  );
  return Option.match(pair, {
    onNone: () => [],
    onSome: ([before, now]) => entries.flatMap((entry) => changeOf(before, now, entry)),
  });
};
