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
import {
  categoryIds,
  categoryLabels,
  type RadarRelationship,
  relationshipLabels,
  type RelationshipType,
  ringIds,
  ringLabels,
  type Category,
} from './data';
import type { RadarPosition } from './layout';
import {
  blipKey,
  isVisible,
  type Model,
  positionOf,
  positionsOf,
  visibleOf,
  visibleRelationships,
} from './model';
import { edgeKey, touches } from './relations';
import {
  arcPeak,
  blipPosition,
  categoryLabelPosition,
  type Detail,
  categoryLabelDistance,
  detailFor,
  facesCamera,
  distanceBetween,
  edgeArc,
  equator,
  fullDistance,
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

/**
 * Relationship colours: four dark-surface steps of the dataviz reference palette that
 * pass its checks on the stage (#12121f) against each other, and a neutral ink for the
 * fifth, peer type. Every edge also carries a line style and, when focused or near, its
 * label, so a type never rests on colour alone.
 */
export const relationshipColours = {
  'builds-on': 0x3987e5,
  complements: 0xc98500,
  'inspired-by': 0xd55181,
  'guards-against': 0x008300,
  'alternative-to': 0xc3c2b7,
} satisfies Readonly<Record<RelationshipType, number>>;

/** Each type's line: solid, dashed or dotted, matching the legend. */
export const relationshipLines = {
  'builds-on': 'solid',
  complements: 'solid',
  'inspired-by': 'dashed',
  'guards-against': 'dashed',
  'alternative-to': 'dotted',
} as const satisfies Readonly<Record<RelationshipType, 'solid' | 'dashed' | 'dotted'>>;

const dashes = {
  solid: { dashed: false },
  dashed: { dashed: true, dashSize: 0.14, gapSize: 0.09 },
  dotted: { dashed: true, dashSize: 0.03, gapSize: 0.08 },
} as const;

export const relationshipCss = (type: RelationshipType): string =>
  `#${relationshipColours[type].toString(16).padStart(6, '0')}`;

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

/** Category names, while the camera stands far enough back for them to fit. */
const showsCategories = (model: Model): boolean =>
  Math.hypot(...model.camera.position) >= categoryLabelDistance;

const guideLabels = (model: Model): ReadonlyArray<SceneNode> => [
  ...categoryIds
    .filter(() => showsCategories(model))
    .map((category) =>
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
    Option.flatMap(focusedId(model), (id) => positionOf(model, id)),
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

/** The hovered entry, else the pinned one: it has the focus label and lit edges. */
const focusedId = (model: Model): Option.Option<string> =>
  Option.orElse(model.hovered, () => model.selected);

/** Edges of the focused entry stand out; the rest recede. */
const edgeStrength = {
  focused: { width: 3, opacity: 1 },
  dimmed: { width: 1.5, opacity: 0.45 },
} as const;

const isFocusedEdge = (model: Model, relationship: RadarRelationship): boolean =>
  [model.hovered, model.selected].some((id) =>
    Option.exists(id, (current) => touches(relationship, current)),
  );

const endpointOf = (model: Model, id: string): Vec3 =>
  Option.match(positionOf(model, id), { onNone: () => [0, 0, 0], onSome: blipPosition });

/** One relationship: an outward arc in its type's colour and line, labelled when focused or near. */
const edgeNodes = (model: Model, relationship: RadarRelationship): ReadonlyArray<SceneNode> => {
  const arc = edgeArc(endpointOf(model, relationship.from), endpointOf(model, relationship.to));
  const focused = isFocusedEdge(model, relationship);
  const peak = arcPeak(arc);
  const camera = model.camera.position;
  const labelled =
    focused || (facesCamera(camera, peak) && distanceBetween(camera, peak) <= fullDistance);
  const colour = relationshipColours[relationship.type];
  const strength = Match.value(focused).pipe(
    Match.when(true, () => edgeStrength.focused),
    Match.orElse(() => edgeStrength.dimmed),
  );
  const edge = line({
    key: edgeKey(relationship),
    points: arc,
    color: colour,
    ...strength,
    transparent: true,
    ...dashes[relationshipLines[relationship.type]],
  });
  const caption = label({
    ...labelStyle(model),
    key: `${edgeKey(relationship)}:label`,
    position: peak,
    text: relationshipLabels[relationship.type],
    fontSize: 0.13,
    color: colour,
  });
  return Match.value(labelled).pipe(
    Match.when(true, () => [edge, caption]),
    Match.orElse(() => [edge]),
  );
};

/** A blip's name, and when near its ring, category and description, by camera distance. */
const detailNodes = (
  model: Model,
  position: RadarPosition,
  detail: Detail,
): ReadonlyArray<SceneNode> => {
  const { id, name, ring, category, description } = position.entry;
  const [x, y, z] = blipPosition(position);
  const nameLabel = label({
    ...labelStyle(model),
    key: `label:name:${id}`,
    position: [x, y + 0.24, z],
    text: name,
    fontSize: 0.13,
  });
  const metaLabel = label({
    ...labelStyle(model),
    key: `label:meta:${id}`,
    position: [x, y - 0.2, z],
    text: `${ringLabels[ring]} · ${categoryLabels[category]}\n${description}`,
    fontSize: 0.075,
    maxWidth: 1.4,
    lineHeight: 1.3,
    textAlign: 'center',
    anchorY: 'top',
    color: 0xc3c2d0,
  });
  return Match.value(detail).pipe(
    Match.when('full', () => [nameLabel, metaLabel]),
    Match.when('name', () => [nameLabel]),
    Match.orElse(() => []),
  );
};

/** Each visible blip's detail; the focused one already wears the larger focus label. */
const zoomDetail = (model: Model): ReadonlyArray<SceneNode> =>
  visibleOf(model)
    .filter(({ entry }) => !Option.contains(focusedId(model), entry.id))
    .flatMap((position) =>
      detailNodes(model, position, detailFor(model.camera.position, blipPosition(position))),
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
      ...visibleRelationships(model).flatMap((relationship) => edgeNodes(model, relationship)),
      ...zoomDetail(model),
      ...focusLabel(model),
    ],
  });
