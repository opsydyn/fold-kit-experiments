import {
  BufferGeometry,
  Float32BufferAttribute,
  type Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  Raycaster,
  RingGeometry,
  Vector3,
} from 'three';

/**
 * The teleport arc while presenting (`xr({ teleportArc })`): each frame, the arc's hand
 * aims a curve (the core's `arcAim`, eased with `easeAim`, `arcPoints`); while that hand
 * holds select, the curve is cast segment by segment at the target nodes and drawn up to
 * where it lands, with a ring there; letting go there reports a `Teleport` for the Model.
 *
 * Behavioural reference: pmndrs/xr at `0e1acd8`: `vanilla/default.ts`
 * `createDefaultXRInputSourceTeleportPointer` binds the curve to the source's select,
 * draws it only while select is held and something is met (`TeleportPointerRayModel`),
 * and teleports on the select's release over a target (`makeTeleportTarget`).
 *
 * @module
 */
import {
  arcAim,
  arcHit,
  arcPoints,
  easeAim,
  type Quat,
  teleportOrigin,
  type Vec3,
  type Xr,
  type XrInput,
  type XrTeleportArc,
} from '../../index.ts';

export type TeleportArc = {
  /** One session frame: aims the arc, and casts and draws it while select is held. */
  readonly frame: (frame: XRFrame, space: XRReferenceSpace, elapsed: number) => void;
  /** A select starting or ending on `source`: the arc's hand holds or lets go. */
  readonly selecting: (source: XRInputSource, held: boolean) => void;
  readonly stop: () => void;
};

/** Points along the arc: 21, as the core's `arcPoints`. */
const arcLength = 21;

const raycaster = new Raycaster();
const from = new Vector3();
const toward = new Vector3();

/** Where a segment from `start` to `end` first meets `targets`, if it does. */
const castAt = (targets: ReadonlyArray<Object3D>, start: Vec3, end: Vec3): Vec3 | undefined => {
  from.set(...start);
  toward.set(...end).sub(from);
  const length = toward.length();
  if (length === 0) return undefined;
  raycaster.set(from, toward.divideScalar(length));
  raycaster.far = length;
  const point = raycaster.intersectObjects([...targets], true)[0]?.point;
  return point === undefined ? undefined : [point.x, point.y, point.z];
};

/** Draws `group`'s arc and landing ring, neither of which pointers can hit. */
const makeVisual = (group: Group) => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(arcLength * 3), 3));
  const material = new LineBasicMaterial({ transparent: true, depthTest: false });
  const line = new Line(geometry, material);
  line.frustumCulled = false;
  line.renderOrder = 1;
  const ring = new Mesh(
    new RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ transparent: true, depthTest: false }),
  );
  ring.renderOrder = 1;
  line.name = 'teleport-arc';
  ring.name = 'teleport-ring';
  for (const shown of [line, ring]) {
    shown.raycast = () => undefined;
    shown.visible = false;
    group.add(shown);
  }
  return {
    show: (arc: XrTeleportArc, points: ReadonlyArray<Vec3>, landing: Vec3): void => {
      const position = geometry.getAttribute('position');
      [...points, landing].forEach((point, i) => position.setXYZ(i, ...point));
      position.needsUpdate = true;
      geometry.setDrawRange(0, points.length + 1);
      material.color.setHex(arc.color);
      material.opacity = arc.opacity;
      ring.material.color.setHex(arc.color);
      ring.material.opacity = arc.opacity;
      ring.position.set(...landing);
      line.visible = true;
      ring.visible = true;
    },
    hide: (): void => {
      line.visible = false;
      ring.visible = false;
    },
    dispose: (): void => {
      line.removeFromParent();
      ring.removeFromParent();
      geometry.dispose();
      material.dispose();
      ring.geometry.dispose();
      ring.material.dispose();
    },
  };
};

/**
 * Tracks the arc on `session`, drawing it into `group` (in the presented scene), landing
 * on the nodes `object` finds for the arc's target keys, and telling `input` where the
 * player goes when the arc is let go over one.
 */
export const trackTeleportArc = (
  session: XRSession,
  group: Group,
  settings: () => Xr | null,
  object: (key: string) => Object3D | undefined,
  input: (input: XrInput) => void,
): TeleportArc => {
  const visual = makeVisual(group);
  let aim: Quat | undefined;
  let holding: XRInputSource | undefined;
  /** Where the arc lands now, and where the player would go: sent on release. */
  let landing: { readonly point: Vec3; readonly origin: Vec3 } | undefined;

  const handOf = (): XrTeleportArc | null => settings()?.teleportArc ?? null;

  const frameWith = (
    arc: XrTeleportArc,
    frame: XRFrame,
    space: XRReferenceSpace,
    elapsed: number,
  ): void => {
    const source = [...session.inputSources].find((each) => each.handedness === arc.hand);
    const pose = source === undefined ? undefined : frame.getPose(source.targetRaySpace, space);
    if (pose === undefined || pose === null) {
      aim = undefined;
      landing = undefined;
      visual.hide();
      return;
    }
    const { position: at, orientation: turn } = pose.transform;
    const target = arcAim([turn.x, turn.y, turn.z, turn.w]);
    aim = aim === undefined ? target : easeAim(aim, target, elapsed);
    if (holding !== source) {
      landing = undefined;
      visual.hide();
      return;
    }
    const points = arcPoints([at.x, at.y, at.z], aim);
    const targets = arc.targets.flatMap((key) => object(key) ?? []);
    const hit = arcHit(points, (start, end) => castAt(targets, start, end));
    const head = frame.getViewerPose(space)?.transform.position;
    const current = settings();
    if (hit === undefined || head === undefined || current === null) {
      landing = undefined;
      visual.hide();
      return;
    }
    landing = {
      point: hit.point,
      origin: teleportOrigin(current, hit.point, [head.x, head.y, head.z]),
    };
    visual.show(arc, points.slice(0, hit.segment + 1), hit.point);
  };

  return {
    frame: (frame, space, elapsed) => {
      const arc = handOf();
      if (arc === null) {
        aim = undefined;
        landing = undefined;
        visual.hide();
        return;
      }
      frameWith(arc, frame, space, elapsed);
    },
    selecting: (source, held) => {
      const arc = handOf();
      if (arc === null || source.handedness !== arc.hand) return;
      if (held) {
        holding = source;
        return;
      }
      if (holding === source && landing !== undefined) {
        input({ _tag: 'Teleport', hand: arc.hand, ...landing });
      }
      holding = undefined;
      landing = undefined;
      visual.hide();
    },
    stop: () => visual.dispose(),
  };
};
