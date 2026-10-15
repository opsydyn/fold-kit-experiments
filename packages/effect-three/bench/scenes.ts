/** Benchmark scenes: `count` interactive meshes in groups of ten, sharing resources. */
import {
  box,
  ease,
  group,
  mesh,
  scene,
  type SceneDescription,
  sharedGeometry,
  sharedMaterial,
  spin,
  standard,
} from '../src/kernel/index.ts';

const resources = {
  geometries: [{ id: 'box', geometry: box() }],
  materials: [{ id: 'paint', material: standard({ color: 0x3366ff }) }],
};

const endless = ease({ seconds: 1e9, easing: 'linear' });

function benchMesh(index: number, column: number, row: number, changedIndex: number) {
  return mesh({
    key: `m${index}`,
    position: [index === changedIndex || changedIndex === -2 ? 1 : 0, column, row],
    transition: endless,
    geometry: sharedGeometry('box'),
    material: sharedMaterial('paint'),
    interactive: true,
  });
}

/**
 * `count` meshes in groups of ten. Every mesh eases position changes, so moving all of
 * them (`changedIndex = -2`) leaves `count` tweens in flight for the length of a run.
 */
export const wideScene = (count: number, changedIndex = -1): SceneDescription =>
  scene({
    resources,
    children: Array.from({ length: Math.ceil(count / 10) }, (_, row) =>
      group({
        key: `g${row}`,
        children: Array.from({ length: Math.min(10, count - row * 10) }, (_, column) =>
          benchMesh(row * 10 + column, column, row, changedIndex),
        ),
      }),
    ),
  });

export const spinningCube = scene({
  resources,
  children: [
    mesh({
      key: 'cube',
      geometry: sharedGeometry('box'),
      material: sharedMaterial('paint'),
      rotation: spin({ axis: 'y', radiansPerSecond: 1 }),
      interactive: true,
    }),
  ],
});
