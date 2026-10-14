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
  Mesh,
  type MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  Scene,
} from 'three';

import { writeRotation } from './behaviours.ts';
import type {
  AmbientLightNode,
  DirectionalLightNode,
  GroupNode,
  MeshNode,
  PerspectiveCamera as CameraDescription,
  SceneDescription,
  SceneNode,
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
  readonly camera: PerspectiveCamera;
  readonly store: ResourceStore;
  /** Diffs against the last applied description and applies the result. */
  readonly reconcile: (next: SceneDescription) => ReconcileResult;
  /** Advances behaviours to `elapsedSeconds` of scene time. Allocation-free. */
  readonly tick: (elapsedSeconds: number) => void;
  /** Scene time of the last `tick`. */
  readonly elapsedSeconds: () => number;
  /** The hosted object for a key. */
  readonly object: (key: string) => Object3D | undefined;
  /** The key of a hosted object. */
  readonly keyOf: (object: Object3D) => string | undefined;
  /** Removes every node and releases its resources. Disposes the store if the graph owns it. */
  readonly dispose: () => void;
};

const writeVec3 = (
  target: { set: (x: number, y: number, z: number) => unknown },
  v: Vec3,
): void => {
  target.set(v[0], v[1], v[2]);
};

const applyCamera = (camera: PerspectiveCamera, description: CameraDescription): void => {
  camera.fov = description.fov;
  camera.near = description.near;
  camera.far = description.far;
  writeVec3(camera.position, description.position);
  camera.lookAt(description.lookAt[0], description.lookAt[1], description.lookAt[2]);
  camera.updateProjectionMatrix();
};

/** Creates an empty scene graph. */
export const createSceneGraph = (options: SceneGraphOptions = {}): SceneGraph => {
  const store = options.store ?? createResourceStore();
  const ownsStore = options.store === undefined;
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const entries = new Map<string, Entry>();
  const keys = new WeakMap<Object3D, string>();
  const spinning = new Set<Entry>();
  let index: SceneIndex = emptyIndex;
  let elapsed = 0;

  const unsubscribe = store.onGeometryReplaced(({ previous, next }) => {
    for (const entry of entries.values()) {
      if (entry._tag === 'Mesh' && entry.object.geometry === previous) entry.object.geometry = next;
    }
  });

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
        return entry;
      }
      case 'AmbientLight':
        return { _tag: 'AmbientLight', node, object: new AmbientLight(node.color, node.intensity) };
      case 'DirectionalLight': {
        const object = new DirectionalLight(node.color, node.intensity);
        writeVec3(object.position, node.position);
        return { _tag: 'DirectionalLight', node, object };
      }
    }
  };

  const release = (entry: Entry): void => {
    spinning.delete(entry);
    if (entry._tag === 'Mesh') {
      store.releaseGeometry(entry.node.geometry, entry.object.geometry);
      store.releaseMaterial(entry.node.material, entry.object.material);
    }
  };

  const update = (entry: Entry, next: SceneNode, fields: ReadonlyArray<Field>): void => {
    if (entry._tag === 'Mesh' && next._tag === 'Mesh') {
      const prev = entry.node;
      const mesh = entry.object;
      for (const field of fields) {
        if (field === 'position') writeVec3(mesh.position, next.position);
        else if (field === 'scale') writeVec3(mesh.scale, next.scale);
        else if (field === 'geometry') {
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
      if (fields.includes('rotation')) trackRotation(entry, next);
      return;
    }
    if (entry._tag === 'Group' && next._tag === 'Group') {
      if (fields.includes('position')) writeVec3(entry.object.position, next.position);
      if (fields.includes('scale')) writeVec3(entry.object.scale, next.scale);
      entry.node = next;
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
        applyCamera(camera, op.camera);
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
        parentObject(op.parent).add(entry.object);
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
    index = result.index;
    return { _tag: 'Applied', ops: result.ops };
  };

  const tick = (elapsedSeconds: number): void => {
    elapsed = elapsedSeconds;
    for (const entry of spinning) {
      if (entry._tag === 'Group' || entry._tag === 'Mesh') {
        writeRotation(entry.object.rotation, entry.node.rotation, elapsed);
      }
    }
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
    camera,
    store,
    reconcile,
    tick,
    elapsedSeconds: () => elapsed,
    object: (key) => entries.get(key)?.object,
    keyOf: (object) => keys.get(object),
    dispose,
  };
};
