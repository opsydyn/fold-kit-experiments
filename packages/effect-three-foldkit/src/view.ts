/**
 * The scene view: one call from an Effect UI view renders a scene and maps its events to
 * the app's typed Messages. The scene is plain data derived from the Model.
 *
 * @module
 */
import { Mount, type View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import type { SceneDescription, SceneSchema } from '@opsydyn/effect-three';
import { Option, type Scope } from 'effect';

import {
  type ReconciledDetail,
  type SceneError,
  sceneElement,
  type SceneLifecycle,
  type XrSessionDetail,
} from './element.ts';
import type { SceneMount } from './mount.ts';
import { overlayLayer, type OverlayView, withOverlays } from './overlayView.ts';

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

/**
 * A drag, wheel or pinch on the canvas, when the scene claims gestures. Pass it to
 * `orbit` to move a camera kept in the Model.
 */
export type Gesture = typeof SceneSchema.Gesture.Type;

/** Detail of the end of a gesture that moved: the press's button, modifiers, mesh and view. */
export type GestureEndDetail = typeof SceneSchema.GestureEndDetail.Type;

/** Detail of collision events: the two bodies' keys, and whether they began touching. */
export type CollisionDetail = typeof SceneSchema.CollisionDetail.Type;

/** Detail of contact force events: the two bodies, and how hard they pushed. */
export type ContactForceDetail = typeof SceneSchema.ContactForceDetail.Type;
export type PhysicsReachedDetail = typeof SceneSchema.PhysicsReachedDetail.Type;
export type AssetLoadedDetail = typeof SceneSchema.AssetLoadedDetail.Type;
export type AssetFailedDetail = typeof SceneSchema.AssetFailedDetail.Type;

/** Detail of measured events: a node's world bounding box. */
export type MeasuredDetail = typeof SceneSchema.MeasuredDetail.Type;

/** Detail of auto-rotated events: where a camera turning by itself got to. */
export type AutoRotatedDetail = typeof SceneSchema.AutoRotatedDetail.Type;

/** Detail of label measured events: a label's laid-out size in its own units. */
export type LabelMeasuredDetail = typeof SceneSchema.LabelMeasuredDetail.Type;

/** Detail of XR stick events: a thumbstick pushed past halfway in a direction, or let back. */
export type XrStickDetail = typeof SceneSchema.XrStickDetail.Type;

/** Detail of XR button events: a controller button pressed or released. */
export type XrButtonDetail = typeof SceneSchema.XrButtonDetail.Type;

/** Detail of XR moved events: where gliding left the player. */
export type XrMovedDetail = typeof SceneSchema.XrMovedDetail.Type;
export type XrTeleportedDetail = typeof SceneSchema.XrTeleportedDetail.Type;

/** Detail of XR poses events: where the player's head and hands are, in the scene. */
export type XrPosesDetail = typeof SceneSchema.XrPosesDetail.Type;

/** Detail of XR planes events: every plane the session detected, as it is now. */
export type XrPlanesDetail = typeof SceneSchema.XrPlanesDetail.Type;

/** Detail of XR meshes events: every mesh the session detected, as it is now. */
export type XrMeshesDetail = typeof SceneSchema.XrMeshesDetail.Type;

/** Detail of XR surface events: in AR, where a select met a real surface, and its normal. */
export type XrSurfaceDetail = typeof SceneSchema.XrSurfaceDetail.Type;

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
   * A drag, wheel or pinch anywhere on the canvas, reported while the scene claims
   * gestures (`scene({ gestures: 'scene' })`). Apply it with `orbit` in `update`:
   * the camera stays in the Model.
   */
  readonly onGesture?: (gesture: Gesture) => Message;
  /**
   * A gesture that moved has ended (released, or the pointer left): finish what it drew,
   * such as a `BoxSelect` box. Not after a press that never moved.
   */
  readonly onGestureEnd?: (detail: GestureEndDetail) => Message;
  /**
   * A gesture is about to begin on a camera turning by itself (`autoRotate`): keep where
   * it got to with `autoRotated(model.camera, detail)` (a view's camera when `view` names
   * one), so the gesture goes on from where the camera was shown.
   */
  readonly onAutoRotated?: (detail: AutoRotatedDetail) => Message;
  /**
   * Two bodies began or stopped touching (react-three-rapier's `onCollisionEnter` and
   * `onCollisionExit`, for the whole scene). Needs `physics` and an engine.
   */
  readonly onCollision?: (detail: CollisionDetail) => Message;
  /**
   * Two bodies pushed on each other harder than a body's `contactForces` threshold during
   * a step (react-three-rapier's `onContactForce`). Rapier reports every such step, so
   * set the threshold high.
   */
  readonly onContactForce?: (detail: ContactForceDetail) => Message;
  /**
   * A world on `physics({ until })` reached that step and waits there, with its run and a
   * checksum of its bodies' poses (ADR-014): the moment to apply the inputs due at that
   * step and move `until` on. It follows the collisions of the steps that led there.
   */
  readonly onPhysicsReached?: (detail: PhysicsReachedDetail) => Message;
  /**
   * A node listed in the scene's `measure` has a new world bounding box (Drei's `Bounds`
   * measuring, as a Message): fit the camera to it with `fitCamera`.
   */
  readonly onMeasured?: (detail: MeasuredDetail) => Message;
  /**
   * A measured label (`scene({ measure })`) was laid out anew: its block and tight glyph
   * bounds in its own units, before its scale, to size what goes behind it.
   */
  readonly onLabelMeasured?: (detail: LabelMeasuredDetail) => Message;
  /**
   * An immersive session began presenting this scene (`mode`), or ended (`mode: null`),
   * whether the app or the user (through the headset) ended it.
   */
  readonly onXRSession?: (detail: XrSessionDetail) => Message;
  /**
   * In a session, a thumbstick pushed past halfway in a direction, or let back to the
   * centre: snap turn and teleport by changing the scene's `xr({ heading, origin })`, as
   * pmndrs/xr's controller locomotion does.
   */
  readonly onXRStick?: (detail: XrStickDetail) => Message;
  /** In a session, a controller button pressed or released (`xr-standard` mapping). */
  readonly onXRButton?: (detail: XrButtonDetail) => Message;
  /**
   * In AR with `xr({ hitTest: true })`, a select whose ray met a real surface: place
   * things there.
   */
  readonly onXRSurface?: (detail: XrSurfaceDetail) => Message;
  /**
   * Gliding with the sticks (`xr({ glide })`) stopped: keep where the player now stands
   * with `glided(model.xr, detail)`.
   */
  readonly onXRMoved?: (detail: XrMovedDetail) => Message;
  /**
   * The teleport arc (`xr({ teleportArc })`) was let go over a target: where it landed and
   * where the player's origin goes, to keep in the Model (`teleported`).
   */
  readonly onXRTeleported?: (detail: XrTeleportedDetail) => Message;
  /**
   * With `xr({ poses })`, every so many seconds while presenting: where the player's head
   * and hands are, in the scene's space, to send to other players (`avatar`).
   */
  readonly onXRPoses?: (detail: XrPosesDetail) => Message;
  /**
   * With `xr({ planes: true })`, the detected planes changed (found, reshaped, lost, or
   * seen from where the player moved to): every plane, as it is now. Follow one with
   * `group({ follow: planeSpace(id) })`.
   */
  readonly onXRPlanes?: (detail: XrPlanesDetail) => Message;
  /**
   * With `xr({ meshes: true })`, the detected meshes changed: every mesh, as it is now.
   * Draw one as `mesh({ geometry: xrMesh(id), material })` inside a group that follows
   * `meshSpace(id)`: its geometry is lent to the scene, not sent.
   */
  readonly onXRMeshes?: (detail: XrMeshesDetail) => Message;
  /**
   * Frames ran persistently slow or fast, and the performance factor moved (0 to 1).
   * Store it in the Model and lower `render.resolution` with it, as Drei's
   * `PerformanceMonitor` and `AdaptiveDpr` do together.
   */
  readonly onPerformanceChange?: (detail: PerformanceDetail) => Message;
  /** A scene update was rejected; the scene keeps its last good state. */
  readonly onError?: (detail: { readonly error: SceneError }) => Message;
  /**
   * An asset the scene asks for (`scene({ assets })`) has loaded and is lent under its id:
   * at once, for one another scene loaded already. A model's parts and clips come with it.
   */
  readonly onAssetLoaded?: (detail: AssetLoadedDetail) => Message;
  /** An asset the scene asks for could not be loaded, and why. */
  readonly onAssetFailed?: (detail: AssetFailedDetail) => Message;
  /**
   * What each scene update did (operations by kind) and the GPU resources held afterwards.
   * Fires at startup and after every update that changed something, never for no-ops.
   */
  readonly onReconciled?: (detail: ReconciledDetail) => Message;
  /**
   * HTML at points in the scene, as Drei's `Html`: each `overlay` says where (a point,
   * perhaps on a node), `content` what. The scene moves the HTML there every frame it
   * draws; the content is ordinary view HTML, rendered from the Model.
   */
  readonly overlays?: ReadonlyArray<OverlayView<Message>>;
  readonly className?: string;
  /** When false, pointer and XR input is ignored until the scene is live again. */
  readonly live?: boolean;
};

