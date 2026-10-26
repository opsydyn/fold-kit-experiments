/**
 * The radar as a scene: four translucent shells, one per ring, with the categories'
 * sector boundaries on the outer one, and one blip per entry on its ring's shell. Every
 * entry keeps its blip; the filters ease hidden ones to nothing and make them inert, so
 * filtering animates while the Model only holds the filters.
 */
import {
  ambientLight,
  basic,
  billboard,
  directionalLight,
  ease,
  label,
  line,
  mesh,
  scene,
  type SceneNode,
  sharedGeometry,
  sharedMaterial,
  sphere,
  standard,
  type Vec3,
} from '@opsydyn/effect-three';
import { Match, Option } from 'effect';

import { lighten } from '../bars/colours';
import { categoryIds, categoryLabels, ringIds, ringLabels, type Category } from './data';
import type { RadarPosition } from './layout';
import { blipKey, isVisible, type Model, positionOf, positionsOf } from './model';
import {
  blipPosition,
  categoryLabelPosition,
  equator,
  ringLabelPosition,
  sectorBoundaries,
  shellRadius,
} from './space';

/** The 2D radar's category colours, so both radars read the same. */
export const categoryColours = {
  techniques: 0x087f8c,
  tools: 0x397c4a,
  platforms: 0xa56500,
  'languages-frameworks': 0xbb2544,
} satisfies Readonly<Record<Category, number>>;

/** CSS for a category's swatch. */
export const categoryCss = (category: Category): string =>
  `#${categoryColours[category].toString(16).padStart(6, '0')}`;

/** Shells, guides and labels: muted ink that reads on the stage's dark surface. */
const guide = 0x8a8aa3;
const ink = 0xe8e8f0;
const outline = 0x12121f;

const glide = ease({ seconds: 0.45 });
/** Never scale a blip to zero: a degenerate matrix breaks lighting and hit testing. */
const flat = 0.001;
const blipRadius = 0.12;

const font = (model: Model): string => `${model.assetBase}inter-latin-400-normal.woff`;

const isLit = (model: Model, id: string): boolean =>
  Option.contains(model.hovered, id) || Option.contains(model.selected, id);

/** Hidden blips flatten, the pinned one grows. */
const blipSize = (model: Model, id: string): number =>
  Match.value({ visible: isVisible(model, id), pinned: Option.contains(model.selected, id) }).pipe(
    Match.when({ visible: false }, () => flat),
    Match.when({ pinned: true }, () => 1.6),
    Match.orElse(() => 1),
  );

const blipScale = (model: Model, id: string): Vec3 => {
  const size = blipSize(model, id);
  return [size, size, size];
};

/** The category's material, or its lit step for the hovered or pinned blip. */
const blipMaterial = (model: Model, position: RadarPosition): string =>
  Match.value(isLit(model, position.entry.id)).pipe(
    Match.when(true, () => `${position.entry.category}:lit`),
    Match.orElse(() => position.entry.category),
  );

const blipNode = (model: Model, position: RadarPosition): SceneNode => {
  const { id } = position.entry;
  return mesh({
    key: blipKey(id),
    position: blipPosition(position),
    scale: blipScale(model, id),
    transition: glide,
    geometry: sharedGeometry('blip'),
    material: sharedMaterial(blipMaterial(model, position)),
    interactive: isVisible(model, id),
  });
};

const shellNodes: ReadonlyArray<SceneNode> = ringIds.flatMap((ring) => [
  mesh({
    key: `shell:${ring}`,
    geometry: sharedGeometry(`shell:${ring}`),
    material: sharedMaterial('shell'),
  }),
  line({
    key: `equator:${ring}`,
    points: equator(shellRadius(ring)),
    color: guide,
    opacity: 0.55,
    transparent: true,
  }),
]);

const sectorNodes: ReadonlyArray<SceneNode> = sectorBoundaries.map(({ category, points }) =>
  line({ key: `sector:${category}`, points, color: guide, opacity: 0.8, transparent: true }),
);

const labelStyle = (model: Model) =>
  ({
    font: font(model),
    rotation: billboard(),
    color: ink,
    outlineWidth: 0.012,
    outlineColor: outline,
  }) as const;

const guideLabels = (model: Model): ReadonlyArray<SceneNode> => [
  ...categoryIds.map((category) =>
    label({
      ...labelStyle(model),
      key: `label:category:${category}`,
      position: categoryLabelPosition(category),
      text: categoryLabels[category],
      fontSize: 0.26,
      color: categoryColours[category],
      outlineWidth: 0.02,
      outlineColor: ink,
    }),
  ),
  ...ringIds.map((ring) =>
    label({
      ...labelStyle(model),
      key: `label:ring:${ring}`,
      position: ringLabelPosition(ring),
      text: ringLabels[ring].toUpperCase(),
      fontSize: 0.15,
      letterSpacing: 0.12,
      color: guide,
    }),
  ),
];

/** The hovered entry's name over its blip, else the pinned one's. */
const focusLabel = (model: Model): ReadonlyArray<SceneNode> =>
  Option.match(
    Option.flatMap(
      Option.orElse(model.hovered, () => model.selected),
      (id) => positionOf(model, id),
    ),
    {
      onNone: () => [],
      onSome: (position) => {
        const [x, y, z] = blipPosition(position);
        return [
          label({
            ...labelStyle(model),
            key: 'label:focus',
            position: [x, y + 0.34, z],
            text: position.entry.name,
            fontSize: 0.22,
            outlineWidth: 0.02,
          }),
        ];
      },
    },
  );

const materials = [
  ...categoryIds.flatMap((category) => [
    { id: category, material: standard({ color: categoryColours[category], roughness: 0.45 }) },
    {
      id: `${category}:lit`,
      material: standard({
        color: lighten(categoryColours[category], 0.4),
        roughness: 0.45,
        emissive: categoryColours[category],
        emissiveIntensity: 0.35,
      }),
    },
  ]),
  {
    id: 'shell',
    // A faint unlit tint that writes no depth: anything inside a shell (inner shells,
    // their equators, ring names) stays visible through the ones around it.
    material: basic({ color: guide, opacity: 0.07, transparent: true, depthTest: false }),
  },
];

const geometries = [
  { id: 'blip', geometry: sphere({ radius: blipRadius, widthSegments: 20, heightSegments: 12 }) },
  ...ringIds.map((ring) => ({
    id: `shell:${ring}`,
    geometry: sphere({ radius: shellRadius(ring), widthSegments: 48, heightSegments: 24 }),
  })),
];

export const sceneFor = (model: Model) =>
  scene({
    camera: model.camera,
    gestures: 'scene',
    resources: { geometries, materials },
    children: [
      ambientLight({ key: 'ambient', intensity: 0.9 }),
      directionalLight({ key: 'key-light', intensity: 1.8, position: [4, 6, 5] }),
      directionalLight({ key: 'fill-light', intensity: 0.6, position: [-5, -2, -4] }),
      ...shellNodes,
      ...sectorNodes,
      ...guideLabels(model),
      ...positionsOf(model).map((position) => blipNode(model, position)),
      ...focusLabel(model),
    ],
  });
