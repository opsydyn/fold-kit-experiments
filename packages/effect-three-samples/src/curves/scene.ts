/**
 * Curves, drawn as data:
 *
 * - a closed Catmull-Rom curve through five handles (`catmullRomPoints`), five pixels wide
 *   with a colour gradient (`catmullRomColors`), or dashed;
 * - the handles' control polygon as a thin dashed line, and a quadratic Bézier swinging
 *   under it (`quadraticBezierPoints`);
 * - handles that are boxes with their edges drawn (`edges`), dragged in the plane z = 0;
 * - a comet riding the curve by a behaviour, with a tapering, fading trail (`trail`) and,
 *   glittering, sparkles round it (`sparkles`);
 * - and stars behind it all (`stars`).
 */
import {
  basic,
  behave,
  box,
  catmullRomColors,
  catmullRomPoints,
  edges,
  group,
  line,
  mesh,
  perspectiveCamera,
  quadraticBezierPoints,
  type SceneNode,
  scene,
  sparkles,
  sphere,
  standard,
  stars,
  trail,
} from '@opsydyn/effect-three';

import { paintColour } from '../palette';
import type { Model } from './model';
import { ridePoints } from './ride';
import { handleKey } from './update';

const curveSegments = 120;

const curve = (model: Model): SceneNode =>
  line({
    key: 'curve',
    points: catmullRomPoints(model.controls, { closed: true, segments: curveSegments }),
    vertexColors: catmullRomColors(
      [paintColour.coral, paintColour.gold, paintColour.mint, paintColour.blue],
      { segments: curveSegments, closed: true },
    ),
    width: 5,
    dashed: model.dashed,
    dashSize: 0.25,
    gapSize: 0.12,
  });

/** The handles joined in order, dashed and faint: the polygon the curve smooths. */
const polygon = (model: Model): SceneNode =>
  line({
    key: 'polygon',
    points: [...model.controls, ...model.controls.slice(0, 1)],
    color: 0x8a90a0,
    width: 1.5,
    dashed: true,
    dashSize: 0.08,
    gapSize: 0.08,
  });

/** A quadratic Bézier from the first handle to the last, swinging down under the stage. */
const swing = (model: Model): ReadonlyArray<SceneNode> => {
  const [first] = model.controls;
  const last = model.controls.at(-1);
  if (first === undefined || last === undefined) return [];
  return [
    line({
      key: 'swing',
      points: quadraticBezierPoints({ start: first, end: last, mid: [0, -3.2, 0], segments: 40 }),
      color: paintColour.gold,
      width: 2,
      dashed: true,
      dashSize: 0.18,
      gapSize: 0.1,
      transparent: true,
      opacity: 0.7,
    }),
  ];
};

const handles = (model: Model): ReadonlyArray<SceneNode> =>
  model.controls.map((at, index) =>
    mesh({
      key: handleKey(index),
      position: at,
      geometry: box({ width: 0.24, height: 0.24, depth: 0.24 }),
      material: standard({ color: 0x20242c, roughness: 0.5 }),
      edges: edges({ color: 0xffffff, width: 1.5 }),
      interactive: true,
    }),
  );

/** The comet's ride: the handles as the behaviour's parameters. */
const rideParams = (model: Model): Readonly<Record<string, number>> =>
  Object.fromEntries([
    ['lap', 8],
    ...model.controls.slice(0, ridePoints).flatMap(([x, y], index) => [
      [`x${index}`, x],
      [`y${index}`, y],
    ]),
  ]);

const comet = (model: Model): SceneNode =>
  group({
    key: 'comet',
    behaviour: behave('ride', rideParams(model)),
    trail: trail({
      width: 3,
      length: 12,
      color: paintColour.gold,
      taper: 'linear',
      fade: true,
    }),
    children: [
      mesh({
        key: 'comet:head',
        geometry: sphere({ radius: 0.11 }),
        material: basic({ color: 0xfff4d6 }),
      }),
      ...(model.glitter
        ? [
            sparkles({
              key: 'comet:glitter',
              count: 40,
              spread: 0.9,
              size: 3,
              speed: 0.6,
              color: paintColour.gold,
            }),
          ]
        : []),
    ],
  });

export const sceneFor = (model: Model) =>
  scene({
    // Far enough for the stars: Drei draws them at twice their radius (React Three Fiber's
    // default camera reaches 1000).
    camera: perspectiveCamera({ fov: 45, position: [0, 0.2, 9], lookAt: [0, 0.2, 0], far: 400 }),
    children: [
      stars({ key: 'stars', radius: 40, depth: 30, count: 3000, factor: 3, fade: true }),
      curve(model),
      polygon(model),
      ...swing(model),
      ...handles(model),
      comet(model),
    ],
  });
