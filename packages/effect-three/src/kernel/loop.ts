import { EquirectangularReflectionMapping, type Texture, UVMapping } from 'three';

import type { RenderSettings } from './description.ts';
import { type OverlayPlacement, placeOverlays } from './overlays.ts';
import { createPerformanceMonitor, type PerformanceOptions } from './performance.ts';
/**
 * The per-frame step and pointer routing for one scene. Plain synchronous code: the
 * Effect runtime owns its lifetime (ADR-003: Effect owns lifetimes, not frames).
 *
 * @module
 */
import {
  createPicker,
  createPointerTracker,
  type PointerInput,
  type SceneEvent,
} from './pointer.ts';
import type { RenderTarget, SceneRenderer } from './renderer.ts';
import type { SceneGraph } from './sceneGraph.ts';

export type SceneLoopOptions = {
  readonly graph: SceneGraph;
  readonly renderer: SceneRenderer;
  /** Scene time in seconds. Behaviours are a pure function of it. */
  readonly elapsedSeconds: () => number;
  /** Receives every scene event. Must not throw. */
  readonly emit: (event: SceneEvent) => void;
  /** Wall-clock milliseconds, for the frame-rate monitor. Defaults to `Date.now`. */
  readonly now?: () => number;
  /** Tuning for the frame-rate monitor. */
  readonly performance?: PerformanceOptions;
  /**
   * Receives where the scene's overlays are after each drawn frame, for the host to move
   * their HTML there; once with none after the last overlay goes. Must not throw.
   */
  readonly placeOverlays?: (placements: ReadonlyArray<OverlayPlacement>) => void;
};

export type SceneLoop = {
  /** Advances behaviours, re-tests hover and renders one frame. */
  readonly frame: () => void;
  /**
   * Whether frames should keep coming: always in `always` mode, while the graph needs one
   * in `demand` mode, never in `never` mode (frames then come only from `advance`).
   */
  readonly wantsFrames: () => boolean;
  /** Releases the render textures' targets and withdraws their textures. */
  readonly dispose: () => void;
  /**
   * Routes pointer input to hit testing, emits the resulting events and returns them, so
   * a DOM listener can decide synchronously whether the scene handled its event.
   */
  readonly pointer: (input: PointerInput) => ReadonlyArray<SceneEvent>;
};

/** Creates the frame step and pointer router for one scene. */
export const createSceneLoop = (options: SceneLoopOptions): SceneLoop => {
  const { graph, renderer, elapsedSeconds, emit } = options;
  const tracker = createPointerTracker(createPicker(graph));
  const monitor = createPerformanceMonitor(options.performance);
  const now = options.now ?? Date.now;
  let configured: RenderSettings | undefined;
  // Whether overlays were placed last frame, so their going is reported once.
  let placedAny = false;
  // One offscreen target per render texture, its texture lent to the store under its id.
  const targets = new Map<
    string,
    {
      readonly target: RenderTarget;
      readonly width: number;
      readonly height: number;
      readonly withdraw: () => void;
      fresh: boolean;
    }
  >();

  const release = (id: string): void => {
    const held = targets.get(id);
    if (held === undefined) return;
    held.withdraw();
    held.target.dispose();
    targets.delete(id);
  };

  /** Draws each render texture whose scene changed or animates, into its own target. */
  const drawTextures = (): void => {
    const textures = graph.renderTextures();
    for (const texture of textures) {
      const held = targets.get(texture.id);
      if (held === undefined || held.width !== texture.width || held.height !== texture.height) {
        release(texture.id);
        const target = renderer.createTarget(texture.width, texture.height);
        const withdraw = graph.store.lendTexture(texture.id, target.texture);
        targets.set(texture.id, {
          target,
          width: texture.width,
          height: texture.height,
          withdraw,
          fresh: true,
        });
      }
      const current = targets.get(texture.id);
      if (current !== undefined && (current.fresh || texture.graph.needsFrame())) {
        renderer.render(texture.graph.scene, texture.graph.camera, undefined, current.target);
        texture.graph.drawn();
        current.fresh = false;
      }
    }
    if (targets.size > textures.length) {
      const live = new Set(textures.map((texture) => texture.id));
      for (const id of targets.keys()) if (!live.has(id)) release(id);
    }
  };
  // The room environment, made by the renderer while a scene asks for it.
  let room: RenderTarget | undefined;

  const releaseRoom = (): void => {
    room?.dispose();
    room = undefined;
  };

  /** The environment's texture: the room, or the lent map (set to reflect as a panorama). */
  const environmentTexture = (map: string | null): Texture | null => {
    if (map === null) {
      room ??= renderer.createEnvironment();
      return room.texture;
    }
    releaseRoom();
    const texture = graph.store.texture(map) ?? null;
    // As Drei's useEnvironment: an equirectangular image maps as a reflection panorama.
    if (texture !== null && texture.mapping === UVMapping) {
      texture.mapping = EquirectangularReflectionMapping;
      texture.needsUpdate = true;
    }
    return texture;
  };

  /** Applies the scene's environment as Drei's `setEnvProps` does. */
  const applyEnvironment = (): void => {
    const environment = graph.environment();
    const { scene } = graph;
    if (environment === null) {
      releaseRoom();
      scene.environment = null;
      scene.background = null;
      return;
    }
    const texture = environmentTexture(environment.map);
    scene.environment = environment.background === 'only' ? null : texture;
    scene.background = environment.background === false ? null : texture;
    scene.backgroundBlurriness = environment.backgroundBlurriness;
    scene.backgroundIntensity = environment.backgroundIntensity;
    scene.environmentIntensity = environment.environmentIntensity;
  };

  return {
    frame: () => {
      graph.tick(elapsedSeconds());
      for (const event of tracker.frame()) emit(event);
      // Settings change only through reconcile, which replaces the value: compare by reference.
      const settings = graph.renderSettings();
      if (settings !== configured) {
        renderer.configure(settings);
        configured = settings;
      }
      drawTextures();
      applyEnvironment();
      const views = graph.views();
      if (views.length === 0) renderer.render(graph.scene, graph.camera);
      for (const view of views) renderer.render(graph.scene, view.camera, view.area);
      graph.drawn();
      const overlays = graph.overlays();
      if (options.placeOverlays !== undefined && (overlays.length > 0 || placedAny)) {
        options.placeOverlays(placeOverlays(graph));
        placedAny = overlays.length > 0;
      }
      const change = monitor.sample(now());
      if (change !== undefined) emit({ _tag: 'PerformanceChanged', ...change });
    },
    dispose: () => {
      for (const id of targets.keys()) release(id);
      releaseRoom();
    },
    wantsFrames: () => {
      const mode = graph.renderSettings().frames;
      return mode === 'always' || (mode === 'demand' && graph.needsFrame());
    },
    pointer: (input) => {
      const events = tracker.input(input);
      for (const event of events) emit(event);
      return events;
    },
  };
};
