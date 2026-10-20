/**
 * Builds the sample robot from three.js primitives and writes it as a GLB, so the samples
 * and tests use a model we made ourselves (no third-party asset licences).
 *
 *   bun scripts/make-robot.ts <out.glb> [more.glb ...]
 *   DETAIL=low bun scripts/make-robot.ts <out-low.glb> ...   # a coarse level, few facets
 *
 * Parts are named (hits report them as `part`); clips: `wave` (the arm) and `roll` (the
 * wheels). GLTFExporter needs FileReader, which Bun lacks, so a minimal one is provided.
 */
import {
  AnimationClip,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  QuaternionKeyframeTrack,
  SphereGeometry,
  Vector3,
} from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

class MinimalFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
}
Reflect.set(globalThis, 'FileReader', MinimalFileReader);

/** A coarse level (`DETAIL=low`) has the same parts and clips, in a handful of facets. */
const low = process.env['DETAIL'] === 'low';
const round = low ? { width: 6, height: 4, around: 6 } : { width: 32, height: 16, around: 32 };

const paint = (color: number, roughness = 0.5, metalness = 0.1) =>
  new MeshStandardMaterial({ color, roughness, metalness });

const part = (name: string, mesh: Mesh, x: number, y: number, z: number): Mesh => {
  mesh.name = name;
  mesh.position.set(x, y, z);
  return mesh;
};

const robot = new Group();
robot.name = 'robot';
robot.add(part('body', new Mesh(new BoxGeometry(1, 1.1, 0.7), paint(0x3d79fa)), 0, 0.95, 0));
robot.add(
  part(
    'head',
    new Mesh(new SphereGeometry(0.36, round.width, round.height), paint(0xb3c9fc)),
    0,
    1.78,
    0,
  ),
);
robot.add(
  part(
    'eye-left',
    new Mesh(new SphereGeometry(0.07, round.width, round.height), paint(0x1a1a2e)),
    -0.13,
    1.82,
    0.31,
  ),
);
robot.add(
  part(
    'eye-right',
    new Mesh(new SphereGeometry(0.07, round.width, round.height), paint(0x1a1a2e)),
    0.13,
    1.82,
    0.31,
  ),
);
const antenna = part(
  'antenna',
  new Mesh(new CylinderGeometry(0.03, 0.03, 0.4), paint(0xf5ce60)),
  0,
  2.28,
  0,
);
robot.add(antenna);

// The arm pivots at the shoulder, so the clip rotates the pivot, not the mesh.
const shoulder = new Group();
shoulder.name = 'shoulder';
shoulder.position.set(0.62, 1.35, 0);
shoulder.add(part('arm', new Mesh(new BoxGeometry(0.2, 0.75, 0.2), paint(0xfa8b79)), 0, -0.3, 0));
robot.add(shoulder);
robot.add(
  part('arm-left', new Mesh(new BoxGeometry(0.2, 0.75, 0.2), paint(0xfa8b79)), -0.62, 1.05, 0),
);

const wheel = (name: string, x: number) => {
  const mesh = new Mesh(
    new CylinderGeometry(0.3, 0.3, 0.18, round.around),
    paint(0x2a2a3a, 0.8, 0),
  );
  mesh.rotation.z = Math.PI / 2;
  const hub = new Group();
  hub.name = name;
  hub.position.set(x, 0.3, 0);
  hub.add(mesh);
  return hub;
};
robot.add(wheel('wheel-left', -0.5), wheel('wheel-right', 0.5));

const turn = (axis: Vector3, angle: number) =>
  new Quaternion().setFromAxisAngle(axis, angle).toArray();
const x = new Vector3(1, 0, 0);
const z = new Vector3(0, 0, 1);

robot.animations = [
  new AnimationClip('wave', 1.6, [
    new QuaternionKeyframeTrack(
      'shoulder.quaternion',
      [0, 0.4, 0.8, 1.2, 1.6],
      [...turn(z, 0), ...turn(z, 2.6), ...turn(z, 2.1), ...turn(z, 2.6), ...turn(z, 0)],
    ),
  ]),
  new AnimationClip('roll', 1, [
    new QuaternionKeyframeTrack(
      'wheel-left.quaternion',
      [0, 0.5, 1],
      [...turn(x, 0), ...turn(x, Math.PI), ...turn(x, 2 * Math.PI)],
    ),
    new QuaternionKeyframeTrack(
      'wheel-right.quaternion',
      [0, 0.5, 1],
      [...turn(x, 0), ...turn(x, Math.PI), ...turn(x, 2 * Math.PI)],
    ),
  ]),
];

const glb = await new GLTFExporter().parseAsync(robot, {
  binary: true,
  animations: robot.animations,
});
if (!(glb instanceof ArrayBuffer)) throw new Error('expected binary GLB output');
for (const path of process.argv.slice(2)) {
  await Bun.write(path, glb);
  console.log('wrote', path, glb.byteLength, 'bytes');
}
