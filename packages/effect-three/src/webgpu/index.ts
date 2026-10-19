/**
 * The WebGPU render kit: the scene's shaded parts (the sky, the shader grid, contact
 * shadows) written in TSL, for three.js's `WebGPURenderer` on either of its backends.
 * The Foldkit adapter's `webgpuRendererFactory` carries it.
 *
 * @module
 */
import type { RenderKit } from '../kernel/renderKit.ts';
import { createContactShadows } from './contactShadows.ts';
import { hostLine } from './line.ts';
import { hostPoints } from './points.ts';
import { hostShaderGrid } from './shaderGrid.ts';
import { hostSky } from './sky.ts';

export const webgpuKit: RenderKit = {
  // Node materials: label engines draw with their TSL implementation (`createTsl`).
  shading: 'tsl',
  sky: hostSky,
  shaderGrid: hostShaderGrid,
  line: hostLine,
  points: hostPoints,
  contactShadows: createContactShadows,
};
