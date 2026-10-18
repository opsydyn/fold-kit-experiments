/**
 * The WebGPU kit's contact shadow materials, in TSL: the WebGL kit's shadow-from-depth
 * output (colour `color · depth · 2`, alpha `1 − depth`) and three's horizontal and
 * vertical blur shaders (nine taps, their weights). The passes themselves are the
 * kernel's.
 *
 * @module
 */
import { type Color, NoBlending, Texture } from 'three';
import { depth, float, texture, uniform, uv, vec2 } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

import {
  type BlurPass,
  createContactShadowPasses,
  type ShadowMaterials,
} from '../kernel/contactShadowPasses.ts';
import type { SceneRenderer } from '../kernel/renderer.ts';
import type { ContactShadowPasses, ShadowedScene } from '../kernel/renderKit.ts';

/** A material writing exactly what its nodes say: no blending, depth or tone mapping. */
const plainMaterial = (): MeshBasicNodeMaterial => {
  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.blending = NoBlending;
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;
  return material;
};

const depthMaterial = (color: Color): MeshBasicNodeMaterial => {
  const material = plainMaterial();
  // Darkest where an object touches the plane: `depth` is linear for the orthographic camera.
  material.colorNode = uniform(color).mul(depth).mul(2);
  material.opacityNode = float(1).sub(depth);
  return material;
};

/** three's `HorizontalBlurShader` and `VerticalBlurShader` taps: offset and weight. */
const taps = [
  [-4, 0.051],
  [-3, 0.0918],
  [-2, 0.12245],
  [-1, 0.1531],
  [0, 0.1633],
  [1, 0.1531],
  [2, 0.12245],
  [3, 0.0918],
  [4, 0.051],
] as const;

const blur = (direction: 'horizontal' | 'vertical'): BlurPass => {
  const source = texture(new Texture());
  const step = uniform(0);
  const along = direction === 'horizontal' ? vec2(step, 0) : vec2(0, step);
  const [first, ...rest] = taps.map(([offset, weight]) =>
    source.sample(uv().add(along.mul(offset))).mul(weight),
  );
  const sum = rest.reduce((total, tap) => total.add(tap), first ?? source);
  const material = plainMaterial();
  material.colorNode = sum.rgb;
  material.opacityNode = sum.a;
  return {
    material,
    set: (map, amount) => {
      source.value = map;
      step.value = amount;
    },
  };
};

const webgpuShadowMaterials: ShadowMaterials = {
  depth: depthMaterial,
  blur,
  flippedTargets: true,
};

/** Creates the contact shadow passes for one scene graph and renderer, in TSL. */
export const createContactShadows = (
  graph: ShadowedScene,
  renderer: SceneRenderer,
): ContactShadowPasses => createContactShadowPasses(graph, renderer, webgpuShadowMaterials);
