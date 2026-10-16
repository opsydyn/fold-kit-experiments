import { expect, test } from 'bun:test';

import {
  box,
  createSceneGraph,
  mesh,
  scene,
  stage,
  stagePresets,
  standard,
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
