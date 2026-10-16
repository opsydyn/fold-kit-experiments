/**
 * The scene view: one call from a Foldkit `view` renders a scene and maps its events to
 * the app's typed Messages. The scene is plain data derived from the Model.
 *
 * @module
 */
import type { SceneDescription, SceneSchema } from '@opsydyn/effect-three';
import { Array as Arr, Option } from 'effect';
import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';

import { markTyped } from './dom/typedScenes.ts';
import {
  type ReconciledDetail,
  type SceneError,
  sceneElement,
  type SceneLifecycle,
} from './element.ts';
import type { SceneMount } from './mount.ts';

/**
 * Where the pointer met an interactive mesh: key, world-space point, distance from the
 * camera, world-space face normal and texture coordinates.
 */
export type HitDetail = typeof SceneSchema.HitDetail.Type;

/** Detail of click, double-click, pointer-down and pointer-up events: the hit and button. */
export type ButtonDetail = typeof SceneSchema.ButtonDetail.Type;

/** Detail of wheel events: the hit and the wheel deltas. */
export type WheelDetail = typeof SceneSchema.WheelDetail.Type;

/** Detail of a click that hit no interactive mesh. */
export type MissDetail = typeof SceneSchema.MissDetail.Type;

/** Detail of drag events: the captured mesh, the button and the pointer's world-space ray. */
export type DragDetail = typeof SceneSchema.DragDetail.Type;

/** Detail of performance changes: the measured fps and the new factor, 0 to 1. */
export type PerformanceDetail = typeof SceneSchema.PerformanceDetail.Type;

/** Detail of pointer-leave events: the key that is no longer under the pointer. */
export type KeyDetail = typeof SceneSchema.KeyDetail.Type;

export type ViewConfig<Message> = {
  /** The scene to show. Derive it from the Model; unchanged scenes cost nothing. */
  readonly scene: SceneDescription;
  /** The Mount from `makeSceneMount`, created once at the entry point. */
  readonly mount: SceneMount;
  /** Maps the mount outcome (started or failed) into the app's Messages. */
  readonly onLifecycle: (message: SceneLifecycle) => Message;
  /** Pressed and released on the same mesh with the same button. */
  readonly onClick?: (detail: ButtonDetail) => Message;
  /** A double-click on the mesh that was last pressed. */
  readonly onDoubleClick?: (detail: ButtonDetail) => Message;
  /** A context menu on the mesh that was last pressed. The browser's menu stays shut. */
  readonly onContextMenu?: (detail: HitDetail) => Message;
  readonly onPointerDown?: (detail: ButtonDetail) => Message;
  readonly onPointerUp?: (detail: ButtonDetail) => Message;
  readonly onPointerEnter?: (detail: HitDetail) => Message;
  /** Every pointer movement over an interactive mesh. Can fire at the pointer's rate. */
  readonly onPointerMove?: (detail: HitDetail) => Message;
  readonly onPointerLeave?: (detail: KeyDetail) => Message;
  /** A click that hit no interactive mesh and moved at most two pixels: clear a selection. */
  readonly onPointerMissed?: (detail: MissDetail) => Message;
  /** The wheel over an interactive mesh. Page scrolling is not blocked. */
  readonly onWheel?: (detail: WheelDetail) => Message;
  /**
   * The pointer moved while pressed on a mesh, anywhere (the press captures it). Turn the
   * ray into a point with `pointOnPlane` to drag along a plane.
   */
  readonly onDrag?: (detail: DragDetail) => Message;
  /** A drag ended: released anywhere, or the pointer was cancelled. */
  readonly onDragEnd?: (detail: DragDetail) => Message;
  /**
   * Frames ran persistently slow or fast, and the performance factor moved (0 to 1).
   * Store it in the Model and lower `render.resolution` with it, as Drei's
   * `PerformanceMonitor` and `AdaptiveDpr` do together.
   */
  readonly onPerformanceChange?: (detail: PerformanceDetail) => Message;
  /** A scene update was rejected; the scene keeps its last good state. */
  readonly onError?: (detail: { readonly error: SceneError }) => Message;
  /**
   * What each scene update did (operations by kind) and the GPU resources held afterwards.
   * Fires at startup and after every update that changed something, never for no-ops.
   */
  readonly onReconciled?: (detail: ReconciledDetail) => Message;
  readonly className?: string;
};

const given = Option.fromNullishOr;

/** Renders a scene element. Only the event handlers you pass are bound. */
export const view = <Message>(
  config: ViewConfig<NoInfer<Message>>,
  h: HtmlBuilder<Message>,
): Html => {
  const element = sceneElement.withMessage(h);
  const optional = Arr.getSomes([
    Option.map(given(config.onClick), element.OnSceneClick),
    Option.map(given(config.onDoubleClick), element.OnSceneDoubleClick),
    Option.map(given(config.onContextMenu), element.OnSceneContextMenu),
    Option.map(given(config.onPointerDown), element.OnScenePointerDown),
    Option.map(given(config.onPointerUp), element.OnScenePointerUp),
    Option.map(given(config.onPointerEnter), element.OnScenePointerEnter),
    Option.map(given(config.onPointerMove), element.OnScenePointerMove),
    Option.map(given(config.onPointerLeave), element.OnScenePointerLeave),
    Option.map(given(config.onPointerMissed), element.OnScenePointerMissed),
    Option.map(given(config.onWheel), element.OnSceneWheel),
    Option.map(given(config.onDrag), element.OnSceneDrag),
    Option.map(given(config.onDragEnd), element.OnSceneDragEnd),
    Option.map(given(config.onPerformanceChange), element.OnScenePerformance),
    Option.map(given(config.onError), element.OnSceneError),
    Option.map(given(config.onReconciled), element.OnSceneReconciled),
    Option.map(given(config.className), h.Class),
  ]);
  const lifecycle = Mount.mapMessage(config.mount(), config.onLifecycle);
  return element([element.Scene(markTyped(config.scene)), h.OnMount(lifecycle), ...optional], []);
};
