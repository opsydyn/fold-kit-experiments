/**
 * The WebGL2 renderer behind the core's backend-neutral renderer contract.
 *
 * @module
 */
import type { RendererFactory, RenderSettings, RenderTarget } from '@opsydyn/effect-three';
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  BasicShadowMap,
  type Camera,
  CineonToneMapping,
  type ColorSpace,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  LinearToneMapping,
  Material,
  NeutralToneMapping,
  NoToneMapping,
  type Object3D,
  PCFShadowMap,
  PMREMGenerator,
  ReinhardToneMapping,
  type Scene,
  type ShadowMapType,
  SRGBColorSpace,
  type ToneMapping,
  Vector2,
  VSMShadowMap,
  WebGLRenderer,
  type WebGLRendererParameters,
  WebGLRenderTarget,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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

/**
 * Applies scene render settings; a change of shadow mode re-renders the shadow maps.
 * Returns whether shadows were switched on or off, which materials must be recompiled for.
 */
const configure = (renderer: WebGLRenderer, settings: RenderSettings): boolean => {
  const shadowMap = renderer.shadowMap;
  const enabled = settings.shadows !== 'off';
  const switched = shadowMap.enabled !== enabled;
  const type = enabled ? shadowTypes[settings.shadows] : shadowMap.type;
  if (switched || shadowMap.type !== type) shadowMap.needsUpdate = true;
  shadowMap.enabled = enabled;
  shadowMap.type = type;
  renderer.toneMapping = toneMappings[settings.toneMapping];
  renderer.toneMappingExposure = settings.exposure;
  renderer.outputColorSpace = colorSpaces[settings.colorSpace];
  return switched;
};

/**
 * Flags every material in the scene for recompilation. three.js keeps a shader built
 * with shadows sampling its last shadow map after `shadowMap.enabled` turns off (and
 * without shadows after it turns on) until its material is updated.
 */
const recompileMaterials = (scene: Object3D): void => {
  scene.traverse((object) => {
    const material: unknown = Reflect.get(object, 'material');
    const materials = Array.isArray(material) ? material : [material];
    for (const each of materials) if (each instanceof Material) each.needsUpdate = true;
  });
};

const drawingSize = new Vector2();

/**
 * A render texture's target, as Drei's `useFBO` makes one for `RenderTexture` (drei
 * `bf6f4ad`, `src/core/Fbo.tsx`): half-float colour, linear filtering, multisampled, with
 * a depth buffer.
 */
const createTarget = (
  targets: WeakMap<RenderTarget, WebGLRenderTarget>,
  width: number,
  height: number,
): RenderTarget => {
  const target = new WebGLRenderTarget(width, height, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    type: HalfFloatType,
    samples: 8,
  });
  const handle = { texture: target.texture, dispose: () => target.dispose() };
  targets.set(handle, target);
  return handle;
};

/**
 * three.js's `RoomEnvironment`, prefiltered for image-based lighting, as three's examples
 * set it up (`PMREMGenerator.fromScene(new RoomEnvironment(), 0.04)`).
 */
const createRoom = (renderer: WebGLRenderer): RenderTarget => {
  const generator = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const target = generator.fromScene(room, 0.04);
  room.dispose();
  generator.dispose();
  return { texture: target.texture, dispose: () => target.dispose() };
};

/** Each canvas's three.js renderer, for presenting it in a WebXR session. */
const renderers = new WeakMap<HTMLCanvasElement, WebGLRenderer>();

/** The three.js renderer drawing into `canvas`, if one does. */
export const webglRendererOf = (canvas: HTMLCanvasElement): WebGLRenderer | undefined =>
  renderers.get(canvas);

/**
 * Draws a frame of an immersive session. In AR the room shows through: three clears to
 * transparent there, but a background (an environment shown as one) would cover it, so it
 * is left out of the frame.
 */
