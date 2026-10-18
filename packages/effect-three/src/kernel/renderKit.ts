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

import type { ContactShadows, ShaderGridNode, Sky } from './description.ts';
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
  readonly sky: () => HostedSky;
  readonly shaderGrid: (node: ShaderGridNode) => HostedShaderGrid;
  readonly contactShadows: (graph: ShadowedScene, renderer: SceneRenderer) => ContactShadowPasses;
};
