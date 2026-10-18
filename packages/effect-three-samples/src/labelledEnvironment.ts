/**
 * The environment for samples that draw labels: troika as the label engine, and the
 * WebGL renderer even when the page asks for WebGPU, which troika cannot draw with.
 */
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { troikaLabels } from '@opsydyn/effect-three-troika';

import { rendererForPage, rendererNotice } from './renderer';

const needs = { labels: true } as const;

export const environment = EffectThreeFoldkit.makeEnvironment(window, {
  renderer: rendererForPage(window, needs),
  labels: troikaLabels(),
});

export const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);

/** Why this page draws with WebGL when it asked for WebGPU, if it did. */
export const notice = rendererNotice(window, needs);
