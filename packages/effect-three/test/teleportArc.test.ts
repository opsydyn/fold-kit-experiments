/**
 * The teleport arc (`xr({ teleportArc })`), checked against pmndrs/xr at `0e1acd8`
 * (`packages/xr/src/teleport.ts`): the curve, how it leaves a controller, where it lands,
 * and where the player goes.
 */
import { expect, test } from 'bun:test';

import { Euler, Quaternion, QuadraticBezierCurve3, Vector3 } from 'three';

import {
  arcAim,
  arcHit,
  arcPoints,
  createPicker,
  createSceneGraph,
  createXrTracker,
  easeAim,
  type Quat,
  teleportArc,
  teleported,
  teleportOrigin,
  type Vec3,
  xr,
  xrEquals,
} from '../src/kernel/index.ts';

const quat = (x: number, y: number, z: number): Quat => {
  const q = new Quaternion().setFromEuler(new Euler(x, y, z, 'YXZ'));
  return [q.x, q.y, q.z, q.w];
};

const eulerOf = (q: Quat) => new Euler().setFromQuaternion(new Quaternion(...q), 'YXZ');

const close = (a: ReadonlyArray<number>, b: ReadonlyArray<number>) =>
  a.forEach((value, i) => expect(value).toBeCloseTo(b[i] ?? Number.NaN, 9));

test('the arc is pmndrs/xr’s curve, placed at the controller along its aim', () => {
  const reference = new QuadraticBezierCurve3(
    new Vector3(0, 0, 0),
    new Vector3(0, 0, -8),
    new Vector3(0, -20, -15),
  ).getPoints(20);
  const level = arcPoints([0, 0, 0], [0, 0, 0, 1]);
  expect(level).toHaveLength(21);
  level.forEach((point, i) => close(point, reference[i]?.toArray() ?? []));
  // Moved and turned, it is the same curve, moved and turned.
  const aim = quat(0, Math.PI / 2, 0);
  const placed = arcPoints([1, 1.5, -2], aim);
  placed.forEach((point, i) => {
    const expected = (reference[i] ?? new Vector3())
      .clone()
      .applyQuaternion(new Quaternion(...aim))
      .add(new Vector3(1, 1.5, -2));
    close(point, expected.toArray());
  });
});

test('the arc keeps the controller’s yaw and pitch, dipped 10° and clamped, and drops its roll', () => {
  const dip = (10 * Math.PI) / 180;
  const level = eulerOf(arcAim(quat(0.2, 0.7, 0.9)));
  expect(level.y).toBeCloseTo(0.7, 9);
  expect(level.x).toBeCloseTo(0.2 - dip, 9);
  expect(level.z).toBeCloseTo(0, 9);
  // Pointed high, it leaves no higher than 49.5°; pointed down, no lower than straight down.
  expect(eulerOf(arcAim(quat(1.2, 0, 0))).x).toBeCloseTo((1.1 * Math.PI) / 4, 9);
  expect(eulerOf(arcAim(quat(-1.5, 0, 0))).x).toBeCloseTo(-Math.PI / 2, 6);
});

test('the arc’s aim catches up over a tenth of a second', () => {
  const from = quat(0, 0, 0);
  const to = quat(0, 1, 0);
  close(easeAim(from, to, 0), from);
  expect(eulerOf(easeAim(from, to, 50)).y).toBeCloseTo(0.5, 9);
  close(easeAim(from, to, 100), to);
  close(easeAim(from, to, 400), to);
});

/** Where a segment from `from` to `to` crosses the floor (y = 0), going down. */
function floor(from: Vec3, to: Vec3): Vec3 | undefined {
  if (from[1] < 0 || to[1] >= 0) return undefined;
  const t = from[1] / (from[1] - to[1]);
  return [from[0] + (to[0] - from[0]) * t, 0, from[2] + (to[2] - from[2]) * t];
}

test('the arc lands where its first segment meets something', () => {
  // A controller at head height, level: the arc falls to the floor (y = 0) ahead of it.
  const points = arcPoints([0, 1.5, 0], arcAim([0, 0, 0, 1]));
  const hit = arcHit(points, floor);
  expect(hit?.point[1]).toBe(0);
  expect(hit?.point[2]).toBeLessThan(-1);
  // The segment before it is still above the floor.
  expect(points[hit?.segment ?? 0]?.[1]).toBeGreaterThanOrEqual(0);
  expect(arcHit(points, () => undefined)).toBeUndefined();
});

test('the player goes so their head stands over the landing, on its floor, facing as before', () => {
  const settings = xr({ origin: [2, 0, 0], heading: 0.5 });
  // The head is half a metre right of the origin and a little forward.
  const origin = teleportOrigin(settings, [5, 0.4, -3], [2.5, 1.6, -0.2]);
  close(origin, [4.5, 0.4, -2.8]);
  expect(teleported(settings, { origin })).toEqual({ ...settings, origin });
});

test('letting an arc go over a target reports where the player goes', () => {
  const route = createXrTracker(createPicker(createSceneGraph()));
  expect(
    route({ _tag: 'Teleport', hand: 'left', point: [1, 0, -2], origin: [0.5, 0, -2] }),
  ).toEqual([{ _tag: 'XrTeleported', hand: 'left', point: [1, 0, -2], origin: [0.5, 0, -2] }]);
});

test('an arc is the left hand’s by default, white at 0.4, and part of xr equality', () => {
  const arc = teleportArc({ targets: ['floor'] });
  expect(arc).toEqual({ hand: 'left', targets: ['floor'], color: 0xffffff, opacity: 0.4 });
  expect(xr().teleportArc).toBeNull();
  const withArc = xr({ teleportArc: arc });
  expect(xrEquals(withArc, xr({ teleportArc: teleportArc({ targets: ['floor'] }) }))).toBe(true);
  expect(xrEquals(withArc, xr({ teleportArc: teleportArc({ targets: ['rug'] }) }))).toBe(false);
  expect(xrEquals(withArc, xr())).toBe(false);
});
