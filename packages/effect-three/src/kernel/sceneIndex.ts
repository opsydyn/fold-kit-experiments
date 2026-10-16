/**
 * Flattened, validated view of a scene description, used by the diff.
 *
 * @module
 */
import type { SceneDescription, SceneNode } from './description.ts';

/** Parent of a node: another node's key, or `null` for the scene root. */
export type ParentKey = string | null;

/** A node with its position in the tree. */
export type IndexedNode = {
  readonly node: SceneNode;
  readonly parent: ParentKey;
};

/** A description is rejected as a whole; nothing is applied (no partial updates). */
export type DescriptionError =
  | { readonly _tag: 'DuplicateKey'; readonly key: string }
  | {
      readonly _tag: 'DuplicateResourceId';
      readonly resource: 'geometry' | 'material';
      readonly id: string;
    }
  | { readonly _tag: 'UnknownSharedGeometry'; readonly nodeKey: string; readonly id: string }
  | { readonly _tag: 'UnknownSharedMaterial'; readonly nodeKey: string; readonly id: string }
  | { readonly _tag: 'DuplicateInstanceKey'; readonly nodeKey: string; readonly key: string };

/** A validated scene. Keys are unique across the whole scene. */
export type SceneIndex = {
  readonly description: SceneDescription | null;
  readonly nodes: ReadonlyMap<string, IndexedNode>;
  /** Child keys per parent, in description order. Includes the root (`null`). */
  readonly children: ReadonlyMap<ParentKey, ReadonlyArray<string>>;
  /** Keys in depth-first pre-order: parents always precede their children. */
  readonly preOrder: ReadonlyArray<string>;
};

/** The index of the empty scene that every graph starts from. */
export const emptyIndex: SceneIndex = {
  description: null,
  nodes: new Map(),
  children: new Map([[null, []]]),
  preOrder: [],
};

export type IndexResult =
  | { readonly _tag: 'Indexed'; readonly index: SceneIndex }
  | { readonly _tag: 'Invalid'; readonly error: DescriptionError };

/** Validates and flattens a description. */
/** The first instance key used twice, if any. */
const firstDuplicateInstance = (
  instances: ReadonlyArray<{ readonly key: string }>,
): string | undefined => {
  const seen = new Set<string>();
  for (const { key } of instances) {
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return undefined;
};

export const indexScene = (description: SceneDescription): IndexResult => {
  const geometryIds = new Set<string>();
  for (const { id } of description.resources.geometries) {
    if (geometryIds.has(id)) {
      return { _tag: 'Invalid', error: { _tag: 'DuplicateResourceId', resource: 'geometry', id } };
    }
    geometryIds.add(id);
  }
  const materialIds = new Set<string>();
  for (const { id } of description.resources.materials) {
    if (materialIds.has(id)) {
      return { _tag: 'Invalid', error: { _tag: 'DuplicateResourceId', resource: 'material', id } };
    }
    materialIds.add(id);
  }

  const nodes = new Map<string, IndexedNode>();
  const children = new Map<ParentKey, Array<string>>([[null, []]]);
  const preOrder: Array<string> = [];
  // Explicit stack instead of recursion: deep scenes cannot overflow the call stack.
  const stack: Array<{ readonly node: SceneNode; readonly parent: ParentKey }> = [];
  for (let i = description.children.length - 1; i >= 0; i--) {
    const node = description.children[i];
    if (node !== undefined) stack.push({ node, parent: null });
  }
  for (let item = stack.pop(); item !== undefined; item = stack.pop()) {
    const { node, parent } = item;
    if (nodes.has(node.key))
      return { _tag: 'Invalid', error: { _tag: 'DuplicateKey', key: node.key } };
    if (node._tag === 'Mesh' || node._tag === 'Instances') {
      if (node.geometry._tag === 'SharedGeometry' && !geometryIds.has(node.geometry.id)) {
        return {
          _tag: 'Invalid',
          error: { _tag: 'UnknownSharedGeometry', nodeKey: node.key, id: node.geometry.id },
        };
      }
      if (node.material._tag === 'SharedMaterial' && !materialIds.has(node.material.id)) {
        return {
          _tag: 'Invalid',
          error: { _tag: 'UnknownSharedMaterial', nodeKey: node.key, id: node.material.id },
        };
      }
    }
    if (node._tag === 'Instances') {
      const duplicate = firstDuplicateInstance(node.instances);
      if (duplicate !== undefined) {
        return {
          _tag: 'Invalid',
          error: { _tag: 'DuplicateInstanceKey', nodeKey: node.key, key: duplicate },
        };
      }
    }
    nodes.set(node.key, { node, parent });
    preOrder.push(node.key);
    children.get(parent)?.push(node.key);
    if (node._tag === 'Group') {
      children.set(node.key, []);
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        if (child !== undefined) stack.push({ node: child, parent: node.key });
      }
    }
  }
  return { _tag: 'Indexed', index: { description, nodes, children, preOrder } };
};
