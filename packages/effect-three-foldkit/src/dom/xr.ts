/**
 * Presenting a scene in a WebXR session through three.js's `WebXRManager`.
 *
 * Behavioural references: React Three Fiber `core/configuration.ts` at `d74622e` (on
 * `sessionstart` enable XR and hand frames to `xr.setAnimationLoop`; on `sessionend` take
 * them back and draw again), and pmndrs/xr at `0e1acd8` (`store.ts` `setupXRManager`:
 * reference space type and framebuffer scale before `setSession`; `init.ts`
 * `buildXRSessionInit`: the reference space required, other features optional). The
 * player's origin is an offset reference space, as three.js's teleport example moves
 * the viewer. Controller selects become rays, as `@react-three/xr`'s pointers hit-test
 * along each controller's target ray.
 *
 * @module
 */
import type { Xr, XrInput } from '@opsydyn/effect-three';
import { Group, type Object3D } from 'three';

import type { PresentableRenderer } from './renderSettings.ts';
import { floorFacing, type GlidePose, glideFrame, startGlider } from './xrGlide.ts';
import { rayOf, trackInputs, type XrInputs } from './xrInputs.ts';
import { type Follow, type LendGeometry, trackSpaces } from './xrSpaces.ts';

/** Where an immersive session can come from: `navigator.xr`, or an emulator's. */
export type XrSystem = Pick<XRSystem, 'requestSession' | 'isSessionSupported'>;

/** The immersive session modes. */
export type XrMode = 'immersive-vr' | 'immersive-ar';

/**
 * The session request for a scene's settings: its reference space required, other
 * floors, hand tracking and anchors optional, and plane detection, a DOM overlay (on
 * `overlay`, the scene's element) and in AR hit testing when the scene asks for them
 * (pmndrs/xr's `buildXRSessionInit` asks for every feature it may use, optionally, and
 * roots the overlay on the element it is given). Anchors are asked for whether or not
 * the scene has any yet: it may place them mid-session.
 */
export const sessionInit = (
  settings: Xr,
  mode: XrMode = 'immersive-vr',
  overlay?: Element,
): XRSessionInit => ({
  requiredFeatures: [settings.referenceSpace],
  optionalFeatures: [
    ...['local-floor', 'bounded-floor', 'hand-tracking', 'anchors'].filter(
      (feature) => feature !== settings.referenceSpace,
    ),
    ...(settings.planes ? ['plane-detection'] : []),
    ...(settings.meshes ? ['mesh-detection'] : []),
    ...(settings.domOverlay && overlay !== undefined ? ['dom-overlay'] : []),
    ...(mode === 'immersive-ar' && settings.hitTest ? ['hit-test'] : []),
  ],
  ...(settings.domOverlay && overlay !== undefined ? { domOverlay: { root: overlay } } : {}),
});

/**
 * The offset that puts the player at `origin` facing `heading`: a reference space whose
 * poses are the device's, rotated by the heading and moved to the origin.
 */
const originOffset = (settings: GlidePose): XRRigidTransform => {
  const [x, y, z] = settings.origin;
  const half = -settings.heading / 2;
  const cos = Math.cos(-settings.heading);
  const sin = Math.sin(-settings.heading);
  // The inverse of "rotate by heading, then move to origin": rotate by −heading the point −origin.
  return new XRRigidTransform(
    { x: -x * cos - z * sin, y: -y, z: x * sin - z * cos },
    { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) },
  );
};

/**
 * Forwards each source's select as a ray in the presented space (the scene's, since the
 * reference space is offset to the player's origin); a select ending in AR also reports
 * the surface its ray met. Returns a function that stops.
 */
const listenForSelects = (
  session: XRSession,
  space: () => XRReferenceSpace | null,
  inputs: XrInputs,
  input: (input: XrInput) => void,
): (() => void) => {
  const forward = (tag: 'SelectStart' | 'SelectEnd') => (event: XRInputSourceEvent) => {
    const reference = space();
    const pose =
      reference === null
        ? undefined
        : event.frame.getPose(event.inputSource.targetRaySpace, reference);
    if (pose !== undefined && pose !== null) {
      input({ _tag: tag, source: inputs.idOf(event.inputSource), ray: rayOf(pose) });
    }
    if (tag === 'SelectEnd') inputs.selected(event.inputSource);
  };
  const started = forward('SelectStart');
  const ended = forward('SelectEnd');
  session.addEventListener('selectstart', started);
  session.addEventListener('selectend', ended);
  return () => {
    session.removeEventListener('selectstart', started);
    session.removeEventListener('selectend', ended);
  };
};

