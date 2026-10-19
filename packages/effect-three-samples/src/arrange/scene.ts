/**
 * Four things on a table, some selected, with the transform gizmo on the first (a
 * Foldkit submodel over the core's pure gizmo, after three's `TransformControls`). The
 * selected things glow and their sharp edges are drawn, and while a selection box is
 * drawn, what it holds is marked instead; the floor is Drei's shader grid.
 */
import {
  box,
  cone,
  directionalLight,
  edges,
  environment,
  fixed,
  type GeometryRef,
  hemisphereLight,
  mesh,
  type Placement,
  renderSettings,
  roundedBox,
  type SceneNode,
  scene,
  shaderGrid,
  sphere,
  standard,
  torus,
} from '@opsydyn/effect-three';
import {
  BoxSelect,
  PivotControls,
  TransformGizmo,
  ViewportGizmo,
} from '@opsydyn/effect-three-foldkit';
import { Array as Arr, Option } from 'effect';

import type { Kind, Model, Thing } from './model';

const geometries = {
  crate: roundedBox({ width: 0.7, height: 0.7, depth: 0.7, radius: 0.05 }),
  ball: sphere({ radius: 0.4, widthSegments: 32, heightSegments: 16 }),
  cone: cone({ radius: 0.4, height: 0.8, radialSegments: 24 }),
  ring: torus({ radius: 0.32, tube: 0.12, radialSegments: 12, tubularSegments: 40 }),
} satisfies Record<Kind, GeometryRef>;

/** The keys outlined: what the box holds while it is drawn, else what is selected. */
const outlined = (model: Model): ReadonlyArray<string> =>
  BoxSelect.drawing(model.box)
    ? BoxSelect.inside(
        model.box,
        model.camera,
        model.things.map(({ key, placement }) => ({ key, at: placement.position })),
      )
    : model.selected;

const outlineFor = (keys: ReadonlyArray<string>, thing: Thing) =>
  keys.includes(thing.key) ? edges({ color: 0xffffff, width: 2, threshold: 30 }) : null;

/** Marked things glow faintly too: a rounded crate or a ball has no sharp edges to draw. */
const glowFor = (keys: ReadonlyArray<string>, thing: Thing) =>
  keys.includes(thing.key) ? 0.35 : 0;

const thingNode = (keys: ReadonlyArray<string>, thing: Thing): SceneNode =>
  mesh({
    key: thing.key,
    position: thing.placement.position,
    rotation: fixed(thing.placement.rotation),
    scale: thing.placement.scale,
    geometry: geometries[thing.kind],
    material: standard({
      color: thing.colour,
      roughness: 0.45,
      metalness: 0.1,
      emissive: 0x3d79fa,
      emissiveIntensity: glowFor(keys, thing),
    }),
    castShadow: true,
    interactive: true,
    edges: outlineFor(keys, thing),
  });

const selectedPlacement = (model: Model): Option.Option<Placement> =>
  Option.flatMap(Arr.head(model.selected), (key) =>
    Option.fromNullishOr(model.things.find((thing) => thing.key === key)?.placement),
  );

/** The gizmo on the first selected thing, if something is selected. */
const gizmoFor = (model: Model): ReadonlyArray<SceneNode> =>
  Option.match(selectedPlacement(model), {
    onNone: () => [],
    onSome: (placement) => [
      model.style === 'pivot'
        ? PivotControls.nodes(model.pivot, placement)
        : TransformGizmo.nodes(model.gizmo, placement, model.camera),
    ],
  });

export const sceneFor = (model: Model) => {
  const keys = outlined(model);
  return scene({
    camera: model.camera,
    gestures: 'scene',
    hud: ViewportGizmo.hud(model.view, model.camera),
    environment: environment({ environmentIntensity: 0.4 }),
    render: renderSettings({ shadows: 'soft', toneMapping: 'aces' }),
    children: [
      hemisphereLight({ key: 'sky', color: 0xffffff, groundColor: 0x6f6a62, intensity: 1 }),
      directionalLight({ key: 'sun', position: [4, 7, 3], intensity: 2.5, castShadow: true }),
      mesh({
        key: 'table',
        position: [0, -0.02, 0],
        rotation: fixed([-Math.PI / 2, 0, 0]),
        geometry: box({ width: 8, height: 8, depth: 0.02 }),
        material: standard({ color: 0xd9d6cf, roughness: 0.95 }),
        receiveShadow: true,
      }),
      shaderGrid({ key: 'grid', size: [8, 8], cellSize: 0.25, sectionSize: 1, fadeDistance: 14 }),
      ...model.things.map((thing) => thingNode(keys, thing)),
      ...gizmoFor(model),
    ],
  });
};
