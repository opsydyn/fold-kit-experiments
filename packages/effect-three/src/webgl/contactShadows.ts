/**
 * Contact shadows, drawn by the frame loop with the scene's renderer.
 *
 * Behavioural reference: Drei `src/core/ContactShadows.tsx` at `bf6f4ad`, itself after
 * three.js's `webgl_shadow_contact` example by mrdoob (both MIT). As there, every drawn
 * frame:
 *
 * 1. renders the scene from below with an orthographic camera into a texture, through a
 *    depth material that turns nearness to the ground into shadow (alpha `1 − depth`,
 *    colour `color · depth · 2`), with the background off and the shadow plane hidden;
 * 2. blurs it with three's horizontal and vertical blur shaders (`blur / 256`), twice
 *    with `smooth` (the second at 0.4 of the blur);
 * 3. shows it on a transparent plane facing up.
 *
 * One difference: the blur passes draw a quad with their own camera, so they fill the
 * texture wherever the shadows are placed. (Drei draws its quad at the world origin with
 * the shadow camera, which leaves the blur empty when the shadows sit above `y = 0`.)
 *
 * @module
 */
import {
  Color,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector3,
} from 'three';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

import type { ContactShadows } from '../kernel/description.ts';
import type { RenderTarget, SceneRenderer } from '../kernel/renderer.ts';
import type { ContactShadowPasses, ShadowedScene } from '../kernel/renderKit.ts';

/**
 * The shadow pass's edit to three's depth shader: its basic-packing output, and the
 * shadow written instead (darkest where an object touches the plane).
 */
const shadowShader = {
  depthOutput: 'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
  shadowOutput: 'gl_FragColor = vec4( shadowColor * fragCoordZ * 2.0, 1.0 - fragCoordZ );',
} as const;

const createDepthMaterial = (color: Color): MeshDepthMaterial => {
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

/** Everything one set of contact shadows holds while shown. */
type Shown = {
  readonly description: ContactShadows;
  readonly plane: Mesh<PlaneGeometry, MeshBasicMaterial>;
  readonly camera: OrthographicCamera;
  readonly target: RenderTarget;
  readonly blurTarget: RenderTarget;
  readonly color: Color;
  readonly depthMaterial: MeshDepthMaterial;
  readonly horizontal: ShaderMaterial;
  readonly vertical: ShaderMaterial;
  readonly quad: Mesh<PlaneGeometry, Material>;
  readonly quadScene: Scene;
  readonly quadCamera: OrthographicCamera;
};

const up = new Vector3(0, 1, 0);
const aim = new Vector3();

/** The plane's geometry: flat, facing up, its texture's v running towards +z. */
const groundGeometry = (width: number, depth: number): PlaneGeometry => {
  const geometry = new PlaneGeometry(width, depth).rotateX(-Math.PI / 2);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  return geometry;
};

/** Whether a change needs new targets, geometry or camera rather than an update. */
const reshaped = (a: ContactShadows, b: ContactShadows): boolean =>
  a.resolution !== b.resolution || a.size[0] !== b.size[0] || a.size[1] !== b.size[1];

/** Creates the contact shadow passes for one scene graph and renderer. */
export const createContactShadows = (
  graph: ShadowedScene,
  renderer: SceneRenderer,
): ContactShadowPasses => {
  let shown: Shown | undefined;

  const release = (): void => {
    if (shown === undefined) return;
    shown.plane.removeFromParent();
    shown.plane.geometry.dispose();
    shown.plane.material.dispose();
    shown.target.dispose();
    shown.blurTarget.dispose();
    shown.depthMaterial.dispose();
    shown.horizontal.dispose();
    shown.vertical.dispose();
    shown.quad.geometry.dispose();
    shown = undefined;
  };

  const build = (description: ContactShadows): Shown => {
    const [width, depth] = description.size;
    const target = renderer.createTarget(description.resolution, description.resolution);
    const blurTarget = renderer.createTarget(description.resolution, description.resolution);
    const material = new MeshBasicMaterial({
      map: target.texture,
      transparent: true,
      depthWrite: false,
    });
    const plane = new Mesh(groundGeometry(width, depth), material);
    // Shadows are scenery: never picked, never in the way of an overlay.
    plane.raycast = () => undefined;
    graph.scene.add(plane);
    const color = new Color();
    const quad = new Mesh<PlaneGeometry, Material>(new PlaneGeometry(2, 2));
    // In front of the quad camera, between its near and far planes.
    quad.position.z = -0.5;
    const quadScene = new Scene();
    quadScene.add(quad);
    return {
      description,
      plane,
      camera: new OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, 0, 1),
      target,
      blurTarget,
      color,
      depthMaterial: createDepthMaterial(color),
      horizontal: new ShaderMaterial({ ...HorizontalBlurShader, depthTest: false }),
      vertical: new ShaderMaterial({ ...VerticalBlurShader, depthTest: false }),
      quad,
      quadScene,
      quadCamera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    };
  };

  /** Applies the fields that change in place: placement, reach, colour and opacity. */
  const update = (current: Shown, description: ContactShadows): Shown => {
    current.plane.position.fromArray(description.position);
    current.plane.material.opacity = description.opacity;
    current.color.setHex(description.color);
    current.camera.position.fromArray(description.position);
    // Looking straight up, with +z as the image's up: its v runs towards +z, as the plane's.
    current.camera.up.set(0, 0, 1);
    current.camera.lookAt(aim.copy(current.camera.position).add(up));
    current.camera.near = description.near;
    current.camera.far = description.far;
    current.camera.updateProjectionMatrix();
    current.camera.updateMatrixWorld();
    return { ...current, description };
  };

  /** One blur: horizontally into the spare target, then vertically back. */
  const blurPass = (current: Shown, amount: number): void => {
    const { horizontal, vertical, quad, quadScene, quadCamera } = current;
    quad.material = horizontal;
    Reflect.set(horizontal.uniforms['tDiffuse'] ?? {}, 'value', current.target.texture);
    Reflect.set(horizontal.uniforms['h'] ?? {}, 'value', amount / 256);
    renderer.render(quadScene, quadCamera, undefined, current.blurTarget);
    quad.material = vertical;
    Reflect.set(vertical.uniforms['tDiffuse'] ?? {}, 'value', current.blurTarget.texture);
    Reflect.set(vertical.uniforms['v'] ?? {}, 'value', amount / 256);
    renderer.render(quadScene, quadCamera, undefined, current.target);
  };

  const render = (current: Shown): void => {
    const { scene } = graph;
    const background = scene.background;
    const override = scene.overrideMaterial;
    current.plane.visible = false;
    scene.background = null;
    scene.overrideMaterial = current.depthMaterial;
    renderer.render(scene, current.camera, undefined, current.target);
    scene.overrideMaterial = override;
    scene.background = background;
    current.plane.visible = true;
    blurPass(current, current.description.blur);
    if (current.description.smooth) blurPass(current, current.description.blur * 0.4);
  };

  return {
    draw: () => {
      const description = graph.contactShadows();
      if (description === null) {
        release();
        return;
      }
      if (shown !== undefined && reshaped(shown.description, description)) release();
      shown = update(shown ?? build(description), description);
      render(shown);
    },
    dispose: release,
  };
};