export type Presentation = {
  /** Applies new settings mid-session: a new origin or heading moves the player. */
  readonly update: (settings: Xr) => void;
  readonly session: XRSession;
};

/** What a session presents: the scene, and how it is drawn, followed and told of input. */
export type Presented = {
  readonly scene: Object3D;
  readonly draw: () => void;
  /** Places the groups that follow tracked spaces (`group({ follow })`). */
  readonly follow: Follow;
  /** Lends detected meshes' geometry to the scene (`xrMesh(id)`). */
  readonly lend: LendGeometry;
  readonly input: (input: XrInput) => void;
};

/**
 * Presents into `session`: frames come from the session (each read for input and the
 * spaces groups follow, then drawn) until it ends, when `ended` is called and the page's
 * own frames take over again. Input sources are drawn into the scene while it presents.
 */
export const present = async (
  renderer: PresentableRenderer,
  session: XRSession,
  settings: Xr,
  presented: Presented,
  ended: () => void,
): Promise<Presentation> => {
  const { scene, draw, input } = presented;
  const { xr } = renderer;
  xr.enabled = true;
  xr.setReferenceSpaceType(settings.referenceSpace);
  xr.setFramebufferScaleFactor(settings.framebufferScale);
  let inputs: XrInputs | undefined;
  const spaces = trackSpaces(session, () => current, presented.follow, input, presented.lend);
  let current = settings;
  // Gliding (`xr({ glide })`) moves the player from the description's place; the
  // description wins again whenever it changes.
  let glider = startGlider({ origin: settings.origin, heading: settings.heading });
  let lastTime: number | undefined;
  let base: XRReferenceSpace | null = null;
  const place = (pose: GlidePose): void => {
    if (base !== null) xr.setReferenceSpace(base.getOffsetReferenceSpace(originOffset(pose)));
  };

  /** One frame of gliding, when the description asks for it. */
  const glideStep = (time: number, frame: XRFrame, space: XRReferenceSpace): void => {
    const seconds = Math.min(0.1, Math.max(0, (time - (lastTime ?? time)) / 1000));
    lastTime = time;
    if (current.glide === null || inputs === undefined) return;
    const head = frame.getViewerPose(space);
    const facing = floorFacing(head?.transform.orientation ?? { x: 0, y: 0, z: 0, w: 1 });
    const { left, right } = inputs.sticks();
    const next = glideFrame(glider, current.glide, { move: left, turn: right }, facing, seconds);
    if (next.glider.pose !== glider.pose) place(next.glider.pose);
    glider = next.glider;
    if (next.stopped !== undefined) input({ _tag: 'Moved', ...next.stopped });
  };

  /** One session frame: its input read, then drawn. Frames outside the session are skipped. */
  function sessionFrame(time: number, frame?: XRFrame): void {
    if (!xr.isPresenting) return;
    const space = xr.getReferenceSpace();
    if (frame !== undefined && space !== null) {
      inputs?.frame(frame, space);
      glideStep(time, frame, space);
      // After gliding, so the spaces are where the player now stands.
      spaces.frame(frame, xr.getReferenceSpace() ?? space);
    }
    draw();
  }
  // Set before the session starts (WebGPU's XR manager takes the loop then).
  renderer.setXrLoop(sessionFrame);
  await xr.setSession(session);
  base = xr.getReferenceSpace();
  place(glider.pose);
  const shown = new Group();
  shown.name = 'xr-inputs';
  scene.add(shown);
  const tracked = trackInputs(session, shown, () => current, input);
  inputs = tracked;
  const stopSelects = listenForSelects(session, () => xr.getReferenceSpace(), tracked, input);
  session.addEventListener(
    'end',
    () => {
      stopSelects();
      tracked.stop();
      spaces.stop();
      shown.removeFromParent();
      renderer.setXrLoop(null);
      xr.enabled = false;
      ended();
    },
    { once: true },
  );
  return {
    session,
    update: (next) => {
      const moved =
        next.origin.some((value, i) => value !== current.origin[i]) ||
        next.heading !== current.heading;
      current = next;
      if (!moved) return;
      glider = startGlider({ origin: next.origin, heading: next.heading });
      place(glider.pose);
    },
  };
};