/** Renders a scene element. Only the event handlers you pass are bound. */
export const view = <Message>(
  config: ViewConfig<NoInfer<Message>>,
  h: Html.H<Message>,
): View.Content<Message, Scope.Scope> => {
  let element = sceneElement(h).attr('class', config.className);
  const bind = <Detail>(
    handler: ((detail: Detail) => Message) | undefined,
    attach: (handler: (detail: Detail) => Message) => typeof element,
  ) => {
    const input = Option.fromNullishOr(handler);
    const attached = Option.map(input, attach);
    element = Option.getOrElse(attached, () => element);
  };
  bind(config.onClick, (handler) => element.on('scene-click', handler));
  bind(config.onDoubleClick, (handler) => element.on('scene-double-click', handler));
  bind(config.onContextMenu, (handler) => element.on('scene-context-menu', handler));
  bind(config.onPointerDown, (handler) => element.on('scene-pointer-down', handler));
  bind(config.onPointerUp, (handler) => element.on('scene-pointer-up', handler));
  bind(config.onPointerEnter, (handler) => element.on('scene-pointer-enter', handler));
  bind(config.onPointerMove, (handler) => element.on('scene-pointer-move', handler));
  bind(config.onPointerLeave, (handler) => element.on('scene-pointer-leave', handler));
  bind(config.onPointerMissed, (handler) => element.on('scene-pointer-missed', handler));
  bind(config.onWheel, (handler) => element.on('scene-wheel', handler));
  bind(config.onDrag, (handler) => element.on('scene-drag', handler));
  bind(config.onDragEnd, (handler) => element.on('scene-drag-end', handler));
  bind(config.onCollision, (handler) => element.on('scene-collision', handler));
  bind(config.onContactForce, (handler) => element.on('scene-contact-force', handler));
  bind(config.onPhysicsReached, (handler) => element.on('scene-physics-reached', handler));
  bind(config.onMeasured, (handler) => element.on('scene-measured', handler));
  bind(config.onLabelMeasured, (handler) => element.on('scene-label-measured', handler));
  bind(config.onXRSession, (handler) => element.on('scene-xr', handler));
  bind(config.onXRStick, (handler) => element.on('scene-xr-stick', handler));
  bind(config.onXRButton, (handler) => element.on('scene-xr-button', handler));
  bind(config.onXRSurface, (handler) => element.on('scene-xr-surface', handler));
  bind(config.onXRMoved, (handler) => element.on('scene-xr-moved', handler));
  bind(config.onXRTeleported, (handler) => element.on('scene-xr-teleported', handler));
  bind(config.onXRPoses, (handler) => element.on('scene-xr-poses', handler));
  bind(config.onXRPlanes, (handler) => element.on('scene-xr-planes', handler));
  bind(config.onXRMeshes, (handler) => element.on('scene-xr-meshes', handler));
  bind(config.onAutoRotated, (handler) => element.on('scene-auto-rotated', handler));
  bind(config.onGestureEnd, (handler) => element.on('scene-gesture-end', handler));
  bind(config.onPerformanceChange, (handler) => element.on('scene-performance', handler));
  bind(config.onError, (handler) => element.on('scene-error', handler));
  bind(config.onAssetLoaded, (handler) => element.on('scene-asset-loaded', handler));
  bind(config.onAssetFailed, (handler) => element.on('scene-asset-failed', handler));
  bind(config.onReconciled, (handler) => element.on('scene-reconciled', handler));
  bind(config.onGesture, (handler) =>
    element.on('scene-gesture', ({ gesture }) => handler(gesture)),
  );

  const overlays = config.overlays ?? [];
  const scene = withOverlays(config.scene, overlays);
  const mounted = config.mount({ scene, live: config.live ?? true });
  const lifecycle = Mount.map(mounted, config.onLifecycle);
  return element.onMount(lifecycle).children(overlayLayer(h, overlays));
};
