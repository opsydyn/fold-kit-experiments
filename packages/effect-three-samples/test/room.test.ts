import { expect, mock, test } from 'bun:test';

// The commands use the page's environment; the update logic under test never runs them.
await mock.module('../src/environment', () => ({ environment: {}, sceneMount: () => undefined }));
const { Message } = await import('../src/room/message');
const { init, update } = await import('../src/room/update');
const { sceneFor } = await import('../src/room/scene');

type Model = ReturnType<typeof init>['model'];
const step = (model: Model, message: typeof Message.Type): Model => update(model, message).model;
const start = init().model;
const keys = (model: Model) => sceneFor(model).children.map((child) => child.key);

test('a click on the floor plants there, on the floor; a click on a plant takes it away', () => {
  const planted = step(start, Message.ClickedFloor({ point: [1, 0.004, -0.5] }));
  expect(planted.plants.at(-1)).toEqual({ id: 'plant-1', at: [1, 0, -0.5] });
  expect(step(planted, Message.ClickedPlant({ id: 'plant-1' })).plants).toEqual(start.plants);
});

test('in AR the furniture goes, plants become anchors, and what was detected is drawn', () => {
  const ar = step(start, Message.ChangedSession({ mode: 'immersive-ar' }));
  expect(keys(ar)).not.toContain('sofa-seat');
  const anchors = sceneFor(ar).xr?.anchors ?? [];
  expect(anchors.map((anchor) => anchor.id)).toEqual(['plant-0']);
  const plant = sceneFor(ar).children.find((child) => child.key === 'plant-0');
  expect(plant?._tag === 'Group' && plant.follow).toEqual({ _tag: 'Anchor', id: 'plant-0' });
  const found = step(
    ar,
    Message.DetectedPlanes({
      detected: {
        planes: [
          {
            id: 'plane-0',
            orientation: 'horizontal',
            label: 'table',
            position: [0, 0.7, -1],
            rotation: [0, 0, 0],
            polygon: [
              [-0.5, 0, -0.4],
              [0.5, 0, -0.4],
              [0.5, 0, 0.4],
            ],
          },
        ],
      },
    }),
  );
  expect(keys(found)).toContain('plane:plane-0');
  // Leaving the session forgets what it found, and the furniture returns.
  const left = step(found, Message.ChangedSession({ mode: null }));
  expect(left.planes).toEqual([]);
  expect(keys(left)).toContain('sofa-seat');
  expect(sceneFor(left).xr?.anchors).toEqual([]);
});

test('a surface selected in AR plants at its point; gliding keeps where the player stands', () => {
  const planted = step(
    start,
    Message.SelectedSurface({
      surface: { hand: 'right', point: [0.4, 0.7, -1], normal: [0, 1, 0] },
    }),
  );
  expect(planted.plants.at(-1)?.at).toEqual([0.4, 0.7, -1]);
  const moved = step(start, Message.Glided({ moved: { origin: [1, 0, 1], heading: 0.5 } }));
  expect([moved.player.origin, moved.player.heading]).toEqual([[1, 0, 1], 0.5]);
});

test('only modes the browser can present are offered', () => {
  const vr = step(start, Message.CheckedSupport({ mode: 'immersive-vr', supported: true }));
  const ar = step(vr, Message.CheckedSupport({ mode: 'immersive-ar', supported: false }));
  expect([ar.vr, ar.ar]).toEqual(['ready', 'unavailable']);
});
