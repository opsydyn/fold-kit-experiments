import { expect, test } from 'bun:test';

import { PerspectiveCamera, Vector3 } from 'three';

import {
  box,
  describeScene,
  environment,
  formatSummary,
  group,
  mesh,
  moodStaging,
  moods,
  perspectiveCamera,
  pointLight,
  renderSettings,
  scene,
  shotAngles,
  shotCamera,
  sphere,
  standard,
} from '../src/kernel/index.ts';

const table = scene({
  camera: perspectiveCamera({ position: [0, 2, 6], lookAt: [0, 0, 0] }),
  environment: environment(),
  render: renderSettings({ shadows: 'soft' }),
  children: [
    mesh({
      key: 'crate',
      position: [-1, 0.5, 0],
      scale: [2, 1, 1],
      geometry: box({ width: 1, height: 1, depth: 1 }),
      material: standard({ color: 0xff8800 }),
    }),
    group({
      key: 'shelf',
      position: [2, 0, 0],
      children: [
        mesh({
          key: 'ball',
          geometry: sphere({ radius: 0.25 }),
          material: standard({ color: 0x3366ff }),
        }),
      ],
    }),
    pointLight({ key: 'lamp', position: [0, 3, 0], intensity: 5, color: 0xffeecc }),
  ],
});

test('a summary lists things with kind, size, colour and place, and lights apart', () => {
  const summary = describeScene(table);
  expect(summary.things.map((thing) => thing.key)).toEqual(['crate', 'shelf', 'ball']);
  expect(summary.things[0]).toMatchObject({
    kind: 'Mesh (Box)',
    size: [2, 1, 1],
    colour: 0xff8800,
  });
  expect(summary.things[2]).toMatchObject({
    kind: 'Mesh (Sphere)',
    parent: 'shelf',
    size: [0.5, 0.5, 0.5],
  });
  expect(summary.lights).toEqual([
    { key: 'lamp', kind: 'PointLight', colour: 0xffeecc, intensity: 5, position: [0, 3, 0] },
  ]);
  // Only top-level things of known size: the crate, 2 wide round x = −1.
  expect(summary.bounds).toEqual({ min: [-2, 0, -0.5], max: [0, 1, 0.5] });
  expect(summary.staging).toEqual(['environment lighting', 'soft shadows']);
});

test('as text, a line each, ready for a prompt', () => {
  const text = formatSummary(describeScene(table));
  expect(text.split('\n')).toEqual([
    'Camera: perspective at (0, 2, 6), looking at (0, 0, 0)',
    'Things (3), within (-2, 0, -0.5) to (0, 1, 0.5):',
    '- crate: Mesh (Box), 2 × 1 × 1, #ff8800, at (-1, 0.5, 0)',
    '- shelf: Group, at (2, 0, 0)',
    '- ball: Mesh (Sphere), 0.5 × 0.5 × 0.5, #3366ff, at (0, 0, 0) in shelf',
    'Lights (1):',
    '- lamp: PointLight, #ffeecc × 5 at (0, 3, 0)',
    'Staging: environment lighting, soft shadows',
  ]);
});

test('every shot angle keeps the whole subject in frame, looking at its middle', () => {
  const subject = { min: [-2, 0, -1], max: [1, 1.5, 0.5] } as const;
  const camera = perspectiveCamera({ fov: 45 });
  for (const angle of shotAngles) {
    const shot = shotCamera(camera, subject, angle);
    expect(shot.lookAt).toEqual([-0.5, 0.75, -0.25]);
    const host = new PerspectiveCamera(45, 16 / 10, 0.1, 1000);
    host.position.fromArray(shot.position);
    host.lookAt(...shot.lookAt);
    host.updateMatrixWorld();
    for (const x of [subject.min[0], subject.max[0]])
      for (const y of [subject.min[1], subject.max[1]])
        for (const z of [subject.min[2], subject.max[2]]) {
          const seen = new Vector3(x, y, z).project(host);
          expect(Math.abs(seen.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(seen.y)).toBeLessThanOrEqual(1);
        }
  }
  // From the front the camera is on +z; from the top, above.
  expect(shotCamera(camera, subject, 'front').position[2]).toBeGreaterThan(0.5);
  expect(shotCamera(camera, subject, 'top').position[1]).toBeGreaterThan(3);
});

test('each mood stages lights under its prefix; a sunset sun is low, a daylight one high', () => {
  for (const mood of moods) {
    const staging = moodStaging(mood, 'stage');
    expect(staging.lights.length).toBeGreaterThan(0);
    expect(staging.lights.every((light) => light.key.startsWith('stage:'))).toBe(true);
  }
  const sunHeight = (mood: 'daylight' | 'sunset') => moodStaging(mood).sky?.sunPosition[1] ?? 0;
  expect(sunHeight('sunset')).toBeLessThan(0.1);
  expect(sunHeight('sunset')).toBeGreaterThan(0);
  expect(sunHeight('daylight')).toBeGreaterThan(0.8);
});
