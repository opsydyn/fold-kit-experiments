/**
 * Contact shadows, drawn by the frame loop with the scene's renderer: the passes, shared
 * by every render kit, which supplies the materials (`ShadowMaterials`).
 *
 * Behavioural reference: Drei `src/core/ContactShadows.tsx` at `bf6f4ad`, itself after
 * three.js's `webgl_shadow_contact` example by mrdoob (both MIT). As there, every drawn
 * frame:
 *
 * 1. renders the scene from below with an orthographic camera into a texture, through a
 *    depth material that turns nearness to the ground into shadow (alpha `1 − depth`,
 *    colour `color · depth · 2`), with the background off and the shadow plane hidden;
 * 2. blurs it horizontally and vertically (`blur / 256`), twice with `smooth` (the second
 *    at 0.4 of the blur);
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
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  type Texture,
  Vector3,
} from 'three';

import type { ContactShadows } from './description.ts';
import type { RenderTarget, SceneRenderer } from './renderer.ts';
import type { ContactShadowPasses, ShadowedScene } from './renderKit.ts';

/** One blur direction's material, and how to point it at a texture by an amount. */
export type BlurPass = {
  readonly material: Material;
  /** Reads `source`, blurring by `amount` of the texture's width (or height). */
  readonly set: (source: Texture, amount: number) => void;
};

/** What a render kit draws contact shadows with. */
export type ShadowMaterials = {
  /**
   * The material the scene is drawn through from below: colour `color · depth · 2`, alpha
   * `1 − depth`, no depth test or write.
   */
  readonly depth: (color: Color) => Material;
  readonly blur: (direction: 'horizontal' | 'vertical') => BlurPass;
  /**
   * Whether the renderer reads a target's texture with v running the other way from
   * WebGL's: three's WebGPU renderer does, on either backend.
   */
  readonly flippedTargets: boolean;
};

/** Everything one set of contact shadows holds while shown. */
type Shown = {
  readonly description: ContactShadows;
  readonly plane: Mesh<PlaneGeometry, MeshBasicMaterial>;
  readonly camera: OrthographicCamera;
  readonly target: RenderTarget;
  readonly blurTarget: RenderTarget;
  readonly color: Color;
  readonly depthMaterial: Material;
  readonly horizontal: BlurPass;
  readonly vertical: BlurPass;
  readonly quad: Mesh<PlaneGeometry, Material>;
  readonly quadScene: Scene;
  readonly quadCamera: OrthographicCamera;
};

const up = new Vector3(0, 1, 0);
const aim = new Vector3();

/**
 * The plane's geometry: flat, facing up, its texture's v running towards +z as the shadow
 * camera's image does (already so where the renderer reads targets flipped).
 */
const groundGeometry = (width: number, depth: number, flipped: boolean): PlaneGeometry => {
  const geometry = new PlaneGeometry(width, depth).rotateX(-Math.PI / 2);
  if (flipped) return geometry;
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  return geometry;
};

/** Whether a change needs new targets, geometry or camera rather than an update. */
const reshaped = (a: ContactShadows, b: ContactShadows): boolean =>
  a.resolution !== b.resolution || a.size[0] !== b.size[0] || a.size[1] !== b.size[1];

/** Creates the contact shadow passes for one scene graph and renderer, with `materials`. */
export const createContactShadowPasses = (
  graph: ShadowedScene,
  renderer: SceneRenderer,
  materials: ShadowMaterials,
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
    shown.horizontal.material.dispose();
    shown.vertical.material.dispose();
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
    const plane = new Mesh(groundGeometry(width, depth, materials.flippedTargets), material);
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
      depthMaterial: materials.depth(color),
      horizontal: materials.blur('horizontal'),
      vertical: materials.blur('vertical'),
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
    quad.material = horizontal.material;
    horizontal.set(current.target.texture, amount / 256);
    renderer.render(quadScene, quadCamera, undefined, current.blurTarget);
    quad.material = vertical.material;
    vertical.set(current.blurTarget.texture, amount / 256);
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
