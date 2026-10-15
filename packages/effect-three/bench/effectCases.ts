/**
 * Benchmark cases that run Effect code: a full runtime mount/unmount, and the Schema
 * decode the Foldkit adapter performs on every scene it receives.
 */
import { Effect, Schema } from 'effect';

import {
  createManualFrames,
  createResourceStore,
  recordingRendererFactory,
  type SceneDescription,
} from '../src/kernel/index.ts';
import { FrameSource, ResourceRegistry, SceneRuntime, SceneSchema } from '../src/runtime/index.ts';

const store = createResourceStore();
const frames = FrameSource.fromScheduler(createManualFrames());
const renderer = recordingRendererFactory();
const viewport = { width: 800, height: 600, pixelRatio: 1 };

/** Starts a scene in a fresh scope and closes it again, synchronously. */
export const runtimeMountCycle = (scene: SceneDescription) => {
  const started = SceneRuntime.make({ scene, renderer, viewport }).pipe(
    Effect.scoped,
    Effect.provideService(FrameSource.FrameSource, frames),
    Effect.provideService(ResourceRegistry.ResourceRegistry, { store }),
  );
  return () => Effect.runSync(started);
};

const decode = Schema.decodeUnknownSync(SceneSchema.SceneDescription);

/** Decodes an untyped scene, as the adapter does at the DOM property boundary. */
export const decodeScene = (scene: unknown) => () => decode(scene);
