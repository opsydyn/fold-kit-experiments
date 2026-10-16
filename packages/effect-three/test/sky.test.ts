import { expect, test } from 'bun:test';

import { Raycaster, Vector3 } from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

import {
  createSceneGraph,
  overlay,
  perspectiveCamera,
  placeOverlays,
  scene,
  sky,
  sunPositionFromAngles,
} from '../src/kernel/index.ts';

const skyOf = (graph: ReturnType<typeof createSceneGraph>) =>
  graph.scene.children.find((child) => child instanceof Sky);

test('sky defaults are Drei’s, with the sun from inclination 0.6 and azimuth 0.1', () => {
  const { sunPosition, ...rest } = sky();
  expect(rest).toEqual({
    turbidity: 10,
    rayleigh: 0.5,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.8,
    clouds: 0,
    distance: 1000,
  });
  // Drei's calcPosFromAngles: theta = π(inclination − ½), phi = 2π(azimuth − ½).
  const expected = [Math.cos(-0.8 * Math.PI), Math.sin(0.1 * Math.PI), Math.sin(-0.8 * Math.PI)];
  sunPosition.forEach((value, i) => expect(value).toBeCloseTo(expected[i] ?? NaN, 12));
  expect(sunPositionFromAngles(0.6, 0.1)).toEqual(sunPosition);
});

test('a sky is shown, updated in place and removed, and is never hit', () => {
  const graph = createSceneGraph();
  graph.reconcile(scene({ sky: sky() }));
  const shown = skyOf(graph);
  expect(shown).toBeInstanceOf(Sky);
  expect(shown?.scale.x).toBe(1000);

  graph.reconcile(scene({ sky: sky({ turbidity: 2, sunPosition: [0, 1, 0] }) }));
  expect(skyOf(graph)).toBe(shown);
  expect(shown?.material.uniforms['turbidity']?.value).toBe(2);
  expect(shown?.material.uniforms['sunPosition']?.value).toEqual(new Vector3(0, 1, 0));

  // Rays pass through the sky: a point far away is still visible past it.
  const raycaster = new Raycaster(new Vector3(), new Vector3(0, 0, -1));
  expect(raycaster.intersectObject(graph.scene, true)).toEqual([]);
  graph.reconcile(
    scene({
      sky: sky(),
      camera: perspectiveCamera({ far: 5000 }),
      overlays: [overlay({ key: 'far', position: [0, 0, -2000], occlude: true })],
    }),
  );
  expect(placeOverlays(graph)[0]?.visible).toBe(true);

  graph.reconcile(scene({}));
  expect(skyOf(graph)).toBeUndefined();
  graph.dispose();
});
