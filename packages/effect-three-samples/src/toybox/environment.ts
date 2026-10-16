/**
 * The toybox's own environment: the samples' transparent WebGL renderer, plus Rapier.
 * Only this page loads Rapier's WebAssembly; the scene starts once it is ready.
 */
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { loadRapier } from '@opsydyn/effect-three-rapier';

export const environment = EffectThreeFoldkit.makeEnvironment(window, {
  renderer: (canvas) => EffectThreeFoldkit.webglRendererFactory(canvas, { alpha: true }),
  physics: loadRapier(),
});

export const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);
