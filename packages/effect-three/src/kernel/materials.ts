/**
 * Building and updating three.js materials from descriptions.
 *
 * Kinds and defaults follow three.js's mesh materials (`three/src/materials`). A change
 * within one kind is applied in place; when it touches something compiled into the shader
 * (transparency, side, flat shading) the material is flagged for recompilation, as three
 * requires. A change of kind needs a new material, which the resource store handles.
 *
 * @module
 */
import {
  BackSide,
  DoubleSide,
  FrontSide,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshNormalMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShadowMaterial as ThreeShadowMaterial,
  type Side,
  type Texture,
} from 'three';

import type {
  BasicMaterial,
  LambertMaterial,
  MaterialSide,
  NormalMaterial,
  PhongMaterial,
  PhysicalMaterial,
  ShadowMaterial,
  StandardMaterial,
  SurfaceMaterial,
} from './description.ts';

/** Looks up a texture lent to the store. */
export type Textures = (id: string) => Texture | undefined;

const noTextures: Textures = () => undefined;

/** Sets the colour map. Returns whether the shader must recompile (a map came or went). */
const applyMap = (
  material: Exclude<HostMaterial, MeshNormalMaterial | ThreeShadowMaterial>,
  id: string | null,
  textures: Textures,
): boolean => {
  const map = id === null ? null : (textures(id) ?? null);
  const recompile = (material.map === null) !== (map === null);
  material.map = map;
  return recompile;
};

/** The three.js material kinds the kernel hosts. */
export type HostMaterial =
  | MeshBasicMaterial
  | MeshLambertMaterial
  | MeshPhongMaterial
  | MeshStandardMaterial
  | MeshPhysicalMaterial
  | MeshNormalMaterial
  | ThreeShadowMaterial;

const sides = { front: FrontSide, back: BackSide, double: DoubleSide } satisfies Record<
  MaterialSide,
  Side
>;

type SurfaceFields = {
  readonly opacity: number;
  readonly transparent: boolean;
  readonly side: MaterialSide;
  readonly wireframe: boolean;
};

type Shaded = SurfaceFields & { readonly flatShading: boolean };

/** Applies the fields every kind shares. Returns whether the shader must recompile. */
const applySurface = (
  material: Exclude<HostMaterial, ThreeShadowMaterial>,
  description: SurfaceFields,
): boolean => {
  const side = sides[description.side];
  const recompile = material.transparent !== description.transparent || material.side !== side;
  material.opacity = description.opacity;
  material.transparent = description.transparent;
  material.side = side;
  material.wireframe = description.wireframe;
  return recompile;
};

const applyShaded = (
  material: Exclude<HostMaterial, MeshBasicMaterial | ThreeShadowMaterial>,
  description: Shaded,
  mapChanged = false,
): void => {
  const flatChanged = material.flatShading !== description.flatShading;
  material.flatShading = description.flatShading;
  if (applySurface(material, description) || flatChanged || mapChanged) {
    material.needsUpdate = true;
  }
};

const applyBasic = (
  material: MeshBasicMaterial,
  description: BasicMaterial,
  textures: Textures,
): void => {
  material.color.setHex(description.color);
  // Drawn over everything when not depth-tested, and leaving no depth behind.
  material.depthTest = description.depthTest;
  material.depthWrite = description.depthTest;
  const mapChanged = applyMap(material, description.map, textures);
  if (applySurface(material, description) || mapChanged) material.needsUpdate = true;
};

const applyLambert = (
  material: MeshLambertMaterial,
  description: LambertMaterial,
  textures: Textures,
): void => {
  material.color.setHex(description.color);
  material.emissive.setHex(description.emissive);
  applyShaded(material, description, applyMap(material, description.map, textures));
};

