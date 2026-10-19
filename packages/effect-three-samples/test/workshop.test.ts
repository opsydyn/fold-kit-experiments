import { expect, mock, test } from 'bun:test';

import { Option, Result } from 'effect';

// The commands use the page's environment; the update logic under test never runs them.
await mock.module('../src/labelledEnvironment', () => ({
  environment: {},
  sceneMount: () => undefined,
}));
const { Message } = await import('../src/workshop/message');
const { init, update } = await import('../src/workshop/update');

type Model = ReturnType<typeof init>['model'];
const step = (model: Model, message: typeof Message.Type): Model => update(model, message).model;

test('init loads the robot, the floor and the sign font from the asset base', () => {
  const { model, commands } = init({ assetBase: '/three/models/' });
  expect(model.robot).toEqual({ _tag: 'Loading' });
  expect(commands.map((command) => command.args)).toEqual([
    { url: '/three/models/robot.glb' },
    { url: '/three/models/tiles.png' },
    { url: '/three/models/inter-bold.typeface.json' },
  ]);
});

test('settling, unloading and reloading move both assets through AsyncData', () => {
  const start = init().model;
  const ready = step(
    step(
      start,
      Message.SettledRobot({ result: Result.succeed({ parts: ['head'], clips: ['wave'] }) }),
    ),
    Message.SettledFloor({ result: Result.succeed('workshop-floor') }),
  );
  expect(
    step(ready, Message.SettledFont({ result: Result.succeed('workshop-font') })).font,
  ).toEqual({ _tag: 'Success', data: 'workshop-font' });
  expect(ready.robot).toEqual({ _tag: 'Success', data: { parts: ['head'], clips: ['wave'] } });
  expect(ready.floor._tag).toBe('Success');

  const clicked = step(ready, Message.ClickedPart({ part: 'head' }));
  expect(clicked.part).toEqual(Option.some('head'));
  const unloaded = step(clicked, Message.CompletedUnload());
  expect([unloaded.robot._tag, unloaded.floor._tag, unloaded.font._tag]).toEqual([
    'Idle',
    'Idle',
    'Idle',
  ]);
  expect(Option.isNone(unloaded.part)).toBe(true);

  const reloading = update(unloaded, Message.ClickedReload());
  expect(reloading.model.robot._tag).toBe('Loading');
  expect(reloading.commands).toHaveLength(3);

  const failed = step(start, Message.SettledRobot({ result: Result.fail('Could not load x.') }));
  expect(failed.robot).toEqual({ _tag: 'Failure', error: 'Could not load x.' });
});

test('clip and speed controls', () => {
  const start = init().model;
  expect(step(start, Message.ClickedClip({ clip: 'roll' })).clip).toBe('roll');
  expect(step(start, Message.ClickedClip({ clip: null })).clip).toBeNull();
  expect(step(start, Message.ChangedSpeed({ speed: -1.5 })).speed).toBe(-1.5);
});