const drawPresenting = (renderer: WebGLRenderer, scene: Scene, camera: Camera): void => {
  const passthrough = renderer.xr.getEnvironmentBlendMode() !== 'opaque';
  if (!passthrough || scene.background === null) {
    renderer.render(scene, camera);
    return;
  }
  const background = scene.background;
  scene.background = null;
  renderer.render(scene, camera);
  scene.background = background;
};

/** A factory for a WebGL2 renderer drawing into `canvas`. `create` throws if WebGL2 is unavailable. */
export const webglRendererFactory = (
  canvas: HTMLCanvasElement,
  options: WebGLOptions = {},
): RendererFactory => ({
  create: () => {
    const renderer = new WebGLRenderer({ antialias: true, ...options, canvas });
    renderers.set(canvas, renderer);
    const post = createPostProcessing(renderer);
    const targets = new WeakMap<RenderTarget, WebGLRenderTarget>();
    // The pixel ratio is the viewport's, scaled by the scene's resolution setting.
    let pixelRatio = 1;
    let resolution = 1;
    let scissored = false;
    // Counts shadow switches; each scene drawn (main or render texture) recompiles its
    // materials once after a switch.
    let shadowSwitches = 0;
    const compiledAt = new WeakMap<Object3D, number>();
    const applyPixelRatio = (): void => {
      if (renderer.getPixelRatio() !== pixelRatio * resolution) {
        renderer.setPixelRatio(pixelRatio * resolution);
      }
      const { width, height } = renderer.getSize(drawingSize);
      post.setSize(width, height, pixelRatio * resolution);
    };
    return {
      render: (scene, camera, area, target) => {
        if (shadowSwitches > 0 && compiledAt.get(scene) !== shadowSwitches) {
          recompileMaterials(scene);
          compiledAt.set(scene, shadowSwitches);
        }
        const webglTarget = target === undefined ? undefined : targets.get(target);
        if (webglTarget !== undefined) {
          // As Drei's RenderTexture draws (src/core/RenderTexture.tsx): into the target, then
          // back to whatever was bound. A target keeps its own viewport and scissor.
          // Targets start transparent, whatever the canvas clears to: what the scene does
          // not cover stays see-through (a render texture without a background, contact
          // shadows away from objects).
          // Offscreen passes keep their own camera, even while presenting in XR (three
          // would otherwise draw them from the headset).
          const previous = renderer.getRenderTarget();
          const clearAlpha = renderer.getClearAlpha();
          const xrEnabled = renderer.xr.enabled;
          renderer.xr.enabled = false;
          renderer.setClearAlpha(0);
          renderer.setRenderTarget(webglTarget);
          renderer.render(scene, camera);
          renderer.setRenderTarget(previous);
          renderer.setClearAlpha(clearAlpha);
          renderer.xr.enabled = xrEnabled;
          return;
        }
        // Presenting in XR, three draws the headset's views itself: no areas, no effects.
        if (renderer.xr.isPresenting) {
          drawPresenting(renderer, scene, camera);
          return;
        }
        const { width, height } = renderer.getSize(drawingSize);
        if (area === undefined) {
          if (scissored) {
            renderer.setScissorTest(false);
            renderer.setViewport(0, 0, width, height);
            scissored = false;
          }
          if (!post.render(scene, camera)) renderer.render(scene, camera);
          return;
        }
        // three's viewport and scissor origin is the bottom left; areas are from the top.
        const bottom = height - area.y - area.height;
        renderer.setViewport(area.x, bottom, area.width, area.height);
        renderer.setScissor(area.x, bottom, area.width, area.height);
        renderer.setScissorTest(true);
        scissored = true;
        // Effects apply to the single full view only; views draw straight to the screen.
        renderer.render(scene, camera);
      },
      createTarget: (width, height) => createTarget(targets, width, height),
      createEnvironment: () => createRoom(renderer),
      configure: (settings) => {
        if (configure(renderer, settings)) shadowSwitches++;
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
        renderers.delete(canvas);
        void renderer.xr.getSession()?.end();
        post.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      },
    };
  },
});
