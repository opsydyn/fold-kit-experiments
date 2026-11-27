/**
 * Most of what a scene can hold, at once, on the renderer `?renderer=` names (`webgl`, or
 * `webgpu` on its WebGL 2 backend): sky, room environment, a render texture, bloom,
 * vignette and film, shadows, contact shadows, a shader grid, instances and a label
 * (which the WebGPU renderer leaves undrawn: troika's materials are WebGL's).
 */
import {
  bloom,
  box,
  contactShadows,
  directionalLight,
  environment,
  film,
  instance,
  instances,
  label,
  mesh,
  perspectiveCamera,
  renderSettings,
  renderTexture,
  scene,
  shaderGrid,
  sky,
  sphere,
  standard,
  vignette,
} from '@opsydyn/effect-three';
import { troikaLabels } from '@opsydyn/effect-three-troika';
import { makeEnvironment } from '@opsydyn/effect-three/browser';

import { font } from './font.ts';
import { effectsFromAddress, rendererFromAddress } from './rendererChoice.ts';
import { showScenes } from './sceneHost.ts';

const wanted = effectsFromAddress(location.search);
const environmentOf = makeEnvironment(window, {
  labels: troikaLabels(),
  ...rendererFromAddress(location.search),
});

const everything = scene({
  camera: perspectiveCamera({ position: [0, 3, 7], lookAt: [0, 0.5, 0] }),
  render: renderSettings({
    shadows: 'soft',
    toneMapping: 'aces',
    effects: [
      bloom({ strength: 0.6, threshold: 0.9 }),
      vignette(),
      film({ intensity: 0.2 }),
    ].filter((effect) => wanted(effect._tag)),
  }),
  sky: sky(),
  environment: environment(),
  contactShadows: contactShadows({ size: 10, blur: 2 }),
  renderTextures: [
    renderTexture({
      id: 'screen',
      width: 128,
      height: 128,
      background: 0x223344,
      children: [
        mesh({ key: 'inner', geometry: sphere(), material: standard({ color: 0xff8800 }) }),
      ],
    }),
  ],
  children: [
    directionalLight({ key: 'sun', position: [3, 6, 2], castShadow: true }),
    shaderGrid({ key: 'grid', infinite: true, sectionColor: 0x8a94a6 }),
    mesh({
      key: 'monitor',
      position: [-1.5, 1, 0],
      geometry: box({ width: 1.2, height: 1.2, depth: 0.1 }),
      material: standard({ map: 'screen' }),
      castShadow: true,
    }),
    mesh({
      key: 'ball',
      position: [1.5, 0.5, 0],
      geometry: sphere({ radius: 0.5 }),
      material: standard({ color: 0x3366ff, metalness: 0.5, roughness: 0.3 }),
      castShadow: true,
    }),
    instances({
      key: 'crowd',
      geometry: box({ width: 0.2, height: 0.2, depth: 0.2 }),
      material: standard(),
      instances: [-2, -1, 0, 1, 2].map((x) => instance({ key: `c${x}`, position: [x, 0.1, 1.5] })),
    }),
    label({ key: 'title', text: 'Everything', font, position: [0, 2.2, 0], fontSize: 0.4 }),
  ],
});

const element = document.createElement('effect-three-scene');
element.className = 'scene';
document.body.append(element);

showScenes(environmentOf, element, everything);

Reflect.set(globalThis, '__everything', {
  ready: () => element.querySelector('canvas') !== null,
});
