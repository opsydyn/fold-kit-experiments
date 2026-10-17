// Bundled with the page, so troika fetches nothing from elsewhere.
import font from '@fontsource/inter/files/inter-latin-400-normal.woff';
/**
 * Labels on a white page, drawn by troika: black text whose glyphs the test finds in the
 * canvas. The scene is set from the test through `window.__labels`.
 */
import { basic, label, mesh, orthographicCamera, plane, scene } from '@opsydyn/effect-three';
import { troikaLabels } from '@opsydyn/effect-three-troika';
import { Effect, Queue, Stream } from 'effect';
import type { ViewState } from 'foldkit/mount';

import * as EffectThreeFoldkit from '../../src/index.ts';

const environment = EffectThreeFoldkit.makeEnvironment(window, { labels: troikaLabels() });
const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);

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
      }),
    ],
  });

const element = document.createElement('effect-three-scene');
element.className = 'scene';
Reflect.set(element, 'scene', labelScene('HI', -4));
document.body.append(element);

const viewStates = Effect.runSync(Queue.sliding<ViewState>(4));
Queue.offerUnsafe(viewStates, 'Live');
const lifecycle = sceneMount().f(element, Stream.fromQueue(viewStates));
Effect.runFork(Stream.runDrain(lifecycle));

Reflect.set(globalThis, '__labels', {
  ready: () => element.querySelector('canvas') !== null,
  show: (text: string, x: number) => Reflect.set(element, 'scene', labelScene(text, x)),
});
