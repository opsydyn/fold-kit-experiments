/**
 * A game as a record: what the player did on each roll (start, line, speed), and how many
 * pins each roll knocked down. Replaying feeds the inputs back to the simulation and
 * checks that the pins fall the same way (ADR-011). The record travels as a short
 * fragment, `#replay=…`, decoded and checked before use.
 */
import { Option } from 'effect';

import { limits } from './model';

export type Shot = { readonly aim: number; readonly angle: number; readonly speed: number };

export type Record = {
  readonly shots: ReadonlyArray<Shot>;
  /** Pins knocked by each roll when recorded: a replay must knock the same. */
  readonly rolls: ReadonlyArray<number>;
};

const prefix = '#replay=';

const number = (value: number): string => String(Number(value.toFixed(3)));

/** The record as a URL fragment: `#replay=aim,line,speed;…|pins,pins,…`. */
export const encode = (record: Record): string =>
  `${prefix}${record.shots
    .map((shot) => [shot.aim, shot.angle, shot.speed].map(number).join(','))
    .join(';')}|${record.rolls.join(',')}`;

const within = (value: number, range: { readonly min: number; readonly max: number }) =>
  Number.isFinite(value) && value >= range.min && value <= range.max;

const shotOf = (text: string): Option.Option<Shot> => {
  const [aim, angle, speed, extra] = text.split(',').map(Number);
  if (extra !== undefined || aim === undefined || angle === undefined || speed === undefined) {
    return Option.none();
  }
  return within(aim, limits.aim) && within(angle, limits.angle) && within(speed, limits.speed)
    ? Option.some({ aim, angle, speed })
    : Option.none();
};

/** A fragment back into a record, or nothing if it is not a well-formed one. */
export const decode = (fragment: string): Option.Option<Record> => {
  if (!fragment.startsWith(prefix)) return Option.none();
  const [shotsText = '', rollsText = '', extra] = decodeURIComponent(
    fragment.slice(prefix.length),
  ).split('|');
  if (extra !== undefined || shotsText === '') return Option.none();
  const shots = Option.all(shotsText.split(';').map(shotOf));
  const rolls = rollsText === '' ? [] : rollsText.split(',').map(Number);
  const pinsOk = rolls.every((pins) => Number.isInteger(pins) && pins >= 0 && pins <= 10);
  if (!pinsOk || (rolls.length > 0 && rolls.length !== shotsText.split(';').length)) {
    return Option.none();
  }
  return Option.map(shots, (each) => ({ shots: each, rolls }));
};

/** How a replay compares with its record so far: matching, or where it first differs. */
export type Verdict =
  | { readonly _tag: 'Matching'; readonly rolls: number }
  | {
      readonly _tag: 'Differs';
      readonly roll: number;
      readonly expected: number;
      readonly got: number;
    };

export const verdict = (expected: ReadonlyArray<number>, got: ReadonlyArray<number>): Verdict => {
  const index = got.findIndex(
    (pins, roll) => expected[roll] !== undefined && expected[roll] !== pins,
  );
  const differing = index < 0 ? undefined : got[index];
  const wanted = index < 0 ? undefined : expected[index];
  return differing === undefined || wanted === undefined
    ? { _tag: 'Matching', rolls: Math.min(got.length, expected.length) }
    : { _tag: 'Differs', roll: index + 1, expected: wanted, got: differing };
};
