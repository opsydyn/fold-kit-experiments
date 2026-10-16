/**
 * Post-processing for the WebGL renderer: three.js's `EffectComposer`, built from the
 * scene's `render.effects` and rebuilt only when they change. With no effects the scene
 * renders straight to the screen and no composer exists.
 *
 * The composer renders into a multisampled target, so antialiasing survives, and ends
 * with three's `OutputPass`, which applies tone mapping and the output colour space.
 *
 * @module
 */
import { effectsEqual, type PostEffect } from '@opsydyn/effect-three';
import {
  type Camera,
  HalfFloatType,
  PerspectiveCamera,
  type Scene,
  Scene as EmptyScene,
  Vector2,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Pass } from 'three/addons/postprocessing/Pass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';

type Size = { width: number; height: number; pixelRatio: number };

const passFor = (effect: PostEffect, size: Size): Pass => {
  switch (effect._tag) {
    case 'Bloom':
      return new UnrealBloomPass(
        new Vector2(size.width, size.height),
        effect.strength,
        effect.radius,
        effect.threshold,
      );
    case 'Vignette': {
      const pass = new ShaderPass(VignetteShader);
      pass.uniforms['offset'] = { value: effect.offset };
      pass.uniforms['darkness'] = { value: effect.darkness };
      return pass;
    }
    case 'Film':
      return new FilmPass(effect.intensity, effect.grayscale);
  }
};

export type PostProcessing = {
  /** Rebuilds the passes when `effects` differ from the current ones. */
  readonly configure: (effects: ReadonlyArray<PostEffect>) => void;
  readonly setSize: (width: number, height: number, pixelRatio: number) => void;
  /** Renders through the effects; returns false when there are none to apply. */
  readonly render: (scene: Scene, camera: Camera) => boolean;
  readonly dispose: () => void;
};

export const createPostProcessing = (renderer: WebGLRenderer): PostProcessing => {
  let effects: ReadonlyArray<PostEffect> = [];
  let composer: EffectComposer | undefined;
  let renderPass: RenderPass | undefined;
  const size: Size = { width: 1, height: 1, pixelRatio: 1 };

  const dispose = (): void => {
    if (composer === undefined) return;
    for (const pass of composer.passes) pass.dispose();
    composer.dispose();
    composer = undefined;
    renderPass = undefined;
  };

  const build = (): void => {
    dispose();
    if (effects.length === 0) return;
    const target = new WebGLRenderTarget(size.width, size.height, {
      type: HalfFloatType,
      samples: 4,
    });
    const next = new EffectComposer(renderer, target);
    const first = new RenderPass(new EmptyScene(), new PerspectiveCamera());
    next.addPass(first);
    for (const effect of effects) next.addPass(passFor(effect, size));
    next.addPass(new OutputPass());
    next.setPixelRatio(size.pixelRatio);
    next.setSize(size.width, size.height);
    composer = next;
    renderPass = first;
  };

  return {
    configure: (next) => {
      if (effectsEqual(next, effects)) return;
      effects = next;
      build();
    },
    setSize: (width, height, pixelRatio) => {
      size.width = width;
      size.height = height;
      size.pixelRatio = pixelRatio;
      composer?.setPixelRatio(pixelRatio);
      composer?.setSize(width, height);
    },
    render: (scene, camera) => {
      if (composer === undefined || renderPass === undefined) return false;
      renderPass.scene = scene;
      renderPass.camera = camera;
      composer.render();
      return true;
    },
    dispose,
  };
};
