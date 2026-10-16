/**
 * A ready-lit stage for a model, as Drei's `Stage` (`src/core/Stage.tsx` at `bf6f4ad`):
 * an ambient light, a main spot light and a fill point light placed by a lighting preset
 * and scaled by the content's size, contact shadows at its base, and an environment.
 *
 * Drei's `Stage` measures and centres its children and can fit the camera to them. Here
 * the content's size is data the application knows (or measures once), and the content
 * is centred on the origin, as Drei's `Center` would leave it.
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
