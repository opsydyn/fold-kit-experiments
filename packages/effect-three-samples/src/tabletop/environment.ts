/**
 * The tabletop's own environment: the samples' renderer, plus Rapier's deterministic
 * build, so peers on different machines simulate the same world (ADR-014).
 */
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { loadRapier } from '@opsydyn/effect-three-rapier/deterministic';

import { rendererForPage } from '../renderer';

export const environment = EffectThreeFoldkit.makeEnvironment(window, {
  renderer: rendererForPage(window),
  physics: loadRapier(),
});

export const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);
