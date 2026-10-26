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
  cameraFov,
  isVisible,
  type Model,
  positionOf,
  positionsOf,
  visibleOf,
  visibleRelationships,
} from './model';
import {
  acrossView,
  type Candidate,
  frameOf,
  type Obstacle,
  place,
  textSize,
  viewOf,
} from './placement';
import { edgeKey, touches } from './relations';
import {
  arcPeak,
  blipPosition,
  categoryLabelPosition,
  type Detail,
  categoryLabelDistance,
  detailFor,
  distanceBetween,
  edgeArc,
  equator,
  ringLabelPosition,
  sectorBoundaries,
  shellRadius,
  showsMeta,
  showsName,
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
/** The pinned blip grows by this much, so it reads as the one you chose. */
const pinnedScale = 1.6;

const font = (model: Model): string => `${model.assetBase}inter-latin-400-normal.woff`;

const isLit = (model: Model, id: string): boolean =>
  Option.contains(model.hovered, id) || Option.contains(model.selected, id);

/** Hidden blips flatten, the pinned one grows. */
const blipSize = (model: Model, id: string): number =>
  Match.value({ visible: isVisible(model, id), pinned: Option.contains(model.selected, id) }).pipe(
    Match.when({ visible: false }, () => flat),
    Match.when({ pinned: true }, () => pinnedScale),
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

/** The hovered entry, else the pinned one: it has the focus label and forward edges. */
const focusedId = (model: Model): Option.Option<string> =>
  Option.orElse(model.hovered, () => model.selected);

/**
 * Edges are faint threads that sit behind the blips. The focused entry's edges come
 * forward; while something is focused, every other edge all but disappears.
 */
const edgeStrength = {
  focused: { width: 1.75, opacity: 0.8 },
  resting: { width: 1, opacity: 0.18 },
  receded: { width: 1, opacity: 0.06 },
} as const;

const isFocusedEdge = (model: Model, relationship: RadarRelationship): boolean =>
  [model.hovered, model.selected].some((id) =>
    Option.exists(id, (current) => touches(relationship, current)),
  );

const strengthOf = (model: Model, relationship: RadarRelationship) =>
  Match.value({
    focused: isFocusedEdge(model, relationship),
    anyFocus: Option.isSome(focusedId(model)),
  }).pipe(
    Match.when({ focused: true }, () => edgeStrength.focused),
    Match.when({ anyFocus: true }, () => edgeStrength.receded),
    Match.orElse(() => edgeStrength.resting),
  );

const endpointOf = (model: Model, id: string): Vec3 =>
  Option.match(positionOf(model, id), { onNone: () => [0, 0, 0], onSome: blipPosition });

const arcOf = (model: Model, relationship: RadarRelationship): ReadonlyArray<Vec3> =>
  edgeArc(endpointOf(model, relationship.from), endpointOf(model, relationship.to));

/** One relationship: an outward arc in its type's colour and line style. */
const edgeNode = (model: Model, relationship: RadarRelationship): SceneNode =>
  line({
    key: edgeKey(relationship),
    points: arcOf(model, relationship),
    color: relationshipColours[relationship.type],
    ...strengthOf(model, relationship),
    transparent: true,
    ...dashes[relationshipLines[relationship.type]],
  });

/**
 * Where a label may sit beside its blip: its anchor point and alignment, and the centre
 * of the box it covers there. Side slots are measured along the camera's right, so they
 * stay beside the blip on screen however the radar turns.
 */
type Slot = Readonly<{
  position: Vec3;
  centre: Vec3;
  anchorX: 'left' | 'center' | 'right';
  anchorY: 'top' | 'middle';
  textAlign: 'left' | 'center' | 'right';
}>;

/** A label the scene may draw: its candidate slots, and its node in the one chosen. */
type Placeable = Readonly<{
  candidate: Candidate;
  slots: ReadonlyArray<Slot>;
  nodeAt: (slot: Slot) => SceneNode;
}>;

type Size = Readonly<{ width: number; height: number }>;
type View = ReturnType<typeof viewOf>;

const nameOffset = 0.24;
const focusOffset = 0.34;
const sideOffset = 0.2;
const metaFontSize = 0.075;
const metaWidth = 1.4;

const shifted = (point: Vec3, direction: Vec3, by: number): Vec3 => [
  point[0] + direction[0] * by,
  point[1] + direction[1] * by,
  point[2] + direction[2] * by,
];
const above = (point: Vec3, by: number): Vec3 => shifted(point, [0, 1, 0], by);

const centred = (position: Vec3): Slot => ({
  position,
  centre: position,
  anchorX: 'center',
  anchorY: 'middle',
  textAlign: 'center',
});

/** A label to the right of its blip starts at its left edge, and the other way round. */
const sideAnchors = {
  1: { anchorX: 'left', textAlign: 'left' },
  [-1]: { anchorX: 'right', textAlign: 'right' },
} as const;

/** Beside the blip on screen, `side` 1 to its right or -1 to its left. */
const besideSlot = (view: View, blip: Vec3, size: Size, side: 1 | -1): Slot => ({
  ...sideAnchors[side],
  position: shifted(blip, view.right, side * sideOffset),
  centre: shifted(blip, view.right, side * (sideOffset + size.width / 2)),
  anchorY: 'middle',
});

/** Beyond this far across the view, a blip's labels first try the side facing the centre. */
const outerView = 0.2;

/**
 * Over, under and beside a blip: the order a name tries them in. Near the edge of the
 * view the inward side comes first, so labels run towards the middle, not off the stage.
 */
const aroundSlots = (view: View, blip: Vec3, size: Size, offset: number): ReadonlyArray<Slot> => {
  const across = acrossView(view, blip);
  const left = besideSlot(view, blip, size, -1);
  const right = besideSlot(view, blip, size, 1);
  const overUnder = [centred(above(blip, offset)), centred(above(blip, -offset))];
  return Match.value({ outer: Math.abs(across) > outerView, onRight: across > 0 }).pipe(
    Match.when({ outer: true, onRight: true }, () => [left, ...overUnder, right]),
    Match.when({ outer: true }, () => [right, ...overUnder, left]),
    Match.orElse(() => [...overUnder, right, left]),
  );
};

const placeable = (
  key: string,
  kind: Candidate['kind'],
  size: Size,
  slots: ReadonlyArray<Slot>,
  nodeAt: (slot: Slot) => SceneNode,
): Placeable => ({
  candidate: { key, kind, centres: slots.map(({ centre }) => centre), ...size },
  nodeAt,
  slots,
});

/** The pinned or hovered entry's name, larger, beside its blip. */
const focusCandidate = (model: Model, view: View, position: RadarPosition): Placeable => {
  const text = position.entry.name;
  const size = textSize(text, 0.22);
  return placeable(
    'label:focus',
    'focus',
    size,
    aroundSlots(view, blipPosition(position), size, focusOffset),
    (slot) =>
      label({
        ...labelStyle(model),
        ...slot,
        key: 'label:focus',
        text,
        fontSize: 0.22,
        outlineWidth: 0.02,
      }),
  );
};

/** A nearby entry's name, beside its blip. */
const nameCandidate = (model: Model, view: View, position: RadarPosition): Placeable => {
  const key = `label:name:${position.entry.id}`;
  const text = position.entry.name;
  const size = textSize(text, 0.13);
  return placeable(
    key,
    'name',
    size,
    aroundSlots(view, blipPosition(position), size, nameOffset),
    (slot) => label({ ...labelStyle(model), ...slot, key, text, fontSize: 0.13 }),
  );
};

/** How much a metadata label says: ring and category, or those and the description too. */
type MetaReach = 'heading' | 'described';

/**
 * A blip's ring and category, one short line under it or else to one side. The focused
 * entry's also carries its description: nearby blips stay scannable, and the one you are
 * reading tells you more.
 */
const metaCandidate = (
  model: Model,
  view: View,
  position: RadarPosition,
  reach: MetaReach,
): Placeable => {
  const { id, ring, category, description } = position.entry;
  const key = `label:meta:${id}`;
  const blip = blipPosition(position);
  const heading = `${ringLabels[ring]} · ${categoryLabels[category]}`;
  const text = Match.value(reach).pipe(
    Match.when('described', () => `${heading}\n${description}`),
    Match.orElse(() => heading),
  );
  const size = textSize(text.replace('\n', ' '), metaFontSize, metaWidth);
  // Clear of the blip at its pinned size, so a focused entry's own line is never blocked.
  const top = above(blip, -(blipRadius * pinnedScale + 0.06));
  const under: Slot = {
    position: top,
    centre: above(top, -size.height / 2),
    anchorX: 'center',
    anchorY: 'top',
    textAlign: 'center',
  };
  return placeable(
    key,
    'meta',
    size,
    [under, besideSlot(view, blip, size, 1), besideSlot(view, blip, size, -1)],
    (slot) =>
      label({
        ...labelStyle(model),
        ...slot,
        key,
        text,
        fontSize: metaFontSize,
        maxWidth: metaWidth,
        lineHeight: 1.3,
        color: 0xc3c2d0,
      }),
  );
};

/** Where along a focused edge, from the focused entry, its type label may sit. */
const captionStops = [0.7, 0.5, 0.85, 0.3] as const;
/** Each stop is tried on the arc, then above and below it, a little and then further. */
const captionNudges = [0, 0.18, -0.18, 0.34, -0.34] as const;

/** A point `along` the way from the focused end of an edge, just outside the arc. */
const captionPoint = (
  model: Model,
  relationship: RadarRelationship,
  arc: ReadonlyArray<Vec3>,
  along: number,
): Vec3 => {
  const fromFocused = Option.exists(focusedId(model), (id) => id === relationship.from);
  const share = Match.value(fromFocused).pipe(
    Match.when(true, () => along),
    Match.orElse(() => 1 - along),
  );
  const [x, y, z] = arc[Math.round(share * (arc.length - 1))] ?? arcPeak(arc);
  return [x * 1.05, y * 1.05, z * 1.05];
};

/**
 * An edge label's size: never below 0.11 units, and growing with distance so it stays
 * about ten pixels tall on screen instead of shrinking out of reach.
 */
const captionSize = (model: Model, point: Vec3): number =>
  Math.max(0.11, 0.016 * distanceBetween(model.camera.position, point));

/** A focused edge's type, small, near the related entry where it fits. */
const edgeCandidate = (model: Model, relationship: RadarRelationship): Placeable => {
  const arc = arcOf(model, relationship);
  const key = `${edgeKey(relationship)}:label`;
  const text = relationshipLabels[relationship.type];
  const fontSize = captionSize(model, arcPeak(arc));
  return placeable(
    key,
    'edge',
    textSize(text, fontSize),
    captionStops.flatMap((along) =>
      captionNudges.map((nudge) =>
        centred(above(captionPoint(model, relationship, arc, along), nudge)),
      ),
    ),
    (slot) =>
      label({
        ...labelStyle(model),
        ...slot,
        key,
        text,
        fontSize,
        color: relationshipColours[relationship.type],
        fillOpacity: 0.9,
        outlineWidth: fontSize * 0.12,
      }),
  );
};

const detailOf = (model: Model, position: RadarPosition): Detail =>
  detailFor(model.camera.position, blipPosition(position));

/** Every label the scene could draw, most important first. */
const candidatesOf = (model: Model, view: View): ReadonlyArray<Placeable> => {
  const focused = Option.flatMap(focusedId(model), (id) => positionOf(model, id));
  const camera = model.camera.position;
  const others = visibleOf(model)
    .filter(({ entry }) => !Option.contains(focusedId(model), entry.id))
    .filter((position) => showsName(detailOf(model, position)))
    .map((position) => ({ position, distance: distanceBetween(camera, blipPosition(position)) }))
    .toSorted((a, b) => a.distance - b.distance)
    .map(({ position }) => position);
  const metaOf = (position: RadarPosition, reach: MetaReach): ReadonlyArray<Placeable> =>
    [position]
      .filter((current) => showsMeta(detailOf(model, current)))
      .map((current) => metaCandidate(model, view, current, reach));
  return [
    ...Option.match(focused, {
      onNone: () => [],
      onSome: (position) => [
        focusCandidate(model, view, position),
        ...metaOf(position, 'described'),
      ],
    }),
    ...visibleRelationships(model)
      .filter((relationship) => isFocusedEdge(model, relationship))
      .map((relationship) => edgeCandidate(model, relationship)),
    ...others.flatMap((position) => [
      nameCandidate(model, view, position),
      ...metaOf(position, 'heading'),
    ]),
  ];
};

/** Nearby blips, which labels must not cover; far ones are small and may sit behind a label. */
const blipObstacles = (model: Model): ReadonlyArray<Obstacle> => [
  ...visibleOf(model)
    .filter((position) => showsName(detailOf(model, position)))
    .map((position) => ({
      centre: blipPosition(position),
      width: 2 * blipRadius,
      height: 2 * blipRadius,
    })),
  // The focused blip, at its pinned size, is never covered by another label.
  ...Option.toArray(Option.flatMap(focusedId(model), (id) => positionOf(model, id))).map(
    (position) => ({
      centre: blipPosition(position),
      width: 2 * blipRadius * pinnedScale,
      height: 2 * blipRadius * pinnedScale,
      solid: true,
    }),
  ),
];

/** A description shows only beside its entry's name, never on its own. */
const keepsMeta = (placed: ReadonlyMap<string, number>, key: string): boolean =>
  !key.startsWith('label:meta:') ||
  placed.has('label:focus') ||
  placed.has(key.replace('label:meta:', 'label:name:'));

/** The labels that fit: placed in priority order, none overlapping on screen. */
const labelNodes = (model: Model): ReadonlyArray<SceneNode> => {
  const view = viewOf(model.camera.position, model.camera.lookAt);
  const candidates = candidatesOf(model, view);
  const placed = place(
    view,
    candidates.map(({ candidate }) => candidate),
    blipObstacles(model),
    frameOf(cameraFov, model.stageAspect),
  );
  return candidates.flatMap(({ candidate, nodeAt, slots }) =>
    Option.match(Option.fromNullishOr(placed.get(candidate.key)), {
      onNone: () => [],
      onSome: (index) =>
        slots
          .filter((_, at) => at === index && keepsMeta(placed, candidate.key))
          .map((slot) => nodeAt(slot)),
    }),
  );
};

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
      ...visibleRelationships(model).map((relationship) => edgeNode(model, relationship)),
      ...labelNodes(model),
    ],
  });
