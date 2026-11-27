/** The bowling lane uses Rapier for its ball and pins, and troika for the scoreboard. */
import { loadRapier } from '@opsydyn/effect-three-rapier';

import { defineLabelledSceneMount } from '../effect-ui-scene';

export const sceneMount = defineLabelledSceneMount(loadRapier);
