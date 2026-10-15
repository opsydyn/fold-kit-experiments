/**
 * The hosted three.js scene graph: applies diff operations to real three.js objects.
 *
 * `reconcile` is atomic: an invalid description is rejected before anything changes.
 * Objects keep their identity across updates; only a change of node kind replaces one.
 *
 * @module
 */
import {
  AmbientLight,
  type BufferGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  type MeshStandardMaterial,
  type Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  PointLight,
  Scene,
  SpotLight,
  Vector3,
} from 'three';

import { writeRotation } from './behaviours.ts';
import type {
  AmbientLightNode,
  DirectionalLightNode,
  HemisphereLightNode,
  GroupNode,
  MeshNode,
  Camera as CameraDescription,
  PointLightNode,
  SceneDescription,
  SceneNode,
  SpotLightNode,
  Vec3,
} from './description.ts';
import { diff, type Field, type Op } from './diff.ts';
import { createResourceStore, type ResourceStore } from './resources.ts';
import {
  type DescriptionError,
  emptyIndex,
  type ParentKey,
  type SceneIndex,
} from './sceneIndex.ts';
import { applyTween, startTween, type Tween } from './tween.ts';

/** The mesh type the kernel hosts. */
export type HostMesh = Mesh<BufferGeometry, MeshStandardMaterial>;

type Entry =
  | { readonly _tag: 'Group'; node: GroupNode; readonly object: Group }
  | { readonly _tag: 'Mesh'; node: MeshNode; readonly object: HostMesh }
  | { readonly _tag: 'AmbientLight'; node: AmbientLightNode; readonly object: AmbientLight }
  | {
      readonly _tag: 'DirectionalLight';
      node: DirectionalLightNode;
      readonly object: DirectionalLight;
    }
  | { readonly _tag: 'PointLight'; node: PointLightNode; readonly object: PointLight }
  | { readonly _tag: 'SpotLight'; node: SpotLightNode; readonly object: SpotLight }
  | {
      readonly _tag: 'HemisphereLight';
      node: HemisphereLightNode;
      readonly object: HemisphereLight;
    };

export type ReconcileResult =
  | { readonly _tag: 'Applied'; readonly ops: ReadonlyArray<Op> }
  | { readonly _tag: 'Invalid'; readonly error: DescriptionError };

export type SceneGraphOptions = {
  /** A store shared with other graphs. When omitted the graph owns a private store. */
  readonly store?: ResourceStore;
};

export type SceneGraph = {
  readonly scene: Scene;
  /** The active camera. Changing the description's camera kind replaces it. */
  readonly camera: HostCamera;
  readonly store: ResourceStore;
  /** Diffs against the last applied description and applies the result. */
  readonly reconcile: (next: SceneDescription) => ReconcileResult;
  /** Advances behaviours to `elapsedSeconds` of scene time. Allocation-free. */
  readonly tick: (elapsedSeconds: number) => void;
  /** Scene time of the last `tick`. */
  readonly elapsedSeconds: () => number;
  /**
   * While not animating (reduced motion, a paused debugger), transitions land at once and
   * any in flight finish, because frozen scene time would otherwise strand them mid-way.
   */
  readonly setAnimating: (animating: boolean) => void;
  /** The hosted object for a key. */
  readonly object: (key: string) => Object3D | undefined;
  /** The key of a hosted object. */
  readonly keyOf: (object: Object3D) => string | undefined;
  /**
   * Hosted objects of interactive meshes. The array is cached until the set changes and
   * is mutable only because three's `Raycaster.intersectObjects` requires it: don't modify it.
   */
  readonly interactiveObjects: () => Array<Object3D>;
  /** Fits the camera to a viewport of `width` by `height` CSS pixels. */
  readonly resize: (width: number, height: number) => void;
  /** The last `resize`, in CSS pixels. `1 × 1` until the first resize. */
  readonly viewport: () => { readonly width: number; readonly height: number };
  /** Removes every node and releases its resources. Disposes the store if the graph owns it. */
  readonly dispose: () => void;
};

const writeVec3 = (
  target: { set: (x: number, y: number, z: number) => unknown },
  v: Vec3,
): void => {
  target.set(v[0], v[1], v[2]);
};

// Lights are cheap to write in full, so an update rewrites every field from the node.
const writePointLight = (light: PointLight, node: PointLightNode): void => {
  light.color.setHex(node.color);
  light.intensity = node.intensity;
  writeVec3(light.position, node.position);
  light.distance = node.distance;
  light.decay = node.decay;
};

