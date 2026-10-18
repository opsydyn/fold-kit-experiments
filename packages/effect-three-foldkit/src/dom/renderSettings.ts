/**
 * What the WebGL and WebGPU renderers share: the scene's render settings by three.js's
 * names, recompiling materials when shadows switch, and which renderer draws each
 * canvas, for presenting it in an immersive session.
 *
 * @module
 */
import type { RenderSettings } from '@opsydyn/effect-three';
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  BasicShadowMap,
  CineonToneMapping,
  type ColorSpace,
  LinearSRGBColorSpace,
  LinearToneMapping,
  Material,
  NeutralToneMapping,
  NoToneMapping,
  type Object3D,
  PCFShadowMap,
  ReinhardToneMapping,
  type ShadowMapType,
  SRGBColorSpace,
  type ToneMapping,
  VSMShadowMap,
  type WebGLRenderer,
} from 'three';
import type { WebGPURenderer } from 'three/webgpu';

/**
 * Shadow map types by React Three Fiber's names (`core/configuration.ts` at `d74622e`).
 * three 0.186 folded PCF soft into PCF (softness is per light), so `soft` maps to PCF
 * here; R3F's PCFSoftShadowMap would only log a removal warning on this version.
 */
export const shadowTypes = {
  basic: BasicShadowMap,
  percentage: PCFShadowMap,
  soft: PCFShadowMap,
  variance: VSMShadowMap,
} satisfies Record<Exclude<RenderSettings['shadows'], 'off'>, ShadowMapType>;

export const toneMappings = {
  none: NoToneMapping,
  linear: LinearToneMapping,
  reinhard: ReinhardToneMapping,
  cineon: CineonToneMapping,
  aces: ACESFilmicToneMapping,
  agx: AgXToneMapping,
  neutral: NeutralToneMapping,
} satisfies Record<RenderSettings['toneMapping'], ToneMapping>;

export const colorSpaces = {
  srgb: SRGBColorSpace,
  linear: LinearSRGBColorSpace,
} satisfies Record<RenderSettings['colorSpace'], ColorSpace>;

/**
 * Flags every material in the scene for recompilation. three.js keeps a shader built
 * with shadows sampling its last shadow map after `shadowMap.enabled` turns off (and
 * without shadows after it turns on) until its material is updated.
 */
export const recompileMaterials = (scene: Object3D): void => {
  scene.traverse((object) => {
    const material: unknown = Reflect.get(object, 'material');
    const materials = Array.isArray(material) ? material : [material];
    for (const each of materials) if (each instanceof Material) each.needsUpdate = true;
  });
};

/** What presenting a renderer in WebXR uses; three's WebGL and WebGPU renderers both have it. */
export type PresentableRenderer = {
  readonly xr: {
    enabled: boolean;
    readonly isPresenting: boolean;
    setReferenceSpaceType: (type: XRReferenceSpaceType) => void;
    setFramebufferScaleFactor: (scale: number) => void;
    setSession: (session: XRSession) => Promise<void>;
    getReferenceSpace: () => XRReferenceSpace | null;
    setReferenceSpace: (space: XRReferenceSpace) => void;
    getEnvironmentBlendMode: () => XREnvironmentBlendMode | undefined;
  };
  /**
   * Hands the session's frames to `callback` (`null` stops), set before the session starts:
   * WebGL's `xr.setAnimationLoop`, or WebGPU's `setAnimationLoop`, which its XR manager
   * captures when the session starts. It may also be called outside the session.
   */
  readonly setXrLoop: (callback: ((time: number, frame?: XRFrame) => void) | null) => void;
};

/** Each canvas's three.js renderer, for presenting it in a WebXR session. */
const presentable = new WeakMap<HTMLCanvasElement, PresentableRenderer>();
/** Each canvas's three.js renderer itself, for tests that read three's own state. */
const drawing = new WeakMap<HTMLCanvasElement, WebGLRenderer | WebGPURenderer>();

export const registerPresentable = (
  canvas: HTMLCanvasElement,
  renderer: WebGLRenderer | WebGPURenderer,
  presenting: PresentableRenderer,
): void => {
  presentable.set(canvas, presenting);
  drawing.set(canvas, renderer);
};

export const forgetPresentable = (canvas: HTMLCanvasElement): void => {
  presentable.delete(canvas);
  drawing.delete(canvas);
};

/** The three.js renderer drawing into `canvas` (WebGL or WebGPU), if one does. */
export const threeRendererOf = (
  canvas: HTMLCanvasElement,
): WebGLRenderer | WebGPURenderer | undefined => drawing.get(canvas);

/** The three.js renderer drawing into `canvas`, if one does. */
export const presentableRendererOf = (canvas: HTMLCanvasElement): PresentableRenderer | undefined =>
  presentable.get(canvas);
