import { expect, test } from 'bun:test';

import { Option } from 'effect';

import { Message } from '../src/studio/message';
import { home, init, limit, type Model } from '../src/studio/model';
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
  expect(Option.isNone(step(toggled, Message.ClickedEmptySpace()).selected)).toBe(true);
});
