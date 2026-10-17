/**
 * The `<effect-three-scene>` element: a typed `scene` property that Foldkit diffs on
 * every render, and Schema-decoded events that become the app's typed Messages.
 *
 * The tag is never registered with `customElements`; the scene Mount intercepts the
 * property instead (ADR-002), so there is nothing to re-register under HMR or SSR.
 *
 * @module
 */
import { SceneSchema, type SceneEvent } from '@opsydyn/effect-three';
import { Schema } from 'effect';
import { CustomElement } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';

/** A scene update that could not be applied. The scene keeps its last good state. */
export const SceneError = Schema.Union([
  ...SceneSchema.DescriptionError.members,
  Schema.TaggedStruct('MalformedScene', { issue: Schema.String }),
]);
export type SceneError = typeof SceneError.Type;

const Counts = Schema.Struct({ live: Schema.Int, created: Schema.Int, disposed: Schema.Int });

/** What one scene update did, and the GPU resources held afterwards. */
export const ReconciledDetail = Schema.Struct({
  ops: Schema.Struct({
    created: Schema.Int,
    updated: Schema.Int,
    moved: Schema.Int,
    removed: Schema.Int,
    replaced: Schema.Int,
    reordered: Schema.Int,
    configured: Schema.Int,
  }),
  resources: Schema.Struct({ geometries: Counts, materials: Counts }),
});
export type ReconciledDetail = typeof ReconciledDetail.Type;

/** An immersive session began presenting the scene in `mode`, or ended (`null`). */
export const XrSessionDetail = Schema.Struct({
  mode: Schema.NullOr(Schema.Literals(['immersive-vr', 'immersive-ar'])),
});
export type XrSessionDetail = typeof XrSessionDetail.Type;

export const sceneElement = CustomElement.define({
  tag: 'effect-three-scene',
  properties: { scene: SceneSchema.SceneDescription },
  events: {
    'scene-click': SceneSchema.ButtonDetail,
    'scene-double-click': SceneSchema.ButtonDetail,
    'scene-context-menu': SceneSchema.HitDetail,
    'scene-pointer-down': SceneSchema.ButtonDetail,
    'scene-pointer-up': SceneSchema.ButtonDetail,
    'scene-pointer-enter': SceneSchema.HitDetail,
    'scene-pointer-move': SceneSchema.HitDetail,
    'scene-pointer-leave': SceneSchema.KeyDetail,
    'scene-pointer-missed': SceneSchema.MissDetail,
    'scene-wheel': SceneSchema.WheelDetail,
    'scene-drag': SceneSchema.DragDetail,
    'scene-drag-end': SceneSchema.DragDetail,
    'scene-gesture': SceneSchema.GestureDetail,
    'scene-collision': SceneSchema.CollisionDetail,
    'scene-measured': SceneSchema.MeasuredDetail,
    'scene-xr': XrSessionDetail,
    'scene-performance': SceneSchema.PerformanceDetail,
    'scene-error': Schema.Struct({ error: SceneError }),
    'scene-reconciled': ReconciledDetail,
  },
});

/** The DOM event name for each kernel scene event. */
export const domEventName = {
  Click: 'scene-click',
  DoubleClick: 'scene-double-click',
  ContextMenu: 'scene-context-menu',
  PointerDown: 'scene-pointer-down',
  PointerUp: 'scene-pointer-up',
  PointerEnter: 'scene-pointer-enter',
  PointerMove: 'scene-pointer-move',
  PointerLeave: 'scene-pointer-leave',
  PointerMissed: 'scene-pointer-missed',
  Wheel: 'scene-wheel',
  Drag: 'scene-drag',
  DragEnd: 'scene-drag-end',
  Gesture: 'scene-gesture',
  Collision: 'scene-collision',
  Measured: 'scene-measured',
  PerformanceChanged: 'scene-performance',
} as const satisfies Record<SceneEvent['_tag'], keyof typeof sceneElement.events>;

/** Outcome of mounting a scene. Map these into the app's Messages with `onLifecycle`. */
export const SceneLifecycle = defineMessageUnion({
  StartedScene: {},
  FailedScene: { reason: Schema.String },
});
export type SceneLifecycle = typeof SceneLifecycle.Type;
