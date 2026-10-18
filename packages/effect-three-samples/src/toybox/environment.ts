/**
 * The toybox's own environment: the samples' renderer (WebGL, or WebGPU with
 * `?renderer=webgpu`), plus Rapier.
 * Only this page loads Rapier's WebAssembly; the scene starts once it is ready.
 */
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { loadRapier } from '@opsydyn/effect-three-rapier';

import { rendererForPage } from '../renderer';

export const environment = EffectThreeFoldkit.makeEnvironment(window, {
  renderer: rendererForPage(window),
  physics: loadRapier(),
});

export const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);
