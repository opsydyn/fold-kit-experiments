import { describe, expect, test } from 'bun:test';

import type { SceneNode } from '@opsydyn/effect-three';

import { ringIds } from '../src/radar/data';
import { Message } from '../src/radar/message';
import { cameraDamping, homeCamera, type Model, universeView } from '../src/radar/model';
import { labelBudget, mapBudget } from '../src/radar/placement';
import { sceneFor } from '../src/radar/scene';
import {
  bearingOf,
  elevationOf,
  isBirdsEye,
  ringLabelPosition,
  shellRadius,
} from '../src/radar/space';
import { init, update } from '../src/radar/update';

const start = init().model;
const step = (model: Model, message: Message): Model => update(model, message).model;
const universe = step(start, Message.ClickedUniverse());

const labelAt = (model: Model, key: string) => {
  const node = sceneFor(model).children.find((child: SceneNode) => child.key === key);
  return node?._tag === 'Label' ? node : undefined;
};
const namesOf = (model: Model): ReadonlyArray<string> =>
  sceneFor(model)
    .children.map((node) => node.key)
    .filter((key) => key.startsWith('label:name:'));

describe('universe view', () => {
  test('flies high above the radar on the current bearing, looking at the centre', () => {
    expect(elevationOf(universe.camera.position)).toBeCloseTo(universeView.elevation, 9);
    expect(Math.hypot(...universe.camera.position)).toBeCloseTo(universeView.distance, 9);
    expect(bearingOf(universe.camera.position)).toBeCloseTo(bearingOf(start.camera.position), 9);
    expect(universe.camera.lookAt).toEqual([0, 0, 0]);
    expect(universe.camera.damping).toBe(cameraDamping.flight);
    expect(isBirdsEye(universe.camera.position)).toBe(true);
    expect(isBirdsEye(homeCamera.position)).toBe(false);
  });

  test('from the side the ring names sit over the poles; from above they swing to the edges', () => {
    for (const ring of ringIds) {
      const side = ringLabelPosition(ring, start.camera.position);
      expect([side[0], side[2]]).toEqual([0, 0]);
      const above = ringLabelPosition(ring, universe.camera.position);
      expect(above[1]).toBeCloseTo(0, 9);
      expect(Math.hypot(...above)).toBeCloseTo(shellRadius(ring) + 0.16, 9);
    }
    // Along one bearing, near the camera's, so they read outward like a map's scale.
    const bearings = ringIds.map((ring) =>
      bearingOf(ringLabelPosition(ring, universe.camera.position)),
    );
    for (const bearing of bearings) expect(bearing).toBeCloseTo(bearings[0] ?? Number.NaN, 9);
    expect(Math.abs((bearings[0] ?? 0) - bearingOf(universe.camera.position))).toBeLessThan(10);
  });

  test('the ring names ease between the two places rather than jump', () => {
    const ring = labelAt(universe, 'label:ring:caution');
    expect(ring?.transition._tag).toBe('Ease');
    expect(ring?.position).toEqual(ringLabelPosition('caution', universe.camera.position));
  });

  test('from above the radar is a map: more entries are named, none overlapping', () => {
    expect(namesOf(start)).toEqual([]);
    const names = namesOf(universe);
    expect(names.length).toBeGreaterThan(labelBudget.name);
    expect(names.length).toBeLessThanOrEqual(mapBudget.name);
    for (const key of names) {
      expect(labelAt(universe, key)?.fontSize).toBeGreaterThan(0.13);
    }
  });

  test('the orbit stops short of overhead, where the view would be undefined', () => {
    const climbed = Array.from({ length: 40 }, () =>
      Message.MadeGesture({
        gesture: {
          _tag: 'Drag',
          button: 0,
          modifiers: { shift: false, control: false, meta: false, alt: false },
          width: 800,
          height: 500,
          x: 10,
          y: 10,
          deltaX: 0,
          deltaY: 60,
        },
      }),
    ).reduce(step, start);
    expect(elevationOf(climbed.camera.position)).toBeLessThan(90);
    expect(isBirdsEye(climbed.camera.position)).toBe(true);
  });
});
