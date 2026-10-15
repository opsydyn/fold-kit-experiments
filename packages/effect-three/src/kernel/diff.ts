/**
 * Keyed diff: `(previous index, next description) => operations`.
 *
 * Pure. Operations are emitted in the order the applier must run them:
 *
 * 1. `SetCamera`, `DefineResources`
 * 2. `Create`, `Replace`, `Move`, `Update` in depth-first pre-order (parents first)
 * 3. `Remove`
 * 4. `Order`, only where child order would otherwise be wrong
 *
 * Keys are unique across the scene, so a node keeps its identity when it moves between
 * parents. A node whose kind changes under the same key is replaced.
 *
 * @module
 */
import type { Camera, ResourceDefinitions, SceneDescription, SceneNode } from './description.ts';
import {
  cameraEquals,
  geometryRefEquals,
  materialRefEquals,
  resourcesEqual,
  rotationEquals,
  transitionEquals,
  vec3Equals,
} from './equality.ts';
import {
  type DescriptionError,
  indexScene,
  type ParentKey,
  type SceneIndex,
} from './sceneIndex.ts';

/** A node property that an `Update` changes. */
export type Field =
  | 'position'
  | 'rotation'
  | 'scale'
  | 'transition'
  | 'geometry'
  | 'material'
  | 'interactive'
  | 'color'
  | 'intensity'
  | 'groundColor'
  | 'target'
  | 'distance'
  | 'angle'
  | 'penumbra'
  | 'decay';

/** A single change to apply to the hosted scene graph. */
export type Op =
  | { readonly _tag: 'SetCamera'; readonly camera: Camera }
  | { readonly _tag: 'DefineResources'; readonly resources: ResourceDefinitions }
  | { readonly _tag: 'Create'; readonly node: SceneNode; readonly parent: ParentKey }
  | { readonly _tag: 'Replace'; readonly node: SceneNode; readonly parent: ParentKey }
  | { readonly _tag: 'Move'; readonly key: string; readonly parent: ParentKey }
  | {
      readonly _tag: 'Update';
      readonly node: SceneNode;
      readonly fields: ReadonlyArray<Field>;
    }
  | { readonly _tag: 'Remove'; readonly key: string }
  | { readonly _tag: 'Order'; readonly parent: ParentKey; readonly keys: ReadonlyArray<string> };

export type DiffResult =
  | { readonly _tag: 'Diffed'; readonly ops: ReadonlyArray<Op>; readonly index: SceneIndex }
  | { readonly _tag: 'Invalid'; readonly error: DescriptionError };

const noFields: ReadonlyArray<Field> = [];

/**
 * Fields that differ between two nodes, or `undefined` when the kind changed and the
 * node must be replaced.
 */
export const changedFields = (
  prev: SceneNode,
  next: SceneNode,
): ReadonlyArray<Field> | undefined => {
  if (prev === next) return noFields;
  const fields: Array<Field> = [];
  switch (next._tag) {
    case 'Group': {
      if (prev._tag !== 'Group') return undefined;
      if (!vec3Equals(prev.position, next.position)) fields.push('position');
      if (!rotationEquals(prev.rotation, next.rotation)) fields.push('rotation');
      if (!vec3Equals(prev.scale, next.scale)) fields.push('scale');
      if (!transitionEquals(prev.transition, next.transition)) fields.push('transition');
      return fields;
    }
    case 'Mesh': {
      if (prev._tag !== 'Mesh') return undefined;
      if (!vec3Equals(prev.position, next.position)) fields.push('position');
      if (!rotationEquals(prev.rotation, next.rotation)) fields.push('rotation');
      if (!vec3Equals(prev.scale, next.scale)) fields.push('scale');
      if (!transitionEquals(prev.transition, next.transition)) fields.push('transition');
      if (!geometryRefEquals(prev.geometry, next.geometry)) fields.push('geometry');
      if (!materialRefEquals(prev.material, next.material)) fields.push('material');
      if (prev.interactive !== next.interactive) fields.push('interactive');
      return fields;
    }
    case 'AmbientLight': {
      if (prev._tag !== 'AmbientLight') return undefined;
      if (!Object.is(prev.color, next.color)) fields.push('color');
      if (!Object.is(prev.intensity, next.intensity)) fields.push('intensity');
      return fields;
    }
    case 'DirectionalLight': {
      if (prev._tag !== 'DirectionalLight') return undefined;
      if (!Object.is(prev.color, next.color)) fields.push('color');
      if (!Object.is(prev.intensity, next.intensity)) fields.push('intensity');
      if (!vec3Equals(prev.position, next.position)) fields.push('position');
      return fields;
    }
    case 'PointLight': {
      if (prev._tag !== 'PointLight') return undefined;
      if (!Object.is(prev.color, next.color)) fields.push('color');
      if (!Object.is(prev.intensity, next.intensity)) fields.push('intensity');
      if (!vec3Equals(prev.position, next.position)) fields.push('position');
      if (!Object.is(prev.distance, next.distance)) fields.push('distance');
      if (!Object.is(prev.decay, next.decay)) fields.push('decay');
      return fields;
    }
    case 'SpotLight': {
      if (prev._tag !== 'SpotLight') return undefined;
      if (!Object.is(prev.color, next.color)) fields.push('color');
      if (!Object.is(prev.intensity, next.intensity)) fields.push('intensity');
      if (!vec3Equals(prev.position, next.position)) fields.push('position');
      if (!vec3Equals(prev.target, next.target)) fields.push('target');
      if (!Object.is(prev.distance, next.distance)) fields.push('distance');
      if (!Object.is(prev.angle, next.angle)) fields.push('angle');
      if (!Object.is(prev.penumbra, next.penumbra)) fields.push('penumbra');
      if (!Object.is(prev.decay, next.decay)) fields.push('decay');
      return fields;
    }
    case 'HemisphereLight': {
      if (prev._tag !== 'HemisphereLight') return undefined;
      if (!Object.is(prev.color, next.color)) fields.push('color');
      if (!Object.is(prev.groundColor, next.groundColor)) fields.push('groundColor');
      if (!Object.is(prev.intensity, next.intensity)) fields.push('intensity');
      if (!vec3Equals(prev.position, next.position)) fields.push('position');
      return fields;
    }
  }
};

