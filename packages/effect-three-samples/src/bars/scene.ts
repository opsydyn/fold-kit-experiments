/**
 * The chart as a scene: one shared unit box scaled into every bar, gridlines on the back
 * wall and a floor plane. Every bar and gridline eases, so new data, sorting and hiding
 * a series animate while the Model only ever holds the target.
 */
import {
  ambientLight,
  box,
  directionalLight,
  ease,
  fixed,
  mesh,
  perspectiveCamera,
  plane,
  scene,
  type SceneNode,
  sharedGeometry,
  sharedMaterial,
  standard,
} from '@opsydyn/effect-three';
import { Option } from 'effect';

import { lighten, palettes } from './colours';
import { valuesFor } from './data';
import { type BarLayout, type Gridline, layoutFor, plot } from './layout';
import { type Model, sameBar, seriesList } from './model';

const glide = ease({ seconds: 0.6 });
const backWall = -plot.depth / 2 - 0.05;

const isLit = (model: Model, layout: BarLayout): boolean =>
  [model.hovered, model.selected].some((bar) =>
    Option.isSome(Option.filter(bar, (current) => sameBar(current, layout.bar))),
  );

/** The series material, or its lighter step for the hovered or pinned bar. */
const materialOf = (model: Model, layout: BarLayout): string =>
  Option.match(
    Option.liftPredicate(layout, (bar) => isLit(model, bar)),
    {
      onNone: () => layout.bar.series,
      onSome: () => `${layout.bar.series}:lit`,
    },
  );

const barNode = (model: Model, layout: BarLayout): SceneNode => {
  const material = materialOf(model, layout);
  return mesh({
    key: layout.key,
    position: layout.position,
    scale: layout.scale,
    transition: glide,
    geometry: sharedGeometry('bar'),
    material: sharedMaterial(material),
    interactive: layout.shown,
  });
};

const gridNode = (gridline: Gridline): SceneNode =>
  mesh({
    key: gridline.key,
    position: [0, gridline.y, backWall],
    scale: [plot.width, 0.015, 0.015],
    transition: glide,
    geometry: sharedGeometry('bar'),
    material: sharedMaterial('grid'),
  });

const materialsFor = (model: Model) => {
  const palette = palettes[model.theme];
  return [
    ...seriesList.flatMap((series) => [
      { id: series, material: standard({ color: palette[series], roughness: 0.55 }) },
      {
        id: `${series}:lit`,
        material: standard({ color: lighten(palette[series], 0.35), roughness: 0.55 }),
      },
    ]),
    { id: 'grid', material: standard({ color: palette.grid, roughness: 1 }) },
    { id: 'floor', material: standard({ color: palette.floor, roughness: 1 }) },
  ];
};

export const sceneFor = (model: Model) => {
  const layout = layoutFor(model, valuesFor(model.seed));
  return scene({
    camera: perspectiveCamera({ fov: 34, position: [0.8, 6.4, 8.4], lookAt: [0, 0.9, -0.2] }),
    resources: {
      geometries: [{ id: 'bar', geometry: box() }],
      materials: materialsFor(model),
    },
    children: [
      ambientLight({ key: 'ambient', intensity: 0.75 }),
      directionalLight({ key: 'key-light', intensity: 2, position: [3, 6, 5] }),
      directionalLight({ key: 'fill-light', intensity: 0.5, position: [-4, 2, -3] }),
      mesh({
        key: 'floor',
        // Just below the bars' bases, so flattened bars never fight the floor for depth.
        position: [0, -0.005, 0],
        rotation: fixed([-Math.PI / 2, 0, 0]),
        geometry: plane({ width: plot.width + 0.4, height: plot.depth + 0.5 }),
        material: sharedMaterial('floor'),
      }),
      ...layout.gridlines.map(gridNode),
      ...layout.bars.map((bar) => barNode(model, bar)),
    ],
  });
};
