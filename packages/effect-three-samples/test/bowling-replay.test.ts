import { expect, mock, test } from 'bun:test';

import { Option } from 'effect';

await mock.module('../src/bowling/environment', () => ({
  environment: {},
  sceneMount: () => undefined,
}));
const { Message } = await import('../src/bowling/message');
const { ballKey, init, pinKey, update } = await import('../src/bowling/update');
const { sceneFor } = await import('../src/bowling/scene');
const { decode, encode, verdict } = await import('../src/bowling/replay');

type Model = ReturnType<typeof init>['model'];
const step = (model: Model, message: typeof Message.Type): Model => update(model, message).model;
const rest = (model: Model): Model => step(model, Message.RackRested({ shot: model.shot }));

/** One roll at `aim`, knocking down `pins`, counted. */
const roll = (model: Model, aim: number, pins: ReadonlyArray<string>): Model => {
  const rolling = step(step(rest(model), Message.ChangedAim({ aim })), Message.ClickedRoll());
  const fallen = pins.reduce(
    (current, id) =>
      step(
        current,
        Message.Collided({
          collision: { a: pinKey(current, id), b: 'sensors', bPart: `spot:${id}`, started: false },
        }),
      ),
    rolling,
  );
  return step(fallen, Message.Settled({ shot: fallen.shot }));
};

test('a roll records what the player did; the rack rests before the next', () => {
  const once = roll(init().model, 0.1, ['p1', 'p2']);
  expect(once.shots).toEqual([{ aim: 0.1, angle: -0.6, speed: 8 }]);
  expect(once.rolls).toEqual([2]);
  expect(once.phase).toBe('racking');
  // Rolling waits for the rack: a click before it rests does nothing.
  expect(step(once, Message.ClickedRoll()).phase).toBe('racking');
});

test('a replay rolls the recorded inputs, each as soon as its rack has rested', () => {
  const played = roll(roll(init().model, 0.1, ['p1', 'p2']), -0.2, ['p3']);
  const replay = step(played, Message.ClickedReplay());
  expect(replay.replay).toEqual({ shots: played.shots, rolls: [2, 1], rolled: 0 });
  expect(replay.rolls).toEqual([]);
  expect(replay.phase).toBe('racking');
  // The rack rests, and the first shot rolls with its own aim, without a click.
  const first = rest(replay);
  expect([first.phase, first.aim, first.replay?.rolled]).toEqual(['rolling', 0.1, 1]);
  // The rolled ball is a fresh body carrying its impulse.
  const ball = sceneFor(first).children.find((child) => child.key === ballKey(first));
  expect(ball?._tag === 'Mesh' && ball.body?.impulse?.id).toBe(first.shot);
  // While it replays, the player's Roll does nothing.
  expect(step(first, Message.ClickedRoll())).toEqual(first);
});

test('a replay link carries the record; a malformed one is ignored', () => {
  const record = {
    shots: [
      { aim: 0.08, angle: -0.6, speed: 8 },
      { aim: -0.12, angle: 1.3, speed: 9.25 },
    ],
    rolls: [9, 1],
  };
  const link = encode(record);
  expect(link).toBe('#replay=0.08,-0.6,8;-0.12,1.3,9.25|9,1');
  expect(decode(link)).toEqual(Option.some(record));
  for (const bad of [
    '#replay=',
    '#replay=1,2',
    '#replay=9,0,8|1',
    '#replay=0,0,8|11',
    '#other',
    '#replay=0,0,8;0,0,8|1',
  ]) {
    expect(Option.isNone(decode(bad))).toBe(true);
  }
  // Read at start, a link starts its replay.
  const started = step(init().model, Message.ReadFragment({ fragment: link }));
  expect(started.replay?.shots).toEqual(record.shots);
});

test('a verdict says whether the pins fell the same, or where they first did not', () => {
  expect(verdict([9, 1, 10], [9, 1])).toEqual({ _tag: 'Matching', rolls: 2 });
  expect(verdict([9, 1, 10], [9, 0])).toEqual({ _tag: 'Differs', roll: 2, expected: 1, got: 0 });
});
