/**
 * The renderer the samples draw with: three's WebGL renderer, or its WebGPU renderer when
 * the page's address asks for it with `?renderer=webgpu` (WebGPU where the browser has it,
 * its WebGL 2 backend otherwise). Every sample draws with either, labels included.
 *
 * Both canvases are transparent, so the host page's surface colour and theme show through.
 */
import type { RendererFactory } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';

/** What the renderer choice reads of the page: its address's query. */
export type Page = { readonly location: Pick<Location, 'search'> };

/** Whether the page's address asks for WebGPU. */
export const drawsWithWebGpu = (page: Page): boolean =>
  new URLSearchParams(page.location.search).get('renderer') === 'webgpu';

export const rendererForPage =
  (page: Page) =>
  (canvas: HTMLCanvasElement): RendererFactory =>
    drawsWithWebGpu(page)
      ? EffectThreeFoldkit.webgpuRendererFactory(canvas, { alpha: true })
      : EffectThreeFoldkit.webglRendererFactory(canvas, { alpha: true });
