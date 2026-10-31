/**
 * Two editions side by side on one radar: the edition shown, against an earlier one. Each
 * entry keeps its bearing across editions and only its ring changes, so a move is a step
 * along its radius: a ghost where it stood, a line to where it stands. One that joined
 * arrives from beyond the outer shell, and one that left goes out past it. "Play the moves"
 * shows the earlier edition for a beat, then the shown one, and the blips glide between
 * them. Pure, so it is tested without a browser.
 */
import type { Vec3 } from '@opsydyn/effect-three';
import { Option } from 'effect';

import type { Category } from './data';
import { editionsOf, type Model, positionsOf } from './model';
import { blipPosition, onSphere, shellRadius } from './space';
import { changesBetween } from './timeline';

/** How an entry changed between the two editions. */
export type MoveKind = 'moved' | 'joined' | 'left';

/** One entry's change: where it was and is (beyond the outer shell when off the radar). */
export type Move = Readonly<{
  id: string;
  category: Category;
  kind: MoveKind;
  from: Vec3;
  to: Vec3;
  text: string;
}>;

/** How far beyond the outer shell an entry arrives from, or leaves to. */
const beyond = 1.18;

/** The edition at `index`, as the Model would show it. */
const at = (model: Model, index: number): Model => ({ ...model, edition: index });

const absentIn = (model: Model, index: number): ReadonlySet<string> =>
  new Set(editionsOf(model)[index]?.absent ?? []);

/** Each entry's change from the edition at `from` to the one shown. */
export const movesOf = (model: Model, from: number): ReadonlyArray<Move> => {
  const then = new Map(
    positionsOf(at(model, from)).map((position) => [position.entry.id, position]),
  );
  const wasAbsent = absentIn(model, from);
  const isAbsent = absentIn(model, model.edition);
  const outside = (position: { longitude: number; latitude: number }): Vec3 =>
    onSphere(position.longitude, position.latitude, shellRadius('caution') * beyond);
  const texts = new Map(
    changesBetween(model, from, model.edition).map(({ id, text }) => [id, text]),
  );
  return positionsOf(model).flatMap((now): ReadonlyArray<Move> => {
    const { id, category } = now.entry;
    const before = then.get(id) ?? now;
    const text = texts.get(id) ?? '';
    const kind: Option.Option<MoveKind> =
      wasAbsent.has(id) && !isAbsent.has(id)
        ? Option.some('joined')
        : !wasAbsent.has(id) && isAbsent.has(id)
          ? Option.some('left')
          : !isAbsent.has(id) && before.entry.ring !== now.entry.ring
            ? Option.some('moved')
            : Option.none();
    return Option.match(kind, {
      onNone: () => [],
      onSome: (change) => [
        {
          id,
          category,
          kind: change,
          from: change === 'joined' ? outside(now) : blipPosition(before),
          to: change === 'left' ? outside(before) : blipPosition(now),
          text,
        },
      ],
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
