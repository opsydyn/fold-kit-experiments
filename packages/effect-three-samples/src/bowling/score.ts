/**
 * Ten-pin scoring, from the pins each roll knocked down: a strike scores ten plus the
 * next two rolls, a spare ten plus the next one, and the tenth frame takes its bonus
 * rolls in place.
 */

/** One frame as scored: its rolls, and its running total once it can be counted. */
export type Frame = { readonly rolls: ReadonlyArray<number>; readonly total: number | null };

export const framesInGame = 10;

/** The rolls grouped into frames, each with its running total where the bonus is known. */
export const frames = (rolls: ReadonlyArray<number>): ReadonlyArray<Frame> => {
  const result: Array<Frame> = [];
  let index = 0;
  let total = 0;
  for (let frame = 0; frame < framesInGame && index < rolls.length; frame++) {
    const first = rolls[index] ?? 0;
    const last = frame === framesInGame - 1;
    if (first === 10 && !last) {
      const bonus = rolls.slice(index + 1, index + 3);
      total += 10 + bonus.reduce((sum, pins) => sum + pins, 0);
      result.push({ rolls: [10], total: bonus.length === 2 ? total : null });
      index += 1;
      continue;
    }
    const second = rolls[index + 1];
    const taken = last ? rolls.slice(index, index + 3) : rolls.slice(index, index + 2);
    if (second === undefined) {
      result.push({ rolls: [first], total: null });
      break;
    }
    const open = first + second < 10;
    if (last) {
      const complete = open ? taken.length >= 2 : taken.length === 3;
      total += taken.reduce((sum, pins) => sum + pins, 0);
      result.push({ rolls: taken, total: complete ? total : null });
      break;
    }
    const bonus = open ? [] : rolls.slice(index + 2, index + 3);
    total += first + second + bonus.reduce((sum, pins) => sum + pins, 0);
    result.push({ rolls: [first, second], total: open || bonus.length === 1 ? total : null });
    index += 2;
  }
  return result;
};

/** Whether the game is over: ten frames, the last with its bonus rolls taken. */
export const finished = (rolls: ReadonlyArray<number>): boolean => {
  const scored = frames(rolls);
  return scored.length === framesInGame && scored.at(-1)?.total !== null;
};

/** The score so far: the last frame with a total. */
export const score = (rolls: ReadonlyArray<number>): number =>
  frames(rolls).findLast((frame) => frame.total !== null)?.total ?? 0;

/** Where the next roll falls: its frame (0 to 9) and the rolls that frame has had. */
const position = (rolls: ReadonlyArray<number>) => {
  let index = 0;
  for (let frame = 0; frame < framesInGame - 1; frame++) {
    const taken = (rolls[index] ?? 0) === 10 ? 1 : 2;
    if (index + taken > rolls.length) return { frame, rolls: rolls.slice(index) };
    index += taken;
  }
  return { frame: framesInGame - 1, rolls: rolls.slice(index) };
};

/**
 * Walks a frame's rolls rack by rack: whether each roll met a fresh rack, and the pins
 * left standing after it (a strike or a spare brings a fresh rack in the tenth frame).
 */
const racks = (rolls: ReadonlyArray<number>) => {
  let fresh = true;
  let left = 10;
  return rolls.map((pins) => {
    const met = { fresh, left };
    left -= pins;
    fresh = left === 0 || !fresh;
    if (fresh) left = 10;
    return met;
  });
};

/**
 * Whether the next roll starts a fresh rack: a frame's first roll, or in the tenth frame
 * one after a strike or a spare.
 */
export const freshRack = (rolls: ReadonlyArray<number>): boolean => {
  const { frame, rolls: taken } = position(rolls);
  if (taken.length === 0) return true;
  if (frame < framesInGame - 1) return false;
  const walked = racks(taken);
  const last = walked.at(-1);
  const pins = taken.at(-1) ?? 0;
  if (last === undefined) return true;
  return last.left - pins === 0 || !last.fresh;
};

/** How many strikes the rolls so far hold: every X on the scoresheet. */
export const strikes = (rolls: ReadonlyArray<number>): number =>
  frames(rolls)
    .flatMap((frame) => marks(frame).split(' '))
    .filter((mark) => mark === 'X').length;

/** How a frame's rolls read on a scoresheet: X for a strike, / for a spare, - for none. */
export const marks = (frame: Frame): string =>
  racks(frame.rolls)
    .map(({ fresh, left }, index) => {
      const pins = frame.rolls[index] ?? 0;
      if (fresh && pins === 10) return 'X';
      if (!fresh && pins === left) return '/';
      return pins === 0 ? '-' : String(pins);
    })
    .join(' ');
