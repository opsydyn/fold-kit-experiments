import { expect, mock, test } from 'bun:test';

// The page's environment is not needed by the update logic under test.
await mock.module('../src/bowling/environment', () => ({ environment: {}, sceneMount: () => undefined }));
const { Message } = await import('../src/bowling/message');
const { ballKey, init, pinKey, update } = await import('../src/bowling/update');
const { sceneFor, sheet } = await import('../src/bowling/scene');

type Model = ReturnType<typeof init>['model'];
const step = (model: Model, message: typeof Message.Type): Model => update(model, message).model;
const start = init().model;

const head = (model: Model, id: string, started: boolean) =>
  Message.Collided({
    collision: { a: pinKey(model, id), b: 'sensors', bPart: `spot:${id}`, started },
  });

const knock = (model: Model, ids: ReadonlyArray<string>): Model =>
  ids.reduce((current, id) => step(current, head(current, id, false)), model);

test('a pin is down when its head leaves its own spot; another pin’s spot says nothing', () => {
  const down = step(start, head(start, 'p5', false));
  expect(down.standing).not.toContain('p5');
  const crossed = step(
    down,
    Message.Collided({
      collision: { a: pinKey(down, 'p5'), b: 'sensors', bPart: 'spot:p9', started: true },
    }),
  );
  expect(crossed.standing).not.toContain('p5');
  expect(step(crossed, head(crossed, 'p5', true)).standing).toContain('p5');
});

test('a roll is counted once its shot settles; the pins left stand for the second roll', () => {
  const rolling = update(start, Message.ClickedRoll());
  expect(rolling.model.phase).toBe('rolling');
  expect(rolling.commands).toHaveLength(1);
  const hit = knock(rolling.model, ['p1', 'p2', 'p3', 'p5']);
  // The ball reaching the pit starts the settling wait.
  const pit = update(
    hit,
    Message.Collided({ collision: { a: ballKey(hit), b: 'sensors', bPart: 'pit', started: true } }),
  );
  expect(pit.model.phase).toBe('settling');
  const counted = step(pit.model, Message.Settled({ shot: hit.shot }));
  expect(counted.rolls).toEqual([4]);
  expect(counted.standing).toHaveLength(6);
  expect(counted.rack).toBe(start.rack);
  // The fallback timer for the same shot, arriving later, is stale.
  expect(step(counted, Message.Settled({ shot: hit.shot }))).toEqual(counted);
});

test('a strike brings a fresh rack under new keys; the scoreboard marks it', () => {
  const rolling = step(start, Message.ClickedRoll());
  const struck = step(knock(rolling, ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10']), Message.Settled({ shot: rolling.shot }));
  expect(struck.rolls).toEqual([10]);
  expect(struck.rack).toBe(start.rack + 1);
  expect(struck.standing).toHaveLength(10);
  expect(sheet(struck).text.startsWith('X')).toBe(true);
  // The new rack's pins are drawn under new keys, so they stand up again.
  const keys = sceneFor(struck).children.map((child) => child.key);
  expect(keys).toContain(pinKey(struck, 'p1'));
  expect(keys).not.toContain(pinKey(start, 'p1'));
});

test('only an aimed ball rolls; the ball carries its impulse once rolled', () => {
  const rolling = step(start, Message.ClickedRoll());
  expect(step(rolling, Message.ClickedRoll())).toEqual(rolling);
  const ball = sceneFor(rolling).children.find((child) => child.key === ballKey(rolling));
  expect(ball?._tag === 'Mesh' && ball.body?.impulse?.id).toBe(rolling.shot);
});
