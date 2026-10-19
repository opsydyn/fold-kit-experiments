import { expect, test } from 'bun:test';

import {
  basic,
  box,
  createPicker,
  createSceneGraph,
  type Detail,
  detailed,
  group,
  mesh,
  perspectiveCamera,
  scene,
  sphere,
} from '../src/index.ts';

/** A tree in three levels, seen from `distance` along z. */
const treeScene = (distance: number, detail: Detail | null) =>
  scene({
    camera: perspectiveCamera({ position: [0, 0, distance], lookAt: [0, 0, 0] }),
    children: [
      group({
        key: 'tree',
        interactive: true,
        detail,
        children: [
          mesh({ key: 'near', geometry: sphere({ widthSegments: 32 }), material: basic() }),
          mesh({ key: 'middle', geometry: sphere({ widthSegments: 8 }), material: basic() }),
          mesh({ key: 'far', geometry: box(), material: basic() }),
        ],
      }),
    ],
  });

const levels = detailed({ distances: [0, 10, 20] });

const showing = (graph: ReturnType<typeof createSceneGraph>) =>
  ['near', 'middle', 'far'].filter((key) => graph.object(key)?.visible === true);

test('a detailed group shows one level, chosen by the camera’s distance', () => {
  const graph = createSceneGraph();
  for (const [distance, shown] of [
    [5, 'near'],
    [10, 'middle'],
    [15, 'middle'],
    [25, 'far'],
    [3, 'near'],
  ] as const) {
    graph.reconcile(treeScene(distance, levels));
    graph.tick(distance);
    expect(showing(graph)).toEqual([shown]);
  }
  graph.dispose();
});

test('hysteresis keeps a shown level until the camera is that much nearer', () => {
  const graph = createSceneGraph();
  const sticky = detailed({ distances: [0, 10, 20], hysteresis: 0.2 });
  graph.reconcile(treeScene(12, sticky));
  graph.tick(0);
  expect(showing(graph)).toEqual(['middle']);
  // Nearer than 10, but not nearer than 10 less a fifth: the middle level stays.
  graph.reconcile(treeScene(9, sticky));
  graph.tick(1);
  expect(showing(graph)).toEqual(['middle']);
  graph.reconcile(treeScene(7, sticky));
  graph.tick(2);
  expect(showing(graph)).toEqual(['near']);
  graph.dispose();
});

test('without levels every child shows again', () => {
  const graph = createSceneGraph();
  graph.reconcile(treeScene(25, levels));
  graph.tick(0);
  graph.reconcile(treeScene(25, null));
  graph.tick(1);
  expect(showing(graph)).toEqual(['near', 'middle', 'far']);
  graph.dispose();
});

test('only the level showing is picked, as three’s LOD raycasts', () => {
  const graph = createSceneGraph();
  graph.reconcile(treeScene(25, levels));
  graph.tick(0);
  expect(createPicker(graph).pick(0, 0)).toMatchObject({ key: 'far', path: ['tree'] });
  graph.dispose();
});
