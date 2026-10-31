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
  type Camera,
  detailed,
  directionalLight,
  ease,
  instant,
  fixed,
  group,
  label,
  line,
  mesh,
  physical,
  points,
  renderSettings,
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
import { lighten } from './colours';
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
import { eggGeometries, eggMaterials, eggNodes } from './easter';
import type { RadarPosition } from './layout';
import {
  blipKey,
  cameraFov,
  themeOf,
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
  labelBudget,
  mapBudget,
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
  isBirdsEye,
  equator,
  ringLabelPosition,
  sectorBoundaries,
  shellRadius,
  showsMeta,
  showsName,
} from './space';
import { type Fold, foldedPoint, foldOf, stagedModel } from './stack';
import { fovFor } from './stageSize';
import { css, skies, type Theme, themes, type Tokens } from './themes';

/** The theme in force's colours: every colour the scene draws comes from here. */
export const tokensOf = (model: Model): Tokens => themes[themeOf(model)];

/** CSS for a category's swatch, in a theme. */
export const categoryCss = (theme: Theme, category: Category): string =>
  css(themes[theme].categories[category]);

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

/**
 * CSS for a relationship's line, in a theme. Every edge also carries a line style and,
 * when focused or near, its caption, so a type never rests on colour alone; two types
 * share the neutral ink and differ only by those.
 */
export const relationshipCss = (theme: Theme, type: RelationshipType): string =>
  css(themes[theme].relationships[type]);

const glide = ease({ seconds: 0.45 });
/** Never scale a blip to zero: a degenerate matrix breaks lighting and hit testing. */
const flat = 0.001;
const blipRadius = bodyRadius;
/** The pinned blip grows by this much, so it reads as the one you chose. */
const pinnedScale = 1.6;