const applyPhong = (
  material: MeshPhongMaterial,
  description: PhongMaterial,
  textures: Textures,
): void => {
  material.color.setHex(description.color);
  material.emissive.setHex(description.emissive);
  material.specular.setHex(description.specular);
  material.shininess = description.shininess;
  applyShaded(material, description, applyMap(material, description.map, textures));
};

const applyStandard = (
  material: MeshStandardMaterial,
  description: StandardMaterial | PhysicalMaterial,
  textures: Textures,
): void => {
  material.color.setHex(description.color);
  material.roughness = description.roughness;
  material.metalness = description.metalness;
  material.emissive.setHex(description.emissive);
  material.emissiveIntensity = description.emissiveIntensity;
  applyShaded(material, description, applyMap(material, description.map, textures));
};

const applyPhysical = (
  material: MeshPhysicalMaterial,
  description: PhysicalMaterial,
  textures: Textures,
): void => {
  applyStandard(material, description, textures);
  // three's clearcoat and transmission setters recompile when crossing zero.
  material.clearcoat = description.clearcoat;
  material.clearcoatRoughness = description.clearcoatRoughness;
  material.transmission = description.transmission;
  material.ior = description.ior;
};

const applyNormal = (material: MeshNormalMaterial, description: NormalMaterial): void => {
  applyShaded(material, description);
};

const applyShadow = (material: ThreeShadowMaterial, description: ShadowMaterial): void => {
  material.color.setHex(description.color);
  material.opacity = description.opacity;
};

/** Builds a new material for a description. */
export const buildMaterial = (
  description: SurfaceMaterial,
  textures: Textures = noTextures,
): HostMaterial => {
  switch (description._tag) {
    case 'Shadow': {
      const material = new ThreeShadowMaterial();
      applyShadow(material, description);
      return material;
    }
    case 'Basic': {
      const material = new MeshBasicMaterial();
      applyBasic(material, description, textures);
      return material;
    }
    case 'Lambert': {
      const material = new MeshLambertMaterial();
      applyLambert(material, description, textures);
      return material;
    }
    case 'Phong': {
      const material = new MeshPhongMaterial();
      applyPhong(material, description, textures);
      return material;
    }
    case 'Standard': {
      const material = new MeshStandardMaterial();
      applyStandard(material, description, textures);
      return material;
    }
    case 'Physical': {
      const material = new MeshPhysicalMaterial();
      applyPhysical(material, description, textures);
      return material;
    }
    case 'Normal': {
      const material = new MeshNormalMaterial();
      applyNormal(material, description);
      return material;
    }
  }
};

/**
 * Applies a description to an existing material in place. Returns `false`, changing
 * nothing, when the material is a different kind: the caller must build a new one.
 */
export const updateMaterial = (
  material: HostMaterial,
  description: SurfaceMaterial,
  textures: Textures = noTextures,
): boolean => {
  // MeshPhysicalMaterial extends MeshStandardMaterial, so test the exact kind by type.
  switch (description._tag) {
    case 'Shadow':
      if (!(material instanceof ThreeShadowMaterial)) return false;
      applyShadow(material, description);
      return true;
    case 'Basic':
      if (!(material instanceof MeshBasicMaterial)) return false;
      applyBasic(material, description, textures);
      return true;
    case 'Lambert':
      if (!(material instanceof MeshLambertMaterial)) return false;
      applyLambert(material, description, textures);
      return true;
    case 'Phong':
      if (!(material instanceof MeshPhongMaterial)) return false;
      applyPhong(material, description, textures);
      return true;
    case 'Standard':
      if (material.type !== 'MeshStandardMaterial' || !(material instanceof MeshStandardMaterial)) {
        return false;
      }
      applyStandard(material, description, textures);
      return true;
    case 'Physical':
      if (!(material instanceof MeshPhysicalMaterial)) return false;
      applyPhysical(material, description, textures);
      return true;
    case 'Normal':
      if (!(material instanceof MeshNormalMaterial)) return false;
      applyNormal(material, description);
      return true;
  }
};
