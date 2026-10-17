/**
 * Drei's environment presets (`src/helpers/environment-assets.ts` and the `CUBEMAP_ROOT` of
 * `src/core/useEnvironment.tsx` at `bf6f4ad`): Poly Haven HDR panoramas (CC0) on Drei's
 * asset repository at the commit Drei pins, served by a CDN. Nothing is fetched until an
 * application loads one, as an environment map lent like any other:
 *
 * ```ts
 * environment.assets.loadEnvironment('sky', environmentPresetUrl('city'));
 * scene({ environment: environment({ map: 'sky' }) });
 * ```
 *
 * @module
 */

/** Each preset's file. */
export const environmentPresets = {
  apartment: 'lebombo_1k.hdr',
  city: 'potsdamer_platz_1k.hdr',
  dawn: 'kiara_1_dawn_1k.hdr',
  forest: 'forest_slope_1k.hdr',
  lobby: 'st_fagans_interior_1k.hdr',
  night: 'dikhololo_night_1k.hdr',
  park: 'rooitou_park_1k.hdr',
  studio: 'studio_small_03_1k.hdr',
  sunset: 'venice_sunset_1k.hdr',
  warehouse: 'empty_warehouse_01_1k.hdr',
} satisfies Readonly<Record<string, string>>;

export type EnvironmentPreset = keyof typeof environmentPresets;

/** Where Drei's presets are served from: its asset repository at the commit it pins. */
const dreiAssets = {
  hdri: 'https://raw.githack.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri/',
} as const;

/** The URL of a preset's HDR file, for `assets.loadEnvironment`. */
export const environmentPresetUrl = (preset: EnvironmentPreset): string =>
  `${dreiAssets.hdri}${environmentPresets[preset]}`;
