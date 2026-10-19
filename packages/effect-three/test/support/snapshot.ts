/**
 * Serialisable snapshot of a hosted scene graph, read from the three.js objects
 * themselves, so convergence tests compare real host state rather than descriptions.
 */
import {
  AmbientLight,
  BoxGeometry,
  type BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  InstancedMesh,
  type Material,
  Mesh,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RingGeometry,
  SphereGeometry,
  SpotLight,
  Texture,
  TorusGeometry,
} from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

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
  if (geometry instanceof ConeGeometry) return { type: 'Cone', ...geometry.parameters };
  if (geometry instanceof CylinderGeometry) return { type: 'Cylinder', ...geometry.parameters };
  if (geometry instanceof TorusGeometry) return { type: 'Torus', ...geometry.parameters };
  if (geometry instanceof CapsuleGeometry) return { type: 'Capsule', ...geometry.parameters };
  if (geometry instanceof RingGeometry) return { type: 'Ring', ...geometry.parameters };
  if (geometry instanceof CircleGeometry) return { type: 'Circle', ...geometry.parameters };
  return 'unexpected geometry';
};

/** Hex colours and plain parameters of a hosted material, whatever its kind. */
const materialOf = (material: Material): Record<string, unknown> => {
  const detail: Record<string, unknown> = { type: material.type };
  for (const key of materialKeys) {
    const value: unknown = Reflect.get(material, key);
    if (value instanceof Color) detail[key] = value.getHex();
    else if (value instanceof Texture) detail[key] = value.uuid;
    else if (value !== undefined) detail[key] = value;
  }
  return detail;
};

const materialKeys = [
  'color',
  'map',
  'emissive',
  'specular',
  'shininess',
  'roughness',
  'metalness',
  'emissiveIntensity',
  'clearcoat',
  'clearcoatRoughness',
  'transmission',
  'ior',
  'opacity',
  'transparent',
  'side',
  'wireframe',
  'flatShading',
] as const;

const shadowOf = (light: DirectionalLight | PointLight | SpotLight) => ({
  castShadow: light.castShadow,
  mapSize: light.shadow.mapSize.toArray(),
  bias: light.shadow.bias,
});

/** The live slots of an instanced mesh, not its capacity: count, matrices and colours. */
const instancesOf = (mesh: InstancedMesh) => ({
  count: mesh.count,
  matrices: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)),
  colors: Array.from(mesh.instanceColor?.array.slice(0, mesh.count * 3) ?? []),
});

const detailOf = (graph: SceneGraph, object: Object3D): unknown => {
  if (object instanceof Mesh) {
    const materialDetail = {
      shared: graph.store.sharedMaterialId(object.material),
      ...materialOf(object.material),
    };
    return {
      ...(object instanceof InstancedMesh ? { instances: instancesOf(object) } : {}),
      castShadow: object.castShadow,
      receiveShadow: object.receiveShadow,
      geometry: {
        shared: graph.store.sharedGeometryId(object.geometry),
        shape: shapeOf(object.geometry),
      },
      material: materialDetail,
    };
  }
  if (object instanceof SpotLight) {
    return {
      ...shadowOf(object),
      color: object.color.getHex(),
      intensity: object.intensity,
      target: object.target.position.toArray(),
      distance: object.distance,
      angle: object.angle,
      penumbra: object.penumbra,
      decay: object.decay,
    };
  }
  if (object instanceof PointLight) {
    return {
      ...shadowOf(object),
      color: object.color.getHex(),
      intensity: object.intensity,
      distance: object.distance,
      decay: object.decay,
    };
  }
  if (object instanceof HemisphereLight) {
    return {
      color: object.color.getHex(),
      groundColor: object.groundColor.getHex(),
      intensity: object.intensity,
    };
  }
  if (object instanceof DirectionalLight) {
    return {
      ...shadowOf(object),
      area: object.shadow.camera.right,
      color: object.color.getHex(),
      intensity: object.intensity,
    };
  }
  if (object instanceof GridHelper) {
    const sum = (name: string): number =>
      Array.from(object.geometry.getAttribute(name).array).reduce((a, b) => a + Math.abs(b), 0);
    return {
      lines: object.geometry.getAttribute('position').count,
      extent: sum('position'),
      colours: sum('color'),
    };
  }
  if (object instanceof AmbientLight) {
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

/** A sky's settings, read back from its shader. */
const skySnapshot = (sky: Sky) => {
  const value = (name: string): unknown => sky.material.uniforms[name]?.value;
  const sun = value('sunPosition');
  return {
    turbidity: value('turbidity'),
    rayleigh: value('rayleigh'),
    mieCoefficient: value('mieCoefficient'),
    mieDirectionalG: value('mieDirectionalG'),
    clouds: value('cloudCoverage'),
    sun:
      sun instanceof Object && 'toArray' in sun && typeof sun.toArray === 'function'
        ? sun.toArray()
        : sun,
    distance: sky.scale.x,
  };
};

const isTrail = (child: Object3D): boolean => child.name === 'effect-three:trail';

export const snapshot = (graph: SceneGraph): unknown => ({
  render: graph.renderSettings(),
  renderTextures: graph.renderTextures().map((texture) => ({
    id: texture.id,
    width: texture.width,
    height: texture.height,
    scene: snapshot(texture.graph),
  })),
  views: graph.views().map((view) => ({
    key: view.key,
    area: view.area,
    projection: view.camera.projectionMatrix.toArray(),
    position: view.camera.position.toArray(),
  })),
  camera: {
    type: graph.camera.type,
    lens: graph.camera instanceof PerspectiveCamera ? graph.camera.fov : graph.camera.zoom,
    projection: graph.camera.projectionMatrix.toArray(),
    near: graph.camera.near,
    far: graph.camera.far,
    position: graph.camera.position.toArray(),
    quaternion: graph.camera.quaternion.toArray(),
  },
  // The sky is the scene's, not a node: its place among the children does not matter.
  sky: graph.scene.children.filter((child) => child instanceof Sky).map(skySnapshot),
  // Trail ribbons too: how many there are, not where they fall among the children.
  trails: graph.scene.children.filter(isTrail).length,
  children: graph.scene.children
    .filter((child) => !(child instanceof Sky) && !isTrail(child))
    .map((child) => snapshotNode(graph, child)),
});
