/**
 * The troika label engine for pages that may draw with `WebGPURenderer`: troika's WebGL
 * labels for `WebGLRenderer`, and the same labels drawn with node materials (TSL) for a
 * `'tsl'` render kit. Pass it as the root entry's is:
 *
 * ```ts
 * import { troikaLabels } from '@opsydyn/effect-three-troika/webgpu';
 *
 * const environment = EffectThreeFoldkit.makeEnvironment(window, {
 *   renderer: EffectThreeFoldkit.webgpuRendererFactory,
 *   labels: troikaLabels(),
 * });
 * ```
 *
 * @module
 */
import type { LabelEngine } from '@opsydyn/effect-three';

import { troikaLabels as webglLabels } from './index.ts';
import { hostTslLabel } from './tsl.ts';

/** The troika label engine, for WebGL and WebGPU. One serves every scene on a page. */
export const troikaLabels = (): LabelEngine => ({ ...webglLabels(), createTsl: hostTslLabel });
