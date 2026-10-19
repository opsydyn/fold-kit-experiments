/**
 * One effect-three environment per page, shared by every sample on it that draws no
 * labels. Sample modules load only in the browser (through Astro islands), so `window`
 * exists here.
 *
 * The canvas is transparent, so the host page's surface colour and theme show through.
 */
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';

import { rendererForPage } from './renderer';

export const environment = EffectThreeFoldkit.makeEnvironment(window, {
  renderer: rendererForPage(window),
});

export const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);
