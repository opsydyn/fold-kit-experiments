import { glide, type XrGlide } from '@opsydyn/effect-three';
/**
 * Plain helpers for the XR page: the emulator shim, and reading the presented scene's
 * renderer. Kept apart from the Effect code that mounts the scene.
 */
import { type XRDevice, XRReferenceSpace } from 'iwer';
import { InstancedMesh, Line, Object3D, type WebGLRenderer } from 'three';
import type { WebGPURenderer } from 'three/webgpu';

type ThreeRenderer = WebGLRenderer | WebGPURenderer;

import { threeRendererOf } from '../../src/dom/renderSettings.ts';

const offsetSpace = Reflect.get(XRReferenceSpace.prototype, 'getOffsetReferenceSpace');

function offsetByMatrix(this: XRReferenceSpace, offset: XRRigidTransform): XRReferenceSpace {
  return Reflect.apply(offsetSpace, this, [offset.matrix]);
}

/**
 * Emulator shim: iwer 2.5.0 hands the spec's XRRigidTransform to gl-matrix as if it were
 * a matrix, losing the offset. Real browsers take the transform, as the adapter passes it.
 */
export const shimOffsetSpaces = (): void => {
  Reflect.set(XRReferenceSpace.prototype, 'getOffsetReferenceSpace', offsetByMatrix);
};

/** The key a `scene-click` event reports. */
export const keyOf = (event: Event): string =>
  event instanceof CustomEvent ? event.detail.key : '';

/** The mode a `scene-xr` event reports. */
export const modeOf = (event: Event): string | null =>
  event instanceof CustomEvent ? event.detail.mode : null;

/** The scene's renderer, found once: the emulator moves the canvas while presenting. */
export const rendererFinder = (element: Element) => {
  let renderer: ThreeRenderer | undefined;
  return (): ThreeRenderer | undefined => {
    const canvas = element.querySelector('canvas');
    if (renderer === undefined && canvas !== null) renderer = threeRendererOf(canvas);
    return renderer;
  };
};

/** Where the headset's camera is in the scene, as three.js places it. */
export const headOf = (renderer: ThreeRenderer | undefined): ReadonlyArray<number> | null => {
  if (renderer === undefined) return null;
  return renderer.xr.getCamera().matrixWorld.elements.slice(12, 15);
};

/** Points an emulated controller straight ahead (−z in its space), 0.3 forward at `y`. */
export const aimStraight = (controller: XRDevice['controllers']['right'], y: number): void => {
  if (controller === undefined) return;
  controller.position.x = 0.2;
  controller.position.y = y;
  controller.position.z = -0.3;
  controller.quaternion.x = 0;
  controller.quaternion.y = 0;
  controller.quaternion.z = 0;
  controller.quaternion.w = 1;
};

/** Points an emulated controller straight down, 0.3 forward at `y`, 0.2 to the right. */
export const aimDown = (controller: XRDevice['controllers']['right'], y: number): void => {
  if (controller === undefined) return;
  aimStraight(controller, y);
  // A quarter turn about x (−90°) turns −z to −y.
  controller.quaternion.x = -Math.SQRT1_2;
  controller.quaternion.w = Math.SQRT1_2;
};

/**
 * A synthetic environment for the emulator's hit tests: a floor at y = 0 in its global
 * space. IWER asks one for every hit test (a ray as a matrix: its position, looking down
 * −z) and expects the hit poses back (+y the surface normal).
 */
export class FloorEnvironment {
  readonly version = 'floor';
  planesVisible = false;
  boundingBoxesVisible = false;
  meshesVisible = false;
  readonly environmentCanvas = document.createElement('canvas');
  readonly trackedPlanes = new Set<never>();
  readonly trackedMeshes = new Set<never>();
  render(): void {}
  loadEnvironment(): void {}
  loadDefaultEnvironment(): void {}
  deleteAll(): void {}
  computeDepthBuffer(): null {
    return null;
  }
  computeHitTestResults(ray: ArrayLike<number>): Array<Float32Array> {
    const [ox = 0, oy = 0, oz = 0] = [ray[12], ray[13], ray[14]];
    const [dx = 0, dy = 0, dz = 0] = [-(ray[8] ?? 0), -(ray[9] ?? 0), -(ray[10] ?? 0)];
    if (dy >= 0) return [];
    const t = -oy / dy;
    const hit = new Float32Array(16);
    hit[0] = 1;
    hit[5] = 1;
    hit[10] = 1;
    hit[15] = 1;
    hit[12] = ox + dx * t;
    hit[13] = 0;
    hit[14] = oz + dz * t;
    return [hit];
  }
}

/** A short line for each scene event the XR test watches: its type and what it names. */
export const describeEvent = (event: Event): string => {
  const detail: unknown = event instanceof CustomEvent ? event.detail : undefined;
  const field = (name: string): unknown =>
    typeof detail === 'object' && detail !== null ? Reflect.get(detail, name) : undefined;
  const parts = [field('key'), field('hand'), field('direction'), field('button'), field('pressed')]
    .filter((part) => part !== undefined)
    .map(String);
  // Where surfaces and glides ended (pointer events' hit points are left out).
  const place = { 'scene-xr-surface': field('point'), 'scene-xr-moved': field('origin') }[
    event.type
  ];
  if (Array.isArray(place)) parts.push(place.map((value: number) => value.toFixed(1)).join(','));
  return [event.type.replace('scene-', ''), ...parts].join(' ');
};

/** What the session draws for its inputs: visible rays, and hand joint spheres placed. */
export const inputsShown = (
  scenes: ReadonlyArray<unknown>,
): { readonly rays: number; readonly joints: number } => {
  let rays = 0;
  let joints = 0;
  for (const scene of scenes) {
    if (!(scene instanceof Object3D)) continue;
    scene.getObjectByName('xr-inputs')?.traverse((object) => {
      if (object instanceof Line && object.visible) rays++;
      if (object instanceof InstancedMesh) joints += object.count;
    });
  }
  return { rays, joints };
};

/** Frames the renderer has drawn: WebGL's `info.render.frame`, WebGPU's `frameCalls`. */
export const framesDrawn = (renderer: ThreeRenderer | undefined): number => {
  const render = renderer?.info.render;
  if (render === undefined) return 0;
  return 'frameCalls' in render ? render.frameCalls : render.frame;
};

/** Gliding with the sticks when the page's address has `?glide`; otherwise none. */
export const glideFromAddress = (search: string): XrGlide | null =>
  new URLSearchParams(search).has('glide') ? glide() : null;
