/**
 * The WebGL kit's contact shadow materials: three's depth material with its output
 * replaced by the shadow (as Drei's `ContactShadows`, `bf6f4ad`), and three's horizontal
 * and vertical blur shaders. The passes themselves are the kernel's.
 *
 * @module
 */
import { type Color, MeshDepthMaterial, ShaderMaterial } from 'three';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

import {
  type BlurPass,
  createContactShadowPasses,
  type ShadowMaterials,
} from '../kernel/contactShadowPasses.ts';
import type { SceneRenderer } from '../kernel/renderer.ts';
import type { ContactShadowPasses, ShadowedScene } from '../kernel/renderKit.ts';

/**
 * The shadow pass's edit to three's depth shader: its basic-packing output, and the
 * shadow written instead (darkest where an object touches the plane).
 */
const shadowShader = {
  depthOutput: 'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
  shadowOutput: 'gl_FragColor = vec4( shadowColor * fragCoordZ * 2.0, 1.0 - fragCoordZ );',
} as const;

const depth = (color: Color): MeshDepthMaterial => {
  const material = new MeshDepthMaterial();
  material.depthTest = false;
  material.depthWrite = false;
  material.onBeforeCompile = (shader) => {
    shader.uniforms['shadowColor'] = { value: color };
    shader.fragmentShader = `uniform vec3 shadowColor;\n${shader.fragmentShader.replace(
      shadowShader.depthOutput,
      shadowShader.shadowOutput,
    )}`;
  };
  return material;
};

/** three's blur shaders: `h` (horizontal) or `v` (vertical) is the step, `tDiffuse` the source. */
const blurShaders = {
  horizontal: { shader: HorizontalBlurShader, step: 'h' },
  vertical: { shader: VerticalBlurShader, step: 'v' },
} as const;

const blur = (direction: 'horizontal' | 'vertical'): BlurPass => {
  const { shader, step } = blurShaders[direction];
  const material = new ShaderMaterial({ ...shader, depthTest: false });
  return {
    material,
    set: (source, amount) => {
      Reflect.set(material.uniforms['tDiffuse'] ?? {}, 'value', source);
      Reflect.set(material.uniforms[step] ?? {}, 'value', amount);
    },
  };
};

const webglShadowMaterials: ShadowMaterials = { depth, blur, flippedTargets: false };

/** Creates the contact shadow passes for one scene graph and renderer, in GLSL. */
export const createContactShadows = (
  graph: ShadowedScene,
  renderer: SceneRenderer,
): ContactShadowPasses => createContactShadowPasses(graph, renderer, webglShadowMaterials);
