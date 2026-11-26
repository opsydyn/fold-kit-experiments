import { Mount, UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { SceneSchema, type PhysicsEngine } from '@opsydyn/effect-three';
import {
  makeEnvironment,
  mountSceneHost,
  type Environment,
} from '@opsydyn/effect-three-foldkit/browser';
import { troikaLabels } from '@opsydyn/effect-three-troika/webgpu';
import { Effect, Schema, Stream } from 'effect';

import { rendererForPage } from './renderer';

export const SceneStart = UiSchema.TaggedEnum({
  StartedScene: {},
  FailedScene: { reason: Schema.String },
});

/** Mounts a scene in the element's scope and follows its description argument. */
// oxlint-disable-next-line linteffect/no-manual-effect-channels -- Keep the provider requirement generic so a room can share its environment with commands.
export const defineScopedSceneMount = <R>(environment: Effect.Effect<Environment, never, R>) =>
  Mount.make(
    'EffectThreeScene',
    { args: { scene: SceneSchema.SceneDescription } },
    (element: HTMLElement, { scene }, changes) => {
      const startup = environment.pipe(
        Effect.flatMap((environment) =>
          mountSceneHost({
            environment,
            element,
            initial: scene,
            updates: Stream.map(changes, (args) => args.scene),
            liveChanges: Stream.empty,
          }),
        ),
      );
      return startup.pipe(
        Effect.map(() => SceneStart.StartedScene()),
        Effect.catchTags({
          InvalidScene: ({ error }) =>
            Effect.succeed(SceneStart.FailedScene({ reason: error._tag })),
          RendererUnavailable: () =>
            Effect.succeed(SceneStart.FailedScene({ reason: 'renderer unavailable' })),
          PhysicsUnavailable: () =>
            Effect.succeed(SceneStart.FailedScene({ reason: 'physics unavailable' })),
        }),
      );
    },
  );

export function scopedSceneEnvironment(createEnvironment: () => Environment) {
  const acquire = Effect.sync(createEnvironment);
  const environment = Effect.acquireRelease(acquire, (created) => Effect.sync(created.dispose));
  return environment.pipe(Effect.withSpan('effect-three.samples.environment'));
}

export const defineEffectThreeMount = (createEnvironment: () => Environment) =>
  defineScopedSceneMount(scopedSceneEnvironment(createEnvironment));

/** Connects typed scene events to Effect UI without a registered custom element. */
export const EffectThreeStage = Html.customElement({
  tag: 'effect-three-scene',
  events: {
    'scene-click': SceneSchema.ButtonDetail,
    'scene-pointer-missed': SceneSchema.MissDetail,
    'scene-label-measured': SceneSchema.LabelMeasuredDetail,
    'scene-gesture': SceneSchema.GestureDetail,
    'scene-collision': SceneSchema.CollisionDetail,
    'scene-contact-force': SceneSchema.ContactForceDetail,
    'scene-asset-loaded': SceneSchema.AssetLoadedDetail,
    'scene-asset-failed': SceneSchema.AssetFailedDetail,
    'scene-xr': Schema.Struct({
      mode: Schema.NullOr(Schema.Literals(['immersive-vr', 'immersive-ar'])),
    }),
    'scene-xr-surface': SceneSchema.XrSurfaceDetail,
    'scene-xr-planes': SceneSchema.XrPlanesDetail,
    'scene-xr-meshes': SceneSchema.XrMeshesDetail,
    'scene-xr-moved': SceneSchema.XrMovedDetail,
    'scene-xr-teleported': SceneSchema.XrTeleportedDetail,
    'scene-xr-poses': SceneSchema.XrPosesDetail,
  },
});

export const createLabelledEnvironment = (loadPhysics?: () => Promise<PhysicsEngine>) => {
  const options = { renderer: rendererForPage(window), labels: troikaLabels() };
  return makeEnvironment(
    window,
    loadPhysics === undefined ? options : { ...options, physics: loadPhysics() },
  );
};

export const defineLabelledSceneMount = (loadPhysics?: () => Promise<PhysicsEngine>) =>
  defineEffectThreeMount(() => createLabelledEnvironment(loadPhysics));
