/**
 * The chart as a scene: foldkit-viz lays the 3D chart out (chart/space3d) and
 * describes it for effect-three (effect-three/space3d); this sample adds the
 * camera from its Model and claims the page's gestures for orbiting.
 */
import { scene } from '@opsydyn/effect-three';
import type { SceneDescription } from '@opsydyn/effect-three';
import { scatter3d, surface3d } from '@opsydyn/foldkit-viz/chart/space3d';
import { darkTheme, lightTheme } from '@opsydyn/foldkit-viz/chart/theme';
import { scatter3dScene, surface3dScene } from '@opsydyn/foldkit-viz/effect-three/space3d';

import { hill, measurements } from './data';
import type { Model } from './model';

export const scatter = scatter3d(
  measurements,
  { x: (d) => d.x, y: (d) => d.y, z: (d) => d.z, color: (d) => d.cluster },
  { labels: { x: 'Latency', y: 'Load', z: 'Cost' } },
);

export const surface = surface3d(hill, { labels: { x: 'x', y: 'y', z: 'sin x · cos y' } });

export const sceneFor = (model: Model): SceneDescription => {
  const theme = model.theme === 'dark' ? darkTheme : lightTheme;
  const chart =
    model.chart === 'scatter'
      ? scatter3dScene(scatter, { key: 'scatter', theme })
      : surface3dScene(surface, { key: 'surface', theme });
  return scene({ camera: model.camera, gestures: 'scene', children: [chart] });
};
