/**
 * The renderer boundary (requirement 7). Synchronous and backend-neutral: a WebGL or
 * WebGPU implementation lives outside the DOM-free core and is handed in as a factory.
 *
 * @module
 */
import { type Camera, type Scene, Texture } from 'three';

import type { RenderSettings } from './description.ts';

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
/** A rectangle of the drawing surface in CSS pixels, from the top left. */
export type RenderArea = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** An offscreen surface: render into it, then use its texture. Dispose exactly once. */
export type RenderTarget = {
  readonly texture: Texture;
  readonly dispose: () => void;
};

export type SceneRenderer = {
  /**
   * Draws the scene through `camera`, into `area` when given (clearing only that area),
   * otherwise across the whole surface.
   */
  readonly render: (scene: Scene, camera: Camera, area?: RenderArea, target?: RenderTarget) => void;
  /** Creates an offscreen target of `width` × `height` pixels to render into. */
  readonly createTarget: (width: number, height: number) => RenderTarget;
  /**
   * Creates the environment map of three.js's `RoomEnvironment`, prefiltered for this
   * renderer (WebGL: `PMREMGenerator.fromScene(new RoomEnvironment(), 0.04)`).
   */
  readonly createEnvironment: () => RenderTarget;
  /** Applies scene-wide render settings. Called before the first frame and on each change. */
  readonly configure: (settings: RenderSettings) => void;
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
  /** Every `configure` call, in order. */
  readonly configured: () => ReadonlyArray<RenderSettings>;
  readonly viewport: () => Viewport | undefined;
  readonly disposed: () => boolean;
};

/** A factory of recording renderers that remembers every renderer it created. */
export type RecordingRendererFactory = RendererFactory & {
  readonly created: () => ReadonlyArray<RecordingRenderer>;
};

const createRecordingRenderer = (): RecordingRenderer => {
  let renders = 0;
  const configured: Array<RenderSettings> = [];
  let viewport: Viewport | undefined;
  let disposed = false;
  return {
    render: () => {
      renders++;
    },
    configure: (settings) => {
      configured.push(settings);
    },
    createTarget: () => {
      const texture = new Texture();
      return { texture, dispose: () => texture.dispose() };
    },
    createEnvironment: () => {
      const texture = new Texture();
      return { texture, dispose: () => texture.dispose() };
    },
    setViewport: (next) => {
      viewport = next;
    },
    memory: () => ({ geometries: 0, textures: 0 }),
    dispose: () => {
      disposed = true;
    },
    renders: () => renders,
    configured: () => configured,
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
