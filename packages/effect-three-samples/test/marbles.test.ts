import { expect, test } from 'bun:test';

import type { Gesture } from '@opsydyn/effect-three';

const { Message } = await import('../src/marbles/message');
const { init, marblesKey, update } = await import('../src/marbles/update');
const { sceneFor } = await import('../src/marbles/scene');

type Model = ReturnType<typeof init>['model'];
const step = (model: Model, message: typeof Message.Type): Model => update(model, message).model;
const start = init().model;

const entered = (model: Model, colour: 'gold' | 'teal', bin: string, started = true) =>
  Message.Collided({
    collision: { a: marblesKey(model, colour), aInstance: 'x1', b: 'bins', bPart: bin, started },
  });

test('a marble entering a bin counts by bin and colour; leaving and other contacts do not', () => {
  const once = step(start, entered(start, 'gold', 'gold-bin'));
  expect(once.goldBin).toEqual({ gold: 1, teal: 0 });
  const stray = step(once, entered(once, 'gold', 'teal-bin'));
  expect(stray.tealBin).toEqual({ gold: 1, teal: 0 });
  // Stopping touching, and touching anything that is not a bin, change nothing.
  expect(step(stray, entered(stray, 'teal', 'teal-bin', false))).toEqual(stray);
  const wall = Message.Collided({
    collision: { a: marblesKey(stray, 'teal'), b: 'wall-left', started: true },
  });
  expect(step(stray, wall)).toEqual(stray);
});

test('last round’s marbles no longer count once the machine is emptied', () => {
  const emptied = step(start, Message.ClickedEmpty());
  expect(emptied.round).toBe(1);
  expect(step(emptied, entered(start, 'gold', 'gold-bin'))).toEqual(emptied);
  expect(step(emptied, entered(emptied, 'gold', 'gold-bin')).goldBin.gold).toBe(1);
});

test('the wheel’s motor follows the Model, within its range, in either direction', () => {
  const fastest = Array.from({ length: 10 }).reduce<Model>(
    (model) => step(model, Message.ClickedFaster()),
    start,
  );
  expect(fastest.wheelSpeed).toBe(-6);
  const reversed = step(fastest, Message.ClickedReverse());
  expect(reversed.wheelSpeed).toBe(6);
  const joints = sceneFor(reversed).physics?.joints ?? [];
  const hinge = joints.find((joint) => joint.key === 'wheel:hinge');
  expect(hinge?.kind._tag === 'Revolute' && hinge.kind.motor?.velocity).toBe(6);
});

test('pours stop at the most of one colour; knocks keep the hardest', () => {
  const full = Array.from({ length: 10 }).reduce<Model>(
    (model) => step(model, Message.ClickedPour({ colour: 'teal' })),
    start,
  );
  expect(full.poured.teal).toBe(60);
  const knocked = step(step(start, Message.KnockedWheel({ force: 20 })), Message.KnockedWheel({ force: 9 }));
  expect([knocked.knocks, knocked.hardest]).toEqual([2, 20]);
});

test('orbiting moves the camera; a turned camera is kept before the gesture', () => {
  const turned = step(start, Message.AutoRotated({ turned: { position: [5, 4, 5] } }));
  expect(turned.camera.position).toEqual([5, 4, 5]);
  const gesture: Gesture = {
    _tag: 'Drag',
    button: 0,
    modifiers: { shift: false, control: false, meta: false, alt: false },
    deltaX: 80,
    deltaY: 0,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
  };
  expect(step(turned, Message.MadeGesture({ gesture })).camera.position).not.toEqual([5, 4, 5]);
});
