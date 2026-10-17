/**
 * Moving the player in an immersive session, as functions from the scene's `xr` settings
 * to new ones: the Model keeps where the player stands, and the session follows it.
 *
 * Behavioural reference: pmndrs/xr at `0e1acd8`, `controller-locomotion.ts`: the right
 * thumbstick snap-turns 45° once pushed past halfway (and must come back before turning
 * again), and the left one moves the player along where they face. Here moving is a step
 * per push, not a glide: sticks arrive as `XrStick` events when pushed and let back.
 * `teleport` is `@react-three/xr`'s `TeleportTarget`: the player stands where they point.
 *
 * @module
 */
import type { Vec3, Xr } from './description.ts';
import type { XrHand, XrStickDirection } from './xrInput.ts';

export type LocomotionOptions = {
  /** Degrees a snap turn turns by. Default 45, as pmndrs/xr's. */
  readonly snapDegrees?: number;
  /** Metres a step moves. Default 1. */
  readonly step?: number;
  /** The hand whose stick turns; the other moves. Default `right`, as pmndrs/xr's. */
  readonly turnHand?: Exclude<XrHand, 'none'>;
};

/** A step `forward` (`-1` back) and `right` (`-1` left) of the player facing `heading`. */
const stepped = (settings: Xr, forward: number, right: number): Vec3 => {
  const [x, y, z] = settings.origin;
  const sin = Math.sin(settings.heading);
  const cos = Math.cos(settings.heading);
  // Facing `heading` about +y from −z: forward is (−sin, −cos), right is (cos, −sin).
  return [x - forward * sin + right * cos, y, z - forward * cos - right * sin];
};

/**
 * The settings after a stick is pushed: the turning hand's left and right snap-turn, the
 * other hand's stick steps forward, back, left or right. Centring changes nothing.
 */
export const locomote = (
  settings: Xr,
  stick: { readonly hand: XrHand; readonly direction: XrStickDirection },
  options: LocomotionOptions = {},
): Xr => {
  const turnHand = options.turnHand ?? 'right';
  const step = options.step ?? 1;
  const snap = ((options.snapDegrees ?? 45) * Math.PI) / 180;
  if (stick.hand === turnHand) {
    if (stick.direction === 'left') return { ...settings, heading: settings.heading + snap };
    if (stick.direction === 'right') return { ...settings, heading: settings.heading - snap };
    return settings;
  }
  const moves: Readonly<Record<XrStickDirection, readonly [number, number] | undefined>> = {
    center: undefined,
    forward: [step, 0],
    back: [-step, 0],
    left: [0, -step],
    right: [0, step],
  };
  const move = moves[stick.direction];
  return move === undefined ? settings : { ...settings, origin: stepped(settings, ...move) };
};

/** The settings with the player standing at `point` (on the floor there), facing as before. */
export const teleport = (settings: Xr, point: Vec3): Xr => ({
  ...settings,
  origin: [point[0], settings.origin[1], point[2]],
});
