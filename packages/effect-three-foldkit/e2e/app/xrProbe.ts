/**
 * Plain helpers for the XR page: the emulator shim, and reading the presented scene's
 * renderer. Kept apart from the Effect code that mounts the scene.
 */
import { XRReferenceSpace } from 'iwer';
import type { WebGLRenderer } from 'three';

import { webglRendererOf } from '../../src/dom/webgl.ts';

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

/** The mode a `scene-xr` event reports. */
export const modeOf = (event: Event): string | null =>
  event instanceof CustomEvent ? event.detail.mode : null;

/** The scene's renderer, found once: the emulator moves the canvas while presenting. */
export const rendererFinder = (element: Element) => {
  let renderer: WebGLRenderer | undefined;
  return (): WebGLRenderer | undefined => {
    const canvas = element.querySelector('canvas');
    if (renderer === undefined && canvas !== null) renderer = webglRendererOf(canvas);
    return renderer;
  };
};

/** Where the headset's camera is in the scene, as three.js places it. */
export const headOf = (renderer: WebGLRenderer | undefined): ReadonlyArray<number> | null => {
  if (renderer === undefined) return null;
  return renderer.xr.getCamera().matrixWorld.elements.slice(12, 15);
};
