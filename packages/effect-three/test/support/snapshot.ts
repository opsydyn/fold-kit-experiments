/**
 * Serialisable snapshot of a hosted scene graph, read from the three.js objects
 * themselves, so convergence tests compare real host state rather than descriptions.
 */
import {
  AmbientLight,
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  DirectionalLight,
  Mesh,
  type Object3D,
  PlaneGeometry,
  SphereGeometry,
} from 'three';

import type { SceneGraph } from '../../src/kernel/index.ts';

export type NodeSnapshot = {
  readonly key: string | undefined;
  readonly type: string;
  readonly position: ReadonlyArray<number>;
  readonly rotation: ReadonlyArray<number>;
  readonly scale: ReadonlyArray<number>;
  readonly detail: unknown;
  readonly children: ReadonlyArray<NodeSnapshot>;
};

/** The kind and parameters of a kernel-built geometry. */
const shapeOf = (geometry: BufferGeometry): unknown => {
  if (geometry instanceof BoxGeometry) return { type: 'Box', ...geometry.parameters };
  if (geometry instanceof SphereGeometry) return { type: 'Sphere', ...geometry.parameters };
  if (geometry instanceof PlaneGeometry) return { type: 'Plane', ...geometry.parameters };
  if (geometry instanceof CylinderGeometry) return { type: 'Cylinder', ...geometry.parameters };
  return 'unexpected geometry';
};

const detailOf = (graph: SceneGraph, object: Object3D): unknown => {
  if (object instanceof Mesh) {
    const material: unknown = object.material;
    const materialDetail =
      material !== null && typeof material === 'object' && 'color' in material
        ? {
            shared: graph.store.sharedMaterialId(object.material),
            color: object.material.color.getHex(),
            roughness: object.material.roughness,
            metalness: object.material.metalness,
          }
        : 'unexpected material';
    return {
      geometry: {
        shared: graph.store.sharedGeometryId(object.geometry),
        shape: shapeOf(object.geometry),
      },
      material: materialDetail,
    };
  }
  if (object instanceof AmbientLight || object instanceof DirectionalLight) {
    return { color: object.color.getHex(), intensity: object.intensity };
  }
  return null;
};

const snapshotNode = (graph: SceneGraph, object: Object3D): NodeSnapshot => ({
  key: graph.keyOf(object),
  type: object.type,
  position: object.position.toArray(),
  rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
  scale: object.scale.toArray(),
  detail: detailOf(graph, object),
  children: object.children.map((child) => snapshotNode(graph, child)),
});

export const snapshot = (graph: SceneGraph): unknown => ({
  camera: {
    fov: graph.camera.fov,
    near: graph.camera.near,
    far: graph.camera.far,
    position: graph.camera.position.toArray(),
    quaternion: graph.camera.quaternion.toArray(),
  },
  children: graph.scene.children.map((child) => snapshotNode(graph, child)),
});
