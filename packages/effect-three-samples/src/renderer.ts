/**
 * The renderer the samples draw with: three's WebGL renderer, or its WebGPU renderer when
 * the page's address asks for it with `?renderer=webgpu` (WebGPU where the browser has it,
 * its WebGL 2 backend otherwise).
 *
 * Labels are not drawn under WebGPU (troika has no WebGPU path), so a sample that needs
 * them stays on WebGL even when WebGPU is asked for, and says why (`rendererNotice`).
 *
 * Both canvases are transparent, so the host page's surface colour and theme show through.
 */
import type { RendererFactory } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';

/** What the renderer choice reads of the page: its address's query. */
export type Page = { readonly location: Pick<Location, 'search'> };

/** What a sample needs from its renderer. */
export type Needs = { readonly labels: boolean };

const asksForWebGpu = (page: Page): boolean =>
  new URLSearchParams(page.location.search).get('renderer') === 'webgpu';

/** Whether the page draws with WebGPU: asked for, and nothing it needs rules it out. */
export const drawsWithWebGpu = (page: Page, needs: Needs): boolean =>
  asksForWebGpu(page) && !needs.labels;

export const rendererForPage =
  (page: Page, needs: Needs = { labels: false }) =>
  (canvas: HTMLCanvasElement): RendererFactory =>
    drawsWithWebGpu(page, needs)
      ? EffectThreeFoldkit.webgpuRendererFactory(canvas, { alpha: true })
      : EffectThreeFoldkit.webglRendererFactory(canvas, { alpha: true });

/** Why a page asked for WebGPU but draws with WebGL, or nothing when it did not need to. */
export const rendererNotice = (page: Page, needs: Needs): string | null =>
  asksForWebGpu(page) && needs.labels
    ? 'You asked for WebGPU, but this example draws labels with troika, which has no WebGPU path yet, so it runs on WebGL.'
    : null;
