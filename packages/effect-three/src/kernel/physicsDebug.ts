/**
 * The physics world drawn as lines, as react-three-rapier's `Debug` (`ae5c3fe`,
 * `src/components/Debug.tsx`) draws `world.debugRender()`: one `LineSegments` with
 * per-vertex colours, never culled. Here its buffers are reused while their size holds.
 *
 * @module
 */
import {
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  type Object3D,
} from 'three';

import type { DebugLines } from './physics.ts';

export type PhysicsDebug = {
  /** Shows `lines` (adding the drawing to the scene the first time). */
  readonly show: (lines: DebugLines) => void;
  /** Takes the drawing away and frees it. */
  readonly hide: () => void;
};

/** Writes `values` into the geometry's attribute `name`, reusing it when it fits. */
const write = (
  geometry: BufferGeometry,
  name: 'position' | 'color',
  values: Float32Array,
  size: number,
): void => {
  const current = geometry.getAttribute(name);
  if (current instanceof BufferAttribute && current.array.length === values.length) {
    current.array.set(values);
    current.needsUpdate = true;
    return;
  }
  geometry.setAttribute(name, new BufferAttribute(values.slice(), size));
};

/** Creates the debug drawing for a scene. */
export const createPhysicsDebug = (scene: Object3D): PhysicsDebug => {
  let lines: LineSegments<BufferGeometry, LineBasicMaterial> | undefined;
  return {
    show: ({ vertices, colors }) => {
      if (lines === undefined) {
        lines = new LineSegments(
          new BufferGeometry(),
          new LineBasicMaterial({ color: 0xffffff, vertexColors: true }),
        );
        lines.name = 'physics-debug';
        lines.frustumCulled = false;
        lines.raycast = () => undefined;
        scene.add(lines);
      }
      write(lines.geometry, 'position', vertices, 3);
      write(lines.geometry, 'color', colors, 4);
      lines.geometry.setDrawRange(0, vertices.length / 3);
    },
    hide: () => {
      if (lines === undefined) return;
      lines.removeFromParent();
      lines.geometry.dispose();
      lines.material.dispose();
      lines = undefined;
    },
  };
};
