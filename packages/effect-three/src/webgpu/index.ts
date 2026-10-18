/**
 * The WebGPU render kit: the scene's shaded parts (the sky, the shader grid, contact
 * shadows) written in TSL, for three.js's `WebGPURenderer` on either of its backends.
 * The Foldkit adapter's `webgpuRendererFactory` carries it.
 *
 * @module
 */
import type { RenderKit } from '../kernel/renderKit.ts';
import { createContactShadows } from './contactShadows.ts';
import { hostShaderGrid } from './shaderGrid.ts';
import { hostSky } from './sky.ts';

export const webgpuKit: RenderKit = {
  // troika's labels are WebGL materials; real WebGPU rejects their draw calls.
  drawsLabels: false,
  sky: hostSky,
  shaderGrid: hostShaderGrid,
  contactShadows: createContactShadows,
};
