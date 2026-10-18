import { expect, test } from 'bun:test';

import {
  anchorSpace,
  type BodyPose,
  controllerSpace,
  headSpace,
  jointSpace,
  planeSpace,
  xr,
  xrAnchor,
  type XrInput,
  type XrSpace,
} from '@opsydyn/effect-three';

import { sessionInit } from '../src/dom/xr.ts';
import { trackSpaces } from '../src/dom/xrSpaces.ts';

/** Only a session has rigid transforms; this one keeps what it was made with. */
class RigidTransform {
  readonly position: DOMPointInit;
  readonly orientation: DOMPointInit;
  constructor(position: DOMPointInit, orientation: DOMPointInit) {
    this.position = position;
    this.orientation = orientation;
  }
}
Object.assign(globalThis, { XRRigidTransform: RigidTransform });

/** A space, by name, at a position (identity orientation). */
type Space = { readonly name: string; readonly at: readonly [number, number, number] };
const space = (name: string, at: readonly [number, number, number]): Space => ({ name, at });

const poseAt = ({ at: [x, y, z] }: Space) => ({
  transform: { position: { x, y, z, w: 1 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
});

const reference = space('reference', [0, 0, 0]);

type FakePlane = {
  readonly planeSpace: Space;
  readonly orientation: 'horizontal' | 'vertical';
  readonly polygon: ReadonlyArray<{ x: number; y: number; z: number }>;
  lastChangedTime: number;
  readonly semanticLabel?: string;
};

const fakes = () => {
  const deleted: Array<string> = [];
  const made: Array<RigidTransform> = [];
  const planes = new Set<FakePlane>();
  const index = space('index', [0.1, 1.2, -0.3]);
  const grip = space('grip', [0.3, 1, -0.2]);
  const hand = { handedness: 'right', hand: new Map([['index-finger-tip', index]]) };
  const controller = { handedness: 'left', hand: undefined, gripSpace: grip, targetRaySpace: grip };
  const session = { inputSources: [hand, controller] };
  const frame = {
    getViewerPose: () => poseAt(space('head', [0, 1.6, 0])),
    getJointPose: (joint: Space) => poseAt(joint),
    getPose: (located: Space) => poseAt(located),
    createAnchor: (transform: RigidTransform) => {
      made.push(transform);
      const { x = 0, y = 0, z = 0 } = transform.position;
      const anchorSpace = space(`anchor-${made.length}`, [x, y, z]);
      return Promise.resolve({ anchorSpace, delete: () => deleted.push(anchorSpace.name) });
    },
    detectedPlanes: planes,
  };
  return {
    session: session as unknown as XRSession,
    frame: frame as unknown as XRFrame,
    space: reference as unknown as XRReferenceSpace,
    planes,
    made,
    deleted,
  };
};

const rounded = (pose: BodyPose | undefined) =>
  pose?.position.map((v) => Math.round(v * 1e6) / 1e6);

test('the session asks for anchors always, and planes and an overlay when the scene does', () => {
  const overlay = { tagName: 'EFFECT-THREE-SCENE' } as unknown as Element;
  const plain = sessionInit(xr(), 'immersive-ar', overlay);
  expect(plain.optionalFeatures).toContain('anchors');
  expect(plain.optionalFeatures).not.toContain('plane-detection');
  expect(plain.optionalFeatures).not.toContain('dom-overlay');
  expect(plain.domOverlay).toBeUndefined();
  const asking = sessionInit(xr({ planes: true, domOverlay: true }), 'immersive-ar', overlay);
  expect(asking.optionalFeatures).toEqual(
    expect.arrayContaining(['plane-detection', 'dom-overlay']),
  );
  expect(asking.domOverlay?.root).toBe(overlay);
});

test('heads, joints and controllers are located in the frame; what is missing is not', () => {
  const { session, frame, space: inSpace } = fakes();
  const located = new Map<string, BodyPose | undefined>();
  const asked: ReadonlyArray<readonly [string, XrSpace]> = [
    ['head', headSpace()],
    ['tip', jointSpace('right', 'index-finger-tip')],
    ['wrist', jointSpace('right', 'wrist')],
    ['left grip', controllerSpace('left')],
    ['right grip', controllerSpace('right')],
    ['anchor', anchorSpace('nowhere')],
  ];
  const spaces = trackSpaces(
    session,
    () => xr(),
    (locate) => {
      for (const [name, target] of asked) located.set(name, locate(target));
    },
    () => undefined,
  );
  spaces.frame(frame, inSpace);
  expect(rounded(located.get('head'))).toEqual([0, 1.6, 0]);
  expect(rounded(located.get('tip'))).toEqual([0.1, 1.2, -0.3]);
  expect(located.get('wrist')).toBeUndefined();
  expect(rounded(located.get('left grip'))).toEqual([0.3, 1, -0.2]);
  // The right hand is tracked as a hand, not held as a controller.
  expect(located.get('right grip')).toBeUndefined();
  expect(located.get('anchor')).toBeUndefined();
});

test('anchors are made where the scene puts them, again when moved, deleted when gone', async () => {
  const { session, frame, space: inSpace, made, deleted } = fakes();
  let settings = xr({ anchors: [xrAnchor({ id: 'a1', position: [1, 0, -1] })] });
  let found: BodyPose | undefined;
  const spaces = trackSpaces(
    session,
    () => settings,
    (locate) => {
      found = locate(anchorSpace('a1'));
    },
    () => undefined,
  );
  spaces.frame(frame, inSpace);
  // Made this frame; found once the session has made it.
  expect(made).toHaveLength(1);
  expect(found).toBeUndefined();
  await Promise.resolve();
  spaces.frame(frame, inSpace);
  expect(rounded(found)).toEqual([1, 0, -1]);
  // The same anchor again is left alone.
  spaces.frame(frame, inSpace);
  expect(made).toHaveLength(1);
  settings = xr({ anchors: [xrAnchor({ id: 'a1', position: [2, 0, -1] })] });
  spaces.frame(frame, inSpace);
  expect(made).toHaveLength(2);
  expect(deleted).toEqual(['anchor-1']);
  await Promise.resolve();
  settings = xr();
  spaces.frame(frame, inSpace);
  expect(deleted).toEqual(['anchor-1', 'anchor-2']);
  spaces.stop();
});

test('planes are reported when found and when they change, and can be followed', () => {
  const { session, frame, space: inSpace, planes } = fakes();
  const reports: Array<XrInput> = [];
  let followed: BodyPose | undefined;
  const spaces = trackSpaces(
    session,
    () => xr({ planes: true }),
    (locate) => {
      followed = locate(planeSpace('plane-0'));
    },
    (input) => reports.push(input),
  );
  spaces.frame(frame, inSpace);
  expect(reports).toEqual([{ _tag: 'Planes', planes: [] }]);
  const table: FakePlane = {
    planeSpace: space('table', [0, 0.7, -1]),
    orientation: 'horizontal',
    polygon: [
      { x: -0.5, y: 0, z: -0.5 },
      { x: 0.5, y: 0, z: -0.5 },
      { x: 0.5, y: 0, z: 0.5 },
    ],
    lastChangedTime: 1,
    semanticLabel: 'table',
  };
  planes.add(table);
  spaces.frame(frame, inSpace);
  spaces.frame(frame, inSpace);
  expect(reports).toHaveLength(2);
  const report = reports[1];
  const plane = report?._tag === 'Planes' ? report.planes[0] : undefined;
  expect(plane).toMatchObject({
    id: 'plane-0',
    orientation: 'horizontal',
    label: 'table',
    position: [0, 0.7, -1],
    polygon: [
      [-0.5, 0, -0.5],
      [0.5, 0, -0.5],
      [0.5, 0, 0.5],
    ],
  });
  expect(plane?.rotation.map(Math.abs)).toEqual([0, 0, 0]);
  expect(rounded(followed)).toEqual([0, 0.7, -1]);
  // Seen again unchanged (some runtimes move `lastChangedTime` every frame): not reported.
  table.lastChangedTime = 2;
  spaces.frame(frame, inSpace);
  expect(reports).toHaveLength(2);
  planes.delete(table);
  spaces.frame(frame, inSpace);
  expect(reports.at(-1)).toEqual({ _tag: 'Planes', planes: [] });
  // Ending hides every following group.
  spaces.stop();
  expect(followed).toBeUndefined();
});
