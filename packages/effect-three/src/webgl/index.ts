/**
 * The WebGL render kit: the scene parts written in GLSL (the sky, the shader grid,
 * contact shadows), for renderers drawing with three.js's `WebGLRenderer`. The Foldkit
 * adapter's `webglRendererFactory` carries it; pass it to `createSceneGraph({ kit })`
 * when using the kernel directly.
 *
 * @module
 */
import type { RenderKit } from '../kernel/renderKit.ts';
import { createContactShadows } from './contactShadows.ts';
import { hostShaderGrid } from './shaderGrid.ts';
import { hostSky } from './sky.ts';

export const webglKit: RenderKit = {
  sky: hostSky,
  shaderGrid: hostShaderGrid,
  contactShadows: createContactShadows,
};
