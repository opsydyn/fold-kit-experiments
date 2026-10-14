/**
 * Drives the scene Mount directly through Foldkit's MountAction contract,
 * `f(element, viewStateChanges)`, with a controllable view-state stream. This checks the
 * DevTools time-travel gate (`Paused` drops pointer events) without the DevTools overlay,
 * which only Foldkit's Vite plugin can inject.
 */
import { Effect, Queue, Stream } from 'effect';
import type { ViewState } from 'foldkit/mount';

import * as EffectThreeFoldkit from '../../src/index.ts';
import { sceneFor } from './scene.ts';

const environment = EffectThreeFoldkit.makeEnvironment(window);
const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);

const element = document.createElement('effect-three-scene');
element.className = 'scene';
Reflect.set(element, 'scene', sceneFor('red'));
document.body.append(element);

let clicks = 0;
element.addEventListener('scene-click', () => {
  clicks++;
});

const viewStates = Effect.runSync(Queue.sliding<ViewState>(4));
Queue.offerUnsafe(viewStates, 'Live');
const lifecycle = sceneMount().f(element, Stream.fromQueue(viewStates));
Effect.runFork(Stream.runDrain(lifecycle));

Reflect.set(globalThis, '__pause', {
  setViewState: (state: ViewState) => Queue.offerUnsafe(viewStates, state),
  clicks: () => clicks,
  ready: () => element.querySelector('canvas') !== null,
});
