/**
 * Post-processing for the WebGPU renderer: three.js's `RenderPipeline` with TSL nodes for
 * the same effects the WebGL renderer composes (`postprocessing.ts`): bloom
 * (`tsl/display/BloomNode.js`, added to the scene as three's examples add it), film
 * (`tsl/display/FilmNode.js`'s grain, written here, with grayscale by luminance as
 * `FilmPass` offers) and
 * vignette (three's `VignetteShader`, as TSL). The pipeline's output transform applies
 * tone mapping and the output colour space, as the WebGL composer's `OutputPass` does.
 *
 * @module
 */
import { effectsEqual, type PostEffect } from '@opsydyn/effect-three';
import type { Camera, Scene } from 'three';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import {
  clamp,
  dot,
  fract,
  luminance,
  mix,
  pass,
  rand,
  screenUV,
  time,
  uv,
  vec3,
  vec4,
} from 'three/tsl';
import { type Node, RenderPipeline, type WebGPURenderer } from 'three/webgpu';

import type { PostProcessing } from './postprocessing.ts';

type Colour = Node<'vec4'>;

/** One effect applied to the colour so far. */
const applied = (input: Colour, effect: PostEffect): Colour => {
  switch (effect._tag) {
    case 'Bloom':
      return input.add(bloom(input, effect.strength, effect.radius, effect.threshold));
    case 'Vignette': {
      // three's VignetteShader: towards `1 − darkness` with distance from the middle.
      const centred = screenUV.sub(0.5).mul(effect.offset);
      return vec4(mix(input.rgb, vec3(1 - effect.darkness), dot(centred, centred)), input.a);
    }
    case 'Film': {
      // three's FilmNode: noise added in proportion to the colour, mixed in by intensity.
      const base = input.rgb;
      const noise = rand(fract(uv().add(time)));
      const grained = mix(base, base.add(base.mul(clamp(noise.add(0.1), 0, 1))), effect.intensity);
      return vec4(effect.grayscale ? vec3(luminance(grained)) : grained, input.a);
    }
  }
};

export const createWebGPUPostProcessing = (renderer: WebGPURenderer): PostProcessing => {
  let effects: ReadonlyArray<PostEffect> = [];
  let pipeline: RenderPipeline | undefined;
  // The scene and camera the pipeline's scene pass draws: a new one rebuilds it.
  let drawn: { readonly scene: Scene; readonly camera: Camera } | undefined;

  const dispose = (): void => {
    pipeline?.dispose();
    pipeline = undefined;
    drawn = undefined;
  };

  const build = (scene: Scene, camera: Camera): RenderPipeline => {
    dispose();
    const output = effects.reduce<Colour>(applied, pass(scene, camera));
    const next = new RenderPipeline(renderer, output);
    pipeline = next;
    drawn = { scene, camera };
    return next;
  };

  return {
    configure: (next) => {
      if (effectsEqual(next, effects)) return;
      effects = next;
      dispose();
    },
    // The pipeline follows the renderer's size.
    setSize: () => undefined,
    render: (scene, camera) => {
      if (effects.length === 0) return false;
      const current =
        pipeline !== undefined && drawn?.scene === scene && drawn.camera === camera
          ? pipeline
          : build(scene, camera);
      current.render();
      return true;
    },
    dispose,
  };
};
