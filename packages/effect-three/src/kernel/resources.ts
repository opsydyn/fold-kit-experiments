/**
 * GPU resource ownership (PLAN D5).
 *
 * - Owned: created for one mesh, disposed when that mesh releases it.
 * - Shared: defined by id, created on first use, reference-counted by the meshes using
 *   it, disposed when the last user releases it. Several scene graphs may share one store.
 *
 * Definitions are upserts. Changing a live shared material updates it in place. Changing
 * a live shared geometry creates a replacement, notifies subscribers (each scene graph
 * swaps it onto its meshes) and disposes the old one.
 *
 * The store is synchronous so the applier stays synchronous. The Effect runtime owns the
 * store's lifetime and calls `dispose` from a scope finalizer.
 *
 * @module
 */
import { BoxGeometry, type BufferGeometry, MeshStandardMaterial } from 'three';

import type {
  BoxGeometry as BoxGeometryDescription,
  GeometryRef,
  MaterialRef,
  ResourceDefinitions,
  StandardMaterial,
} from './description.ts';
import { geometryRefEquals, materialRefEquals } from './equality.ts';

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

export type ResourceStore = {
  readonly define: (definitions: ResourceDefinitions) => void;
  readonly acquireGeometry: (ref: GeometryRef) => BufferGeometry;
  /** Releases one acquisition. `geometry` is the value currently held for `ref`. */
  readonly releaseGeometry: (ref: GeometryRef, geometry: BufferGeometry) => void;
  readonly acquireMaterial: (ref: MaterialRef) => MeshStandardMaterial;
  /** Releases one acquisition. `material` is the value currently held for `ref`. */
  readonly releaseMaterial: (ref: MaterialRef, material: MeshStandardMaterial) => void;
  /** Subscribes to shared geometry replacement. Returns an unsubscribe function. */
  readonly onGeometryReplaced: (listener: (event: GeometryReplaced) => void) => () => void;
  /** Applies new parameters to an owned material in place. */
  readonly updateOwnedMaterial: (material: MeshStandardMaterial, next: StandardMaterial) => void;
  /** The shared id of a live geometry, or `undefined` if it is owned or unknown. */
  readonly sharedGeometryId: (geometry: BufferGeometry) => string | undefined;
  /** The shared id of a live material, or `undefined` if it is owned or unknown. */
  readonly sharedMaterialId: (material: MeshStandardMaterial) => string | undefined;
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

const applyStandard = (material: MeshStandardMaterial, description: StandardMaterial): void => {
  material.color.setHex(description.color);
  material.roughness = description.roughness;
  material.metalness = description.metalness;
};

/** Creates an empty resource store. */
export const createResourceStore = (): ResourceStore => {
  const geometryDefinitions = new Map<string, BoxGeometryDescription>();
  const materialDefinitions = new Map<string, StandardMaterial>();
  const sharedGeometries = new Map<string, Shared<BufferGeometry>>();
  const sharedMaterials = new Map<string, Shared<MeshStandardMaterial>>();
  const sharedGeometryIds = new WeakMap<BufferGeometry, string>();
  const sharedMaterialIds = new WeakMap<MeshStandardMaterial, string>();
  const owned = new Set<BufferGeometry | MeshStandardMaterial>();
  const replacedListeners = new Set<(event: GeometryReplaced) => void>();
  const geometryCounter: Counter = { created: 0, disposed: 0 };
  const materialCounter: Counter = { created: 0, disposed: 0 };

  const makeGeometry = (description: BoxGeometryDescription): BufferGeometry => {
    geometryCounter.created++;
    return new BoxGeometry(description.width, description.height, description.depth);
  };
  const disposeGeometry = (geometry: BufferGeometry): void => {
    geometryCounter.disposed++;
    geometry.dispose();
  };
  const makeMaterial = (description: StandardMaterial): MeshStandardMaterial => {
    materialCounter.created++;
    const material = new MeshStandardMaterial();
    applyStandard(material, description);
    return material;
  };
  const disposeMaterial = (material: MeshStandardMaterial): void => {
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
      if (live !== undefined && before !== undefined && !materialRefEquals(before, material)) {
        applyStandard(live.value, material);
      }
    }
  };

  const acquireGeometry = (ref: GeometryRef): BufferGeometry => {
    if (ref._tag === 'Box') {
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
    if (ref._tag === 'Box') {
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

  const acquireMaterial = (ref: MaterialRef): MeshStandardMaterial => {
    if (ref._tag === 'Standard') {
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

  const releaseMaterial = (ref: MaterialRef, material: MeshStandardMaterial): void => {
    if (ref._tag === 'Standard') {
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
      if (resource instanceof MeshStandardMaterial) disposeMaterial(resource);
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
    updateOwnedMaterial: applyStandard,
    onGeometryReplaced: (listener) => {
      replacedListeners.add(listener);
      return () => {
        replacedListeners.delete(listener);
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
