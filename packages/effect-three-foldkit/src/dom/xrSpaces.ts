/**
 * What a session tracks for the scene's description, each frame: where every space a
 * group follows is (`group({ follow })`), the anchors the scene placed
 * (`xr({ anchors })`), and the planes the session detected (`xr({ planes: true })`).
 *
 * Behavioural reference: pmndrs/xr at `0e1acd8`: `space.ts` `createGetXRSpaceMatrix` (an
 * object on a space takes the space's pose in the reference space each frame, and none
 * while the frame has no pose for it), `anchor.ts` `requestXRAnchor` (`frame.createAnchor`
 * with a rigid transform in the origin's reference space), `store.ts` `updateSession` (the
 * frame's `detectedPlanes` read each frame, passed on when the set changes) and `plane.ts`
 * (a plane is made again once it changes).
 *
 * @module
 */
import type {
  BodyPose,
  Vec3,
  Xr,
  XrAnchor,
  XrInput,
  XrPlane,
  XrSpace,
} from '@opsydyn/effect-three';
import { Euler, Quaternion } from 'three';

/** Places the scene's following groups where `locate` finds their spaces. */
export type Follow = (locate: (space: XrSpace) => BodyPose | undefined) => void;

export type XrSpaces = {
  /** Brings anchors and planes up to date in this frame, then places the following groups. */
  readonly frame: (frame: XRFrame, space: XRReferenceSpace) => void;
  /** Ends tracking: anchors are deleted, and every following group is hidden. */
  readonly stop: () => void;
};

const turn = new Quaternion();
const angles = new Euler();

const poseOf = (pose: XRPose | null | undefined): BodyPose | undefined => {
  if (pose === null || pose === undefined) return undefined;
  const { position: p, orientation: o } = pose.transform;
  return { position: [p.x, p.y, p.z], quaternion: [o.x, o.y, o.z, o.w] };
};

const sameVec3 = (a: Vec3, b: Vec3): boolean => a.every((value, i) => value === b[i]);

const sameAnchor = (a: XrAnchor, b: XrAnchor): boolean =>
  sameVec3(a.position, b.position) && sameVec3(a.rotation, b.rotation);

/** An anchor's place as a rigid transform: its position, its Euler rotation turned. */
const transformOf = ({ position: [x, y, z], rotation }: XrAnchor): XRRigidTransform => {
  turn.setFromEuler(angles.fromArray([...rotation]));
  return new XRRigidTransform({ x, y, z }, { x: turn.x, y: turn.y, z: turn.z, w: turn.w });
};

/** A plane as the scene's data: its pose in the scene, its outline in its own space. */
const planeOf = (id: string, plane: XRPlane, pose: BodyPose): XrPlane => {
  angles.setFromQuaternion(turn.fromArray([...pose.quaternion]));
  return {
    id,
    orientation: plane.orientation,
    label: plane.semanticLabel ?? '',
    position: pose.position,
    rotation: [angles.x, angles.y, angles.z],
    polygon: plane.polygon.map((point): Vec3 => [point.x, point.y, point.z]),
  };
};

/** A plane's report in a few characters, to tell when one changes. */
const signatureOf = (plane: XrPlane): string =>
  [plane.id, plane.orientation, plane.label, ...plane.position, ...plane.rotation]
    .concat(plane.polygon.flat())
    .join(',');

type Made = { readonly spec: XrAnchor; anchor: XRAnchor | undefined };

/**
 * Tracks the spaces `session` can locate for the description `settings()`, placing its
 * following groups with `follow` and reporting detected planes to `input`.
 */
export const trackSpaces = (
  session: XRSession,
  settings: () => Xr | null,
  follow: Follow,
  input: (input: XrInput) => void,
): XrSpaces => {
  const anchors = new Map<string, Made>();
  const planeIds = new WeakMap<XRPlane, string>();
  const planes = new Map<string, XRPlane>();
  let nextPlane = 0;
  /** The planes last reported. */
  let reported: string | undefined;

  /** Anchors made, made again where they moved, and deleted where they went. */
  const syncAnchors = (frame: XRFrame, space: XRReferenceSpace): void => {
    const wanted = settings()?.anchors ?? [];
    const seen = new Set<string>();
    for (const spec of wanted) {
      seen.add(spec.id);
      const made = anchors.get(spec.id);
      if (made !== undefined && sameAnchor(made.spec, spec)) continue;
      made?.anchor?.delete();
      const entry: Made = { spec, anchor: undefined };
      anchors.set(spec.id, entry);
      // Refused where the session lacks anchors (they are optional): never found, then.
      void frame.createAnchor?.(transformOf(spec), space).then(
        (anchor) => {
          if (anchors.get(spec.id) === entry) entry.anchor = anchor;
          else anchor.delete();
        },
        () => undefined,
      );
    }
    for (const [id, made] of anchors) {
      if (seen.has(id)) continue;
      made.anchor?.delete();
      anchors.delete(id);
    }
  };

  /**
   * Reports the detected planes when what is reported changes: one found or lost,
   * reshaped, or seen from where the player has moved to. (Compared by content, not
   * `lastChangedTime`, which some runtimes move on every frame.)
   */
  const syncPlanes = (frame: XRFrame, space: XRReferenceSpace): void => {
    planes.clear();
    if (settings()?.planes !== true || frame.detectedPlanes === undefined) return;
    const found: Array<XrPlane> = [];
    for (const plane of frame.detectedPlanes) {
      const id = planeIds.get(plane) ?? `plane-${nextPlane++}`;
      planeIds.set(plane, id);
      planes.set(id, plane);
      const pose = poseOf(frame.getPose(plane.planeSpace, space));
      if (pose !== undefined) found.push(planeOf(id, plane, pose));
    }
    const now = found.map(signatureOf).join(' ');
    if (now === reported) return;
    reported = now;
    input({ _tag: 'Planes', planes: found });
  };

  const sourceOf = (hand: string, tracked: boolean): XRInputSource | undefined => {
    for (const source of session.inputSources) {
      if (source.handedness === hand && (source.hand !== undefined) === tracked) return source;
    }
    return undefined;
  };

  const locateIn =
    (frame: XRFrame, space: XRReferenceSpace) =>
    (target: XrSpace): BodyPose | undefined => {
      switch (target._tag) {
        case 'Head':
          return poseOf(frame.getViewerPose(space));
        case 'Joint': {
          const joint = sourceOf(target.hand, true)?.hand?.get(target.joint);
          return joint === undefined ? undefined : poseOf(frame.getJointPose?.(joint, space));
        }
        case 'Controller': {
          const source = sourceOf(target.hand, false);
          const located = target.space === 'grip' ? source?.gripSpace : source?.targetRaySpace;
          return located === undefined ? undefined : poseOf(frame.getPose(located, space));
        }
        case 'Anchor': {
          const anchor = anchors.get(target.id)?.anchor;
          return anchor === undefined
            ? undefined
            : poseOf(frame.getPose(anchor.anchorSpace, space));
        }
        case 'Plane': {
          const plane = planes.get(target.id);
          return plane === undefined ? undefined : poseOf(frame.getPose(plane.planeSpace, space));
        }
      }
    };

  return {
    frame: (frame, space) => {
      syncAnchors(frame, space);
      syncPlanes(frame, space);
      follow(locateIn(frame, space));
    },
    stop: () => {
      for (const made of anchors.values()) made.anchor?.delete();
      anchors.clear();
      planes.clear();
      follow(() => undefined);
    },
  };
};
