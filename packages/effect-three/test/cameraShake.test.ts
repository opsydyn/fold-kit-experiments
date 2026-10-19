import { expect, test } from 'bun:test';

import { PerspectiveCamera, Quaternion, Vector3 } from 'three';

import {
  cameraShake,
  type CameraShake,
  createSceneGraph,
  perspectiveCamera,
  scene,
} from '../src/index.ts';

const eye = [0, 2, 8] as const;

const shakenScene = (shake: CameraShake | null) =>
  scene({ camera: perspectiveCamera({ position: [...eye], lookAt: [0, 0, 0], shake }) });

/** The camera's rotation when it looks at the origin with no shake. */
const aimed = (): Quaternion => {
  const camera = new PerspectiveCamera();
  camera.position.set(...eye);
  camera.lookAt(new Vector3());
  return camera.quaternion.clone();
};

const turnAt = (shake: CameraShake | null, times: ReadonlyArray<number>) => {
  const graph = createSceneGraph();
  graph.reconcile(shakenScene(shake));
  const turnAtTime = (time: number): Quaternion => {
    graph.tick(time);
    return graph.camera.quaternion.clone();
  };
  const turns = times.map(turnAtTime);
  graph.dispose();
  return turns;
};

const angle = (a: Quaternion, b: Quaternion) => a.angleTo(b);

test('a shake turns the camera off its aim, the same way at the same scene time', () => {
  const strong = cameraShake({ maxYaw: 0.3, maxPitch: 0.3, maxRoll: 0.3, yawFrequency: 1 });
  const [early, late] = turnAt(strong, [1.3, 7.9]);
  const [again] = turnAt(strong, [1.3]);
  expect(angle(early ?? aimed(), aimed())).toBeGreaterThan(1e-3);
  expect(angle(late ?? aimed(), early ?? aimed())).toBeGreaterThan(1e-3);
  // Pure in scene time: another graph, the same moment, the same turn.
  expect(angle(again ?? aimed(), early ?? aimed())).toBeLessThan(1e-6);
});

test('a decaying shake settles back on the aim, and a new trigger shakes again', () => {
  const graph = createSceneGraph();
  const once = cameraShake({ decay: true, decayRate: 1, maxYaw: 0.3, yawFrequency: 1 });
  graph.reconcile(shakenScene(once));
  graph.tick(0.4);
  expect(angle(graph.camera.quaternion, aimed())).toBeGreaterThan(1e-4);
  expect(graph.needsFrame()).toBe(true);
  // Intensity 1 falling by 1 a second: still after a second.
  graph.tick(1.2);
  expect(angle(graph.camera.quaternion, aimed())).toBeLessThan(1e-6);
  graph.drawn();
  expect(graph.needsFrame()).toBe(false);
  // The same shake, triggered again: it begins now.
  graph.reconcile(shakenScene({ ...once, trigger: 1 }));
  graph.tick(1.6);
  expect(angle(graph.camera.quaternion, aimed())).toBeGreaterThan(1e-4);
  graph.dispose();
});

test('reduced motion holds the camera on its aim', () => {
  const graph = createSceneGraph();
  graph.setAnimating(false);
  graph.reconcile(shakenScene(cameraShake({ maxYaw: 0.3, yawFrequency: 1 })));
  graph.tick(2.5);
  expect(angle(graph.camera.quaternion, aimed())).toBeLessThan(1e-6);
  graph.dispose();
});

test('without a shake the camera stays on its aim', () => {
  const [turn] = turnAt(null, [3]);
  expect(angle(turn ?? new Quaternion(1, 0, 0, 0), aimed())).toBeLessThan(1e-6);
});
