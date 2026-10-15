/** Plain helpers for generated scenes (no Effect import). */
import type { Field, GroupNode, SceneDescription, SceneNode } from '../../src/kernel/index.ts';

function dedupeNode(node: SceneNode, seen: Set<string>): ReadonlyArray<SceneNode> {
  if (seen.has(node.key)) return [];
  seen.add(node.key);
  if (node._tag !== 'Group') return [node];
  const group: GroupNode = { ...node, children: dedupeNodes(node.children, seen) };
  return [group];
}

const dedupeNodes = (
  nodes: ReadonlyArray<SceneNode>,
  seen: Set<string>,
): ReadonlyArray<SceneNode> => nodes.flatMap((node) => dedupeNode(node, seen));

/** Drops every subtree whose key already appeared earlier in pre-order. */
export const withUniqueKeys = (description: SceneDescription): SceneDescription => ({
  ...description,
  children: dedupeNodes(description.children, new Set()),
});

/** Every node in pre-order. */
export const allNodes = (nodes: ReadonlyArray<SceneNode>): ReadonlyArray<SceneNode> =>
  nodes.flatMap((node) => [node, ...(node._tag === 'Group' ? allNodes(node.children) : [])]);

/** Resource counts implied by a description: what the store must hold live. */
export const expectedResources = (description: SceneDescription) => {
  const meshes = allNodes(description.children).flatMap((node) =>
    node._tag === 'Mesh' ? [node] : [],
  );
  const sharedGeometryUsers = new Map<string, number>();
  const sharedMaterialUsers = new Map<string, number>();
  let ownedGeometries = 0;
  let ownedMaterials = 0;
  for (const mesh of meshes) {
    if (mesh.geometry._tag !== 'SharedGeometry') ownedGeometries++;
    else {
      const id = mesh.geometry.id;
      sharedGeometryUsers.set(id, (sharedGeometryUsers.get(id) ?? 0) + 1);
    }
    if (mesh.material._tag === 'Standard') ownedMaterials++;
    else {
      const id = mesh.material.id;
      sharedMaterialUsers.set(id, (sharedMaterialUsers.get(id) ?? 0) + 1);
    }
  }
  return {
    liveGeometries: ownedGeometries + sharedGeometryUsers.size,
    liveMaterials: ownedMaterials + sharedMaterialUsers.size,
    sharedGeometryUsers,
    sharedMaterialUsers,
  };
};

/** Changes exactly one field of a node, returning the field the diff should report. */
export const perturb = (node: SceneNode): { readonly node: SceneNode; readonly field: Field } => {
  switch (node._tag) {
    case 'Group':
    case 'Mesh':
      return {
        node: { ...node, position: [node.position[0] + 100, node.position[1], node.position[2]] },
        field: 'position',
      };
    case 'AmbientLight':
    case 'DirectionalLight':
      return { node: { ...node, intensity: node.intensity + 1 }, field: 'intensity' };
  }
};

function replaceIn(node: SceneNode, key: string, replacement: SceneNode): SceneNode {
  if (node.key === key) return replacement;
  if (node._tag !== 'Group') return node;
  return { ...node, children: replaceNode(node.children, key, replacement) };
}

/** Replaces the node with `key` anywhere in the tree. */
export const replaceNode = (
  nodes: ReadonlyArray<SceneNode>,
  key: string,
  replacement: SceneNode,
): ReadonlyArray<SceneNode> => nodes.map((node) => replaceIn(node, key, replacement));
