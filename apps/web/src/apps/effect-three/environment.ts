/**
 * App-wide effect-three state: one GPU resource store and one animation-frame loop.
 * This module is only loaded in the browser (the island's lazy entry), so `window` exists.
 */
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';

export const environment = EffectThreeFoldkit.makeEnvironment(window);
export const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);
