/** The physics scene and XR controls share an environment scoped to the island. */
import { makeEnvironment, type Environment } from '@opsydyn/effect-three-foldkit/browser';
import { loadRapier } from '@opsydyn/effect-three-rapier';
import { Context, Layer } from 'effect';

import { defineScopedSceneMount, scopedSceneEnvironment } from '../effect-ui-scene';
import { rendererForPage } from '../renderer';

export class ToyboxEnvironment extends Context.Service<ToyboxEnvironment, Environment>()(
  'ToyboxEnvironment',
) {}

export const sceneMount = defineScopedSceneMount(ToyboxEnvironment);
export const toyboxEnvironment = Layer.effect(
  ToyboxEnvironment,
  scopedSceneEnvironment(() =>
    makeEnvironment(window, {
      renderer: rendererForPage(window),
      physics: loadRapier(),
    }),
  ),
);
