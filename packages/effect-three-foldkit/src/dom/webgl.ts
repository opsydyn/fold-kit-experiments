/**
 * The WebGL2 renderer behind the core's backend-neutral renderer contract.
 *
 * @module
 */
import type { RendererFactory, RenderSettings } from '@opsydyn/effect-three';
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  BasicShadowMap,
  CineonToneMapping,
  type ColorSpace,
  LinearSRGBColorSpace,
  LinearToneMapping,
  NeutralToneMapping,
  NoToneMapping,
  PCFShadowMap,
  ReinhardToneMapping,
  type ShadowMapType,
  SRGBColorSpace,
  type ToneMapping,
  Vector2,
  VSMShadowMap,
  WebGLRenderer,
  type WebGLRendererParameters,
} from 'three';

import { createPostProcessing } from './postprocessing.ts';

/** Options passed through to three's `WebGLRenderer`. The canvas is always the scene's own. */
export type WebGLOptions = Omit<WebGLRendererParameters, 'canvas'>;

/**
 * Shadow map types by React Three Fiber's names (`core/configuration.ts` at `d74622e`).
 * three 0.186 folded PCF soft into PCF (softness is per light), so `soft` maps to PCF
 * here; R3F's PCFSoftShadowMap would only log a removal warning on this version.
 */
const shadowTypes = {
  basic: BasicShadowMap,
  percentage: PCFShadowMap,
  soft: PCFShadowMap,
  variance: VSMShadowMap,
} satisfies Record<Exclude<RenderSettings['shadows'], 'off'>, ShadowMapType>;

const toneMappings = {
  none: NoToneMapping,
  linear: LinearToneMapping,
  reinhard: ReinhardToneMapping,
  cineon: CineonToneMapping,
  aces: ACESFilmicToneMapping,
  agx: AgXToneMapping,
  neutral: NeutralToneMapping,
} satisfies Record<RenderSettings['toneMapping'], ToneMapping>;

const colorSpaces = {
  srgb: SRGBColorSpace,
  linear: LinearSRGBColorSpace,
} satisfies Record<RenderSettings['colorSpace'], ColorSpace>;

/** Applies scene render settings; a change of shadow mode re-renders the shadow maps. */
const configure = (renderer: WebGLRenderer, settings: RenderSettings): void => {
  const shadowMap = renderer.shadowMap;
  const enabled = settings.shadows !== 'off';
  const type = enabled ? shadowTypes[settings.shadows] : shadowMap.type;
  if (shadowMap.enabled !== enabled || shadowMap.type !== type) shadowMap.needsUpdate = true;
  shadowMap.enabled = enabled;
  shadowMap.type = type;
  renderer.toneMapping = toneMappings[settings.toneMapping];
  renderer.toneMappingExposure = settings.exposure;
  renderer.outputColorSpace = colorSpaces[settings.colorSpace];
};

const drawingSize = new Vector2();

/** A factory for a WebGL2 renderer drawing into `canvas`. `create` throws if WebGL2 is unavailable. */
export const webglRendererFactory = (
  canvas: HTMLCanvasElement,
  options: WebGLOptions = {},
): RendererFactory => ({
  create: () => {
    const renderer = new WebGLRenderer({ antialias: true, ...options, canvas });
    const post = createPostProcessing(renderer);
    // The pixel ratio is the viewport's, scaled by the scene's resolution setting.
    let pixelRatio = 1;
    let resolution = 1;
    const applyPixelRatio = (): void => {
      if (renderer.getPixelRatio() !== pixelRatio * resolution) {
        renderer.setPixelRatio(pixelRatio * resolution);
      }
      const { width, height } = renderer.getSize(drawingSize);
      post.setSize(width, height, pixelRatio * resolution);
    };
    return {
      render: (scene, camera) => {
        if (!post.render(scene, camera)) renderer.render(scene, camera);
      },
      configure: (settings) => {
        configure(renderer, settings);
        resolution = settings.resolution;
        post.configure(settings.effects);
        applyPixelRatio();
      },
      setViewport: (viewport) => {
        pixelRatio = viewport.pixelRatio;
        applyPixelRatio();
        renderer.setSize(viewport.width, viewport.height, false);
        post.setSize(viewport.width, viewport.height, pixelRatio * resolution);
      },
      memory: () => ({
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      }),
      // dispose() frees three's GPU objects but not the WebGL context. Browsers cap live
      // contexts (about 16 in Chromium), so release it now rather than at garbage collection.
      dispose: () => {
        post.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      },
    };
  },
});
