/**
 * Presenting a scene in a WebXR session through three.js's `WebXRManager`.
 *
 * Behavioural references: React Three Fiber `core/configuration.ts` at `d74622e` (on
 * `sessionstart` enable XR and hand frames to `xr.setAnimationLoop`; on `sessionend` take
 * them back and draw again), and pmndrs/xr at `0e1acd8` (`store.ts` `setupXRManager`:
 * reference space type and framebuffer scale before `setSession`; `init.ts`
 * `buildXRSessionInit`: the reference space required, other features optional). The
 * player's origin is an offset reference space, as three.js's teleport example moves
 * the viewer.
 *
 * @module
 */
import type { Xr } from '@opsydyn/effect-three';
import type { WebGLRenderer } from 'three';

/** Where an immersive session can come from: `navigator.xr`, or an emulator's. */
export type XrSystem = Pick<XRSystem, 'requestSession' | 'isSessionSupported'>;

/** The session request for a scene's settings: its reference space required. */
export const sessionInit = (settings: Xr): XRSessionInit => ({
  requiredFeatures: [settings.referenceSpace],
  optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'].filter(
    (feature) => feature !== settings.referenceSpace,
  ),
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

export type Presentation = {
  /** Applies new settings mid-session: a new origin or heading moves the player. */
  readonly update: (settings: Xr) => void;
  readonly session: XRSession;
};

/**
 * Presents into `session`: frames come from the session (`draw` is called for each) until
 * it ends, when `ended` is called and the page's own frames take over again.
 */
export const present = async (
  renderer: WebGLRenderer,
  session: XRSession,
  settings: Xr,
  draw: () => void,
  ended: () => void,
): Promise<Presentation> => {
  const { xr } = renderer;
  xr.enabled = true;
  xr.setReferenceSpaceType(settings.referenceSpace);
  xr.setFramebufferScaleFactor(settings.framebufferScale);
  await xr.setSession(session);
  const base = xr.getReferenceSpace();
  let current = settings;
  const place = (next: Xr): void => {
    current = next;
    if (base !== null) xr.setReferenceSpace(base.getOffsetReferenceSpace(originOffset(next)));
  };
  place(settings);
  xr.setAnimationLoop(draw);
  session.addEventListener(
    'end',
    () => {
      xr.setAnimationLoop(null);
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
      if (moved) place(next);
    },
  };
};
