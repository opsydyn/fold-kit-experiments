/**
 * One effect-three environment per page, shared by every sample on it. Sample modules
 * load only in the browser (through Astro islands), so `window` exists here.
 *
 * The canvas is transparent, so the host page's surface colour and theme show through.
 */
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';

export const environment = EffectThreeFoldkit.makeEnvironment(window, {
  renderer: (canvas) => EffectThreeFoldkit.webglRendererFactory(canvas, { alpha: true }),
});

export const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);
