import { expect, test } from 'bun:test';

import { Mesh } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';

import { createSceneGraph, scene, shaderGrid, sky } from '../src/kernel/index.ts';
import { webgpuKit } from '../src/webgpu/index.ts';

test('the WebGPU kit draws the sky and shader grid with node materials, updated in place', () => {
  const graph = createSceneGraph({ kit: webgpuKit });
  graph.reconcile(
    scene({ sky: sky({ turbidity: 4 }), children: [shaderGrid({ key: 'grid', size: [4, 4] })] }),
  );
  const skyMesh = graph.scene.children.find((child) => Reflect.get(child, 'isSkyMesh') === true);
  expect(Reflect.get(skyMesh ?? {}, 'turbidity')?.value).toBe(4);
  const grid = graph.object('grid');
  expect(grid).toBeInstanceOf(Mesh);
  expect(grid instanceof Mesh ? grid.material : undefined).toBeInstanceOf(MeshBasicNodeMaterial);
  graph.reconcile(
    scene({ sky: sky({ turbidity: 6 }), children: [shaderGrid({ key: 'grid', size: [8, 8] })] }),
  );
  expect(Reflect.get(skyMesh ?? {}, 'turbidity')?.value).toBe(6);
  expect(graph.object('grid')).toBe(grid);
  expect(grid instanceof Mesh ? grid.geometry.parameters : undefined).toMatchObject({ width: 8 });
  graph.dispose();
});

test('the WebGPU kit shades with TSL, so labels come from an engine’s TSL implementation', () => {
  expect(webgpuKit.shading).toBe('tsl');
});
