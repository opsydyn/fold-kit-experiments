/**
 * A scene derived from a Model: plain data, keyed so the kernel keeps each crate's
 * three.js object while it moves, recolours or is reordered. Nothing here touches the
 * DOM, a renderer or Effect: the same function feeds a Foldkit view or a headless test.
 */
import {
  ambientLight,
  box,
  directionalLight,
  mesh,
  perspectiveCamera,
  type SceneDescription,
  scene,
  sharedGeometry,
  standard,
} from '@opsydyn/effect-three/kernel';

export type Crate = { readonly id: string; readonly x: number; readonly colour: number };

export type Model = {
  readonly crates: ReadonlyArray<Crate>;
  /** The crate a click selected, raised half a unit. */
  readonly selected: string | null;
};

export const model: Model = {
  crates: [
    { id: 'a', x: -1.5, colour: 0x14b8a6 },
    { id: 'b', x: 0, colour: 0xf59e0b },
    { id: 'c', x: 1.5, colour: 0x6366f1 },
  ],
  selected: null,
};

export const sceneFor = (current: Model): SceneDescription =>
  scene({
    camera: perspectiveCamera({ position: [0, 2, 6], lookAt: [0, 0, 0], damping: 0.1 }),
    resources: { geometries: [{ id: 'crate', geometry: box() }], materials: [] },
    children: [
      ambientLight({ key: 'ambient', intensity: 0.4 }),
      directionalLight({ key: 'sun', position: [3, 4, 5] }),
      ...current.crates.map((crate) =>
        mesh({
          // The key is the record's identity, never its index in a filtered list.
          key: `crate-${crate.id}`,
          position: [crate.x, crate.id === current.selected ? 0.5 : 0, 0],
          geometry: sharedGeometry('crate'),
          material: standard({ color: crate.colour }),
          interactive: true,
        }),
      ),
    ],
  });

/** What a click on a crate does to the Model: select it, or clear it when clicked again. */
export const clicked = (current: Model, key: string): Model => {
  const id = key.replace(/^crate-/, '');
  return { ...current, selected: current.selected === id ? null : id };
};
