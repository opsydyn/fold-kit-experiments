import { expect, test } from 'bun:test';

import { Option } from 'effect';

import { SceneStart } from '../src/effect-ui-scene';

const { Message } = await import('../src/room/message');
const { init, update } = await import('../src/room/update');
const { sceneFor } = await import('../src/room/scene');

type Model = ReturnType<typeof init>['model'];
const step = (model: Model, message: typeof Message.Type): Model => update(model, message).model;
const start = init().model;
const keys = (model: Model) => sceneFor(model).children.map((child) => child.key);

test('a click on the floor plants there, on the floor; a click on a plant takes it away', () => {
  const planted = step(start, Message.ClickedFloor({ point: [1, 0.004, -0.5] }));
  expect(planted.plants.at(-1)).toEqual({ id: 'plant-1', at: [1, 0, -0.5], kind: 'fern' });
  expect(step(planted, Message.ClickedPlant({ id: 'plant-1' })).plants).toEqual(start.plants);
});

test('a click plants the chosen kind; a placed plant lands on the floor, inside the walls', () => {
  const cacti = step(
    step(start, Message.ChoseKind({ kind: 'cactus' })),
    Message.ClickedFloor({
      point: [0.5, 0, 0.5],
    }),
  );
  expect(cacti.plants.at(-1)?.kind).toBe('cactus');
  const placed = step(start, Message.PlacedPlant({ at: [9, 2, -1], kind: 'tulip' }));
  expect(placed.plants.at(-1)).toEqual({ id: 'plant-1', at: [2.8, 0, -1], kind: 'tulip' });
  const tulip = sceneFor(placed).children.find((child) => child.key === 'plant-1');
  expect(tulip?._tag === 'Group' && tulip.children.map((child) => child.key)).toEqual([
    'plant-1:pot',
    'plant-1:stem',
    'plant-1:flower',
  ]);
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

test('in VR the left hand throws a teleport arc at the floor, and landing moves the player', () => {
  expect(sceneFor(start).xr?.teleportArc).toEqual({
    hand: 'left',
    targets: ['floor'],
    color: 0xffffff,
    opacity: 0.4,
  });
  const inAr = step(start, Message.ChangedSession({ mode: 'immersive-ar' }));
  expect(sceneFor(inAr).xr?.teleportArc).toBeNull();
  const landed = step(
    start,
    Message.Teleported({ teleported: { hand: 'left', point: [1, 0, -1], origin: [0.8, 0, -1.2] } }),
  );
  expect(landed.player.origin).toEqual([0.8, 0, -1.2]);
  expect(landed.player.heading).toBe(start.player.heading);
});

test('only modes the browser can present are offered', () => {
  const vr = step(start, Message.CheckedSupport({ mode: 'immersive-vr', supported: true }));
  const ar = step(vr, Message.CheckedSupport({ mode: 'immersive-ar', supported: false }));
  expect([ar.vr, ar.ar]).toEqual(['ready', 'unavailable']);
});

// SEEING THE OTHER PLAYERS

const poses = {
  head: { position: [0.5, 1.6, 1] as const, quaternion: [0, 0, 0, 1] as const },
  left: null,
  right: { position: [0.7, 1.1, 0.8] as const, quaternion: [0, 0, 0, 1] as const },
};
const named = step(start, Message.NamedPlayer({ peer: 'me', relay: Option.none() }));
const said = (model: Model, message: typeof Message.Type) =>
  (update(model, message).commands ?? []).map((command) => [command.name, command.args]);

test('a page is named as it starts, and says where its player is once it has a name', () => {
  expect(
    said(
      start,
      Message.ReceivedSceneLifecycle({
        lifecycle: SceneStart.StartedScene(),
      }),
    ).map(([name]) => name),
  ).toContain('NamePlayer');
  // No name yet: nothing to say.
  expect(said(start, Message.ReportedPoses({ poses }))).toEqual([]);
  expect(said(named, Message.ReportedPoses({ poses }))).toEqual([
    ['Say', { wire: { _tag: 'Pose', peer: 'me', poses }, via: 'tabs' }],
  ]);
  const relayed = step(start, Message.NamedPlayer({ peer: 'me', relay: Option.some('ws://x/r') }));
  expect(relayed.relay).toEqual(Option.some({ url: 'ws://x/r', link: 'Connecting' }));
  expect(said(relayed, Message.ReportedPoses({ poses }))[0]?.[1]).toMatchObject({ via: 'relay' });
  expect(step(relayed, Message.ConnectedRelay()).relay).toEqual(
    Option.some({ url: 'ws://x/r', link: 'Open' }),
  );
  expect(step(relayed, Message.LostRelay()).relay).toEqual(
    Option.some({ url: 'ws://x/r', link: 'Lost' }),
  );
});

test('the room reports poses while presenting, and says goodbye when the session ends', () => {
  expect(start.player.poses).toBe(0.05);
  const presenting = step(named, Message.ChangedSession({ mode: 'immersive-vr' }));
  expect(said(presenting, Message.ChangedSession({ mode: null }))).toEqual([
    ['Say', { wire: { _tag: 'Bye', peer: 'me' }, via: 'tabs' }],
  ]);
  expect(said(named, Message.LeftPage())).toEqual([
    ['Say', { wire: { _tag: 'Bye', peer: 'me' }, via: 'tabs' }],
  ]);
});

test('another player is drawn where they said they are, until they leave or go quiet', () => {
  const pose = (peer: string, at: number) =>
    Message.HeardPresence({ wire: { _tag: 'Pose', peer, poses }, at });
  const withBob = step(step(named, pose('bob', 1000)), pose('ann', 1000));
  expect(withBob.others.map((other) => other.peer)).toEqual(['bob', 'ann']);
  expect(keys(withBob)).toContain('avatar:bob');
  const bob = sceneFor(withBob).children.find((child) => child.key === 'avatar:bob');
  expect(bob?._tag === 'Group' && bob.children.map((child) => child.key)).toEqual([
    'avatar:bob-head',
    'avatar:bob-right',
  ]);
  // A newer pose replaces the older one, in its place.
  const moved = step(withBob, pose('bob', 1500));
  expect(moved.others.map((other) => [other.peer, other.at])).toEqual([
    ['bob', 1500],
    ['ann', 1000],
  ]);
  // This page's own words are not another player.
  expect(step(named, pose('me', 1000)).others).toEqual([]);
  // Goodbye, or silence for over two seconds, and they are gone.
  const left = step(moved, Message.HeardPresence({ wire: { _tag: 'Bye', peer: 'bob' }, at: 1600 }));
  expect(left.others.map((other) => other.peer)).toEqual(['ann']);
  expect(step(moved, Message.TickedPresence({ at: 2900 })).others.map((o) => o.peer)).toEqual([
    'bob',
    'ann',
  ]);
  expect(step(moved, Message.TickedPresence({ at: 3200 })).others.map((o) => o.peer)).toEqual([
    'bob',
  ]);
  expect(step(moved, Message.TickedPresence({ at: 3200 })).others[0]?.at).toBe(1500);
});
