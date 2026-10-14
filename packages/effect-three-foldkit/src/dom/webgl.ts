/**
 * The WebGL2 renderer behind the core's backend-neutral renderer contract.
 *
 * @module
 */
import type { RendererFactory } from '@opsydyn/effect-three';
import { WebGLRenderer, type WebGLRendererParameters } from 'three';

/** Options passed through to three's `WebGLRenderer`. The canvas is always the scene's own. */
export type WebGLOptions = Omit<WebGLRendererParameters, 'canvas'>;

/** A factory for a WebGL2 renderer drawing into `canvas`. `create` throws if WebGL2 is unavailable. */
export const webglRendererFactory = (
  canvas: HTMLCanvasElement,
  options: WebGLOptions = {},
): RendererFactory => ({
  create: () => {
    const renderer = new WebGLRenderer({ antialias: true, ...options, canvas });
    return {
      render: (scene, camera) => renderer.render(scene, camera),
      setViewport: (viewport) => {
        renderer.setPixelRatio(viewport.pixelRatio);
        renderer.setSize(viewport.width, viewport.height, false);
      },
      memory: () => ({
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      }),
      // dispose() frees three's GPU objects but not the WebGL context. Browsers cap live
      // contexts (about 16 in Chromium), so release it now rather than at garbage collection.
      dispose: () => {
        renderer.dispose();
        renderer.forceContextLoss();
      },
    };
  },
});
