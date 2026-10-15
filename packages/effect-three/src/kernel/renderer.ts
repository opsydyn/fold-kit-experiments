/**
 * The renderer boundary (requirement 7). Synchronous and backend-neutral: a WebGL or
 * WebGPU implementation lives outside the DOM-free core and is handed in as a factory.
 *
 * @module
 */
import type { Camera, Scene } from 'three';

/** Size of the drawing surface in CSS pixels, plus the device pixel ratio. */
export type Viewport = {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
};

/** GPU memory counters, as reported by three.js `renderer.info.memory`. */
export type RendererMemory = {
  readonly geometries: number;
  readonly textures: number;
};

/** A live renderer bound to one drawing surface. */
export type SceneRenderer = {
  readonly render: (scene: Scene, camera: Camera) => void;
  readonly setViewport: (viewport: Viewport) => void;
  readonly memory: () => RendererMemory;
  /** Releases the renderer and its drawing context. Called exactly once. */
  readonly dispose: () => void;
};

/** Creates a renderer. `create` may throw when the backend is unavailable. */
export type RendererFactory = {
  readonly create: () => SceneRenderer;
};

/** A renderer that records calls instead of drawing. For headless tests. */
export type RecordingRenderer = SceneRenderer & {
  readonly renders: () => number;
  readonly viewport: () => Viewport | undefined;
  readonly disposed: () => boolean;
};

/** A factory of recording renderers that remembers every renderer it created. */
export type RecordingRendererFactory = RendererFactory & {
  readonly created: () => ReadonlyArray<RecordingRenderer>;
};

const createRecordingRenderer = (): RecordingRenderer => {
  let renders = 0;
  let viewport: Viewport | undefined;
  let disposed = false;
  return {
    render: () => {
      renders++;
    },
    setViewport: (next) => {
      viewport = next;
    },
    memory: () => ({ geometries: 0, textures: 0 }),
    dispose: () => {
      disposed = true;
    },
    renders: () => renders,
    viewport: () => viewport,
    disposed: () => disposed,
  };
};

/** Creates a factory of recording renderers. */
export const recordingRendererFactory = (): RecordingRendererFactory => {
  const created: Array<RecordingRenderer> = [];
  return {
    create: () => {
      const renderer = createRecordingRenderer();
      created.push(renderer);
      return renderer;
    },
    created: () => created,
  };
};
