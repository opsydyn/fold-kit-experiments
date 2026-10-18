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
import { rayOf, trackInputs, type XrInputs } from './xrInputs.ts';

/** Where an immersive session can come from: `navigator.xr`, or an emulator's. */
export type XrSystem = Pick<XRSystem, 'requestSession' | 'isSessionSupported'>;

/** The immersive session modes. */
export type XrMode = 'immersive-vr' | 'immersive-ar';

/**
 * The session request for a scene's settings: its reference space required, other
 * floors and hand tracking optional, and in AR hit testing when the scene asks for it
 * (pmndrs/xr's `buildXRSessionInit` asks for every feature it may use, optionally).
 */
export const sessionInit = (settings: Xr, mode: XrMode = 'immersive-vr'): XRSessionInit => ({
  requiredFeatures: [settings.referenceSpace],
  optionalFeatures: [
    ...['local-floor', 'bounded-floor', 'hand-tracking'].filter(
      (feature) => feature !== settings.referenceSpace,
    ),
    ...(mode === 'immersive-ar' && settings.hitTest ? ['hit-test'] : []),
  ],
});

/**
 * The offset that puts the player at `origin` facing `heading`: a reference space whose
 * poses are the device's, rotated by the heading and moved to the origin.
 */
const originOffset = (settings: Xr): XRRigidTransform => {
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

/**
 * Presents into `session`: frames come from the session (each read for input, then drawn
 * with `draw`) until it ends, when `ended` is called and the page's own frames take over
 * again. Input sources are drawn into `scene` while it presents.
 */
export const present = async (
  renderer: PresentableRenderer,
  session: XRSession,
  settings: Xr,
  scene: Object3D,
  draw: () => void,
  input: (input: XrInput) => void,
  ended: () => void,
): Promise<Presentation> => {
  const { xr } = renderer;
  xr.enabled = true;
  xr.setReferenceSpaceType(settings.referenceSpace);
  xr.setFramebufferScaleFactor(settings.framebufferScale);
  let inputs: XrInputs | undefined;
  /** One session frame: its input read, then drawn. Frames outside the session are skipped. */
  function sessionFrame(_time: number, frame?: XRFrame): void {
    if (!xr.isPresenting) return;
    const space = xr.getReferenceSpace();
    if (frame !== undefined && space !== null) inputs?.frame(frame, space);
    draw();
  }
  // Set before the session starts (WebGPU's XR manager takes the loop then).
  renderer.setXrLoop(sessionFrame);
  await xr.setSession(session);
  const base = xr.getReferenceSpace();
  let current = settings;
  const place = (next: Xr): void => {
    if (base !== null) xr.setReferenceSpace(base.getOffsetReferenceSpace(originOffset(next)));
  };
  place(settings);
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
      if (moved) place(next);
    },
  };
};
