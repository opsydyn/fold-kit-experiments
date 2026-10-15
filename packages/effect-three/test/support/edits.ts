/**
 * Incremental scene edits for property tests. Indices are taken modulo the current node
 * count, so every generated edit applies to any scene (or is a no-op on an empty one).
 */
import type { GroupNode, SceneDescription, SceneNode } from '../../src/kernel/index.ts';
import { allNodes, perturb, replaceNode, withUniqueKeys } from './scenes.ts';

export type Edit =
  | { readonly _tag: 'Perturb'; readonly target: number }
  | { readonly _tag: 'Remove'; readonly target: number }
  | { readonly _tag: 'Move'; readonly target: number; readonly destination: number }
  | { readonly _tag: 'Reverse'; readonly destination: number }
  | { readonly _tag: 'Insert'; readonly node: SceneNode; readonly destination: number }
  | { readonly _tag: 'ChangeKind'; readonly target: number; readonly node: SceneNode };

const pick = <A>(items: ReadonlyArray<A>, index: number): A | undefined =>
  items.length === 0 ? undefined : items[index % items.length];

function withoutKey(nodes: ReadonlyArray<SceneNode>, key: string): ReadonlyArray<SceneNode> {
  return nodes.flatMap((node) => removeFrom(node, key));
}

function removeFrom(node: SceneNode, key: string): ReadonlyArray<SceneNode> {
  if (node.key === key) return [];
  if (node._tag !== 'Group') return [node];
  const group: GroupNode = { ...node, children: withoutKey(node.children, key) };
  return [group];
}

function updateChildren(
  nodes: ReadonlyArray<SceneNode>,
  parent: string | null,
  update: (children: ReadonlyArray<SceneNode>) => ReadonlyArray<SceneNode>,
): ReadonlyArray<SceneNode> {
  if (parent === null) return update(nodes);
  return nodes.map((node) => updateChildrenIn(node, parent, update));
}

function updateChildrenIn(
  node: SceneNode,
  parent: string,
  update: (children: ReadonlyArray<SceneNode>) => ReadonlyArray<SceneNode>,
): SceneNode {
  if (node._tag !== 'Group') return node;
  if (node.key === parent) return { ...node, children: update(node.children) };
  return { ...node, children: updateChildren(node.children, parent, update) };
}

/** Root (`null`) plus every group key: places a node can be inserted. */
const destinations = (nodes: ReadonlyArray<SceneNode>): ReadonlyArray<string | null> => [
  null,
  ...allNodes(nodes).flatMap((node) => (node._tag === 'Group' ? [node.key] : [])),
];

const contains = (node: SceneNode, key: string): boolean =>
  allNodes([node]).some((candidate) => candidate.key === key);

/** Applies one edit, returning a valid description (keys stay unique). */
export const applyEdit = (description: SceneDescription, edit: Edit): SceneDescription => {
  const children = description.children;
  const nodes = allNodes(children);
  switch (edit._tag) {
    case 'Perturb': {
      const target = pick(nodes, edit.target);
      if (target === undefined) return description;
      return { ...description, children: replaceNode(children, target.key, perturb(target).node) };
    }
    case 'Remove': {
      const target = pick(nodes, edit.target);
      if (target === undefined) return description;
      return { ...description, children: withoutKey(children, target.key) };
    }
    case 'Move': {
      const target = pick(nodes, edit.target);
      const destination = pick(destinations(children), edit.destination);
      if (target === undefined || destination === undefined) return description;
      if (destination !== null && contains(target, destination)) return description;
      const detached = withoutKey(children, target.key);
      return {
        ...description,
        children: updateChildren(detached, destination, (list) => [...list, target]),
      };
    }
    case 'Reverse': {
      const destination = pick(destinations(children), edit.destination);
      if (destination === undefined) return description;
      return {
        ...description,
        children: updateChildren(children, destination, (list) => [...list].reverse()),
      };
    }
    case 'Insert': {
      const destination = pick(destinations(children), edit.destination);
      if (destination === undefined) return description;
      const inserted = updateChildren(children, destination, (list) => [...list, edit.node]);
      return withUniqueKeys({ ...description, children: inserted });
    }
    case 'ChangeKind': {
      const target = pick(nodes, edit.target);
      if (target === undefined) return description;
      const replacement = { ...edit.node, key: target.key };
      return withUniqueKeys({
        ...description,
        children: replaceNode(children, target.key, replacement),
      });
    }
  }
};

/** Every intermediate description produced by applying `edits` in turn. */
export const evolve = (
  start: SceneDescription,
  edits: ReadonlyArray<Edit>,
): ReadonlyArray<SceneDescription> => {
  const states = [start];
  let current = start;
  for (const edit of edits) {
    current = applyEdit(current, edit);
    states.push(current);
  }
  return states;
};
