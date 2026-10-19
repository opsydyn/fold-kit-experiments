import { expect, test } from 'bun:test';

import { Mesh, type Object3D } from 'three';

import {
  basic,
  createSceneGraph,
  mesh,
  perspectiveCamera,
  scene,
  sphere,
  type Trail,
  trail,
  type Vec3,
} from '../src/index.ts';

const cometScene = (at: Vec3, tail: Trail | null) =>
  scene({
    camera: perspectiveCamera({ position: [0, 0, 10], lookAt: [0, 0, 0] }),
    children: [
      mesh({ key: 'comet', position: at, geometry: sphere(), material: basic(), trail: tail }),
    ],
  });

const ribbonOf = (graph: ReturnType<typeof createSceneGraph>): Mesh | undefined =>
  graph.scene.children.find(
    (child: Object3D): child is Mesh =>
      child instanceof Mesh && child.name === 'effect-three:trail',
  );

/** The ribbon's vertex x positions, a pair a point, tail first. */
const xs = (ribbon: Mesh | undefined): ReadonlyArray<number> => {
  const position = ribbon?.geometry.getAttribute('position');
  return Array.from({ length: position?.count ?? 0 }, (_, index) => position?.getX(index) ?? 0);
};

/** Moves the comet along x at 1 unit a second, ticking at `fps` for `seconds`. */
const fly = (fps: number, seconds: number, tail: Trail) => {
  const graph = createSceneGraph();
  graph.reconcile(cometScene([0, 0, 0], tail));
  graph.tick(0);
  for (let frame = 1; frame <= fps * seconds; frame++) {
    const now = frame / fps;
    graph.reconcile(cometScene([now, 0, 0], tail));
    graph.tick(now);
  }
  return graph;
};

test('a trail is a ribbon of length × 10 points behind the node, in the scene', () => {
  const graph = fly(60, 1, trail({ length: 2 }));
  const ribbon = ribbonOf(graph);
  expect(ribbon?.parent).toBe(graph.scene);
  // Twenty points, two vertices each; its head at the comet, its tail a third of a second back.
  const along = xs(ribbon);
  expect(along).toHaveLength(40);
  expect(along.at(-1)).toBeCloseTo(1, 5);
  expect(along[0]).toBeCloseTo(1 - 19 / 60, 5);
  graph.dispose();
});

test('the same trail at 30 and 120 frames a second: recorded in scene time, not frames', () => {
  const tail = trail({ length: 1 });
  const slow = fly(30, 1, tail);
  const fast = fly(120, 1, tail);
  // Its oldest point is where the comet was ten steps (a sixth of a second) ago, either way.
  expect(xs(ribbonOf(slow))[0]).toBeCloseTo(xs(ribbonOf(fast))[0] ?? 0, 1);
  slow.dispose();
  fast.dispose();
});

test('a still node’s trail catches up and stops asking for frames', () => {
  const graph = fly(60, 0.5, trail());
  graph.drawn();
  expect(graph.needsFrame()).toBe(true);
  graph.tick(2);
  graph.drawn();
  expect(graph.needsFrame()).toBe(false);
  graph.dispose();
});

test('a tapered trail narrows to nothing at its tail', () => {
  const graph = fly(60, 1, trail({ taper: 'linear', width: 2 }));
  const position = ribbonOf(graph)?.geometry.getAttribute('position');
  // The two vertices of the tail point coincide; the head's are 0.2 apart.
  expect(position?.getY(0)).toBeCloseTo(position?.getY(1) ?? 1, 6);
  const last = (position?.count ?? 2) - 1;
  expect(Math.abs((position?.getY(last) ?? 0) - (position?.getY(last - 1) ?? 0))).toBeCloseTo(
    0.2,
    5,
  );
  graph.dispose();
});

test('removing the trail removes its ribbon', () => {
  const graph = fly(60, 0.2, trail());
  graph.reconcile(cometScene([0.2, 0, 0], null));
  expect(ribbonOf(graph)).toBeUndefined();
  graph.dispose();
});
