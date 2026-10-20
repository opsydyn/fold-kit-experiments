import { expect, mock, test } from 'bun:test';

import { Option } from 'effect';

// The view uses the page's environment; the update logic and scene under test do not.
await mock.module('../src/labelledEnvironment', () => ({
  environment: {},
  sceneMount: () => undefined,
}));
const { Message } = await import('../src/workshop/message');
const { init, update } = await import('../src/workshop/update');
const { sceneFor } = await import('../src/workshop/scene');

type Model = ReturnType<typeof init>['model'];
const step = (model: Model, message: typeof Message.Type): Model => update(model, message).model;

test('the scene asks for the robot, the floor and the sign font from the asset base', () => {
  const { model } = init({ assetBase: '/three/models/' });
  expect(model.robot).toEqual({ _tag: 'Loading' });
  expect(sceneFor(model).assets).toEqual([
    { kind: 'model', id: 'workshop-robot', url: '/three/models/robot.glb' },
    { kind: 'texture', id: 'workshop-floor', url: '/three/models/tiles.png' },
    { kind: 'font', id: 'workshop-font', url: '/three/models/inter-bold.typeface.json' },
  ]);
});

test('what the scene hears settles each asset; unloading stops asking, reloading asks again', () => {
  const start = init().model;
  const ready = [
    Message.LoadedAsset({ id: 'workshop-robot', parts: ['head'], clips: ['wave'] }),
    Message.LoadedAsset({ id: 'workshop-floor', parts: [], clips: [] }),
    Message.LoadedAsset({ id: 'workshop-font', parts: [], clips: [] }),
  ].reduce(step, start);
  expect(ready.robot).toEqual({ _tag: 'Success', data: { parts: ['head'], clips: ['wave'] } });
  expect(ready.floor).toEqual({ _tag: 'Success', data: 'workshop-floor' });
  expect(ready.font).toEqual({ _tag: 'Success', data: 'workshop-font' });

  const clicked = step(ready, Message.ClickedPart({ part: 'head' }));
  expect(clicked.part).toEqual(Option.some('head'));
  const unloaded = step(clicked, Message.ClickedUnload());
  expect(sceneFor(unloaded).assets).toEqual([]);
  expect([unloaded.robot._tag, unloaded.floor._tag, unloaded.font._tag]).toEqual([
    'Idle',
    'Idle',
    'Idle',
  ]);
  expect(Option.isNone(unloaded.part)).toBe(true);
  // An answer that arrives after the scene stopped asking changes nothing.
  expect(step(unloaded, Message.LoadedAsset({ id: 'workshop-robot', parts: [], clips: [] }))).toBe(
    unloaded,
  );

  const reloading = step(unloaded, Message.ClickedReload());
  expect(reloading.robot._tag).toBe('Loading');
  expect(sceneFor(reloading).assets).toHaveLength(3);

  const failed = step(
    start,
    Message.FailedAsset({ id: 'workshop-robot', reason: 'Could not load x.' }),
  );
  expect(failed.robot).toEqual({ _tag: 'Failure', error: 'Could not load x.' });
});

test('clip and speed controls', () => {
  const start = init().model;
  expect(step(start, Message.ClickedClip({ clip: 'roll' })).clip).toBe('roll');
  expect(step(start, Message.ClickedClip({ clip: null })).clip).toBeNull();
  expect(step(start, Message.ChangedSpeed({ speed: -1.5 })).speed).toBe(-1.5);
});
