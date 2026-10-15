import { expect, test } from 'bun:test';

import { HemisphereLight, PointLight, SpotLight, Vector3 } from 'three';

import {
  createSceneGraph,
  hemisphereLight,
  pointLight,
  scene,
  spotLight,
} from '../src/kernel/index.ts';

test('light defaults match three.js', () => {
  const point = pointLight({ key: 'p' });
  const reference = new PointLight();
  expect([point.intensity, point.distance, point.decay]).toEqual([
    reference.intensity,
    reference.distance,
    reference.decay,
  ]);
  expect(point.position).toEqual(reference.position.toArray());

  const spot = spotLight({ key: 's' });
  const spotReference = new SpotLight();
  expect([spot.intensity, spot.distance, spot.angle, spot.penumbra, spot.decay]).toEqual([
    spotReference.intensity,
    spotReference.distance,
    spotReference.angle,
    spotReference.penumbra,
    spotReference.decay,
  ]);
  expect(spot.position).toEqual(spotReference.position.toArray());
  expect(spot.target).toEqual(spotReference.target.position.toArray());

  const hemisphere = hemisphereLight({ key: 'h' });
  const hemisphereReference = new HemisphereLight();
  expect(hemisphere.color).toBe(hemisphereReference.color.getHex());
  expect(hemisphere.groundColor).toBe(hemisphereReference.groundColor.getHex());
  expect(hemisphere.position).toEqual(hemisphereReference.position.toArray());
});

test('lights update in place and a spot light aims at its world-space target', () => {
  const graph = createSceneGraph();
  const lit = (target: readonly [number, number, number], intensity: number) =>
    scene({
      children: [
        pointLight({ key: 'p', intensity, position: [1, 2, 3], distance: 8 }),
        spotLight({ key: 's', intensity, position: [0, 5, 0], target, penumbra: 0.4 }),
        hemisphereLight({ key: 'h', intensity, color: 0x87ceeb, groundColor: 0x443322 }),
      ],
    });
  graph.reconcile(lit([0, 0, 0], 1));
  const objects = ['p', 's', 'h'].map((key) => graph.object(key));
  const result = graph.reconcile(lit([2, 0, -1], 3));
  expect(result._tag === 'Applied' && result.ops.map((op) => op._tag)).toEqual([
    'Update',
    'Update',
    'Update',
  ]);
  expect(['p', 's', 'h'].map((key) => graph.object(key))).toEqual(objects);

  const spot = graph.object('s');
  if (!(spot instanceof SpotLight)) throw new Error('expected a spot light');
  expect(spot.intensity).toBe(3);
  expect(spot.penumbra).toBe(0.4);
  // The renderer reads the target's world matrix; it must already reflect the new aim.
  expect(new Vector3().setFromMatrixPosition(spot.target.matrixWorld).toArray()).toEqual([
    2, 0, -1,
  ]);
  graph.dispose();
});
