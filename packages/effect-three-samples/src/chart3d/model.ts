import { perspectiveCamera, SceneSchema } from '@opsydyn/effect-three';
import type { Camera } from '@opsydyn/effect-three';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';
import { Theme } from '../pageTheme';

export const Chart = Schema.Literals(['scatter', 'surface']);
export type Chart = typeof Chart.Type;

/** The page theme, which the chart's axes and labels follow. */
export { Theme } from '../pageTheme';

export const Model = Schema.Struct({
  chart: Chart,
  /** The orbit camera: drags, the wheel and pinches move it, and the Model keeps it. */
  camera: SceneSchema.Camera,
  theme: Theme,
  lifecycle: Schema.NullOr(SceneStart),
});
export type Model = typeof Model.Type;

export const homeCamera = (): Camera =>
  perspectiveCamera({ fov: 40, position: [3.2, 2.2, 3.6], lookAt: [0, 0, 0], damping: 0.12 });

export const init = (): Model => ({
  chart: 'scatter',
  camera: homeCamera(),
  theme: 'dark',
  lifecycle: null,
});