const sameKeys = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

/** Diffs a validated previous scene against the next description. */
export const diff = (prev: SceneIndex, next: SceneDescription): DiffResult => {
  if (prev.description === next) return { _tag: 'Diffed', ops: [], index: prev };
  const indexed = indexScene(next);
  if (indexed._tag === 'Invalid') return indexed;
  const index = indexed.index;
  const ops: Array<Op> = [];

  const prevDescription = prev.description;
  if (prevDescription === null || !cameraEquals(prevDescription.camera, next.camera)) {
    ops.push({ _tag: 'SetCamera', camera: next.camera });
  }
  if (prevDescription === null || !resourcesEqual(prevDescription.resources, next.resources)) {
    ops.push({ _tag: 'DefineResources', resources: next.resources });
  }

  // Keys appended to each parent by this diff (created, or moved in from elsewhere).
  const appended = new Map<ParentKey, Array<string>>();
  const append = (parent: ParentKey, key: string): void => {
    const list = appended.get(parent);
    if (list === undefined) appended.set(parent, [key]);
    else list.push(key);
  };
  // Parents whose hosted object was created by this diff: their children arrive in order.
  const freshParents = new Set<string>();

  for (const key of index.preOrder) {
    const current = index.nodes.get(key);
    if (current === undefined) continue;
    const before = prev.nodes.get(key);
    if (before === undefined) {
      ops.push({ _tag: 'Create', node: current.node, parent: current.parent });
      append(current.parent, key);
      freshParents.add(key);
      continue;
    }
    const fields = changedFields(before.node, current.node);
    if (fields === undefined) {
      ops.push({ _tag: 'Replace', node: current.node, parent: current.parent });
      if (before.parent !== current.parent) append(current.parent, key);
      continue;
    }
    if (before.parent !== current.parent) {
      ops.push({ _tag: 'Move', key, parent: current.parent });
      append(current.parent, key);
    }
    if (fields.length > 0) ops.push({ _tag: 'Update', node: current.node, fields });
  }

  for (const key of prev.preOrder) {
    if (!index.nodes.has(key)) ops.push({ _tag: 'Remove', key });
  }

  // After the steps above each parent holds its surviving children in previous order,
  // followed by appended children in next order. Reorder only where that is wrong.
  for (const [parent, keys] of index.children) {
    if (parent !== null && freshParents.has(parent)) continue;
    const survivors: Array<string> = [];
    for (const key of prev.children.get(parent) ?? []) {
      if (index.nodes.get(key)?.parent === parent) survivors.push(key);
    }
    const predicted = survivors.concat(appended.get(parent) ?? []);
    if (!sameKeys(predicted, keys)) ops.push({ _tag: 'Order', parent, keys });
  }

  return { _tag: 'Diffed', ops, index };
};
