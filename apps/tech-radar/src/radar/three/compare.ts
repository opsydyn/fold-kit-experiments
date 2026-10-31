/**
 * Two editions side by side on one radar: the edition shown, against an earlier one. Each
 * entry keeps its bearing across editions and only its ring changes, so every change has
 * a place and a story, told with the symbols the full pages use:
 *
 * - ▲ / ▼ moved in or out: a ghost where it stood, a line to where it stands, a chevron
 *   on the line pointing the way it went.
 * - ✦ new: first light, a shockwave and a burst where it ignites, then a halo.
 * - ↺ returned (on an edition before the earlier one, absent from it): a periodic comet,
 *   its tail curving back along its orbit.
 * - ◌ left: an event horizon, a dashed ring collapsing on where it stood.
 *
 * The arrivals play on `compareClock`; "Play the moves" shows the earlier edition for a
 * beat, then the shown one, and the blips glide between them. Pure, so it is tested
 * without a browser.
 */
import type { Vec3 } from '@opsydyn/effect-three';
import { Option } from 'effect';

import { type Category, type Ring, ringIds, ringLabels } from './data';
import { editionsOf, type Model, positionsOf } from './model';
import { blipPosition } from './space';

/** How an entry changed between the two editions. */
export type MoveKind = 'in' | 'out' | 'new' | 'returned' | 'left';

/** One entry's change: where it was and is, and how the comparison tells it. */
export type Move = Readonly<{
  id: string;
  name: string;
  category: Category;
  kind: MoveKind;
  /** Where it stood in the earlier edition, or where it stands for one that arrived. */
  from: Vec3;
  /** Where it stands in the shown edition, or stood for one that left. */
  to: Vec3;
  longitude: number;
  latitude: number;
  ring: Ring;
  glyph: string;
  text: string;
}>;

/** Each kind's symbol, as the full pages show an entry's status. */
export const glyphs = {
  in: '▲',
  out: '▼',
  new: '✦',
  returned: '↺',
  left: '◌',
} as const satisfies Readonly<Record<MoveKind, string>>;

/** The edition at `index`, as the Model would show it. */
const at = (model: Model, index: number): Model => ({ ...model, edition: index });

const absentIn = (model: Model, index: number): ReadonlySet<string> =>
  new Set(editionsOf(model)[index]?.absent ?? []);

/** Whether the entry was on the radar in any edition before `index`. */
const seenBefore = (model: Model, id: string, index: number): boolean =>
  editionsOf(model)
    .slice(0, index)
    .some(({ absent }) => !absent.includes(id));

const kindOf = (
  model: Model,
  from: number,
  id: string,
  rings: Readonly<{ then: Ring; now: Ring }>,
): Option.Option<MoveKind> => {
  const was = !absentIn(model, from).has(id);
  const is = !absentIn(model, model.edition).has(id);
  const inward = ringIds.indexOf(rings.now) < ringIds.indexOf(rings.then);
  return !was && is
    ? Option.some(seenBefore(model, id, from) ? 'returned' : 'new')
    : was && !is
      ? Option.some('left')
      : is && rings.then !== rings.now
        ? Option.some(inward ? 'in' : 'out')
        : Option.none();
};

/** A change in words, after its symbol. */
const textOf = (kind: MoveKind, name: string, rings: Readonly<{ then: Ring; now: Ring }>) =>
  ({
    in: `${name} · ${ringLabels[rings.then]} → ${ringLabels[rings.now]}`,
    out: `${name} · ${ringLabels[rings.then]} → ${ringLabels[rings.now]}`,
    new: `${name} · new in ${ringLabels[rings.now]}`,
    returned: `${name} · back in ${ringLabels[rings.now]}`,
    left: `${name} · left the radar`,
  })[kind];

/** Each entry's change from the edition at `from` to the one shown. */
export const movesOf = (model: Model, from: number): ReadonlyArray<Move> => {
  const then = new Map(
    positionsOf(at(model, from)).map((position) => [position.entry.id, position]),
  );
  return positionsOf(model).flatMap((now): ReadonlyArray<Move> => {
    const { id, name, category } = now.entry;
    const before = then.get(id) ?? now;
    const rings = { then: before.entry.ring, now: now.entry.ring };
    return Option.match(kindOf(model, from, id, rings), {
      onNone: () => [],
      onSome: (kind) => {
        const stood = blipPosition(before);
        const stands = blipPosition(now);
        return [
          {
            id,
            name,
            category,
            kind,
            from: kind === 'new' || kind === 'returned' ? stands : stood,
            to: kind === 'left' ? stood : stands,
            longitude: now.longitude,
            latitude: now.latitude,
            ring: kind === 'left' ? rings.then : rings.now,
            glyph: glyphs[kind],
            text: textOf(kind, name, rings),
          },
        ];
      },
    });
  });
};

/** The earlier edition being compared with, while it is still earlier than the one shown. */
export const comparedWith = (model: Model): Option.Option<number> =>
  Option.filter(model.comparing, (from) => from >= 0 && from < model.edition);

/** How long "Play the moves" shows the earlier edition before gliding to the shown one. */
export const moveHold = 900;

/** How long the glide takes to settle before playback ends. */
export const moveGlide = 2400;

/** How long the arrivals play: first light, a comet coming round, a horizon collapsing. */
export const arrivalLength = 2200;

/**
 * How far the arrivals have played, 0 to 1. Under reduced motion they rest at the end, so
 * every mark shows still.
 */
export const arrivalProgress = (model: Model): number =>
  model.reducedMotion ? 1 : Math.min(1, Math.max(0, model.compareClock / arrivalLength));

/** Whether the arrivals are still playing, so the frame clock runs. */
export const arriving = (model: Model): boolean =>
  Option.isSome(comparedWith(model)) && arrivalProgress(model) < 1;
