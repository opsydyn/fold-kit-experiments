import { expect, test } from 'bun:test';

import {
  box,
  clipCamera,
  createSceneGraph,
  createSceneLoop,
  fitCamera,
  mesh,
  orthographicCamera,
  perspectiveCamera,
  recordingRendererFactory,
  scene,
  type SceneEvent,
  standard,
} from '../src/kernel/index.ts';

const area = { width: 800, height: 600 };

test('measured nodes report their world box when it changes, and only then', () => {
  const graph = createSceneGraph();
  const events: Array<SceneEvent> = [];
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => 0,
    emit: (event) => events.push(event),
  });
  const crate = (x: number) =>
    scene({
      measure: ['crate'],
      children: [
        mesh({
          key: 'crate',
          position: [x, 0, 0],
          scale: [2, 1, 1],
          geometry: box(),
          material: standard(),
        }),
      ],
    });
  graph.reconcile(crate(0));
  loop.frame();
  loop.frame();
  expect(events).toEqual([
    { _tag: 'Measured', key: 'crate', min: [-1, -0.5, -0.5], max: [1, 0.5, 0.5] },
  ]);
  graph.reconcile(crate(3));
  loop.frame();
  expect(events.at(-1)).toEqual({
    _tag: 'Measured',
    key: 'crate',
    min: [2, -0.5, -0.5],
    max: [4, 0.5, 0.5],
  });
  expect(graph.reconcile(scene({ measure: ['nope'] }))).toEqual({
    _tag: 'Invalid',
    error: { _tag: 'UnknownMeasuredNode', key: 'nope' },
  });
});

test('fitting moves a perspective camera along its view to Drei’s distance, at the centre', () => {
  const unit = { min: [-1, -1, -1], max: [1, 1, 1] } as const;
  const fitted = fitCamera(perspectiveCamera({ fov: 50, position: [0, 0, 20] }), unit, area);
  // Drei's Bounds: largest side 2, over 2·atan(fov/2); wider than tall, so height decides.
  const distance = 1.2 * (2 / (2 * Math.atan((Math.PI * 50) / 360)));
  expect(fitted.position[2]).toBeCloseTo(distance, 9);
  expect(fitted.lookAt).toEqual([0, 0, 0]);
  // A tall, narrow area: the width decides.
  const narrow = fitCamera(perspectiveCamera({ fov: 50, position: [0, 0, 20] }), unit, {
    width: 300,
    height: 600,
  });
  expect(narrow.position[2]).toBeCloseTo(distance * 2, 9);
  expect(clipCamera(fitted, unit, area)).toMatchObject({
    near: distance / 100,
    far: distance * 100,
  });
});

test('fitting an orthographic camera only zooms, so the box’s corners fit the area', () => {
  const fitted = fitCamera(
    orthographicCamera({ zoom: 1, position: [0, 0, 10] }),
    { min: [-2, -1, -1], max: [2, 1, 1] },
    area,
  );
  // Seen head on the box is 4 wide and 2 tall: 800/4 = 200 and 600/2 = 300, the smaller.
  expect(fitted._tag === 'Orthographic' && fitted.zoom).toBeCloseTo(200 / 1.2, 9);
  expect(fitted.position).toEqual([0, 0, 10]);
});
