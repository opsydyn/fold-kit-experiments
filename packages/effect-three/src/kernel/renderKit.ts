/**
 * What a renderer brings to a scene graph besides drawing: the parts of a scene written
 * in its shading language. The kernel stays free of shader code (ADR-003): it describes a
 * sky, a shader grid or contact shadows, and the renderer's kit makes them. The WebGL kit
 * is `webglKit` from `@opsydyn/effect-three/webgl`, which `webglRendererFactory` carries;
 * without a kit these parts are not drawn.
 *
 * @module
 */
import type { Object3D, Scene } from 'three';

import type { ContactShadows, LineNode, PointsNode, ShaderGridNode, Sky } from './description.ts';
import type { SceneRenderer } from './renderer.ts';

/** A sky as a kit draws it: the object the graph adds to its scene, never picked. */
export type HostedSky = {
  readonly object: Object3D;
  readonly update: (sky: Sky) => void;
  readonly dispose: () => void;
};

/** A shader grid as a kit draws it, placed by the kit from its description. */
export type HostedShaderGrid = {
  readonly object: Object3D;
  readonly update: (previous: ShaderGridNode, next: ShaderGridNode) => void;
  readonly dispose: () => void;
};

/** A line as a kit draws it (three's fat lines), inside the node's wrapper. */
export type HostedLine = {
  readonly object: Object3D;
  /** Applies new points or a new look; the wrapper carries the transform. */
  readonly update: (line: LineNode) => void;
  readonly dispose: () => void;
};

/** Points as a kit draws them, inside the node's wrapper. */
export type HostedPoints = {
  readonly object: Object3D;
  /** Applies a new look; the wrapper carries the transform. */
  readonly update: (points: PointsNode) => void;
  /** Moves sparkles and twinkles stars to scene time `seconds`. */
  readonly tick: (seconds: number) => void;
  readonly dispose: () => void;
};

/** The contact shadow passes for one scene, drawn by the frame loop before each frame. */
export type ContactShadowPasses = {
  /** Draws the scene's contact shadows, if it has any, before the frame is drawn. */
  readonly draw: () => void;
  readonly dispose: () => void;
};

/** What contact shadows need from a scene graph: its scene and their description. */
export type ShadowedScene = {
  readonly scene: Scene;
  readonly contactShadows: () => ContactShadows | null;
};

/** A renderer's shaded parts. */
export type RenderKit = {
  /**
   * The kind of material the renderer draws: `'webgl'`, WebGL's own materials, for
   * `WebGLRenderer`; `'tsl'`, three's node materials, for `WebGPURenderer`. A label engine
   * draws with its implementation for it (`LabelEngine.create` or `createTsl`); WebGL
   * materials break a WebGPU frame, so without a TSL implementation labels stay empty.
   */
  readonly shading: 'webgl' | 'tsl';
  readonly sky: () => HostedSky;
  readonly shaderGrid: (node: ShaderGridNode) => HostedShaderGrid;
  /** Draws a line; a kit without lines leaves them empty. */
  readonly line?: (node: LineNode) => HostedLine;
  /** Draws points; a kit without points leaves them empty. */
  readonly points?: (node: PointsNode) => HostedPoints;
  readonly contactShadows: (graph: ShadowedScene, renderer: SceneRenderer) => ContactShadowPasses;
};
