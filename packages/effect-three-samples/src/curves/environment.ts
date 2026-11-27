/**
 * The curves page's environment: the samples' renderer (WebGL, or WebGPU with
 * `?renderer=webgpu`), and a `ride` behaviour that carries the comet along the curve. A
 * behaviour is a pure function of scene time, so the comet moves without a Message a
 * frame, and the control points ride along as its parameters: drag one and its path
 * changes at once.
 */
import { makeEnvironment } from '@opsydyn/effect-three/browser';

import { defineEffectThreeMount } from '../effect-ui-scene';
import { rendererForPage } from '../renderer';
import { ride } from './ride';

export const sceneMount = defineEffectThreeMount(() =>
  makeEnvironment(window, { renderer: rendererForPage(window), behaviours: { ride } }),
);