const writeSpotLight = (light: SpotLight, node: SpotLightNode): void => {
  light.color.setHex(node.color);
  light.intensity = node.intensity;
  writeVec3(light.position, node.position);
  light.distance = node.distance;
  light.angle = node.angle;
  light.penumbra = node.penumbra;
  light.decay = node.decay;
  // The target is not in the scene graph (it is world space), so three never updates its
  // matrix: do it here, once per change.
  writeVec3(light.target.position, node.target);
  light.target.updateMatrixWorld();
};

const writeHemisphereLight = (light: HemisphereLight, node: HemisphereLightNode): void => {
  light.color.setHex(node.color);
  light.groundColor.setHex(node.groundColor);
  light.intensity = node.intensity;
  writeVec3(light.position, node.position);
};

/** The three.js camera kinds the kernel hosts. */
export type HostCamera = PerspectiveCamera | OrthographicCamera;

type Viewport = { readonly width: number; readonly height: number };

/**
 * Fits a camera's projection to the viewport. Perspective cameras take its aspect ratio;
 * orthographic frustums span it in CSS pixels, scaled by `zoom` (as React Three Fiber's
 * `updateCamera` in `core/utils.tsx` at `d74622e`).
 */
const fitCamera = (camera: HostCamera, viewport: Viewport): void => {
  if (camera instanceof OrthographicCamera) {
    camera.left = viewport.width / -2;
    camera.right = viewport.width / 2;
    camera.top = viewport.height / 2;
    camera.bottom = viewport.height / -2;
  } else {
    camera.aspect = viewport.width / viewport.height;
  }
  camera.updateProjectionMatrix();
};

/** A camera of the description's kind: `current` when it already is one, else a new one. */
const cameraFor = (current: HostCamera, description: CameraDescription): HostCamera => {
  if (description._tag === 'Perspective') {
    return current instanceof PerspectiveCamera ? current : new PerspectiveCamera();
  }
  return current instanceof OrthographicCamera ? current : new OrthographicCamera();
};

const applyCamera = (camera: HostCamera, description: CameraDescription): void => {
  if (camera instanceof PerspectiveCamera && description._tag === 'Perspective') {
    camera.fov = description.fov;
  } else if (camera instanceof OrthographicCamera && description._tag === 'Orthographic') {
    camera.zoom = description.zoom;
  }
  camera.near = description.near;
  camera.far = description.far;
  writeVec3(camera.position, description.position);
  camera.lookAt(description.lookAt[0], description.lookAt[1], description.lookAt[2]);
};

