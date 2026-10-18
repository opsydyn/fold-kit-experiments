/**
 * Flattened, validated view of a scene description, used by the diff.
 *
 * @module
 */
import type { Joint, SceneDescription, SceneNode } from './description.ts';

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
  | { readonly _tag: 'DuplicateInstanceKey'; readonly nodeKey: string; readonly key: string }
  | { readonly _tag: 'UnknownBehaviour'; readonly nodeKey: string; readonly name: string }
  | { readonly _tag: 'DuplicateViewKey'; readonly key: string }
  | { readonly _tag: 'DuplicateRenderTextureId'; readonly id: string }
  | { readonly _tag: 'DuplicateOverlayKey'; readonly key: string }
  | { readonly _tag: 'UnknownOverlayNode'; readonly key: string; readonly node: string }
  | { readonly _tag: 'UnknownOverlayView'; readonly key: string; readonly view: string }
  | { readonly _tag: 'UnknownMeasuredNode'; readonly key: string }
  /** Two joints share a key. */
  | { readonly _tag: 'DuplicateJointKey'; readonly key: string }
  /** A joint names a node that is not in the scene. */
  | { readonly _tag: 'UnknownJointBody'; readonly joint: string; readonly body: string };

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

/** A node waiting to be indexed: its index entry, and the list its key joins. */
type Stacked = IndexedNode & { readonly siblings: Array<string> };

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

/** The first joint error: a key used twice, or a body naming no node. */
const jointsError = (
  joints: ReadonlyArray<Joint>,
  nodes: ReadonlyMap<string, IndexedNode>,
): DescriptionError | undefined => {
  const duplicate = firstDuplicateInstance(joints);
  if (duplicate !== undefined) return { _tag: 'DuplicateJointKey', key: duplicate };
  for (const joint of joints) {
    for (const { key } of [joint.a, joint.b]) {
      if (!nodes.has(key)) return { _tag: 'UnknownJointBody', joint: joint.key, body: key };
    }
  }
  return undefined;
};

/** Validates and flattens a description. */
export const indexScene = (
  description: SceneDescription,
  behaviours: ReadonlySet<string> = new Set(),
): IndexResult => {
  const duplicateTexture = firstDuplicateInstance(
    description.renderTextures.map((texture) => ({ key: texture.id })),
  );
  if (duplicateTexture !== undefined) {
    return { _tag: 'Invalid', error: { _tag: 'DuplicateRenderTextureId', id: duplicateTexture } };
  }
  const duplicateView = firstDuplicateInstance(description.views);
  if (duplicateView !== undefined) {
    return { _tag: 'Invalid', error: { _tag: 'DuplicateViewKey', key: duplicateView } };
  }
  const duplicateOverlay = firstDuplicateInstance(description.overlays);
  if (duplicateOverlay !== undefined) {
    return { _tag: 'Invalid', error: { _tag: 'DuplicateOverlayKey', key: duplicateOverlay } };
  }
  const viewKeys = new Set(description.views.map((view) => view.key));
  const strayView = description.overlays.find(
    (overlay) => overlay.view !== null && !viewKeys.has(overlay.view),
  );
  if (strayView?.view != null) {
    return {
      _tag: 'Invalid',
      error: { _tag: 'UnknownOverlayView', key: strayView.key, view: strayView.view },
    };
  }
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
  const rootChildren: Array<string> = [];
  const children = new Map<ParentKey, Array<string>>([[null, rootChildren]]);
  const preOrder: Array<string> = [];
  // Explicit stack instead of recursion: deep scenes cannot overflow the call stack. Each
  // item becomes the node's index entry, and carries its parent's child list, so indexing
  // a node allocates nothing else.
  const stack: Array<Stacked> = [];
  for (let i = description.children.length - 1; i >= 0; i--) {
    const node = description.children[i];
    if (node !== undefined) stack.push({ node, parent: null, siblings: rootChildren });
  }
  for (let item = stack.pop(); item !== undefined; item = stack.pop()) {
    const { node } = item;
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
    if ('behaviour' in node && node.behaviour !== null && !behaviours.has(node.behaviour.name)) {
      return {
        _tag: 'Invalid',
        error: { _tag: 'UnknownBehaviour', nodeKey: node.key, name: node.behaviour.name },
      };
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
    nodes.set(node.key, item);
    preOrder.push(node.key);
    item.siblings.push(node.key);
    if (node._tag === 'Group') {
      const siblings: Array<string> = [];
      children.set(node.key, siblings);
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        if (child !== undefined) stack.push({ node: child, parent: node.key, siblings });
      }
    }
  }
  const strayNode = description.overlays.find(
    (overlay) => overlay.node !== null && !nodes.has(overlay.node),
  );
  if (strayNode?.node != null) {
    return {
      _tag: 'Invalid',
      error: { _tag: 'UnknownOverlayNode', key: strayNode.key, node: strayNode.node },
    };
  }
  const unmeasurable = description.measure.find((key) => !nodes.has(key));
  if (unmeasurable !== undefined) {
    return { _tag: 'Invalid', error: { _tag: 'UnknownMeasuredNode', key: unmeasurable } };
  }
  const jointError = jointsError(description.physics?.joints ?? [], nodes);
  if (jointError !== undefined) return { _tag: 'Invalid', error: jointError };
  return { _tag: 'Indexed', index: { description, nodes, children, preOrder } };
};
