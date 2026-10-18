/**
 * An immersive session in a headless browser: Meta's IWER emulates a Quest 3 behind
 * `navigator.xr`, and the test enters, moves the headset and controllers, and exits
 * through `window.__xr`. The scene places the player two units along +x, turned to face
 * +x; a synthetic floor at y = 0 answers AR hit tests.
 */
import { box, mesh, scene, standard, xr } from '@opsydyn/effect-three';
import { Effect, Queue, Stream } from 'effect';
import type { ViewState } from 'foldkit/mount';
import { metaQuest3, XRDevice } from 'iwer';

import * as EffectThreeFoldkit from '../../src/index.ts';
import {
  aimDown,
  aimStraight,
  describeEvent,
  FloorEnvironment,
  glideFromAddress,
  headOf,
  inputsShown,
  keyOf,
  modeOf,
  framesDrawn,
  followedIn,
  rendererFinder,
  shimOffsetSpaces,
  spacesFromAddress,
} from './xrProbe.ts';

shimOffsetSpaces();
const device = new XRDevice(metaQuest3);
device.installRuntime({ forceInstall: true });
device.installSEM(FloorEnvironment);

// WebGL only: under IWER the emulated layer has no framebuffer object, which three's
// WebGPURenderer (on its WebGL 2 backend) cannot render into, so WebGPU XR is untested.
const environment = EffectThreeFoldkit.makeEnvironment(window);
const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);

const element = document.createElement('effect-three-scene');
element.className = 'scene';
const spaces = spacesFromAddress(location.search);
const described = scene({
  xr: xr({
    origin: [2, 0, 0],
    heading: -Math.PI / 2,
    hitTest: true,
    glide: glideFromAddress(location.search),
    anchors: spaces.anchors,
    planes: spaces.planes,
  }),
  children: [
    ...spaces.children,
    mesh({
      key: 'cube',
      position: [4, 1.5, 0],
      geometry: box(),
      material: standard(),
      interactive: true,
    }),
  ],
});
Reflect.set(element, 'scene', described);
document.body.append(element);

const sessions: Array<string | null> = [];
element.addEventListener('scene-xr', (event) => sessions.push(modeOf(event)));

const clicks: Array<string> = [];
element.addEventListener('scene-click', (event) => clicks.push(keyOf(event)));

const watched = [
  'scene-pointer-enter',
  'scene-pointer-leave',
  'scene-drag-end',
  'scene-xr-stick',
  'scene-xr-button',
  'scene-xr-surface',
  'scene-pointer-missed',
  'scene-xr-moved',
  'scene-xr-planes',
  'scene-click',
];
const events: Array<string> = [];
for (const type of watched)
  element.addEventListener(type, (event) => events.push(describeEvent(event)));
let drags = 0;
element.addEventListener('scene-drag', () => drags++);

const viewStates = Effect.runSync(Queue.sliding<ViewState>(4));
Queue.offerUnsafe(viewStates, 'Live');
const lifecycle = sceneMount().f(element, Stream.fromQueue(viewStates));
Effect.runFork(Stream.runDrain(lifecycle));

const renderer = rendererFinder(element);

Reflect.set(globalThis, '__xr', {
  ready: () => renderer() !== undefined,
  supported: () => Effect.runPromise(environment.xr.supported('immersive-vr')),
  enter: () => Effect.runPromise(environment.xr.enter('immersive-vr')),
  exit: () => Effect.runPromise(environment.xr.exit),
  sessions: () => sessions,
  presenting: () => renderer()?.xr.isPresenting === true,
  frames: () => framesDrawn(renderer()),
  /** Moves the emulated headset, in its own reference space. */
  moveHead: (x: number, y: number, z: number) => {
    device.position.x = x;
    device.position.y = y;
    device.position.z = z;
  },
  head: () => headOf(renderer()),
  clicks: () => clicks,
  /** Points the right controller straight ahead (−z in the headset's space) from `y`. */
  aimRight: (y: number) => aimStraight(device.controllers.right, y),
  /** Pulls (1) or releases (0) the right controller's trigger: a select. */
  trigger: (value: number) => device.controllers.right?.updateButtonValue('trigger', value),
  enterAr: () => Effect.runPromise(environment.xr.enter('immersive-ar')),
  /** Points the left controller straight ahead from `y`. */
  aimLeft: (y: number) => aimStraight(device.controllers.left, y),
  /** Points the right controller straight down from `y`. */
  aimDown: (y: number) => aimDown(device.controllers.right, y),
  /** Pushes the left thumbstick to `(x, y)`. */
  leftStick: (x: number, y: number) => device.controllers.left?.updateAxes('thumbstick', x, y),
  /** Pushes the right thumbstick to `(x, y)`. */
  stick: (x: number, y: number) => device.controllers.right?.updateAxes('thumbstick', x, y),
  /** Grips (1) or lets go (0) with the right controller. */
  squeeze: (value: number) => device.controllers.right?.updateButtonValue('squeeze', value),
  /** Switches between controllers and tracked hands. */
  inputMode: (mode: 'controller' | 'hand') => {
    device.primaryInputMode = mode;
  },
  /** Pinches (1) or opens (0) the right hand. */
  pinch: (value: number) => device.hands.right?.updatePinchValue(value),
  events: () => events,
  clearEvents: () => {
    events.length = 0;
  },
  drags: () => drags,
  inputs: () => inputsShown(Reflect.get(globalThis, '__observedScenes') ?? []),
  followed: () => followedIn(Reflect.get(globalThis, '__observedScenes') ?? []),
});
