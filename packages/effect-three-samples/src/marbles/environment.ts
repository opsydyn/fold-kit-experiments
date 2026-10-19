/**
 * The marble machine's environment: the samples' renderer (WebGL, or WebGPU with
 * `?renderer=webgpu`), Rapier for the marbles, and troika for the bin labels.
 */
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { loadRapier } from '@opsydyn/effect-three-rapier';
import { troikaLabels } from '@opsydyn/effect-three-troika';

import { rendererForPage, rendererNotice } from '../renderer';

export const environment = EffectThreeFoldkit.makeEnvironment(window, {
  // It draws labels, so it stays on WebGL even when the page asks for WebGPU.
  renderer: rendererForPage(window, { labels: true }),
  physics: loadRapier(),
  labels: troikaLabels(),
});

export const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);

/** Why this page draws with WebGL when it asked for WebGPU, if it did. */
export const notice = rendererNotice(window, { labels: true });
