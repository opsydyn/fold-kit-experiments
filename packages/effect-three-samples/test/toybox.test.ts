import { expect, mock, test } from 'bun:test';

import type { Gesture } from '@opsydyn/effect-three';

// The commands use the page's environment; the update logic under test never runs them.
await mock.module('../src/toybox/environment', () => ({
  environment: {},
  sceneMount: () => undefined,
}));
const { Message } = await import('../src/toybox/message');
const { init, toyKey, update } = await import('../src/toybox/update');
const { sceneFor } = await import('../src/toybox/scene');

type Model = ReturnType<typeof init>['model'];
const step = (model: Model, message: typeof Message.Type): Model => update(model, message).model;
const start = init().model;

test('a click kicks the toy clicked, along the ray and up, once per click', () => {
  const [first] = start.toys;
  if (first === undefined) throw new Error('no toys');
  const key = toyKey(start, first);
  const kicked = step(start, Message.ClickedToy({ key, direction: [0, -0.5, -1] }));
  expect(kicked.toys[0]?.kick).toEqual({ id: 1, impulse: [0, 5, -2.5] });
  const again = step(kicked, Message.ClickedToy({ key, direction: [1, 0, 0] }));
  expect(again.toys[0]?.kick?.id).toBe(2);
  // The scene carries the kick on that toy's body.
  const node = sceneFor(again).children.find((child) => child.key === key);
  expect(node?._tag === 'Mesh' && node.body?.impulse?.id).toBe(2);
});

test('dropping adds toys up to a cap; tidying drops them all again under new keys', () => {
  const full = Array.from({ length: 30 }).reduce<Model>(
    (model) => step(model, Message.ClickedDrop()),
    start,
  );
  expect(full.toys).toHaveLength(24);
  const tidied = step(full, Message.ClickedTidy());
  expect(tidied.round).toBe(1);
  expect(tidied.toys.every((toy) => toy.kick === null)).toBe(true);
  expect(toyKey(tidied, tidied.toys[0] ?? start.toys[0]!)).toContain(':1:');
});

test('orbiting ignores gestures that began on a toy', () => {
  const gesture = {
    _tag: 'Drag',
    button: 0,
    modifiers: { shift: false, control: false, meta: false, alt: false },
    deltaX: 100,
    deltaY: 0,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
  } satisfies Gesture;
  const onToy = Message.MadeGesture({
    gesture: { ...gesture, _tag: 'Drag', button: 0, key: 'toy:0:0', modifiers: gesture.modifiers },
  });
  const onFloor = Message.MadeGesture({ gesture });
  expect(step(start, onToy).camera).toBe(start.camera);
  expect(step(start, onFloor).camera.position).not.toEqual(start.camera.position);
});

test('VR: offered only when supported, and following the session', () => {
  expect(init().commands).toHaveLength(1);
  expect(step(start, Message.CheckedVr({ supported: false })).vr).toBe('unavailable');
  const ready = step(start, Message.CheckedVr({ supported: true }));
  expect(ready.vr).toBe('ready');
  const entering = update(ready, Message.ClickedEnterVr());
  expect(entering.model.vr).toBe('entering');
  expect(entering.commands).toHaveLength(1);
  expect(step(entering.model, Message.FailedVr()).vr).toBe('ready');
  const presenting = step(entering.model, Message.ChangedVrSession({ presenting: true }));
  expect(presenting.vr).toBe('presenting');
  expect(step(presenting, Message.ChangedVrSession({ presenting: false })).vr).toBe('ready');
  // The scene stands the player in front of the tray.
  expect(sceneFor(start).xr?.origin).toEqual([0, 0, 4.2]);
});

test('marbles pour in batches up to a cap, one instances node with a body per marble', () => {
  const poured = Array.from({ length: 8 }).reduce<Model>(
    (model) => step(model, Message.ClickedPour()),
    start,
  );
  expect(poured.marbles).toBe(96);
  const node = sceneFor(poured).children.find((child) => child.key === 'marbles:0');
  expect(node?._tag === 'Instances' && node.instances.length).toBe(96);
  expect(node?._tag === 'Instances' && node.body?.collider).toBe('ball');
});

test('the chain hangs by a spherical joint per link, the first from the hook', () => {
  const joints = sceneFor(start).physics?.joints ?? [];
  expect(joints.map((held) => [held.a.key, held.b.key])).toEqual([
    ['chain:hook', 'chain:0'],
    ['chain:0', 'chain:1'],
    ['chain:1', 'chain:2'],
    ['chain:2', 'chain:3'],
    ['chain:3', 'chain:4'],
  ]);
});

test('bumps count collisions that begin, leaving out marbles', () => {
  const bumped = [
    Message.Bumped({ started: true, marble: false }),
    Message.Bumped({ started: false, marble: false }),
    Message.Bumped({ started: true, marble: true }),
  ].reduce<Model>(step, start);
  expect(bumped.bumps).toBe(1);
});

test('in VR, the right stick snap-turns the player and the left steps them forward', () => {
  const turned = step(start, Message.PushedStick({ stick: { hand: 'right', direction: 'right' } }));
  expect(turned.player.heading).toBeCloseTo(-Math.PI / 4, 9);
  const stepped = step(
    start,
    Message.PushedStick({ stick: { hand: 'left', direction: 'forward' } }),
  );
  // Facing the tray (−z) from z = 4.2: a step brings the player a metre closer.
  expect(stepped.player.origin[2]).toBeCloseTo(3.2, 9);
  expect(sceneFor(stepped).xr?.origin[2]).toBeCloseTo(3.2, 9);
});

test('showing colliders turns on the physics world’s debug lines', () => {
  expect(sceneFor(start).physics?.debug).toBe(false);
  const shown = step(start, Message.ToggledColliders());
  expect(sceneFor(shown).physics?.debug).toBe(true);
  expect(step(shown, Message.ToggledColliders()).showColliders).toBe(false);
});
