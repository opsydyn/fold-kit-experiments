/**
 * The type gallery: a dark room whose wall is an arc round the visitor. Everything on it
 * is a label described as data:
 *
 * - the title follows the wall's curve (`curveRadius`, the wall's radius);
 * - the code plaque is coloured by `colorRanges` from a small highlighter;
 * - with the lights on, the labels take a lit `material`, so the spotlights show on them;
 * - each plaque's panel is sized from its label's measured layout (`LabelMeasured`), so
 *   the note the visitor types grows its panel as it wraps.
 */
import {
  ambientLight,
  colorRange,
  environment,
  fixed,
  group,
  label,
  type LabelNode,
  mesh,
  physical,
  plane,
  renderSettings,
  scene,
  type SceneNode,
  spotLight,
  standard,
} from '@opsydyn/effect-three';

import { paintColour } from '../palette';
import { highlight } from './highlight';
import { type Block, facing, type Model, onWall, type Plaque, wall } from './model';
import { code, noteDegrees, plaques } from './plaques';

const textKey = (id: string): string => `${id}:text`;

/** The wall: an arc of dark panels, sixteen degrees each, from −64° to 64°. */
const wallPanels: ReadonlyArray<SceneNode> = Array.from({ length: 9 }, (_, index) => {
  const degrees = -64 + index * 16;
  return mesh({
    key: `wall:${index}`,
    position: onWall(degrees, 3.5),
    rotation: fixed(facing(degrees)),
    geometry: plane({ width: 2 * wall.radius * Math.sin((8 * Math.PI) / 180) + 0.02, height: 7 }),
    material: standard({ color: 0x1c1f27, roughness: 0.95 }),
    receiveShadow: true,
  });
});

const floor: SceneNode = mesh({
  key: 'floor',
  rotation: fixed([-Math.PI / 2, 0, 0]),
  position: [0, 0, 1],
  geometry: plane({ width: 30, height: 30 }),
  material: standard({ color: 0x121419, roughness: 0.6, metalness: 0.2 }),
  receiveShadow: true,
});

const font = (model: Model): string => `${model.assetBase}inter-latin-400-normal.woff`;

/** A lit material for the labels when the lights are on; troika's own, unlit, when off. */
const ink = (model: Model) => (model.lit ? standard({ roughness: 0.55, metalness: 0.05 }) : null);

const title = (model: Model): ReadonlyArray<SceneNode> => [
  label({
    key: 'title',
    text: 'effect-three',
    font: font(model),
    fontSize: 0.95,
    letterSpacing: -0.02,
    position: onWall(0, 3.95, 0.06),
    // Concave, round the visitor: the wall's own curve.
    curveRadius: wall.radius - 0.06,
    color: 0xf2efe8,
    colorRanges: [colorRange(0, 0xf2efe8), colorRange(7, paintColour.gold)],
    material: model.lit ? physical({ roughness: 0.35, metalness: 0.2, clearcoat: 0.6 }) : null,
  }),
  label({
    key: 'subtitle',
    text: 'A GALLERY OF LABELS, EVERY ONE OF THEM DATA',
    font: font(model),
    fontSize: 0.16,
    letterSpacing: 0.18,
    position: onWall(0, 3.25, 0.06),
    curveRadius: wall.radius - 0.06,
    color: 0x9aa0ab,
    material: ink(model),
  }),
];

/** The panel behind a label, sized to its laid-out block with a margin, once measured. */
const panel = (
  id: string,
  block: Block | undefined,
  selected: boolean,
): ReadonlyArray<SceneNode> => {
  if (block === undefined) return [];
  const [minX, minY, maxX, maxY] = block;
  return [
    mesh({
      key: `${id}:panel`,
      position: [(minX + maxX) / 2, (minY + maxY) / 2, -0.015],
      geometry: plane({ width: maxX - minX + 0.36, height: maxY - minY + 0.3 }),
      material: standard({
        color: selected ? 0x2c3346 : 0x262a33,
        roughness: 0.7,
        emissive: paintColour.blue,
        emissiveIntensity: selected ? 0.08 : 0,
      }),
      receiveShadow: true,
    }),
  ];
};

const plaqueText = (model: Model, plaque: Plaque): LabelNode =>
  label({
    key: textKey(plaque.id),
    text: plaque.text,
    font: font(model),
    fontSize: plaque.fontSize,
    maxWidth: plaque.maxWidth,
    lineHeight: 1.35,
    textAlign: 'left',
    color: 0xeae6de,
    colorRanges:
      plaque.id === 'code'
        ? highlight(code)
        : [colorRange(0, paintColour.gold)].concat(
            // The first line (the headline) in gold, the rest in the plaque's ink.
            plaque.text.includes('\n') ? [colorRange(plaque.text.indexOf('\n'), 0xeae6de)] : [],
          ),
    material: ink(model),
  });

const hung = (model: Model, plaque: Plaque): SceneNode =>
  group({
    key: plaque.id,
    // Far enough off the wall that a flat plaque clears its curve: a 3.4-unit plaque on a
    // 6-unit radius sags a quarter of a unit at its edges.
    position: onWall(plaque.degrees, 1.9, 0.35),
    rotation: fixed(facing(plaque.degrees)),
    interactive: true,
    children: [
      ...panel(plaque.id, model.layouts[textKey(plaque.id)], model.focus === plaque.id),
      plaqueText(model, plaque),
    ],
  });

const note = (model: Model): Plaque => ({
  id: 'note',
  degrees: noteDegrees,
  text: model.note.length === 0 ? '…' : model.note,
  fontSize: 0.2,
  maxWidth: 2.2,
});

/** A spotlight from the ceiling onto a plaque. */
const spot = (key: string, degrees: number, intensity: number, height = 1.9, angle = 0.42) =>
  spotLight({
    key,
    position: onWall(degrees, 4.8, 2.4),
    target: onWall(degrees, height, 0),
    intensity,
    angle,
    penumbra: 0.75,
    decay: 2,
    color: 0xfff1dc,
  });

export const measured: ReadonlyArray<string> = [...plaques.map((plaque) => plaque.id), 'note'].map(
  textKey,
);

export const sceneFor = (model: Model) => {
  const hangings = [...plaques, note(model)];
  return scene({
    camera: model.camera,
    gestures: 'scene',
    measure: measured,
    environment: environment({ environmentIntensity: 0.15 }),
    // No tone mapping: ACES pushes the type's bright, saturated colours towards white.
    render: renderSettings({ toneMapping: 'none' }),
    children: [
      ambientLight({ key: 'ambient', intensity: model.lit ? 0.1 : 0.5 }),
      ...hangings.map((plaque) => spot(`spot:${plaque.id}`, plaque.degrees, model.lit ? 26 : 0)),
      spot('spot:title', 0, model.lit ? 34 : 0, 3.7, 0.95),
      floor,
      ...wallPanels,
      ...title(model),
      ...hangings.map((plaque) => hung(model, plaque)),
    ],
  });
};
