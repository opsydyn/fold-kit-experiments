/**
 * Labels on a white page, drawn by troika: black text whose glyphs the test finds in the
 * canvas. The scene is set from the test through `window.__labels`. The address picks the
 * renderer (`rendererChoice.ts`): under WebGPURenderer troika's labels are drawn with node
 * materials.
 */
import {
  ambientLight,
  basic,
  colorRange,
  label,
  mesh,
  orthographicCamera,
  plane,
  scene,
  standard,
} from '@opsydyn/effect-three';
import { troikaLabels } from '@opsydyn/effect-three-troika/webgpu';
import { makeEnvironment } from '@opsydyn/effect-three/browser';

import { font } from './font.ts';
import { collectDetails } from './labelProbe.ts';
import { rendererFromAddress } from './rendererChoice.ts';
import { showScenes } from './sceneHost.ts';

const environment = makeEnvironment(window, {
  labels: troikaLabels(),
  ...rendererFromAddress(location.search),
});

/** One unit is 40 pixels; the label sits at `x`, anchored by its left edge. */
const labelScene = (text: string, x: number) =>
  scene({
    camera: orthographicCamera({ zoom: 40, position: [0, 0, 10], lookAt: [0, 0, 0] }),
    children: [
      mesh({
        key: 'paper',
        position: [0, 0, -1],
        geometry: plane({ width: 20, height: 20 }),
        material: basic({ color: 0xffffff }),
      }),
      label({
        key: 'sign',
        text,
        font,
        fontSize: 2,
        color: 0x000000,
        anchorX: 'left',
        position: [x, 0, 0],
        interactive: true,
      }),
    ],
  });

/**
 * "HIHI" red then blue (colour ranges), on a slight curve, drawn with a lit material
 * under a white ambient light, and measured: its laid-out size comes back as an event.
 */
const styledScene = () =>
  scene({
    camera: orthographicCamera({ zoom: 40, position: [0, 0, 10], lookAt: [0, 0, 0] }),
    measure: ['sign'],
    children: [
      ambientLight({ key: 'light', intensity: 3 }),
      mesh({
        key: 'paper',
        position: [0, 0, -1],
        geometry: plane({ width: 20, height: 20 }),
        material: basic({ color: 0xffffff }),
      }),
      label({
        key: 'sign',
        text: 'HIHI',
        font,
        fontSize: 2,
        color: 0x000000,
        colorRanges: [colorRange(0, 0xff0000), colorRange(2, 0x0000ff)],
        curveRadius: -20,
        material: standard({ roughness: 1, metalness: 0 }),
      }),
    ],
  });

const element = document.createElement('effect-three-scene');
element.className = 'scene';
document.body.append(element);

const show = showScenes(environment, element, labelScene('HI', -4));

const measured = collectDetails(element, 'scene-label-measured');
const clicks = collectDetails(element, 'scene-click');

Reflect.set(globalThis, '__labels', {
  ready: () => element.querySelector('canvas') !== null,
  show: (text: string, x: number) => show(labelScene(text, x)),
  styled: () => show(styledScene()),
  measured: () => measured,
  clicks: () => clicks,
});
