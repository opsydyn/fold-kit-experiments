/**
 * The bowling lane's environment: the samples' renderer (WebGL, or WebGPU with
 * `?renderer=webgpu`), Rapier for the ball and pins, and troika for the scoreboard.
 */
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { loadRapier } from '@opsydyn/effect-three-rapier';
import { troikaLabels } from '@opsydyn/effect-three-troika';

import { rendererForPage } from '../renderer';

export const environment = EffectThreeFoldkit.makeEnvironment(window, {
  renderer: rendererForPage(window),
  physics: loadRapier(),
  labels: troikaLabels(),
});

export const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);
