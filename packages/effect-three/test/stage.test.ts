import { expect, test } from 'bun:test';

import { Box3, Group } from 'three';

import {
  basic,
  box,
  centerOffset,
  createSceneGraph,
  environmentPresets,
  environmentPresetUrl,
  mesh,
  scene,
  stage,
  stageBounds,
  stagePresets,
  standard,
  type Vec3,
} from '../src/kernel/index.ts';

test('a stage lights as Drei’s Stage does, scaled by the content’s radius', () => {
  const { lights, contactShadows, environment } = stage({ radius: 2, height: 3 });
  expect(lights).toMatchObject([
    { _tag: 'AmbientLight', key: 'stage-ambient', intensity: 0.5 / 3 },
    {
      _tag: 'SpotLight',
      key: 'stage-main',
      position: [2, 4, 2],
      penumbra: 1,
      intensity: 1,
      castShadow: true,
      shadowBias: -0.0001,
      shadowMapSize: 1024,
    },
    { _tag: 'PointLight', key: 'stage-fill', position: [-4, -1, -4], intensity: 0.5 },
  ]);
  // Contact shadows at the content's base, radius × 4 across, reaching radius up, blur 2.
  expect(contactShadows).toMatchObject({ position: [0, -1.5, 0], size: [8, 8], far: 2, blur: 2 });
  // The room environment stands in for Drei's "city" HDR.
  expect(environment).toMatchObject({ map: null });
});

test('presets, intensity, no shadows and no environment', () => {
  const soft = stage({
    radius: 1,
    height: 1,
    preset: 'soft',
    intensity: 2,
    shadows: 'none',
    environment: null,
  });
  expect(soft.lights[1]).toMatchObject({ position: stagePresets.soft.main, castShadow: false });
  expect(soft.lights[2]).toMatchObject({ position: stagePresets.soft.fill, intensity: 2 });
  expect(soft.contactShadows).toBeNull();
  expect(soft.environment).toBeNull();
});

test('a stage spreads into a valid scene', () => {
  const { lights, contactShadows, environment } = stage({ radius: 1, height: 1 });
  const graph = createSceneGraph();
  const result = graph.reconcile(
    scene({
      contactShadows,
      environment,
      children: [...lights, mesh({ key: 'model', geometry: box(), material: standard() })],
    }),
  );
  expect(result._tag).toBe('Applied');
  graph.dispose();
});

test('centerOffset is Drei’s Center: the middle to the origin, or a side, per axis', () => {
  const box = { min: [1, 2, 3], max: [3, 6, 7] } as const;
  expect(centerOffset(box)).toEqual([-2, -4, -5]);
  // `top` stands it on y = 0; `left` puts its right side at x = 0; `front`, its back at z = 0.
  expect(centerOffset(box, { top: true, left: true, front: true })).toEqual([-3, -2, -3]);
  expect(centerOffset(box, { bottom: true, right: true, back: true })).toEqual([-1, -6, -7]);
  expect(centerOffset(box, { disableX: true, disableY: true, disableZ: true })).toEqual([0, 0, 0]);
  // Stage's sizes: the bounding sphere's radius is half the diagonal.
  expect(stageBounds(box)).toEqual({ radius: 3, width: 2, height: 4, depth: 4 });
});

test('content placed at its centre offset sits centred on the origin, or on the floor', () => {
  const graph = createSceneGraph();
  const model = (position: Vec3) =>
    scene({
      children: [
        mesh({
          key: 'model',
          position,
          geometry: box({ width: 2, height: 4, depth: 1 }),
          material: basic(),
        }),
      ],
    });
  // Measured where it is drawn at no offset: a box around its own geometry.
  graph.reconcile(model([0, 0, 0]));
  const measured = new Box3().setFromObject(graph.object('model') ?? new Group());
  const toBox = (b: Box3) => ({ min: b.min.toArray(), max: b.max.toArray() });
  graph.reconcile(model(centerOffset(toBox(measured), { top: true })));
  graph.scene.updateMatrixWorld();
  const placed = new Box3().setFromObject(graph.object('model') ?? new Group());
  expect(placed.min.toArray()).toEqual([-1, 0, -0.5]);
  expect(placed.max.toArray()).toEqual([1, 4, 0.5]);
  graph.dispose();
});

test('environment presets are Drei’s files at the asset commit Drei pins', () => {
  expect(Object.keys(environmentPresets)).toHaveLength(10);
  expect(environmentPresetUrl('city')).toBe(
    'https://raw.githack.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri/potsdamer_platz_1k.hdr',
  );
});
