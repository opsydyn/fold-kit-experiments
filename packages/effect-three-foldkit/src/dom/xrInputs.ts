/**
 * A session's input sources, each frame: where each points (`Aim`), its gamepad's sticks
 * and buttons, in AR where its ray meets a real surface, and drawing its ray and a hand's
 * joints into the presented scene.
 *
 * Behavioural references: pmndrs/xr at `0e1acd8` (`packages/xr/src/pointer` ray-casts
 * along every source's target ray each frame; `controller-locomotion.ts` reads the
 * `xr-standard` thumbstick, axes 2 and 3, forward negative; `hit-test.ts` requests a hit
 * test source per space and reads `getHitTestResults` each frame), and three.js's
 * `XRHandPrimitiveModel` at 0.186.1 (a sphere per hand joint, sized by its radius).
 *
 * @module
 */
import type {
  Ray,
  Vec3,
  Xr,
  XrButtonName,
  XrHand,
  XrInput,
  XrStickDirection,
} from '@opsydyn/effect-three';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';

/** A target ray pose as a ray in the reference space: from its position along its −z. */
export const rayOf = (pose: XRPose): Ray => {
  const { position, orientation } = pose.transform;
  const { x, y, z, w } = orientation;
  // −z rotated by the orientation quaternion.
  return {
    origin: [position.x, position.y, position.z],
    direction: [-2 * (x * z + w * y), -2 * (y * z - w * x), -(1 - 2 * (x * x + y * y))],
  };
};

/** The `xr-standard` mapping's buttons, by index. */
const buttonNames: ReadonlyArray<XrButtonName> = [
  'trigger',
  'squeeze',
  'touchpad',
  'thumbstick',
  'primary',
  'secondary',
];

/** Past this far a stick is pushed; back under the lower mark it is centred again. */
const stickThresholds = { push: 0.6, release: 0.3 } as const;

/** Where a stick at `(x, y)` points, keeping `previous` until it clearly changes. */
export const stickDirection = (
  x: number,
  y: number,
  previous: XrStickDirection,
): XrStickDirection => {
  if (Math.max(Math.abs(x), Math.abs(y)) < stickThresholds.release) return 'center';
  if (Math.max(Math.abs(x), Math.abs(y)) < stickThresholds.push) return previous;
  if (Math.abs(x) >= Math.abs(y)) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'forward' : 'back';
};

const handOf = (source: XRInputSource): XrHand => source.handedness;

/** What the visuals show: a line along each ray, spheres on each hand's joints. */
const rayLength = 1.5;
const jointCount = 25;
const rayMaterial = new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
const jointMaterial = new MeshBasicMaterial({ color: 0xe8e4dc });
const jointGeometry = new SphereGeometry(1, 10, 8);

type Visual = { readonly ray: Line; readonly joints: InstancedMesh | undefined };

const makeVisual = (source: XRInputSource, group: Group): Visual => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, -rayLength], 3));
  const ray = new Line(geometry, rayMaterial);
  ray.raycast = () => undefined;
  ray.matrixAutoUpdate = false;
  group.add(ray);
  const joints =
    source.hand === undefined
      ? undefined
      : new InstancedMesh(jointGeometry, jointMaterial, jointCount);
  if (joints !== undefined) {
    joints.raycast = () => undefined;
    joints.frustumCulled = false;
    group.add(joints);
  }
  return { ray, joints };
};

const disposeVisual = (visual: Visual): void => {
  visual.ray.removeFromParent();
  visual.ray.geometry.dispose();
  visual.joints?.removeFromParent();
  visual.joints?.dispose();
};

const matrix = new Matrix4();
const up = new Vector3(0, 1, 0);
const position = new Vector3();
const turn = new Quaternion();
const size = new Vector3();

/** Places a hand's joint spheres from this frame's joint poses. */
const placeJoints = (
  joints: InstancedMesh,
  hand: XRHand,
  frame: XRFrame,
  space: XRReferenceSpace,
): void => {
  let slot = 0;
  for (const jointSpace of hand.values()) {
    const pose = frame.getJointPose?.(jointSpace, space);
    if (pose !== undefined && pose !== null && slot < jointCount) {
      const { x, y, z } = pose.transform.position;
      const o = pose.transform.orientation;
      const radius = pose.radius ?? 0.008;
      matrix.compose(position.set(x, y, z), turn.set(o.x, o.y, o.z, o.w), size.setScalar(radius));
      joints.setMatrixAt(slot, matrix);
      slot++;
    }
  }
  joints.count = slot;
  joints.instanceMatrix.needsUpdate = true;
};

type Tracked = {
  readonly id: number;
  visual: Visual | undefined;
  stick: XrStickDirection;
  /** The thumbstick's axes this frame, `[x, y]`. */
  axes: readonly [number, number];
  readonly pressed: Array<boolean>;
  hitTest: XRHitTestSource | undefined;
  /** Where its ray last met a real surface. */
  surface: { readonly point: Vec3; readonly normal: Vec3 } | undefined;
};

/** A hit test result's pose as a point and the surface's normal (the pose's +y). */
const surfaceOf = (pose: XRPose): { readonly point: Vec3; readonly normal: Vec3 } => {
  const { position: p, orientation: q } = pose.transform;
  // +y rotated by the orientation quaternion.
  return {
    point: [p.x, p.y, p.z],
    normal: [
      2 * (q.x * q.y - q.w * q.z),
      1 - 2 * (q.x * q.x + q.z * q.z),
      2 * (q.y * q.z + q.w * q.x),
    ],
  };
};

