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
  VSMShadowMap,
  WebGLRenderer,
  type WebGLRendererParameters,
} from 'three';

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

/** A factory for a WebGL2 renderer drawing into `canvas`. `create` throws if WebGL2 is unavailable. */
export const webglRendererFactory = (
  canvas: HTMLCanvasElement,
  options: WebGLOptions = {},
): RendererFactory => ({
  create: () => {
    const renderer = new WebGLRenderer({ antialias: true, ...options, canvas });
    return {
      render: (scene, camera) => renderer.render(scene, camera),
      configure: (settings) => configure(renderer, settings),
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
