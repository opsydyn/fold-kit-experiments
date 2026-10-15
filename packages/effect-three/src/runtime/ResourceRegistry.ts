/**
 * App-level owner of shared GPU resources (ADR-005). Every scene runtime built with the
 * same Layer shares one kernel resource store; the store is disposed when the Layer's
 * scope closes.
 *
 * @module
 */
import { Context, Effect, Layer } from 'effect';

import { createResourceStore, type ResourceStore } from '../kernel/index.ts';

export class ResourceRegistry extends Context.Service<
  ResourceRegistry,
  { readonly store: ResourceStore }
>()('effect-three/ResourceRegistry') {}

const acquireStore = Effect.sync(createResourceStore);

const toService = (store: ResourceStore) => ({ store });

const scopedStore = Effect.acquireRelease(acquireStore, (store) => Effect.sync(store.dispose));

/** Provides one shared resource store for the lifetime of the Layer. */
export const layer = Layer.effect(ResourceRegistry, scopedStore.pipe(Effect.map(toService)));
