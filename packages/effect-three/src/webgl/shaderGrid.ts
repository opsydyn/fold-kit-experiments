/**
 * Drei's `Grid` (`src/core/Grid.tsx` at `bf6f4ad`, MIT; itself after Fyrestar's
 * `THREE.InfiniteGridHelper` and threlte's `Grid`): a plane whose shader draws thin cell
 * lines and thicker section lines from screen-space derivatives, fading with distance
 * from the camera's foot on the plane. An infinite grid stretches the plane by the fade
 * distance; one that follows the camera slides under it.
 *
 * Each frame the material needs the camera drawing it projected onto the grid's plane.
 * Drei sets that in `useFrame`; here `onBeforeRender` does it, so every view (and each
 * eye in XR) gets its own camera.
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
  ShaderMaterial,
  type Side,
  Vector3,
} from 'three';

import type { MaterialSide, ShaderGridNode } from '../kernel/description.ts';
import type { HostedShaderGrid } from '../kernel/renderKit.ts';

/** The mesh a shader grid is hosted as. */
export type HostShaderGrid = Mesh<PlaneGeometry, ShaderMaterial>;

const sides = { front: FrontSide, back: BackSide, double: DoubleSide } satisfies Record<
  MaterialSide,
  Side
>;

const vertexShader = /* glsl */ `
  uniform vec3 cameraOnPlane;
  uniform vec3 planeOrigin;
  uniform float fadeDistance;
  uniform bool infiniteGrid;
  uniform bool followCamera;

  varying vec3 gridPosition;
  varying vec4 worldPosition;

  void main() {
    // The plane geometry lies in XY; the grid lies in XZ.
    gridPosition = position.xzy;
    if (infiniteGrid) gridPosition *= 1.0 + fadeDistance;
    worldPosition = modelMatrix * vec4(gridPosition, 1.0);
    if (followCamera) {
      worldPosition.xyz += cameraOnPlane - planeOrigin;
      gridPosition = (inverse(modelMatrix) * worldPosition).xyz;
    }
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 cameraOnPlane;
  uniform float cellSize;
  uniform float cellThickness;
  uniform vec3 cellColor;
  uniform float sectionSize;
  uniform float sectionThickness;
  uniform vec3 sectionColor;
  uniform float fadeDistance;
  uniform float fadeStrength;
  uniform float fadeFrom;

  varying vec3 gridPosition;
  varying vec4 worldPosition;

  // 1 on a line of a grid with this spacing, 0 between, antialiased over a pixel.
  float lines(float spacing, float thickness) {
    vec2 at = gridPosition.xz / spacing;
    vec2 away = abs(fract(at - 0.5) - 0.5) / fwidth(at);
    return 1.0 - min(min(away.x, away.y) + 1.0 - thickness, 1.0);
  }

  void main() {
    float cell = lines(cellSize, cellThickness);
    float section = lines(sectionSize, sectionThickness);
    float distanceAway = distance(cameraOnPlane * fadeFrom, worldPosition.xyz);
    float fade = pow(1.0 - min(distanceAway / fadeDistance, 1.0), fadeStrength);
    vec3 color = mix(cellColor, sectionColor, min(1.0, sectionThickness * section));
    float alpha = (cell + section) * fade;
    alpha = mix(0.75 * alpha, alpha, section);
    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const up = new Vector3(0, 1, 0);
const origin = new Vector3();
const plane = new Plane();
const cameraPosition = new Vector3();

/** Writes a node's settings into its material's uniforms. */
const writeUniforms = (material: ShaderMaterial, node: ShaderGridNode): void => {
  const { uniforms } = material;
  const set = (name: string, value: unknown): void => {
    const uniform = uniforms[name];
    if (uniform !== undefined) uniform.value = value;
  };
  set('cellSize', node.cellSize);
  set('cellThickness', node.cellThickness);
  set('sectionSize', node.sectionSize);
  set('sectionThickness', node.sectionThickness);
  set('fadeDistance', node.fadeDistance);
  set('fadeStrength', node.fadeStrength);
  set('fadeFrom', node.fadeFrom);
  set('infiniteGrid', node.infinite);
  set('followCamera', node.followCamera);
  uniforms['cellColor']?.value.setHex(node.cellColor);
  uniforms['sectionColor']?.value.setHex(node.sectionColor);
  material.side = sides[node.side];
};

/** Places the grid and its plane from its description. */
const writePlacement = (mesh: HostShaderGrid, node: ShaderGridNode): void => {
  mesh.position.fromArray(node.position);
  mesh.rotation.fromArray([...node.rotation]);
};

/** Creates the grid mesh for a node. */
export const createShaderGrid = (node: ShaderGridNode): HostShaderGrid => {
  const material = new ShaderMaterial({
    uniforms: {
      cellSize: { value: 0 },
      cellThickness: { value: 0 },
      cellColor: { value: new Color() },
      sectionSize: { value: 0 },
      sectionThickness: { value: 0 },
      sectionColor: { value: new Color() },
      fadeDistance: { value: 0 },
      fadeStrength: { value: 0 },
      fadeFrom: { value: 0 },
      infiniteGrid: { value: false },
      followCamera: { value: false },
      cameraOnPlane: { value: new Vector3() },
      planeOrigin: { value: new Vector3() },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
  });
  writeUniforms(material, node);
  const mesh: HostShaderGrid = new Mesh(new PlaneGeometry(...node.size), material);
  // The shader moves vertices (infinite, following): the plane's own bounds mean nothing.
  mesh.frustumCulled = false;
  writePlacement(mesh, node);
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    plane.setFromNormalAndCoplanarPoint(up, origin).applyMatrix4(mesh.matrixWorld);
    plane.projectPoint(
      cameraPosition.setFromMatrixPosition(camera.matrixWorld),
      material.uniforms['cameraOnPlane']?.value,
    );
    material.uniforms['planeOrigin']?.value.set(0, 0, 0).applyMatrix4(mesh.matrixWorld);
  };
  return mesh;
};

/** Applies a new description to a grid mesh. */
export const updateShaderGrid = (
  mesh: HostShaderGrid,
  previous: ShaderGridNode,
  next: ShaderGridNode,
): void => {
  if (previous.size[0] !== next.size[0] || previous.size[1] !== next.size[1]) {
    mesh.geometry.dispose();
    mesh.geometry = new PlaneGeometry(...next.size);
  }
  writeUniforms(mesh.material, next);
  writePlacement(mesh, next);
};

/** Frees the grid's geometry and material, which are its own. */
export const disposeShaderGrid = (mesh: HostShaderGrid): void => {
  mesh.geometry.dispose();
  mesh.material.dispose();
};

/** The WebGL kit's shader grid: the mesh, updated in place and freed with it. */
export const hostShaderGrid = (node: ShaderGridNode): HostedShaderGrid => {
  const mesh = createShaderGrid(node);
  return {
    object: mesh,
    update: (previous, next) => updateShaderGrid(mesh, previous, next),
    dispose: () => disposeShaderGrid(mesh),
  };
};
