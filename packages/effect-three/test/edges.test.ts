import { expect, test } from 'bun:test';

import type { Object3D } from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';

import {
  basic,
  box,
  createPicker,
  createSceneGraph,
  type Edges,
  edges,
  type GeometryRef,
  mesh,
  orthographicCamera,
  scene,
  sphere,
} from '../src/index.ts';
import { webglKit } from '../src/webgl/index.ts';

const crateScene = (outline: Edges | null, geometry: GeometryRef = box()) =>
  scene({
    camera: orthographicCamera({ zoom: 40, position: [0, 0, 10], lookAt: [0, 0, 0] }),
    children: [
      mesh({ key: 'crate', geometry, material: basic(), edges: outline, interactive: true }),
    ],
  });

/** The edge lines' segments object inside the mesh, if it has any. */
const outlineOf = (crate: Object3D | undefined): LineSegments2 | undefined => {
  let found: LineSegments2 | undefined;
  crate?.traverse((part) => {
    if (part instanceof LineSegments2) found = part;
  });
  return found;
};

test('edges draw a segment along each of a box’s twelve hard edges', () => {
  const graph = createSceneGraph({ kit: webglKit });
  graph.reconcile(crateScene(edges({ color: 0x000000, width: 2 })));
  graph.tick(0);
  const outline = outlineOf(graph.object('crate'));
  expect(outline?.geometry.instanceCount).toBe(12);
  expect(outline?.material.color.getHex()).toBe(0x000000);
  expect(outline?.material.linewidth).toBe(2);
  graph.dispose();
});

test('picking through edges hits the mesh: the lines are never picked', () => {
  const graph = createSceneGraph({ kit: webglKit });
  graph.reconcile(crateScene(edges()));
  graph.tick(0);
  expect(createPicker(graph).pick(0, 0)).toMatchObject({ key: 'crate' });
  graph.dispose();
});

test('a new geometry rebuilds the edges; a smooth one has none past the threshold', () => {
  const graph = createSceneGraph({ kit: webglKit });
  graph.reconcile(crateScene(edges()));
  graph.tick(0);
  graph.reconcile(crateScene(edges(), sphere({ widthSegments: 32, heightSegments: 16 })));
  graph.tick(0.1);
  // A sphere's neighbouring faces meet at under 15 degrees: nothing to draw.
  expect(outlineOf(graph.object('crate'))?.visible).toBe(false);
  // At a lower threshold its facets show.
  graph.reconcile(
    crateScene(edges({ threshold: 5 }), sphere({ widthSegments: 32, heightSegments: 16 })),
  );
  graph.tick(0.2);
  expect(outlineOf(graph.object('crate'))?.geometry.instanceCount).toBeGreaterThan(100);
  graph.dispose();
});

test('removing the edges removes their lines; without a kit there are none', () => {
  const graph = createSceneGraph({ kit: webglKit });
  graph.reconcile(crateScene(edges()));
  graph.tick(0);
  graph.reconcile(crateScene(null));
  graph.tick(0.1);
  expect(outlineOf(graph.object('crate'))).toBeUndefined();
  graph.dispose();

  const bare = createSceneGraph();
  bare.reconcile(crateScene(edges()));
  bare.tick(0);
  expect(bare.object('crate')?.children).toEqual([]);
  bare.dispose();
});
