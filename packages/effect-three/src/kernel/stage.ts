/**
 * A ready-lit stage for a model, as Drei's `Stage` (`src/core/Stage.tsx` at `bf6f4ad`):
 * an ambient light, a main spot light and a fill point light placed by a lighting preset
 * and scaled by the content's size, contact shadows at its base, and an environment.
 *
 * Drei's `Stage` measures and centres its children and can fit the camera to them. Here
 * that is a loop through the Model, as controls are (ADR-006): measure the content
 * (`scene({ measure })` reports its box), place it at `centerOffset(box)` as Drei's
 * `Center` would, light it with `stage(stageBounds(box))`, and frame it with `fitCamera`
 * as Drei's `Bounds` would.
 *
 * @module
 */
import {
  ambientLight,
  contactShadows as contactShadowsOf,
  environment as environmentOf,
  pointLight,
  spotLight,
} from './build.ts';
import type { ContactShadows, Environment, SceneNode, Vec3 } from './description.ts';
import type { Box } from './orbit.ts';

/** Where the main and fill lights sit, in multiples of the content's radius. */
export type StageLighting = { readonly main: Vec3; readonly fill: Vec3 };

/** Drei's lighting presets. */
export const stagePresets = {
  rembrandt: { main: [1, 2, 1], fill: [-2, -0.5, -2] },
  portrait: { main: [-1, 2, 0.5], fill: [-1, 0.5, -1.5] },
  upfront: { main: [0, 2, 1], fill: [-1, 0.5, -1.5] },
  soft: { main: [-2, 4, 4], fill: [-1, 0.5, -1.5] },
} satisfies Record<string, StageLighting>;

export type StagePreset = keyof typeof stagePresets;

/** The scene parts a stage contributes: spread them into `scene`. */
export type Stage = {
  /** The stage's lights; add them to the scene's children. */
  readonly lights: ReadonlyArray<SceneNode>;
  readonly contactShadows: ContactShadows | null;
  readonly environment: Environment | null;
};

const scaled = (point: Vec3, by: number): Vec3 => [point[0] * by, point[1] * by, point[2] * by];

/**
 * Lights, ground shadows and an environment for content centred on the origin with
 * bounding radius `radius` and height `height`. Defaults as Drei's `Stage`: the
 * Rembrandt preset, intensity 0.5, contact shadows (`radius × 4` across, reaching
 * `radius` up, blur 2) and a spot light that casts shadow maps when the scene enables
 * them (bias −0.0001, 1024 texels). Drei's default environment is the "city" HDR from a
 * CDN; here it is three.js's `RoomEnvironment`, built in code. `keyPrefix` names the
 * lights (`stage-ambient`, `stage-main`, `stage-fill` by default).
 */
export const stage = (options: {
  readonly radius: number;
  readonly height: number;
  readonly preset?: StagePreset | StageLighting;
  readonly intensity?: number;
  readonly shadows?: 'contact' | 'none';
  readonly environment?: Environment | null;
  readonly keyPrefix?: string;
}): Stage => {
  const { radius, height } = options;
  const lighting =
    typeof options.preset === 'object'
      ? options.preset
      : stagePresets[options.preset ?? 'rembrandt'];
  const intensity = options.intensity ?? 0.5;
  const prefix = options.keyPrefix ?? 'stage';
  const shadowed = (options.shadows ?? 'contact') === 'contact';
  return {
    lights: [
      ambientLight({ key: `${prefix}-ambient`, intensity: intensity / 3 }),
      spotLight({
        key: `${prefix}-main`,
        position: scaled(lighting.main, radius),
        penumbra: 1,
        intensity: intensity * 2,
        castShadow: shadowed,
        shadowBias: -0.0001,
        shadowMapSize: 1024,
      }),
      pointLight({ key: `${prefix}-fill`, position: scaled(lighting.fill, radius), intensity }),
    ],
    contactShadows: shadowed
      ? contactShadowsOf({ position: [0, -height / 2, 0], size: radius * 4, far: radius, blur: 2 })
      : null,
    environment: options.environment === undefined ? environmentOf() : options.environment,
  };
};

/**
 * Which way to align content instead of centring it, per axis, as Drei's `Center` props:
 * `top` stands it on y = 0 (on top of the origin), `bottom` hangs it below; `left` puts
 * it left of x = 0, `right` right of it; `front` before z = 0, `back` behind. `disableY`
 * leaves that axis as it is.
 */
export type CenterAlign = {
  readonly top?: boolean;
  readonly bottom?: boolean;
  readonly left?: boolean;
  readonly right?: boolean;
  readonly front?: boolean;
  readonly back?: boolean;
  readonly disableX?: boolean;
  readonly disableY?: boolean;
  readonly disableZ?: boolean;
};

/**
 * One axis of Drei's `Center`: the shift that puts the box's middle at 0, moved half its
 * size up the axis (`above`, so its low side is at 0) or down it (`below`).
 */
const alignAxis = (
  min: number,
  max: number,
  above: boolean | undefined,
  below: boolean | undefined,
  disabled: boolean | undefined,
): number => {
  if (disabled === true) return 0;
  const half = (max - min) / 2;
  const shift = above === true ? half : below === true ? -half : 0;
  return -(min + max) / 2 + shift;
};

/**
 * Where to put content whose box (as measured where it is drawn now, at no offset) is
 * `box` so that it is centred on the origin, or aligned by `align`: Drei's `Center`
 * (`src/core/Center.tsx` at `bf6f4ad`), which sets its inner group to this position.
 */
export const centerOffset = (box: Box, align: CenterAlign = {}): Vec3 => [
  alignAxis(box.min[0], box.max[0], align.right, align.left, align.disableX),
  alignAxis(box.min[1], box.max[1], align.top, align.bottom, align.disableY),
  alignAxis(box.min[2], box.max[2], align.front, align.back, align.disableZ),
];

/**
 * The sizes Drei's `Stage` takes from `Center`'s report: the box's bounding sphere radius
 * (half its diagonal) and its width, height and depth. Pass to `stage` for lights and
 * shadows scaled to the content.
 */
export const stageBounds = (
  box: Box,
): {
  readonly radius: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
} => {
  const width = box.max[0] - box.min[0];
  const height = box.max[1] - box.min[1];
  const depth = box.max[2] - box.min[2];
  return { radius: Math.hypot(width, height, depth) / 2, width, height, depth };
};
