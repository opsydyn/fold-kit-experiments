/**
 * Writing instance descriptions into three.js's `InstancedMesh` buffers.
 *
 * Slots are positional: instance `i` of the description lives in slot `i`. An update
 * writes only the slots whose instance changed, so moving one of 10,000 instances writes
 * one matrix. Capacity grows by doubling, so adding instances rarely reallocates.
 *
 * @module
 */
import {
  type BufferGeometry,
  Color,
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';

import type { Instance } from './description.ts';
import { instanceEquals } from './equality.ts';
import type { HostMaterial } from './materials.ts';

/** The three.js object an `instances` node is hosted as. */
export type HostInstances = InstancedMesh<BufferGeometry, HostMaterial>;

const minimumCapacity = 16;

/** Slots to allocate for `count` instances: the next power of two, at least 16. */
export const capacityFor = (count: number): number =>
  Math.max(minimumCapacity, 2 ** Math.ceil(Math.log2(Math.max(1, count))));

// Scratch values, so writing instances allocates nothing.
const matrix = new Matrix4();
const position = new Vector3();
const euler = new Euler();
const quaternion = new Quaternion();
const scale = new Vector3();
const color = new Color();

const writeSlot = (mesh: HostInstances, slot: number, instance: Instance): void => {
  position.set(instance.position[0], instance.position[1], instance.position[2]);
  euler.set(instance.rotation[0], instance.rotation[1], instance.rotation[2]);
  quaternion.setFromEuler(euler);
  scale.set(instance.scale[0], instance.scale[1], instance.scale[2]);
  mesh.setMatrixAt(slot, matrix.compose(position, quaternion, scale));
  mesh.setColorAt(slot, color.setHex(instance.color));
};

/** Creates an instanced mesh with room for at least `count` instances. */
export const createInstances = (
  geometry: BufferGeometry,
  material: HostMaterial,
  count: number,
): HostInstances => {
  const mesh: HostInstances = new InstancedMesh(geometry, material, capacityFor(count));
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  // Allocate per-instance colours up front so the shader never changes as colours come and go.
  mesh.setColorAt(0, color.setHex(0xffffff));
  mesh.instanceColor?.setUsage(DynamicDrawUsage);
  mesh.count = 0;
  return mesh;
};

/** Whether `count` instances fit without reallocating. */
export const fits = (mesh: HostInstances, count: number): boolean =>
  count <= mesh.instanceMatrix.count;

/**
 * Writes `next` into `mesh`, skipping slots whose instance is unchanged from `previous`
 * (pass an empty list to write every slot). `next` must fit. Returns the slots written.
 */
export const writeInstances = (
  mesh: HostInstances,
  previous: ReadonlyArray<Instance>,
  next: ReadonlyArray<Instance>,
): number => {
  let written = 0;
  for (let slot = 0; slot < next.length; slot++) {
    const instance = next[slot];
    if (instance === undefined) continue;
    const before = previous[slot];
    if (before !== undefined && instanceEquals(before, instance)) continue;
    writeSlot(mesh, slot, instance);
    written++;
  }
  if (written > 0 || mesh.count !== next.length) {
    mesh.count = next.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
    // Picking and frustum culling recompute these lazily from the new instances.
    mesh.boundingSphere = null;
    mesh.boundingBox = null;
  }
  return written;
};