export type XrInputs = {
  /** Reads every input source in this frame, in `space` (the scene's). */
  readonly frame: (frame: XRFrame, space: XRReferenceSpace) => void;
  /** A source's id, the same for its selects as for its aims. */
  readonly idOf: (source: XRInputSource) => number;
  /** A select ended: in AR with hit tests, report where its ray met a surface. */
  readonly selected: (source: XRInputSource) => void;
  /** Ends tracking: every source is lost, and the visuals go. */
  readonly stop: () => void;
  /** Each hand's thumbstick this frame (`[0, 0]` without one). */
  readonly sticks: () => {
    readonly left: readonly [number, number];
    readonly right: readonly [number, number];
  };
};

/**
 * Tracks `session`'s input sources, sending what they do to `input` and drawing them into
 * `group` (added to the presented scene) while `settings().showInputs`.
 */
export const trackInputs = (
  session: XRSession,
  group: Group,
  settings: () => Xr | null,
  input: (input: XrInput) => void,
): XrInputs => {
  const tracked = new Map<XRInputSource, Tracked>();
  let nextId = 0;

  const trackedOf = (source: XRInputSource): Tracked => {
    const known = tracked.get(source);
    if (known !== undefined) return known;
    const created: Tracked = {
      id: nextId++,
      visual: undefined,
      stick: 'center',
      axes: [0, 0],
      pressed: [],
      hitTest: undefined,
      surface: undefined,
    };
    tracked.set(source, created);
    if (settings()?.hitTest === true && session.requestHitTestSource !== undefined) {
      // Refused where the session lacks hit testing (it is optional): no surfaces, then.
      void session.requestHitTestSource({ space: source.targetRaySpace })?.then(
        (hitTest) => {
          if (tracked.get(source) === created) created.hitTest = hitTest;
          else hitTest.cancel();
        },
        () => undefined,
      );
    }
    return created;
  };

  const forget = (source: XRInputSource, state: Tracked): void => {
    tracked.delete(source);
    if (state.visual !== undefined) disposeVisual(state.visual);
    state.hitTest?.cancel();
    input({ _tag: 'Lost', source: state.id });
  };

  const gamepad = (source: XRInputSource, state: Tracked): void => {
    const pad = source.gamepad;
    if (pad === undefined || pad === null || pad.mapping !== 'xr-standard') return;
    const hand = handOf(source);
    buttonNames.forEach((button, index) => {
      const pressed = pad.buttons[index]?.pressed ?? false;
      if (pressed !== (state.pressed[index] ?? false)) {
        state.pressed[index] = pressed;
        input({ _tag: 'Button', source: state.id, hand, button, pressed });
      }
    });
    state.axes = [pad.axes[2] ?? 0, pad.axes[3] ?? 0];
    const direction = stickDirection(state.axes[0], state.axes[1], state.stick);
    if (direction !== state.stick) {
      state.stick = direction;
      input({ _tag: 'Stick', source: state.id, hand, direction });
    }
  };

  const show = (
    source: XRInputSource,
    state: Tracked,
    ray: Ray,
    frame: XRFrame,
    space: XRReferenceSpace,
  ) => {
    if (settings()?.showInputs !== true) {
      if (state.visual !== undefined) disposeVisual(state.visual);
      state.visual = undefined;
      return;
    }
    state.visual ??= makeVisual(source, group);
    const [ox, oy, oz] = ray.origin;
    const [dx, dy, dz] = ray.direction;
    // Turn −z (along which the line runs) to the ray: lookAt points +z from the target.
    matrix.lookAt(position.set(0, 0, 0), size.set(dx, dy, dz), up);
    matrix.setPosition(ox, oy, oz);
    state.visual.ray.matrix.copy(matrix);
    // A tracked hand points from its wrist; its joints show where it is, not a ray.
    state.visual.ray.visible = source.hand === undefined;
    if (state.visual.joints !== undefined && source.hand !== undefined) {
      placeJoints(state.visual.joints, source.hand, frame, space);
    }
  };

  return {
    frame: (frame, space) => {
      const present = new Set<XRInputSource>();
      for (const source of session.inputSources) {
        present.add(source);
        const state = trackedOf(source);
        const pose = frame.getPose(source.targetRaySpace, space);
        if (pose !== undefined && pose !== null) {
          const ray = rayOf(pose);
          input({ _tag: 'Aim', source: state.id, ray });
          show(source, state, ray, frame, space);
        }
        gamepad(source, state);
        if (state.hitTest !== undefined) {
          const result = frame.getHitTestResults(state.hitTest)[0]?.getPose(space);
          state.surface = result === undefined || result === null ? undefined : surfaceOf(result);
        }
      }
      for (const [source, state] of tracked) if (!present.has(source)) forget(source, state);
    },
    idOf: (source) => trackedOf(source).id,
    selected: (source) => {
      const state = tracked.get(source);
      if (state?.surface === undefined) return;
      input({ _tag: 'Surface', source: state.id, hand: handOf(source), ...state.surface });
    },
    sticks: () => {
      const axesOf = (hand: XrHand): readonly [number, number] => {
        for (const [source, state] of tracked) if (source.handedness === hand) return state.axes;
        return [0, 0];
      };
      return { left: axesOf('left'), right: axesOf('right') };
    },
    stop: () => {
      for (const [source, state] of tracked) forget(source, state);
    },
  };
};
