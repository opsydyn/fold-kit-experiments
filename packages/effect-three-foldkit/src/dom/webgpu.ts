/**
 * three.js's `WebGPURenderer` behind the core's renderer contract: WebGPU where the browser
 * has it, otherwise its WebGL 2 backend (or always, with `forceWebGL`), drawing the same
 * node materials either way. It carries the WebGPU render kit (the sky, shader grid and
 * contact shadows in TSL), post-processes with `RenderPipeline`, and presents in WebXR.
 * It starts asynchronously (`init()`), which the runtime waits for.
 *
 * Not drawn under it: labels, which troika makes from WebGL shaders; a label engine's
 * labels are silently empty here.
 *
 * @module
 */
import type { RendererFactory, RenderSettings, RenderTarget } from '@opsydyn/effect-three';
import { webgpuKit } from '@opsydyn/effect-three/webgpu';
import {
  type Camera,
  HalfFloatType,
  LinearFilter,
  type Object3D,
  RenderTarget as ThreeRenderTarget,
  type Scene,
  Vector2,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PMREMGenerator, WebGPURenderer } from 'three/webgpu';

import {
  colorSpaces,
  forgetPresentable,
  recompileMaterials,
  registerPresentable,
  shadowTypes,
  toneMappings,
} from './renderSettings.ts';
import { createWebGPUPostProcessing } from './webgpuPostprocessing.ts';

/** Options for three's `WebGPURenderer`. The canvas is always the scene's own. */
export type WebGPUOptions = {
  /** Use the WebGL 2 backend even where WebGPU is available. */
  readonly forceWebGL?: boolean;
  readonly alpha?: boolean;
  readonly antialias?: boolean;
};

/** Applies scene render settings; returns whether shadows were switched on or off. */
const configure = (renderer: WebGPURenderer, settings: RenderSettings): boolean => {
  const shadowMap = renderer.shadowMap;
  const enabled = settings.shadows !== 'off';
  const switched = shadowMap.enabled !== enabled;
  shadowMap.enabled = enabled;
  if (enabled) shadowMap.type = shadowTypes[settings.shadows];
  renderer.toneMapping = toneMappings[settings.toneMapping];
  renderer.toneMappingExposure = settings.exposure;
  renderer.outputColorSpace = colorSpaces[settings.colorSpace];
  return switched;
};

const drawingSize = new Vector2();

/**
 * A render texture's target, as the WebGL renderer makes one (Drei's `useFBO`): half-float
 * colour, linear filtering, multisampled (4, WebGPU's only multisample count), with depth.
 */
const createTarget = (
  targets: WeakMap<RenderTarget, ThreeRenderTarget>,
  width: number,
  height: number,
): RenderTarget => {
  const target = new ThreeRenderTarget(width, height, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    type: HalfFloatType,
    samples: 4,
  });
  const handle = { texture: target.texture, dispose: () => target.dispose() };
  targets.set(handle, target);
  return handle;
};

/** three.js's `RoomEnvironment`, prefiltered by the WebGPU renderer's PMREM generator. */
const createRoom = (renderer: WebGPURenderer): RenderTarget => {
  const generator = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const target = generator.fromScene(room, 0.04);
  room.dispose();
  generator.dispose();
  return { texture: target.texture, dispose: () => target.dispose() };
};

/**
 * Draws a frame of an immersive session. In AR the room shows through, so a background
 * (an environment shown as one) is left out of the frame, as the WebGL renderer does.
 */
const drawPresenting = (renderer: WebGPURenderer, scene: Scene, camera: Camera): void => {
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

/** A factory for three's `WebGPURenderer` drawing into `canvas`. */
export const webgpuRendererFactory = (
  canvas: HTMLCanvasElement,
  options: WebGPUOptions = {},
): RendererFactory => ({
  // The TSL parts of a scene (sky, shader grid, contact shadows) go with this renderer.
  kit: webgpuKit,
  create: () => {
    // Opaque by default, as three's WebGLRenderer is (WebGPURenderer's own default is alpha).
    const renderer = new WebGPURenderer({ antialias: true, alpha: false, ...options, canvas });
    registerPresentable(canvas, renderer, {
      xr: renderer.xr,
      setXrLoop: (callback) => {
        void renderer.setAnimationLoop(callback);
      },
    });
    const post = createWebGPUPostProcessing(renderer);
    const targets = new WeakMap<RenderTarget, ThreeRenderTarget>();
    let pixelRatio = 1;
    let resolution = 1;
    let scissored = false;
    let shadowSwitches = 0;
    const compiledAt = new WeakMap<Object3D, number>();
    const applyPixelRatio = (): void => {
      if (renderer.getPixelRatio() !== pixelRatio * resolution) {
        renderer.setPixelRatio(pixelRatio * resolution);
      }
    };
    return {
      ready: () => renderer.init().then(() => undefined),
      render: (scene, camera, area, target) => {
        if (shadowSwitches > 0 && compiledAt.get(scene) !== shadowSwitches) {
          recompileMaterials(scene);
          compiledAt.set(scene, shadowSwitches);
        }
        const offscreen = target === undefined ? undefined : targets.get(target);
        if (offscreen !== undefined) {
          // As the WebGL renderer: into the target, transparent, never from the headset.
          const previous = renderer.getRenderTarget();
          const clearAlpha = renderer.getClearAlpha();
          const xrEnabled = renderer.xr.enabled;
          renderer.xr.enabled = false;
          renderer.setClearAlpha(0);
          renderer.setRenderTarget(offscreen);
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
      },
      memory: () => ({
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      }),
      dispose: () => {
        forgetPresentable(canvas);
        void renderer.xr.getSession()?.end();
        post.dispose();
        void renderer.dispose();
      },
    };
  },
});
