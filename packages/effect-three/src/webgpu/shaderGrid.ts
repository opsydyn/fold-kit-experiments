/**
 * The WebGPU kit's shader grid: the WebGL kit's grid (Drei's `Grid`, `bf6f4ad`, MIT; after
 * Fyrestar's `THREE.InfiniteGridHelper` and threlte's `Grid`) written in TSL, so that
 * three's `WebGPURenderer` can draw it on either backend. Same lines, same fade, same
 * camera uniforms set in `onBeforeRender`.
 *
 * @module
 */
import {
  BackSide,
  Color,
  DoubleSide,
  FrontSide,
  Mesh,
  Plane,
  PlaneGeometry,
  type Side,
  Vector3,
} from 'three';
import {
  abs,
  distance,
  float,
  fract,
  fwidth,
  min,
  mix,
  modelWorldMatrix,
  modelWorldMatrixInverse,
  positionGeometry,
  pow,
  select,
  uniform,
  varying,
  vec4,
} from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

import type { MaterialSide, ShaderGridNode } from '../kernel/description.ts';
import type { HostedShaderGrid } from '../kernel/renderKit.ts';

const sides = { front: FrontSide, back: BackSide, double: DoubleSide } satisfies Record<
  MaterialSide,
  Side
>;

/** The grid's uniforms: one node each, written from the description. */
const createUniforms = () => ({
  cellSize: uniform(0.5),
  cellThickness: uniform(0.5),
  cellColor: uniform(new Color()),
  sectionSize: uniform(1),
  sectionThickness: uniform(1),
  sectionColor: uniform(new Color()),
  fadeDistance: uniform(100),
  fadeStrength: uniform(1),
  fadeFrom: uniform(1),
  infinite: uniform(0),
  followCamera: uniform(0),
  cameraOnPlane: uniform(new Vector3()),
  planeOrigin: uniform(new Vector3()),
});

type Uniforms = ReturnType<typeof createUniforms>;

/** The grid's material: the WebGL kit's vertex and fragment shaders, as TSL nodes. */
const gridMaterial = (u: Uniforms): MeshBasicNodeMaterial => {
  const material = new MeshBasicNodeMaterial({ transparent: true });
  // The plane geometry lies in XY; the grid lies in XZ. Infinite grids reach the fade.
  const lifted = positionGeometry.xzy.mul(
    select(u.infinite.greaterThan(0.5), u.fadeDistance.add(1), 1),
  );
  // Following the camera slides the plane by its foot's offset, in the grid's own space.
  const shift = modelWorldMatrixInverse.mul(vec4(u.cameraOnPlane.sub(u.planeOrigin), 0)).xyz;
  const local = select(u.followCamera.greaterThan(0.5), lifted.add(shift), lifted);
  material.positionNode = local;
  const gridPosition = varying(local);
  const worldPosition = varying(modelWorldMatrix.mul(vec4(local, 1)).xyz);
  // 1 on a line of a grid with this spacing, 0 between, antialiased over a pixel.
  const lines = (spacing: typeof u.cellSize, thickness: typeof u.cellThickness) => {
    const at = gridPosition.xz.div(spacing);
    const away = abs(fract(at.sub(0.5)).sub(0.5)).div(fwidth(at));
    return float(1).sub(min(min(away.x, away.y).add(1).sub(thickness), 1));
  };
  const cell = lines(u.cellSize, u.cellThickness);
  const section = lines(u.sectionSize, u.sectionThickness);
  const away = distance(u.cameraOnPlane.mul(u.fadeFrom), worldPosition);
  const fade = pow(float(1).sub(min(away.div(u.fadeDistance), 1)), u.fadeStrength);
  const alpha = cell.add(section).mul(fade);
  material.colorNode = mix(u.cellColor, u.sectionColor, min(1, u.sectionThickness.mul(section)));
  material.opacityNode = mix(alpha.mul(0.75), alpha, section);
  // Discard where there is no line, as the WebGL kit's shader does.
  material.alphaTest = 1e-4;
  return material;
};

/** Writes a node's settings into the uniforms and material. */
const writeUniforms = (
  u: Uniforms,
  material: MeshBasicNodeMaterial,
  node: ShaderGridNode,
): void => {
  u.cellSize.value = node.cellSize;
  u.cellThickness.value = node.cellThickness;
  u.cellColor.value.setHex(node.cellColor);
  u.sectionSize.value = node.sectionSize;
  u.sectionThickness.value = node.sectionThickness;
  u.sectionColor.value.setHex(node.sectionColor);
  u.fadeDistance.value = node.fadeDistance;
  u.fadeStrength.value = node.fadeStrength;
  u.fadeFrom.value = node.fadeFrom;
  u.infinite.value = node.infinite ? 1 : 0;
  u.followCamera.value = node.followCamera ? 1 : 0;
  material.side = sides[node.side];
};

const up = new Vector3(0, 1, 0);
const origin = new Vector3();
const plane = new Plane();
const cameraPosition = new Vector3();

/** The WebGPU kit's shader grid: a plane with the grid material, placed and updated. */
export const hostShaderGrid = (node: ShaderGridNode): HostedShaderGrid => {
  const u = createUniforms();
  const material = gridMaterial(u);
  writeUniforms(u, material, node);
  const mesh = new Mesh(new PlaneGeometry(...node.size), material);
  // The shader moves vertices (infinite, following): the plane's own bounds mean nothing.
  mesh.frustumCulled = false;
  const place = (next: ShaderGridNode): void => {
    mesh.position.fromArray(next.position);
    mesh.rotation.fromArray([...next.rotation]);
  };
  place(node);
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    plane.setFromNormalAndCoplanarPoint(up, origin).applyMatrix4(mesh.matrixWorld);
    plane.projectPoint(
      cameraPosition.setFromMatrixPosition(camera.matrixWorld),
      u.cameraOnPlane.value,
    );
    u.planeOrigin.value.set(0, 0, 0).applyMatrix4(mesh.matrixWorld);
  };
  return {
    object: mesh,
    update: (previous, next) => {
      if (previous.size[0] !== next.size[0] || previous.size[1] !== next.size[1]) {
        mesh.geometry.dispose();
        mesh.geometry = new PlaneGeometry(...next.size);
      }
      writeUniforms(u, material, next);
      place(next);
    },
    dispose: () => {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
};
