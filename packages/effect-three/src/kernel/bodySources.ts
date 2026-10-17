/**
 * What the body host needs from each body in a scene: where it is, where the description
 * puts it, what its colliders are made from, and how to put a simulated pose back. A body
 * sits on a mesh, group or borrowed model, or on each instance of an instances node (as
 * react-three-rapier's `InstancedRigidBodies`, `ae5c3fe`).
 *
 * @module
 */
import { Euler, type InstancedMesh, Matrix4, type Object3D, Quaternion, Vector3 } from 'three';

import type {
  Body,
  BorrowedNode,
  GroupNode,
  Instance,
  InstancesNode,
  MeshNode,
  Rotation,
} from './description.ts';
import {
  type BodyPose,
  type Collider,
  colliderFor,
  colliderSignature,
  collidersFor,
} from './physics.ts';

/** A node a body can sit on directly. */
export type BodiedNode = MeshNode | GroupNode | BorrowedNode;

/** One body, as the body host sees it. */
export type BodySource = {
  /** The body's id in the physics world. */
  readonly id: string;
  /** The node's key, and for an instance its key, as collisions report them. */
  readonly key: string;
  readonly instance?: string;
  readonly body: Body;
  /** What it lives on (a hosted object, or an instances node's entry): a new one means a new body. */
  readonly holder: object;
  /** Where the description puts it, as text: a change teleports a non-kinematic body. */
  readonly placement: string;
  /** What its colliders are made from: a change remakes them. */
  readonly signature: () => string;
  readonly colliders: () => ReadonlyArray<Collider>;
  /** Where it is now, in world space. */
  readonly pose: () => BodyPose;
  /** Where the description puts it, in world space. */
  readonly described: () => BodyPose;
  /** Puts it at a world pose (a simulated one). */
  readonly place: (pose: BodyPose) => void;
};

const position = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3();
const matrix = new Matrix4();
const local = new Matrix4();
const inverse = new Matrix4();
const euler = new Euler();
const ownScale = new Vector3();

const toPose = (from: Matrix4): BodyPose => {
  from.decompose(position, quaternion, scale);
  return {
    position: [position.x, position.y, position.z],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
  };
};

const rotationText = (rotation: Rotation): string =>
  rotation._tag === 'Fixed' ? rotation.euler.join(',') : 'spin';

/** A world pose written to an object in its parent's space, keeping its scale. */
const placeObject = (object: Object3D, pose: BodyPose): void => {
  object.matrixWorld.decompose(position, quaternion, scale);
  matrix.compose(position.fromArray(pose.position), quaternion.fromArray(pose.quaternion), scale);
  if (object.parent !== null) matrix.premultiply(inverse.copy(object.parent.matrixWorld).invert());
  matrix.decompose(object.position, object.quaternion, scale);
};

/** The body on a mesh, group or borrowed model, if it has one. */
export const nodeSource = (
  key: string,
  node: BodiedNode,
  object: Object3D,
): BodySource | undefined => {
  const { body } = node;
  if (body === null) return undefined;
  return {
    id: key,
    key,
    body,
    holder: object,
    placement: `${node.position.join(',')}|${rotationText(node.rotation)}`,
    signature: () => colliderSignature(object),
    colliders: () => collidersFor(object, body.collider),
    pose: () => toPose(object.matrixWorld),
    described: () => {
      position.fromArray(node.position);
      if (node.rotation._tag === 'Fixed') {
        quaternion.setFromEuler(euler.fromArray([...node.rotation.euler]));
      } else quaternion.copy(object.quaternion);
      matrix.compose(position, quaternion, object.scale);
      if (object.parent !== null) matrix.premultiply(object.parent.matrixWorld);
      return toPose(matrix);
    },
    place: (pose) => placeObject(object, pose),
  };
};

/** An instance's matrix in its mesh, from its description. */
const instanceMatrix = (instance: Instance): Matrix4 =>
  local.compose(
    position.fromArray(instance.position),
    quaternion.setFromEuler(euler.fromArray([...instance.rotation])),
    scale.fromArray(instance.scale),
  );

/** The body on one instance of an instances node with a body. */
const instanceSource = (
  key: string,
  body: Body,
  holder: object,
  mesh: InstancedMesh,
  instance: Instance,
  slot: number,
): BodySource => ({
  id: `${key}\u0000${instance.key}`,
  key,
  instance: instance.key,
  body,
  holder,
  placement: `${instance.position.join(',')}|${instance.rotation.join(',')}`,
  signature: () => `${mesh.geometry.uuid}:${instance.scale.join(',')}`,
  colliders: () => {
    mesh.matrixWorld.decompose(position, quaternion, ownScale);
    return [
      colliderFor(mesh.geometry, body.collider, ownScale.multiply(scale.fromArray(instance.scale))),
    ];
  },
  pose: () => {
    mesh.getMatrixAt(slot, local);
    return toPose(matrix.copy(mesh.matrixWorld).multiply(local));
  },
  described: () => toPose(matrix.copy(mesh.matrixWorld).multiply(instanceMatrix(instance))),
  place: (pose) => {
    mesh.matrixWorld.decompose(position, quaternion, ownScale);
    ownScale.multiply(scale.fromArray(instance.scale));
    matrix.compose(
      position.fromArray(pose.position),
      quaternion.fromArray(pose.quaternion),
      ownScale,
    );
    matrix.premultiply(inverse.copy(mesh.matrixWorld).invert());
    mesh.setMatrixAt(slot, matrix);
    mesh.instanceMatrix.needsUpdate = true;
    // Picking and culling recompute these from the moved instances.
    mesh.boundingSphere = null;
    mesh.boundingBox = null;
  },
});

/**
 * A body per instance of an instances node with a body. `holder` outlives the mesh, which
 * is swapped for a larger one as instances are added: the bodies stay.
 */
export const instanceSources = (
  key: string,
  node: InstancesNode,
  holder: object,
  mesh: InstancedMesh,
): ReadonlyArray<BodySource> => {
  const { body } = node;
  if (body === null) return [];
  return node.instances.map((instance, slot) =>
    instanceSource(key, body, holder, mesh, instance, slot),
  );
};
