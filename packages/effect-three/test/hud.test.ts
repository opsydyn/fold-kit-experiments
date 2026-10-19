import { expect, test } from 'bun:test';

import { Vector3 } from 'three';

import {
  basic,
  box,
  createPicker,
  createSceneGraph,
  createSceneLoop,
  hud,
  type HudAlignment,
  mesh,
  recordingRendererFactory,
  scene,
  standard,
} from '../src/kernel/index.ts';

/** A 40-pixel button at the HUD's origin, over a cube filling the middle of the scene. */
const withHud = (
  alignment: HudAlignment = 'bottom-right',
  margin: readonly [number, number] = [80, 80],
) =>
  scene({
    hud: hud({
      alignment,
      margin,
      children: [
        mesh({
          key: 'button',
          geometry: box({ width: 40, height: 40, depth: 40 }),
          material: basic({ color: 0xff0000 }),
          interactive: true,
        }),
      ],
    }),
    children: [
      mesh({
        key: 'cube',
        geometry: box({ width: 20, height: 20, depth: 1 }),
        material: standard(),
        interactive: true,
      }),
    ],
  });

/** Where the HUD's origin shows on an 800 × 600 canvas, in CSS pixels from the top left. */
const originOnCanvas = (graph: ReturnType<typeof createSceneGraph>) => {
  const hosted = graph.hud();
  if (hosted === undefined) return undefined;
  const { camera } = hosted.graph;
  camera.updateMatrixWorld();
  const seen = new Vector3(0, 0, 0).project(camera);
  return [((seen.x + 1) / 2) * 800, ((1 - seen.y) / 2) * 600];
};

test('a HUD’s origin sits its margin in from the aligned edges, and follows a resize', () => {
  const graph = createSceneGraph();
  graph.resize(800, 600);
  graph.reconcile(withHud());
  const [x = 0, y = 0] = originOnCanvas(graph) ?? [];
  expect(x).toBeCloseTo(720, 6);
  expect(y).toBeCloseTo(520, 6);
  graph.reconcile(withHud('top-center', [10, 30]));
  const [cx = 0, cy = 0] = originOnCanvas(graph) ?? [];
  expect(cx).toBeCloseTo(400, 6);
  expect(cy).toBeCloseTo(30, 6);
  graph.resize(1000, 600);
  graph.reconcile(withHud());
  const hosted = graph.hud();
  hosted?.graph.camera.updateMatrixWorld();
  const seen = new Vector3(0, 0, 0).project(hosted?.graph.camera ?? graph.camera);
  expect(((seen.x + 1) / 2) * 1000).toBeCloseTo(920, 6);
});

test('the HUD is picked first, and the scene behind it everywhere else', () => {
  const graph = createSceneGraph();
  graph.resize(800, 600);
  graph.reconcile(withHud('center-center'));
  const picker = createPicker(graph);
  // The middle of the canvas: the HUD's button covers the cube.
  expect(picker.pick(0, 0)?.key).toBe('button');
  graph.reconcile(withHud());
  expect(picker.pick(0, 0)?.key).toBe('cube');
  // 720, 520 in CSS pixels is (0.8, −0.733) in NDC.
  expect(picker.pick(0.8, -520 / 300 + 1)?.key).toBe('button');
});

test('the loop draws the HUD over the scene, and a scene without one draws none', () => {
  const graph = createSceneGraph();
  graph.resize(800, 600);
  graph.reconcile(withHud());
  const recorded = recordingRendererFactory().create();
  const over: Array<unknown> = [];
  const renderer = {
    ...recorded,
    renderOver: (...args: Parameters<NonNullable<typeof recorded.renderOver>>) => {
      over.push(args[0]);
    },
  };
  const loop = createSceneLoop({ graph, renderer, elapsedSeconds: () => 0, emit: () => undefined });
  loop.frame();
  expect(over).toEqual([graph.hud()?.graph.scene]);
  const removed = graph.reconcile(scene({}));
  expect(removed._tag === 'Applied' ? removed.ops.map((op) => op._tag) : []).toContain('RemoveHud');
  expect(graph.hud()).toBeUndefined();
  loop.frame();
  expect(over).toHaveLength(1);
});

test('a HUD’s keys are checked like the scene’s', () => {
  const graph = createSceneGraph();
  const twice = mesh({ key: 'twice', geometry: box(), material: basic() });
  const result = graph.reconcile(scene({ hud: hud({ children: [twice, twice] }) }));
  expect(result).toMatchObject({ _tag: 'Invalid' });
  expect(graph.hud()).toBeUndefined();
});
