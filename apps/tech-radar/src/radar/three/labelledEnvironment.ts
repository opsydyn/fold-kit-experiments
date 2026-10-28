/**
 * The environment for samples that draw labels: troika as the label engine, from its
 * WebGPU entry, so labels draw with either renderer the page asks for.
 */
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { troikaLabels } from '@opsydyn/effect-three-troika/webgpu';

import { rendererForPage } from './renderer';

export const environment = EffectThreeFoldkit.makeEnvironment(window, {
  renderer: rendererForPage(window),
  labels: troikaLabels(),
});

export const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);