/** The typeface's display face for the labels, or the radar's own Inter if none is given. */
const font = (model: Model): string =>
  model.labelFonts[model.typeface] ?? `${model.assetBase}inter-latin-400-normal.woff`;

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
const blipNode = (
  model: Model,
  position: RadarPosition,
  fold: Option.Option<Fold> = Option.none(),
): SceneNode => {
  const { id, category } = position.entry;
  const key = blipKey(id);
  const body = bodyOf[category];
  const surface = litOr(model, id, `body:${category}`);
  // A fold moves every blip every frame, so it lands each frame where the fold says.
  const transition = Option.match(fold, { onNone: () => glide, onSome: () => instant() });
  return group({
    key,
    position: foldedPoint(blipPosition(position), fold),
    scale: blipScale(model, id),
    transition,
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

/** The frame of the radar as a fold draws it in and turns it; as it stands otherwise. */
const foldPose = (fold: Option.Option<Fold>) =>
  Option.match(fold, {
    onNone: () => ({}),
    onSome: ({ squeeze, twist }) => {
      const size = Math.max(flat, squeeze);
      return { scale: [size, size, size] as const, rotation: fixed([0, twist, 0]) };
    },
  });

const shellNodes = (tokens: Tokens, fold: Option.Option<Fold>): ReadonlyArray<SceneNode> =>
  ringIds.flatMap((ring) => [
    mesh({
      key: `shell:${ring}`,
      ...foldPose(fold),
      geometry: sharedGeometry(`shell:${ring}`),
      material: sharedMaterial('shell'),
    }),
    line({
      key: `equator:${ring}`,
      ...foldPose(fold),
      points: equator(shellRadius(ring)),
      color: tokens.guide,
      opacity: 0.55,
      transparent: true,
    }),
  ]);

const sectorNodes = (tokens: Tokens, fold: Option.Option<Fold>): ReadonlyArray<SceneNode> =>
  sectorBoundaries.map(({ category, points }) =>
    line({
      key: `sector:${category}`,
      ...foldPose(fold),
      points,
      color: tokens.guide,
      opacity: 0.8,
      transparent: true,
    }),
  );

const labelStyle = (model: Model) =>
  ({
    font: font(model),
    rotation: billboard(),
    color: tokensOf(model).ink,
    outlineWidth: tokensOf(model).labelOutline,
    outlineColor: tokensOf(model).outline,
  }) as const;

/** Category names, while the camera stands far enough back for them to fit. */
const showsCategories = (model: Model): boolean =>
  Math.hypot(...model.camera.position) >= categoryLabelDistance;

/** Ring names swing out to their edges, or back to the poles, rather than jumping. */
const ringSwing = ease({ seconds: 0.9 });

const guideLabels = (model: Model): ReadonlyArray<SceneNode> => [
  ...categoryIds
    .filter(() => showsCategories(model))
    .map((category) =>
      label({
        ...labelStyle(model),
        key: `label:category:${category}`,
        position: categoryLabelPosition(category),
        // A click on a category's name stops at its sector.
        interactive: true,
        text: categoryLabels[category],
        fontSize: 0.26 * labelScale(model),
        color: tokensOf(model).categories[category],
        outlineWidth: 0.02,
        outlineColor: tokensOf(model).categoryOutline,
      }),
    ),
  ...ringIds.map((ring) =>
    label({
      ...labelStyle(model),
      key: `label:ring:${ring}`,
      position: ringLabelPosition(ring, model.camera.position),
      transition: ringSwing,
      text: ringLabels[ring].toUpperCase(),
      fontSize: 0.15 * labelScale(model),
      letterSpacing: 0.12,
      color: tokensOf(model).guide,
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

/** An edge's strength on the theme's surface: light ones need stronger lines. */
const themedStrength = (
  model: Model,
  { width, opacity }: Readonly<{ width: number; opacity: number }>,
) => ({ width, opacity: Math.min(1, opacity * tokensOf(model).edgeStrength) });

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
    color: tokensOf(model).relationships[relationship.type],
    ...themedStrength(model, strengthOf(model, relationship)),
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
  const fontSize = 0.22 * labelScale(model);
  const size = textSize(text, fontSize);
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
        fontSize,
        outlineWidth: 0.02,
      }),
  );
};

/**
 * How much smaller labels are drawn on a narrow canvas: a phone's 375 pixels would
 * otherwise give each name as much of the screen as a desktop's 640, crowding it.
 */
export const labelScale = (model: Model): number =>
  Math.min(1, Math.max(0.72, model.stageWidth / 640));

/** How many labels may show at once: fewer on a narrow canvas, where they are smaller. */
const budgetFor = (model: Model, budget: typeof labelBudget | typeof mapBudget) => ({
  ...budget,
  name: Math.round(budget.name * labelScale(model)),
  edge: Math.round(budget.edge * labelScale(model)),
});

/**
 * A name's size: 0.13 units up close, growing with distance beyond that, so names seen
 * on the map from above stay legible rather than shrinking to specks.
 */
const nameSize = (model: Model, point: Vec3): number =>
  Math.max(0.13, 0.014 * distanceBetween(model.camera.position, point)) * labelScale(model);

/** A nearby entry's name, beside its blip. */
const nameCandidate = (model: Model, view: View, position: RadarPosition): Placeable => {
  const key = `label:name:${position.entry.id}`;
  const text = position.entry.name;
  const fontSize = nameSize(model, blipPosition(position));
  const size = textSize(text, fontSize);
  return placeable(
    key,
    'name',
    size,
    aroundSlots(view, blipPosition(position), size, nameOffset),
    (slot) => label({ ...labelStyle(model), ...slot, key, text, fontSize }),
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
        color: tokensOf(model).muted,
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
  Math.max(0.11, 0.016 * distanceBetween(model.camera.position, point)) * labelScale(model);

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
        color: tokensOf(model).relationships[relationship.type],
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
    // From above the radar is a map: every entry may be named, nearest first.
    .filter((position) => showsName(detailOf(model, position)) || isBirdsEye(camera))
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
  ...Option.toArray(Option.flatMap(focusedId(model), (id) => positionOf(model, id))).flatMap(
    (position) => focusedObstacles(model, position),
  ),
];

/**
 * The focused blip, at its pinned size, is never covered by any label, its own
 * included. A giant's ring reaches further: other entries' labels stay off that too, while
 * the blip's own description and edge labels may sit over the ring, beside the body.
 */
const focusedObstacles = (model: Model, position: RadarPosition): ReadonlyArray<Obstacle> => {
  const centre = blipPosition(position);
  const body = 2 * blipRadius * pinnedScale;
  const reach = 2 * focusedReach(position) * pinnedScale;
  const own = [
    `label:meta:${position.entry.id}`,
    ...visibleRelationships(model)
      .filter((relationship) => touches(relationship, position.entry.id))
      .map((relationship) => `${edgeKey(relationship)}:label`),
  ];
  return [
    { centre, width: body, height: body, solid: true },
    { centre, width: reach, height: reach, solid: true, exempt: own },
  ];
};

/** How far a blip reaches from its centre: its body, or a giant's ring. */
const focusedReach = (position: RadarPosition): number =>
  Match.value(bodyOf[position.entry.category]).pipe(
    Match.when('ringed', () => planetRing.radius + planetRing.tube),
    Match.orElse(() => blipRadius),
  );

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
    frameOf(fovFor(cameraFov, model.stageAspect), model.stageAspect),
    Match.value(isBirdsEye(model.camera.position)).pipe(
      Match.when(true, () => budgetFor(model, mapBudget)),
      Match.orElse(() => budgetFor(model, labelBudget)),
    ),
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
function categoryMaterials(tokens: Tokens, category: Category) {
  const color = tokens.categories[category];
  const body = bodyOf[category];
  // Dark surfaces lift the distant forms towards light; on paper they keep their colour.
  const lifted = (amount: number) => lighten(color, amount * tokens.lift);
  return [
    { id: `body:${category}`, material: surfaceOf(body, color, false) },
    { id: `body:${category}:lit`, material: surfaceOf(body, lighten(color, 0.25), true) },
    { id: `dot:${category}`, material: basic({ color: lifted(0.2) }) },
    {
      id: `dot:${category}:lit`,
      material: basic({ color: lighten(color, 0.25 + 0.3 * tokens.lift) }),
    },
    {
      id: `halo:${category}`,
      material: basic({ color: lifted(0.5), opacity: 0.16, transparent: true }),
    },
    {
      id: `ring:${category}`,
      material: standard({
        color: lifted(0.3),
        roughness: 0.6,
        opacity: 0.75,
        transparent: true,
        side: 'double',
      }),
    },
  ];
}

/**
 * The shared materials for a theme. Their ids never change with the theme: effect-three
 * updates a live shared material in place when its definition changes, so switching
 * theme recolours the scene without rebuilding it.
 */
export const materialsFor = (tokens: Tokens) => [
  ...categoryIds.flatMap((category) => categoryMaterials(tokens, category)),
  ...relationshipTypes.map((type) => ({
    id: `moon:${type}`,
    material: basic({ color: tokens.relationships[type] }),
  })),
  {
    id: 'shell',
    // A faint unlit tint that writes no depth: anything inside a shell (inner shells,
    // their equators, ring names) stays visible through the ones around it.
    material: basic({
      color: tokens.guide,
      opacity: tokens.shellOpacity,
      transparent: true,
      depthTest: false,
    }),
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

/**
 * Blueprint's drafting grid: a ruled floor under the radar, fine lines every unit and a
 * stronger one every fourth. From above it is the paper the radar is drawn on; from the
 * side, a floor in perspective. Static, so it never keeps the scene drawing.
 */
export const draftingGrid = { level: -3.6, reach: 16, major: 4 } as const;

const gridLine = (tokens: Tokens, at: number, along: 'x' | 'z'): SceneNode => {
  const { level, reach, major } = draftingGrid;
  const ends: ReadonlyArray<Vec3> = Match.value(along).pipe(
    Match.when(
      'x',
      (): ReadonlyArray<Vec3> => [
        [-reach, level, at],
        [reach, level, at],
      ],
    ),
    Match.orElse(
      (): ReadonlyArray<Vec3> => [
        [at, level, -reach],
        [at, level, reach],
      ],
    ),
  );
  return line({
    key: `grid:${along}:${at}`,
    points: ends,
    color: tokens.guide,
    opacity: Number(at % major === 0) * 0.14 + 0.1,
    transparent: true,
  });
};

const gridNodes = (tokens: Tokens): ReadonlyArray<SceneNode> => {
  const steps = Array.from(
    { length: draftingGrid.reach * 2 + 1 },
    (_, index) => index - draftingGrid.reach,
  );
  return [
    ...steps.map((at) => gridLine(tokens, at, 'x')),
    ...steps.map((at) => gridLine(tokens, at, 'z')),
  ].filter(() => skies[tokens.sky].ruled);
};

/** The far sky: the theme's stars, its drafting grid, or nothing. */
const skyNodes = (tokens: Tokens): ReadonlyArray<SceneNode> => [
  ...gridNodes(tokens),
  ...starNodes(tokens),
];

const starNodes = (tokens: Tokens): ReadonlyArray<SceneNode> =>
  [
    // Faint, still and colourless, well beyond the zoom limit: depth without meaning.
    points({
      key: 'stars',
      positions: starField.positions,
      sizes: starField.sizes,
      size: 1,
      sizeAttenuation: false,
      color: lighten(tokens.guide, 0.6),
      opacity: 0.55,
      transparent: true,
    }),
  ].filter(() => skies[tokens.sky].starry);

/**
 * How the radar renders. On a phone it stops redrawing while the full sheet covers it, and
 * a dense screen draws at 70% of its pixels: three device pixels to a CSS pixel cost more
 * battery than the eye can tell apart from two.
 */
const renderingFor = (model: Model) =>
  renderSettings({
    frames: model.input === 'touch' && model.sheet === 'full' ? 'never' : 'demand',
    resolution: model.input === 'touch' && model.denseScreen ? 0.7 : 1,
  });

/** The Model's camera, its field of view widened for a portrait stage (see stageSize.ts). */
const fitted = (camera: Camera, aspect: number): Camera =>
  camera._tag === 'Perspective' ? { ...camera, fov: fovFor(camera.fov, aspect) } : camera;

export const sceneFor = (model: Model) => {
  // The FoldKit egg draws the radar in and unfolds it through the editions: while it
  // plays, every entry shows, and the labels and edges stand aside.
  const fold = foldOf(model);
  const staged = stagedModel(model);
  const settled = Option.isNone(fold);
  return scene({
    camera: fitted(model.camera, model.stageAspect),
    gestures: 'scene',
    render: renderingFor(model),
    resources: {
      geometries: [...geometries, ...eggGeometries],
      materials: [...materialsFor(tokensOf(model)), ...eggMaterials],
    },
    children: [
      ...skyNodes(tokensOf(model)),
      ambientLight({ key: 'ambient', intensity: 0.9 }),
      directionalLight({ key: 'key-light', intensity: 1.8, position: [4, 6, 5] }),
      directionalLight({ key: 'fill-light', intensity: 0.6, position: [-5, -2, -4] }),
      ...shellNodes(tokensOf(model), fold),
      ...sectorNodes(tokensOf(model), fold),
      ...guideLabels(model).filter(() => settled),
      ...positionsOf(staged).map((position) => blipNode(staged, position, fold)),
      ...visibleRelationships(model)
        .filter(() => settled)
        .map((relationship) => edgeNode(model, relationship)),
      ...labelNodes(model).filter(() => settled),
      ...eggNodes(model),
    ],
  });
};
