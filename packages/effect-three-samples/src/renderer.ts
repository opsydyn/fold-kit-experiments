/**
 * The renderer the samples draw with: three's WebGL renderer, or its WebGPU renderer when
 * the page's address asks for it with `?renderer=webgpu` (WebGPU where the browser has it,
 * its WebGL 2 backend otherwise). Labels are not drawn under WebGPU.
 *
 * Both canvases are transparent, so the host page's surface colour and theme show through.
 */
import type { RendererFactory } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';

export const rendererForPage =
  (page: Pick<Window, 'location'>) =>
  (canvas: HTMLCanvasElement): RendererFactory =>
    new URLSearchParams(page.location.search).get('renderer') === 'webgpu'
      ? EffectThreeFoldkit.webgpuRendererFactory(canvas, { alpha: true })
      : EffectThreeFoldkit.webglRendererFactory(canvas, { alpha: true });