/** Creates an empty scene graph. */
export const createSceneGraph = (options: SceneGraphOptions = {}): SceneGraph => {
  const store = options.store ?? createResourceStore();
  const ownsStore = options.store === undefined;
  const scene = new Scene();
  let camera: HostCamera = new PerspectiveCamera();
  const entries = new Map<string, Entry>();
  const keys = new WeakMap<Object3D, string>();
  const spinning = new Set<Entry>();
  const moving = new Map<Entry, Tween>();
  const reparented = new Set<Entry>();
  const worldPosition = new Vector3();
  const interactive = new Set<Object3D>();
  let interactiveList: Array<Object3D> | undefined;
  let index: SceneIndex = emptyIndex;
  let elapsed = 0;
  let animating = true;
  let viewport = { width: 1, height: 1 };

  const unsubscribe = store.onGeometryReplaced(({ previous, next }) => {
    for (const entry of entries.values()) {
      if (entry._tag === 'Mesh' && entry.object.geometry === previous) entry.object.geometry = next;
    }
  });

  const trackInteractive = (object: Object3D, enabled: boolean): void => {
    const changed = enabled ? !interactive.has(object) : interactive.has(object);
    if (!changed) return;
    if (enabled) interactive.add(object);
    else interactive.delete(object);
    interactiveList = undefined;
  };

  const trackRotation = (entry: Entry, node: GroupNode | MeshNode): void => {
    writeRotation(entry.object.rotation, node.rotation, elapsed);
    if (node.rotation._tag === 'Spin') spinning.add(entry);
    else spinning.delete(entry);
  };

  const build = (node: SceneNode): Entry => {
    switch (node._tag) {
      case 'Group': {
        const entry: Entry = { _tag: 'Group', node, object: new Group() };
        writeVec3(entry.object.position, node.position);
        writeVec3(entry.object.scale, node.scale);
        trackRotation(entry, node);
        return entry;
      }
      case 'Mesh': {
        const object: HostMesh = new Mesh(
          store.acquireGeometry(node.geometry),
          store.acquireMaterial(node.material),
        );
        const entry: Entry = { _tag: 'Mesh', node, object };
        writeVec3(object.position, node.position);
        writeVec3(object.scale, node.scale);
        trackRotation(entry, node);
        trackInteractive(object, node.interactive);
        return entry;
      }
      case 'AmbientLight':
        return { _tag: 'AmbientLight', node, object: new AmbientLight(node.color, node.intensity) };
      case 'DirectionalLight': {
        const object = new DirectionalLight(node.color, node.intensity);
        writeVec3(object.position, node.position);
        return { _tag: 'DirectionalLight', node, object };
      }
      case 'PointLight': {
        const object = new PointLight();
        writePointLight(object, node);
        return { _tag: 'PointLight', node, object };
      }
      case 'SpotLight': {
        const object = new SpotLight();
        writeSpotLight(object, node);
        return { _tag: 'SpotLight', node, object };
      }
      case 'HemisphereLight': {
        const object = new HemisphereLight();
        writeHemisphereLight(object, node);
        return { _tag: 'HemisphereLight', node, object };
      }
    }
  };

  const release = (entry: Entry): void => {
    spinning.delete(entry);
    moving.delete(entry);
    reparented.delete(entry);
    trackInteractive(entry.object, false);
    if (entry._tag === 'Mesh') {
      store.releaseGeometry(entry.node.geometry, entry.object.geometry);
      store.releaseMaterial(entry.node.material, entry.object.material);
    }
  };

  /**
   * Moves the object towards a new position and scale: at once for `Instant` or while not
   * animating, otherwise by restarting the tween from the current rendered pose at the last
   * frame's time.
   */
  const retarget = (entry: Entry, node: GroupNode | MeshNode): void => {
    if (!animating || node.transition._tag === 'Instant') {
      moving.delete(entry);
      writeVec3(entry.object.position, node.position);
      writeVec3(entry.object.scale, node.scale);
      return;
    }
    moving.set(entry, startTween(entry.object, node, elapsed, node.transition));
  };

  const movesTransform = (entry: Entry, fields: ReadonlyArray<Field>): boolean =>
    fields.includes('position') ||
    fields.includes('scale') ||
    (fields.includes('transition') && moving.has(entry));

  const update = (entry: Entry, next: SceneNode, fields: ReadonlyArray<Field>): void => {
    if (entry._tag === 'Mesh' && next._tag === 'Mesh') {
      const prev = entry.node;
      const mesh = entry.object;
      for (const field of fields) {
        if (field === 'geometry') {
          store.releaseGeometry(prev.geometry, mesh.geometry);
          mesh.geometry = store.acquireGeometry(next.geometry);
        } else if (field === 'material') {
          if (prev.material._tag === 'Standard' && next.material._tag === 'Standard') {
            store.updateOwnedMaterial(mesh.material, next.material);
          } else {
            store.releaseMaterial(prev.material, mesh.material);
            mesh.material = store.acquireMaterial(next.material);
          }
        }
      }
      entry.node = next;
      if (movesTransform(entry, fields)) retarget(entry, next);
      if (fields.includes('rotation')) trackRotation(entry, next);
      if (fields.includes('interactive')) trackInteractive(mesh, next.interactive);
      return;
    }
    if (entry._tag === 'Group' && next._tag === 'Group') {
      entry.node = next;
      if (movesTransform(entry, fields)) retarget(entry, next);
      if (fields.includes('rotation')) trackRotation(entry, next);
      return;
    }
    if (entry._tag === 'AmbientLight' && next._tag === 'AmbientLight') {
      entry.object.color.setHex(next.color);
      entry.object.intensity = next.intensity;
      entry.node = next;
      return;
    }
    if (entry._tag === 'DirectionalLight' && next._tag === 'DirectionalLight') {
      entry.object.color.setHex(next.color);
      entry.object.intensity = next.intensity;
      writeVec3(entry.object.position, next.position);
      entry.node = next;
      return;
    }
    if (entry._tag === 'PointLight' && next._tag === 'PointLight') {
      writePointLight(entry.object, next);
      entry.node = next;
      return;
    }
    if (entry._tag === 'SpotLight' && next._tag === 'SpotLight') {
      writeSpotLight(entry.object, next);
      entry.node = next;
      return;
    }
    if (entry._tag === 'HemisphereLight' && next._tag === 'HemisphereLight') {
      writeHemisphereLight(entry.object, next);
      entry.node = next;
      return;
    }
    throw new Error(`effect-three: update kind mismatch for "${next.key}"`);
  };

  const parentObject = (parent: ParentKey): Object3D => {
    if (parent === null) return scene;
    const entry = entries.get(parent);
    if (entry === undefined) throw new Error(`effect-three: missing parent "${parent}"`);
    return entry.object;
  };

  const register = (key: string, entry: Entry): void => {
    entries.set(key, entry);
    entry.object.name = key;
    keys.set(entry.object, key);
  };

  const apply = (op: Op): void => {
    switch (op._tag) {
      case 'SetCamera':
        camera = cameraFor(camera, op.camera);
        applyCamera(camera, op.camera);
        fitCamera(camera, viewport);
        return;
      case 'DefineResources':
        store.define(op.resources);
        return;
      case 'Create': {
        const entry = build(op.node);
        register(op.node.key, entry);
        parentObject(op.parent).add(entry.object);
        return;
      }
      case 'Replace': {
        const old = entries.get(op.node.key);
        if (old === undefined) throw new Error(`effect-three: missing node "${op.node.key}"`);
        const entry = build(op.node);
        const target = parentObject(op.parent);
        // Children follow their parent key. Later Move/Remove ops settle any that leave.
        // Copy first: add() removes each child from the array being iterated.
        for (const child of old.object.children.slice()) entry.object.add(child);
        const position = old.object.parent === target ? target.children.indexOf(old.object) : -1;
        old.object.removeFromParent();
        target.add(entry.object);
        if (position >= 0) {
          target.children.pop();
          target.children.splice(position, 0, entry.object);
        }
        release(old);
        keys.delete(old.object);
        register(op.node.key, entry);
        return;
      }
      case 'Move': {
        const entry = entries.get(op.key);
        if (entry === undefined) throw new Error(`effect-three: missing node "${op.key}"`);
        const target = parentObject(op.parent);
        if (entry._tag === 'Group' || entry._tag === 'Mesh') {
          // Keep the world position across the move; settle() then takes the node to its
          // new local position, instantly or along its transition.
          entry.object.getWorldPosition(worldPosition);
          target.add(entry.object);
          target.updateWorldMatrix(true, false);
          entry.object.position.copy(target.worldToLocal(worldPosition));
          reparented.add(entry);
        } else {
          target.add(entry.object);
        }
        return;
      }
      case 'Update': {
        const entry = entries.get(op.node.key);
        if (entry === undefined) throw new Error(`effect-three: missing node "${op.node.key}"`);
        update(entry, op.node, op.fields);
        return;
      }
      case 'Remove': {
        const entry = entries.get(op.key);
        if (entry === undefined) return;
        entry.object.removeFromParent();
        release(entry);
        entries.delete(op.key);
        keys.delete(entry.object);
        return;
      }
      case 'Order': {
        const parent = parentObject(op.parent);
        const ordered: Array<Object3D> = [];
        for (const key of op.keys) {
          const entry = entries.get(key);
          if (entry !== undefined) ordered.push(entry.object);
        }
        const managed = new Set(ordered);
        const unmanaged = parent.children.filter((child) => !managed.has(child));
        parent.children.splice(0, parent.children.length, ...ordered, ...unmanaged);
        return;
      }
    }
  };

  const reconcile = (next: SceneDescription): ReconcileResult => {
    const result = diff(index, next);
    if (result._tag === 'Invalid') return result;
    for (const op of result.ops) apply(op);
    for (const entry of reparented) {
      if (entry._tag === 'Group' || entry._tag === 'Mesh') retarget(entry, entry.node);
    }
    reparented.clear();
    index = result.index;
    return { _tag: 'Applied', ops: result.ops };
  };

  // Defined once so ticking allocates nothing; deleting during Map.forEach is safe.
  const stepTween = (tween: Tween, entry: Entry): void => {
    if (applyTween(entry.object, tween, elapsed)) moving.delete(entry);
  };

  const tick = (elapsedSeconds: number): void => {
    elapsed = elapsedSeconds;
    for (const entry of spinning) {
      if (entry._tag === 'Group' || entry._tag === 'Mesh') {
        writeRotation(entry.object.rotation, entry.node.rotation, elapsed);
      }
    }
    moving.forEach(stepTween);
  };

  const finishTween = (tween: Tween, entry: Entry): void => {
    applyTween(entry.object, tween, Number.POSITIVE_INFINITY);
  };

  const setAnimating = (next: boolean): void => {
    animating = next;
    if (next) return;
    moving.forEach(finishTween);
    moving.clear();
  };

  const dispose = (): void => {
    for (const entry of entries.values()) {
      entry.object.removeFromParent();
      release(entry);
    }
    entries.clear();
    index = emptyIndex;
    unsubscribe();
    if (ownsStore) store.dispose();
  };

  return {
    scene,
    get camera() {
      return camera;
    },
    store,
    reconcile,
    tick,
    elapsedSeconds: () => elapsed,
    setAnimating,
    object: (key) => entries.get(key)?.object,
    keyOf: (object) => keys.get(object),
    interactiveObjects: () => {
      interactiveList ??= [...interactive];
      return interactiveList;
    },
    viewport: () => viewport,
    resize: (width, height) => {
      viewport = { width, height };
      fitCamera(camera, viewport);
    },
    dispose,
  };
};
