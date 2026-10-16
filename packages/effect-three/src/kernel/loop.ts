import type { RenderSettings } from './description.ts';
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
import type { SceneRenderer } from './renderer.ts';
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
};

export type SceneLoop = {
  /** Advances behaviours, re-tests hover and renders one frame. */
  readonly frame: () => void;
  /**
   * Whether frames should keep coming: always in `always` mode, while the graph needs one
   * in `demand` mode, never in `never` mode (frames then come only from `advance`).
   */
  readonly wantsFrames: () => boolean;
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
      renderer.render(graph.scene, graph.camera);
      graph.drawn();
      const change = monitor.sample(now());
      if (change !== undefined) emit({ _tag: 'PerformanceChanged', ...change });
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
