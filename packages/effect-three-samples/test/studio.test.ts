import { expect, test } from 'bun:test';

import { Option } from 'effect';

import { Message } from '../src/studio/message';
import { home, init, limit, type Model } from '../src/studio/model';
import { sceneFor } from '../src/studio/scene';
import { pieceKey, update } from '../src/studio/update';

const initial = init().model;
const step = (model: Model, message: Message): Model => update(model, message).model;
const placementOf = (model: Model, piece: 'ball' | 'cone') =>
  model.placements.find((placement) => placement.piece === piece);

/** A ray from above straight down onto the floor point `(x, z)`. */
const downOnto = (x: number, z: number) => ({
  origin: [x, 5, z] as const,
  direction: [0, -1, 0] as const,
});

test('a drag keeps the grabbed point under the pointer and stays on the floor', () => {
  const ball = home.ball;
  // Press the ball 0.2 to the right of its centre, then drag 1 unit left: the very first
  // drag moves it, because the press already took hold.
  const grabbed = step(
    initial,
    Message.PressedPiece({ key: pieceKey('ball'), ...downOnto(ball.x + 0.2, ball.z) }),
  );
  expect(placementOf(grabbed, 'ball')).toMatchObject({ x: ball.x, z: ball.z });

  const moved = step(
    grabbed,
    Message.DraggedPiece({ key: pieceKey('ball'), ...downOnto(ball.x - 0.8, ball.z) }),
  );
  expect(placementOf(moved, 'ball')?.x).toBeCloseTo(ball.x - 1, 9);
  expect(moved.selected).toEqual(Option.some('ball'));

  const far = step(moved, Message.DraggedPiece({ key: pieceKey('ball'), ...downOnto(50, -50) }));
  expect(placementOf(far, 'ball')).toMatchObject({ x: limit, z: -limit });

  const dropped = step(far, Message.DroppedPiece());
  expect(Option.isNone(dropped.grab)).toBe(true);
  const returned = step(dropped, Message.DoubleClickedPiece({ key: pieceKey('ball') }));
  expect(placementOf(returned, 'ball')).toMatchObject(ball);
});

test('a ray that never meets the floor moves nothing', () => {
  const upward = { origin: [0, 5, 0] as const, direction: [0, 1, 0] as const };
  expect(step(initial, Message.DraggedPiece({ key: pieceKey('cone'), ...upward }))).toBe(initial);
});

test('right-clicking cycles a finish through every material kind and back', () => {
  let model = initial;
  const seen = new Set<string>();
  for (let i = 0; i < 5; i++) {
    model = step(model, Message.OpenedPieceMenu({ key: pieceKey('cone') }));
    seen.add(placementOf(model, 'cone')?.finish ?? '');
  }
  expect(seen.size).toBe(5);
  expect(placementOf(model, 'cone')?.finish).toBe(placementOf(initial, 'cone')?.finish);
});

test('toggles flip shadows, tone mapping and the camera lens; a miss clears the selection', () => {
  const toggled = [
    Message.ClickedShadows(),
    Message.ClickedToneMapping(),
    Message.ClickedLens(),
  ].reduce(step, step(initial, Message.ClickedPiece({ key: pieceKey('cone') })));
  expect(toggled).toMatchObject({ shadows: 'off', tone: 'aces', lens: 'orthographic' });
  expect(step(toggled, Message.ClickedLens()).lens).toBe('split');
  expect(Option.isNone(step(toggled, Message.ClickedEmptySpace()).selected)).toBe(true);
});

test('the monitor shows the selected piece close up, in its finish, and nothing otherwise', () => {
  const pictureOf = (model: Model) => sceneFor(model).renderTextures[0]?.children ?? [];
  const keysOf = (model: Model) => pictureOf(model).map((node) => node.key);
  expect(keysOf(initial)).not.toContain('close-up');

  const selected = step(initial, Message.ClickedPiece({ key: pieceKey('cone') }));
  expect(keysOf(selected)).toContain('close-up');
  const closeUp = pictureOf(selected).find((node) => node.key === 'close-up');
  const piece = sceneFor(selected).children.find((node) => node.key === pieceKey('cone'));
  expect(closeUp?._tag === 'Mesh' && piece?._tag === 'Mesh').toBe(true);
  expect(closeUp?._tag === 'Mesh' ? closeUp.material : null).toEqual(
    piece?._tag === 'Mesh' ? piece.material : undefined,
  );
});

test('gestures on the floor orbit the camera; on a piece or over the plan they do not', () => {
  const area = { width: 800, height: 600, x: 0, y: 0 };
  const dragBy = (extra: { readonly key?: string; readonly view?: string }) =>
    Message.MadeGesture({
      gesture: {
        _tag: 'Drag',
        button: 0,
        modifiers: { shift: false, control: false, meta: false, alt: false },
        deltaX: 120,
        deltaY: 0,
        ...area,
        ...extra,
      },
    });
  const orbited = step(initial, dragBy({}));
  expect(orbited.camera.position).not.toEqual(initial.camera.position);
  expect(orbited.camera.lookAt).toEqual(initial.camera.lookAt);
  expect(step(initial, dragBy({ key: pieceKey('ball') })).camera).toBe(initial.camera);
  expect(step(initial, dragBy({ view: 'plan' })).camera).toBe(initial.camera);

  // Never below the floor, however far it is dragged down.
  const low = step(
    initial,
    Message.MadeGesture({
      gesture: {
        _tag: 'Drag',
        button: 0,
        modifiers: { shift: false, control: false, meta: false, alt: false },
        deltaX: 0,
        deltaY: -5000,
        ...area,
      },
    }),
  );
  expect(low.camera.position[1]).toBeGreaterThan(low.camera.lookAt[1]);

  // A new lens starts from its own camera.
  const lensed = step(orbited, Message.ClickedLens());
  expect(lensed.camera).toMatchObject({ _tag: 'Orthographic', position: [0, 5.2, 7.5] });
});

test('arrow keys move the camera; framing fits it to every measured piece', () => {
  const panned = step(initial, Message.PressedArrow({ key: 'ArrowLeft', turning: false }));
  expect(panned.camera.lookAt).not.toEqual(initial.camera.lookAt);
  const turned = step(initial, Message.PressedArrow({ key: 'ArrowLeft', turning: true }));
  expect(turned.camera.lookAt).toEqual(initial.camera.lookAt);
  expect(turned.camera.position).not.toEqual(initial.camera.position);

  // Before anything is measured, framing changes nothing.
  expect(step(initial, Message.ClickedFrame()).camera).toBe(initial.camera);
  const measured = [
    Message.MeasuredPiece({ key: pieceKey('torus'), min: [-3, 0, -1], max: [-2, 1, 0] }),
    Message.MeasuredPiece({ key: pieceKey('crate'), min: [2, 0, -1], max: [3, 1, 0] }),
    // A new box for the crate replaces its old one.
    Message.MeasuredPiece({ key: pieceKey('crate'), min: [2, 0, -1], max: [4, 1, 0] }),
  ].reduce(step, initial);
  expect(measured.bounds).toHaveLength(2);
  const framed = step(measured, Message.ClickedFrame());
  // Looking at the middle of everything measured: x from −3 to 4, y 0 to 1, z −1 to 0.
  expect(framed.camera.lookAt).toEqual([0.5, 0.5, -0.5]);
});
