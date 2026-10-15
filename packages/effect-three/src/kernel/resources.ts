/**
 * GPU resource ownership (PLAN D5).
 *
 * - Owned: created for one mesh, disposed when that mesh releases it.
 * - Shared: defined by id, created on first use, reference-counted by the meshes using
 *   it, disposed when the last user releases it. Several scene graphs may share one store.
 *
 * Definitions are upserts. Changing a live shared material within its kind updates it in
 * place. Changing a live shared geometry, or a shared material's kind, creates a
 * replacement, notifies subscribers (each scene graph swaps it onto its meshes) and
 * disposes the old one.
 *
 * The store is synchronous so the applier stays synchronous. The Effect runtime owns the
 * store's lifetime and calls `dispose` from a scope finalizer.
 *
 * @module
 */
import {
  BoxGeometry,
  type BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Material,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';

import type {
  GeometryRef,
  MaterialRef,
  ResourceDefinitions,
  ShapeGeometry,
  SurfaceMaterial,
} from './description.ts';
import { geometryRefEquals, materialRefEquals } from './equality.ts';
import { buildMaterial, type HostMaterial, updateMaterial } from './materials.ts';

/** Lifetime counters for one resource type. `live` is `created - disposed`. */
export type ResourceCounts = {
  readonly created: number;
  readonly disposed: number;
  readonly live: number;
};

export type ResourceStats = {
  readonly geometries: ResourceCounts;
  readonly materials: ResourceCounts;
  /** Acquisitions per live shared resource id. */
  readonly sharedGeometryUsers: ReadonlyMap<string, number>;
  readonly sharedMaterialUsers: ReadonlyMap<string, number>;
};

/** Raised when a live shared geometry is replaced because its definition changed. */
export type GeometryReplaced = {
  readonly previous: BufferGeometry;
  readonly next: BufferGeometry;
};

/** Raised when a live shared material is replaced because its kind changed. */
export type MaterialReplaced = {
  readonly previous: HostMaterial;
  readonly next: HostMaterial;
};

export type ResourceStore = {
  readonly define: (definitions: ResourceDefinitions) => void;
  readonly acquireGeometry: (ref: GeometryRef) => BufferGeometry;
  /** Releases one acquisition. `geometry` is the value currently held for `ref`. */
  readonly releaseGeometry: (ref: GeometryRef, geometry: BufferGeometry) => void;
  readonly acquireMaterial: (ref: MaterialRef) => HostMaterial;
  /** Releases one acquisition. `material` is the value currently held for `ref`. */
  readonly releaseMaterial: (ref: MaterialRef, material: HostMaterial) => void;
  /** Subscribes to shared geometry replacement. Returns an unsubscribe function. */
  readonly onGeometryReplaced: (listener: (event: GeometryReplaced) => void) => () => void;
  /** Subscribes to shared material replacement. Returns an unsubscribe function. */
  readonly onMaterialReplaced: (listener: (event: MaterialReplaced) => void) => () => void;
  /**
   * Applies new parameters to an owned material in place. Returns `false`, changing
   * nothing, when `next` is a different kind: release it and acquire a new one instead.
   */
  readonly updateOwnedMaterial: (material: HostMaterial, next: SurfaceMaterial) => boolean;
  /** The shared id of a live geometry, or `undefined` if it is owned or unknown. */
  readonly sharedGeometryId: (geometry: BufferGeometry) => string | undefined;
  /** The shared id of a live material, or `undefined` if it is owned or unknown. */
  readonly sharedMaterialId: (material: HostMaterial) => string | undefined;
  readonly stats: () => ResourceStats;
  /** Disposes every live resource. Idempotent. */
  readonly dispose: () => void;
};

type Shared<A> = { value: A; users: number };

type Counter = { created: number; disposed: number };

const counts = (counter: Counter): ResourceCounts => ({
  created: counter.created,
  disposed: counter.disposed,
  live: counter.created - counter.disposed,
});

const userCounts = <A>(entries: ReadonlyMap<string, Shared<A>>): ReadonlyMap<string, number> => {
  const result = new Map<string, number>();
  for (const [id, entry] of entries) result.set(id, entry.users);
  return result;
};

// A swapped-out shared geometry keeps its id in the WeakMap, so check it is still current.
const liveId = <A extends object>(
  entries: ReadonlyMap<string, Shared<A>>,
  ids: WeakMap<A, string>,
  value: A,
): string | undefined => {
  const id = ids.get(value);
  if (id === undefined || entries.get(id)?.value !== value) return undefined;
  return id;
};

/** Builds the three.js geometry for a shape description. */
const buildShape = (shape: ShapeGeometry): BufferGeometry => {
  switch (shape._tag) {
    case 'Box':
      return new BoxGeometry(shape.width, shape.height, shape.depth);
    case 'Sphere':
      return new SphereGeometry(shape.radius, shape.widthSegments, shape.heightSegments);
    case 'Plane':
      return new PlaneGeometry(shape.width, shape.height);
    case 'Cylinder':
      return new CylinderGeometry(
        shape.radiusTop,
        shape.radiusBottom,
        shape.height,
        shape.radialSegments,
      );
    case 'Torus':
      return new TorusGeometry(
        shape.radius,
        shape.tube,
        shape.radialSegments,
        shape.tubularSegments,
      );
    case 'Cone':
      return new ConeGeometry(shape.radius, shape.height, shape.radialSegments);
    case 'Capsule':
      return new CapsuleGeometry(
        shape.radius,
        shape.height,
        shape.capSegments,
        shape.radialSegments,
      );
    case 'Ring':
      return new RingGeometry(shape.innerRadius, shape.outerRadius, shape.thetaSegments);
    case 'Circle':
      return new CircleGeometry(shape.radius, shape.segments);
  }
};

/** Creates an empty resource store. */
export const createResourceStore = (): ResourceStore => {
  const geometryDefinitions = new Map<string, ShapeGeometry>();
  const materialDefinitions = new Map<string, SurfaceMaterial>();
  const sharedGeometries = new Map<string, Shared<BufferGeometry>>();
  const sharedMaterials = new Map<string, Shared<HostMaterial>>();
  const sharedGeometryIds = new WeakMap<BufferGeometry, string>();
  const sharedMaterialIds = new WeakMap<HostMaterial, string>();
  const owned = new Set<BufferGeometry | HostMaterial>();
  const replacedListeners = new Set<(event: GeometryReplaced) => void>();
  const materialListeners = new Set<(event: MaterialReplaced) => void>();
  const geometryCounter: Counter = { created: 0, disposed: 0 };
  const materialCounter: Counter = { created: 0, disposed: 0 };

  const makeGeometry = (description: ShapeGeometry): BufferGeometry => {
    geometryCounter.created++;
    return buildShape(description);
  };
  const disposeGeometry = (geometry: BufferGeometry): void => {
    geometryCounter.disposed++;
    geometry.dispose();
  };
  const makeMaterial = (description: SurfaceMaterial): HostMaterial => {
    materialCounter.created++;
    return buildMaterial(description);
  };
  const disposeMaterial = (material: HostMaterial): void => {
    materialCounter.disposed++;
    material.dispose();
  };

  const define = (definitions: ResourceDefinitions): void => {
    for (const { id, geometry } of definitions.geometries) {
      const before = geometryDefinitions.get(id);
      geometryDefinitions.set(id, geometry);
      const live = sharedGeometries.get(id);
      if (live === undefined || before === undefined || geometryRefEquals(before, geometry)) {
        continue;
      }
      const previous = live.value;
      const replacement = makeGeometry(geometry);
      sharedGeometryIds.set(replacement, id);
      live.value = replacement;
      for (const listener of replacedListeners) listener({ previous, next: replacement });
      disposeGeometry(previous);
    }
    for (const { id, material } of definitions.materials) {
      const before = materialDefinitions.get(id);
      materialDefinitions.set(id, material);
      const live = sharedMaterials.get(id);
      if (live === undefined || before === undefined || materialRefEquals(before, material)) {
        continue;
      }
      if (updateMaterial(live.value, material)) continue;
      const previous = live.value;
      const replacement = makeMaterial(material);
      sharedMaterialIds.set(replacement, id);
      live.value = replacement;
      for (const listener of materialListeners) listener({ previous, next: replacement });
      disposeMaterial(previous);
    }
  };

  const acquireGeometry = (ref: GeometryRef): BufferGeometry => {
    if (ref._tag !== 'SharedGeometry') {
      const geometry = makeGeometry(ref);
      owned.add(geometry);
      return geometry;
    }
    const live = sharedGeometries.get(ref.id);
    if (live !== undefined) {
      live.users++;
      return live.value;
    }
    const definition = geometryDefinitions.get(ref.id);
    if (definition === undefined)
      throw new Error(`effect-three: undefined shared geometry "${ref.id}"`);
    const geometry = makeGeometry(definition);
    sharedGeometries.set(ref.id, { value: geometry, users: 1 });
    sharedGeometryIds.set(geometry, ref.id);
    return geometry;
  };

  const releaseGeometry = (ref: GeometryRef, geometry: BufferGeometry): void => {
    if (ref._tag !== 'SharedGeometry') {
      if (owned.delete(geometry)) disposeGeometry(geometry);
      return;
    }
    const live = sharedGeometries.get(ref.id);
    if (live === undefined || live.value !== geometry) return;
    live.users--;
    if (live.users > 0) return;
    sharedGeometries.delete(ref.id);
    disposeGeometry(live.value);
  };

  const acquireMaterial = (ref: MaterialRef): HostMaterial => {
    if (ref._tag !== 'SharedMaterial') {
      const material = makeMaterial(ref);
      owned.add(material);
      return material;
    }
    const live = sharedMaterials.get(ref.id);
    if (live !== undefined) {
      live.users++;
      return live.value;
    }
    const definition = materialDefinitions.get(ref.id);
    if (definition === undefined)
      throw new Error(`effect-three: undefined shared material "${ref.id}"`);
    const material = makeMaterial(definition);
    sharedMaterials.set(ref.id, { value: material, users: 1 });
    sharedMaterialIds.set(material, ref.id);
    return material;
  };

  const releaseMaterial = (ref: MaterialRef, material: HostMaterial): void => {
    if (ref._tag !== 'SharedMaterial') {
      if (owned.delete(material)) disposeMaterial(material);
      return;
    }
    const live = sharedMaterials.get(ref.id);
    if (live === undefined || live.value !== material) return;
    live.users--;
    if (live.users > 0) return;
    sharedMaterials.delete(ref.id);
    disposeMaterial(live.value);
  };

  const dispose = (): void => {
    for (const resource of owned) {
      if (resource instanceof Material) disposeMaterial(resource);
      else disposeGeometry(resource);
    }
    owned.clear();
    for (const entry of sharedGeometries.values()) disposeGeometry(entry.value);
    sharedGeometries.clear();
    for (const entry of sharedMaterials.values()) disposeMaterial(entry.value);
    sharedMaterials.clear();
  };

  return {
    define,
    acquireGeometry,
    releaseGeometry,
    acquireMaterial,
    releaseMaterial,
    updateOwnedMaterial: updateMaterial,
    onGeometryReplaced: (listener) => {
      replacedListeners.add(listener);
      return () => {
        replacedListeners.delete(listener);
      };
    },
    onMaterialReplaced: (listener) => {
      materialListeners.add(listener);
      return () => {
        materialListeners.delete(listener);
      };
    },
    sharedGeometryId: (geometry) => liveId(sharedGeometries, sharedGeometryIds, geometry),
    sharedMaterialId: (material) => liveId(sharedMaterials, sharedMaterialIds, material),
    stats: () => ({
      geometries: counts(geometryCounter),
      materials: counts(materialCounter),
      sharedGeometryUsers: userCounts(sharedGeometries),
      sharedMaterialUsers: userCounts(sharedMaterials),
    }),
    dispose,
  };
};
