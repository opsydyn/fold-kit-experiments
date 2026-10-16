import { expect, test } from 'bun:test';

import {
  box,
  createPicker,
  createSceneGraph,
  createSceneLoop,
  mesh,
  orthographicCamera,
  perspectiveCamera,
  recordingRendererFactory,
  type RenderArea,
  scene,
  standard,
  view,
} from '../src/kernel/index.ts';

const split = (views = true) =>
  scene({
    views: views
      ? [
          view({
            key: 'front',
            camera: perspectiveCamera({ position: [0, 0, 5] }),
            rect: { width: 0.5 },
          }),
          view({
            key: 'top',
            camera: orthographicCamera({ zoom: 40, position: [0, 10, 0.001] }),
            rect: { x: 0.5, width: 0.5 },
          }),
        ]
      : [],
    children: [mesh({ key: 'cube', geometry: box(), material: standard(), interactive: true })],
  });

test('each view draws into its own area, through its own fitted camera', () => {
  const graph = createSceneGraph();
  graph.reconcile(split());
  graph.resize(800, 400);
  const areas: Array<RenderArea | undefined> = [];
  const factory = recordingRendererFactory();
  const recorded = factory.create();
  const renderer = {
    ...recorded,
    render: (...args: Parameters<typeof recorded.render>) => {
      areas.push(args[2]);
      recorded.render(...args);
    },
  };
  createSceneLoop({ graph, renderer, elapsedSeconds: () => 0, emit: () => undefined }).frame();
  expect(areas).toEqual([
    { x: 0, y: 0, width: 400, height: 400 },
    { x: 400, y: 0, width: 400, height: 400 },
  ]);
  const [front, top] = graph.views();
  expect(front?.camera).toMatchObject({ type: 'PerspectiveCamera', aspect: 1 });
  expect(top?.camera).toMatchObject({ type: 'OrthographicCamera', left: -200, right: 200 });

  graph.resize(1000, 400);
  expect(graph.views()[0]?.camera).toMatchObject({ aspect: 500 / 400 });
  graph.dispose();
});

test('picks go through the view under the pointer and report it', () => {
  const graph = createSceneGraph();
  graph.reconcile(split());
  graph.resize(800, 400);
  const picker = createPicker(graph);
  // The centre of the left half (x = -0.5 in canvas NDC) and of the right half (x = 0.5).
  expect(picker.pick(-0.5, 0)).toMatchObject({ key: 'cube', view: 'front' });
  expect(picker.pick(0.5, 0)).toMatchObject({ key: 'cube', view: 'top' });
  expect(picker.pick(-0.95, 0.9)).toBeUndefined();

  // Without views the main camera fills the canvas again, and hits carry no view.
  graph.reconcile(split(false));
  expect(graph.views()).toEqual([]);
  expect(picker.pick(0, 0)).not.toHaveProperty('view');
  graph.dispose();
});

test('an area no view covers picks nothing; duplicate view keys are rejected', () => {
  const graph = createSceneGraph();
  graph.reconcile(
    scene({
      views: [view({ key: 'only', camera: perspectiveCamera(), rect: { x: 0.5, width: 0.5 } })],
      children: [mesh({ key: 'cube', geometry: box(), material: standard(), interactive: true })],
    }),
  );
  graph.resize(800, 400);
  expect(createPicker(graph).pick(-0.5, 0)).toBeUndefined();
  const twice = view({ key: 'v', camera: perspectiveCamera() });
  expect(graph.reconcile(scene({ views: [twice, twice] }))).toEqual({
    _tag: 'Invalid',
    error: { _tag: 'DuplicateViewKey', key: 'v' },
  });
  graph.dispose();
});
