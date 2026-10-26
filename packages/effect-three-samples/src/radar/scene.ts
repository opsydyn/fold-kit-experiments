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
  detailed,
  directionalLight,
  ease,
  fixed,
  group,
  label,
  line,
  mesh,
  physical,
  points,
  scene,
  type SceneNode,
  sharedGeometry,
  sharedMaterial,
  sphere,
  spin,
  standard,
  torus,
  type Vec3,
} from '@opsydyn/effect-three';
import { Match, Option } from 'effect';

import { lighten } from '../bars/colours';
import {
  type Body,
  bodyOf,
  bodyRadius,
  bodySegments,
  detailDistances,
  dotRadius,
  moonOffset,
  moonRadius,
  moonSpeed,
  orbitOf,
  planetRing,
  starField,
} from './bodies';
import {
  categoryIds,
  categoryLabels,
  type RadarRelationship,
  relationshipLabels,
  relationshipTypes,
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
  relationshipsOf,
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
import { edgeKey, relationsOf, touches } from './relations';
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
const blipRadius = bodyRadius;
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

/** The halo's radius: a soft band of light just outside the body. */
const haloRadius = bodyRadius * 1.7;

/** A shared material's id, or its lit step for the hovered or pinned blip. */
const litOr = (model: Model, id: string, material: string): string =>
  Match.value(isLit(model, id)).pipe(
    Match.when(true, () => `${material}:lit`),
    Match.orElse(() => material),
  );

/**
 * The focused blip's halo: a faint, larger sphere of its own colour round the body, a
 * glow drawn in the scene rather than by a post-processing pass, which would wash out the
 * stage's translucent shells.
 */
const haloNodes = (
  model: Model,
  key: string,
  id: string,
  category: Category,
): ReadonlyArray<SceneNode> =>
  Match.value(isLit(model, id)).pipe(
    Match.when(true, () => [
      mesh({
        key: `${key}:halo`,
        geometry: sharedGeometry('halo'),
        material: sharedMaterial(`halo:${category}`),
      }),
    ]),
    Match.orElse(() => []),
  );

const bodyMesh = (key: string, body: Body, material: string): SceneNode =>
  mesh({ key, geometry: sharedGeometry(`body:${body}`), material: sharedMaterial(material) });

/** The ringed giant's ring; other bodies have none. */
const ringNodes = (key: string, position: RadarPosition): ReadonlyArray<SceneNode> =>
  Match.value(bodyOf[position.entry.category]).pipe(
    Match.when('ringed', () => [
      mesh({
        key: `${key}:ring`,
        rotation: fixed([...planetRing.tilt]),
        geometry: sharedGeometry('planet-ring'),
        material: sharedMaterial(`ring:${position.entry.category}`),
      }),
    ]),
    Match.orElse(() => []),
  );

/**
 * One moon per relationship, in its type's colour, orbiting in a plane tilted by the
 * blip's id. Hidden with the relationship edges, and absent while the blip is far off.
 */
const moonNodes = (
  model: Model,
  key: string,
  position: RadarPosition,
): ReadonlyArray<SceneNode> => {
  const { id } = position.entry;
  // Only up close, where they show: orbiting moons keep the scene drawing every frame,
  // so an idle radar seen from afar has none and renders only when something changes.
  const near = showsName(detailFor(model.camera.position, blipPosition(position)));
  const moons = relationsOf(relationshipsOf(model), id).filter(
    () => model.showRelationships && near,
  );
  const { tilt, phase } = orbitOf(id);
  const orbit = group({
    key: `${key}:orbit`,
    rotation: fixed(tilt),
    children: [
      group({
        key: `${key}:moons`,
        rotation: spin({ axis: 'y', radiansPerSecond: moonSpeed, phase }),
        children: moons.map((relation, index) =>
          mesh({
            key: `${key}:moon:${index}`,
            position: moonOffset(index, moons.length),
            geometry: sharedGeometry('moon'),
            material: sharedMaterial(`moon:${relation.type}`),
          }),
        ),
      }),
    ],
  });
  return Match.value(moons.length).pipe(
    Match.when(0, () => []),
    Match.orElse(() => [orbit]),
  );
};

/**
 * A blip as a small world that shows more as the camera nears: up close its body, ring
 * and moons; further out the body alone; far off a soft dot. The group carries the
 * blip's key, place, size and interactivity, so its parts resolve to the entry.
 */
const blipNode = (model: Model, position: RadarPosition): SceneNode => {
  const { id, category } = position.entry;
  const key = blipKey(id);
  const body = bodyOf[category];
  const surface = litOr(model, id, `body:${category}`);
  return group({
    key,
    position: blipPosition(position),
    scale: blipScale(model, id),
    transition: glide,
    interactive: isVisible(model, id),
    detail: detailed({ distances: [...detailDistances] }),
    children: [
      group({
        key: `${key}:near`,
        children: [
          bodyMesh(`${key}:near:body`, body, surface),
          ...haloNodes(model, `${key}:near`, id, category),
          ...ringNodes(key, position),
          ...moonNodes(model, key, position),
        ],
      }),
      group({
        key: `${key}:mid`,
        children: [
          bodyMesh(`${key}:mid:body`, body, surface),
          ...haloNodes(model, `${key}:mid`, id, category),
        ],
      }),
      mesh({
        key: `${key}:far`,
        geometry: sharedGeometry('dot'),
        material: sharedMaterial(litOr(model, id, `dot:${category}`)),
      }),
    ],
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

/**
 * Each body's surface in its category colour: glass that light passes through, cut metal,
 * matte rock, and a smooth giant. The lit step glows softly from within.
 */
const surfaceOf = (body: Body, color: number, lit: boolean) => {
  const glow = Match.value(lit).pipe(
    Match.when(true, () => ({ emissive: color, emissiveIntensity: focusGlow })),
    Match.orElse(() => ({})),
  );
  return Match.value(body).pipe(
    Match.when('glass', () =>
      physical({
        color,
        roughness: 0.08,
        transmission: 0.55,
        ior: 1.3,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        ...glow,
      }),
    ),
    // Only part metal: with no environment to reflect, a full metal reads as black.
    Match.when('faceted', () =>
      standard({ color, metalness: 0.3, roughness: 0.35, flatShading: true, ...glow }),
    ),
    Match.when('rocky', () => standard({ color, roughness: 0.92, flatShading: true, ...glow })),
    Match.orElse(() => standard({ color, roughness: 0.5, ...glow })),
  );
};

/** How brightly the focused blip's surface glows from within. */
const focusGlow = 0.6;

/** A category's surfaces: its body, plain and lit; its distant dot, plain and lit; its ring. */
function categoryMaterials(category: Category) {
  const color = categoryColours[category];
  const body = bodyOf[category];
  return [
    { id: `body:${category}`, material: surfaceOf(body, color, false) },
    { id: `body:${category}:lit`, material: surfaceOf(body, lighten(color, 0.25), true) },
    { id: `dot:${category}`, material: basic({ color: lighten(color, 0.2) }) },
    { id: `dot:${category}:lit`, material: basic({ color: lighten(color, 0.55) }) },
    {
      id: `halo:${category}`,
      material: basic({ color: lighten(color, 0.5), opacity: 0.16, transparent: true }),
    },
    {
      id: `ring:${category}`,
      material: standard({
        color: lighten(color, 0.3),
        roughness: 0.6,
        opacity: 0.75,
        transparent: true,
        side: 'double',
      }),
    },
  ];
}

const materials = [
  ...categoryIds.flatMap(categoryMaterials),
  ...relationshipTypes.map((type) => ({
    id: `moon:${type}`,
    material: basic({ color: relationshipColours[type] }),
  })),
  {
    id: 'shell',
    // A faint unlit tint that writes no depth: anything inside a shell (inner shells,
    // their equators, ring names) stays visible through the ones around it.
    material: basic({ color: guide, opacity: 0.07, transparent: true, depthTest: false }),
  },
];

const geometries = [
  ...(['glass', 'faceted', 'rocky', 'ringed'] as const).map((body) => ({
    id: `body:${body}`,
    geometry: sphere({ radius: bodyRadius, ...bodySegments[body] }),
  })),
  { id: 'dot', geometry: sphere({ radius: dotRadius, widthSegments: 10, heightSegments: 8 }) },
  { id: 'halo', geometry: sphere({ radius: haloRadius, widthSegments: 24, heightSegments: 12 }) },
  { id: 'moon', geometry: sphere({ radius: moonRadius, widthSegments: 8, heightSegments: 6 }) },
  {
    id: 'planet-ring',
    geometry: torus({
      radius: planetRing.radius,
      tube: planetRing.tube,
      radialSegments: 6,
      tubularSegments: 48,
    }),
  },
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
      // Faint, still and colourless, well beyond the zoom limit: depth without meaning.
      points({
        key: 'stars',
        positions: starField.positions,
        sizes: starField.sizes,
        size: 1,
        sizeAttenuation: false,
        color: 0xc8c8d8,
        opacity: 0.55,
        transparent: true,
      }),
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
