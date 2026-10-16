import { expect, test } from 'bun:test';

import {
  box,
  createSceneGraph,
  createSceneLoop,
  group,
  mesh,
  orthographicCamera,
  overlay,
  type OverlayPlacement,
  perspectiveCamera,
  placeOverlays,
  recordingRendererFactory,
  scene,
  type SceneDescription,
  standard,
  view,
} from '../src/kernel/index.ts';

const graphOf = (description: SceneDescription) => {
  const graph = createSceneGraph();
  expect(graph.reconcile(description)._tag).toBe('Applied');
  graph.resize(800, 600);
  return graph;
};

const camera = perspectiveCamera({ fov: 50, position: [0, 0, 5], near: 0.1, far: 100 });

test('a point projects to CSS pixels, with Drei’s z-index for its distance', () => {
  const graph = graphOf(scene({ camera, overlays: [overlay({ key: 'o', center: true })] }));
  const [placed] = placeOverlays(graph);
  // Drei's objectZIndex: linear from the near plane (16777271) to the far one (0).
  const slope = -16777271 / (100 - 0.1);
  expect(placed).toEqual({
    key: 'o',
    x: 400,
    y: 300,
    scale: 1,
    zIndex: Math.round(slope * 5 - slope * 100),
    visible: true,
    center: true,
  });
});

test('a point on a node moves with it and with its parents', () => {
  const at = (x: number) =>
    scene({
      camera,
      overlays: [overlay({ key: 'label', node: 'cube', position: [0, 1, 0] })],
      children: [
        group({
          key: 'stand',
          position: [x, 0, 0],
          children: [mesh({ key: 'cube', geometry: box(), material: standard() })],
        }),
      ],
    });
  const graph = graphOf(at(0));
  const [first] = placeOverlays(graph);
  expect(first?.x).toBeCloseTo(400, 6);
  expect(first?.y).toBeLessThan(300);
  graph.reconcile(at(1));
  const [moved] = placeOverlays(graph);
  expect(moved?.x).toBeGreaterThan(400);
  expect(moved?.y).toBeCloseTo(first?.y ?? 0, 6);
});

test('a point behind the camera, or behind a mesh when it occludes, is hidden', () => {
  const graph = graphOf(
    scene({
      camera,
      overlays: [
        overlay({ key: 'behind', position: [0, 0, 8] }),
        overlay({ key: 'hidden', position: [0, 0, -3], occlude: true }),
        overlay({ key: 'shown', position: [0, 0, -3] }),
      ],
      children: [mesh({ key: 'wall', geometry: box(), material: standard() })],
    }),
  );
  expect(placeOverlays(graph).map(({ key, visible }) => [key, visible])).toEqual([
    ['behind', false],
    ['hidden', false],
    ['shown', true],
  ]);
});

test('distanceFactor scales as Drei’s objectScale does, for both camera kinds', () => {
  const perspective = graphOf(
    scene({ camera, overlays: [overlay({ key: 'o', distanceFactor: 10 })] }),
  );
  // At distance 5 a 50° view is 2·tan(25°)·5 units tall.
  expect(placeOverlays(perspective)[0]?.scale).toBeCloseTo(
    10 / (2 * Math.tan((25 * Math.PI) / 180) * 5),
    9,
  );
  const orthographic = graphOf(
    scene({
      camera: orthographicCamera({ zoom: 40 }),
      overlays: [overlay({ key: 'o', distanceFactor: 0.5 })],
    }),
  );
  expect(placeOverlays(orthographic)[0]?.scale).toBe(20);
});

test('with views, a point is placed in its view’s part of the canvas', () => {
  const graph = graphOf(
    scene({
      views: [
        view({ key: 'left', camera, rect: { width: 0.5 } }),
        view({ key: 'right', camera, rect: { x: 0.5, width: 0.5 } }),
      ],
      overlays: [overlay({ key: 'a' }), overlay({ key: 'b', view: 'right' })],
    }),
  );
  expect(placeOverlays(graph).map(({ x, y }) => [x, y])).toEqual([
    [200, 300],
    [600, 300],
  ]);
});

test('the loop places overlays after each drawn frame, and reports their going once', () => {
  const placed: Array<ReadonlyArray<OverlayPlacement>> = [];
  const graph = graphOf(scene({ camera, overlays: [overlay({ key: 'o' })] }));
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => 0,
    emit: () => undefined,
    placeOverlays: (placements) => placed.push(placements),
  });
  loop.frame();
  expect(placed.map((placements) => placements.map(({ key }) => key))).toEqual([['o']]);

  // Moving only an overlay is no scene operation, but it asks for a frame to place it.
  expect(
    graph.reconcile(scene({ camera, overlays: [overlay({ key: 'o', position: [1, 0, 0] })] })),
  ).toEqual({ _tag: 'Applied', ops: [] });
  expect(graph.needsFrame()).toBe(true);
  loop.frame();
  expect(placed[1]?.[0]?.x).toBeGreaterThan(400);

  graph.reconcile(scene({ camera }));
  loop.frame();
  loop.frame();
  expect(placed.slice(2)).toEqual([[]]);
  graph.dispose();
});

test('overlay keys are unique, and their nodes and views exist', () => {
  const graph = createSceneGraph();
  expect(
    graph.reconcile(scene({ overlays: [overlay({ key: 'o' }), overlay({ key: 'o' })] })),
  ).toEqual({ _tag: 'Invalid', error: { _tag: 'DuplicateOverlayKey', key: 'o' } });
  expect(graph.reconcile(scene({ overlays: [overlay({ key: 'o', node: 'nope' })] }))).toEqual({
    _tag: 'Invalid',
    error: { _tag: 'UnknownOverlayNode', key: 'o', node: 'nope' },
  });
  expect(graph.reconcile(scene({ overlays: [overlay({ key: 'o', view: 'nope' })] }))).toEqual({
    _tag: 'Invalid',
    error: { _tag: 'UnknownOverlayView', key: 'o', view: 'nope' },
  });
});
