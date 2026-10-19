import { expect, test } from 'bun:test';

import { type Object3D, Points, PointsMaterial, ShaderMaterial } from 'three';
import { PointsNodeMaterial, Sprite } from 'three/webgpu';

import {
  createSceneGraph,
  perspectiveCamera,
  type PointsNode,
  points,
  scene,
  sparkles,
  stars,
} from '../src/index.ts';
import { pointBuffers } from '../src/kernel/pointBuffers.ts';
import { webglKit } from '../src/webgl/index.ts';
import { webgpuKit } from '../src/webgpu/index.ts';

const skyScene = (node: PointsNode) =>
  scene({ camera: perspectiveCamera({ position: [0, 0, 5] }), children: [node] });

const drawnOf = (graph: ReturnType<typeof createSceneGraph>): Object3D | undefined =>
  graph.object('sky')?.children[0]?.children[0];

test('sparkles and stars scatter the same way for the same seed, differently for another', () => {
  const one = pointBuffers(sparkles({ key: 'sky', seed: 7 }).look);
  const again = pointBuffers(sparkles({ key: 'sky', seed: 7 }).look);
  const other = pointBuffers(sparkles({ key: 'sky', seed: 8 }).look);
  expect(one.positions).toEqual(again.positions);
  expect(one.positions).not.toEqual(other.positions);
  // Drei's defaults: 100 motes in a unit box, sizes up to 1.
  expect(one.count).toBe(100);
  expect(Math.max(...one.positions.map(Math.abs))).toBeLessThanOrEqual(0.5);
  expect(Math.max(...one.sizes)).toBeLessThan(1);
  const field = pointBuffers(stars({ key: 'sky', count: 50 }).look);
  // A shell from radius 100 to 150.
  for (let star = 0; star < field.count; star++) {
    const [x = 0, y = 0, z = 0] = field.positions.subarray(star * 3, star * 3 + 3);
    const radius = Math.hypot(x, y, z);
    expect(radius).toBeGreaterThanOrEqual(100);
    expect(radius).toBeLessThanOrEqual(150);
  }
});

test('dots take their own colours and size factors, or the look’s', () => {
  const buffers = pointBuffers(
    points({
      key: 'sky',
      positions: [
        [0, 0, 0],
        [1, 0, 0],
      ],
      colors: [0xff0000, 0x0000ff],
      sizes: [1, 3],
    }).look,
  );
  expect(Array.from(buffers.colors)).toEqual([1, 0, 0, 0, 0, 1]);
  expect(Array.from(buffers.sizes)).toEqual([1, 3]);
});

test('the WebGL kit draws dots with a patched PointsMaterial, sparkles and stars with Drei’s shaders', () => {
  const graph = createSceneGraph({ kit: webglKit });
  graph.reconcile(skyScene(points({ key: 'sky', positions: [[0, 0, 0]], size: 8 })));
  const dots = drawnOf(graph);
  expect(dots).toBeInstanceOf(Points);
  expect(dots instanceof Points ? dots.material : undefined).toBeInstanceOf(PointsMaterial);
  graph.reconcile(skyScene(stars({ key: 'sky', count: 10, speed: 2 })));
  const field = drawnOf(graph);
  const material = field instanceof Points ? field.material : undefined;
  expect(material).toBeInstanceOf(ShaderMaterial);
  // Stars twinkle at their speed, in scene time.
  graph.tick(3);
  expect(material instanceof ShaderMaterial ? material.uniforms['time']?.value : 0).toBe(6);
  graph.dispose();
});

test('the WebGPU kit draws points as instanced sprites with node materials', () => {
  const graph = createSceneGraph({ kit: webgpuKit });
  graph.reconcile(skyScene(sparkles({ key: 'sky', count: 30 })));
  const motes = drawnOf(graph);
  expect(motes).toBeInstanceOf(Sprite);
  expect(motes instanceof Sprite ? motes.count : 0).toBe(30);
  expect(motes instanceof Sprite ? motes.material : undefined).toBeInstanceOf(PointsNodeMaterial);
  graph.dispose();
});

test('sparkles keep frames coming while motion is on; reduced motion holds them', () => {
  const graph = createSceneGraph({ kit: webglKit });
  graph.reconcile(skyScene(sparkles({ key: 'sky', count: 5 })));
  graph.tick(1);
  graph.drawn();
  expect(graph.needsFrame()).toBe(true);
  const motes = drawnOf(graph);
  const time = () =>
    motes instanceof Points && motes.material instanceof ShaderMaterial
      ? motes.material.uniforms['time']?.value
      : undefined;
  expect(time()).toBe(1);
  graph.setAnimating(false);
  graph.tick(2);
  graph.drawn();
  expect(time()).toBe(1);
  expect(graph.needsFrame()).toBe(false);
  graph.dispose();
});

test('without a kit points are an empty wrapper', () => {
  const graph = createSceneGraph();
  graph.reconcile(skyScene(stars({ key: 'sky' })));
  expect(graph.object('sky')?.children).toEqual([]);
  graph.dispose();
});
