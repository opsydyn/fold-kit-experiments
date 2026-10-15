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
  type Side,
} from 'three';

import type {
  BasicMaterial,
  LambertMaterial,
  MaterialSide,
  NormalMaterial,
  PhongMaterial,
  PhysicalMaterial,
  StandardMaterial,
  SurfaceMaterial,
} from './description.ts';

/** The three.js material kinds the kernel hosts. */
export type HostMaterial =
  | MeshBasicMaterial
  | MeshLambertMaterial
  | MeshPhongMaterial
  | MeshStandardMaterial
  | MeshPhysicalMaterial
  | MeshNormalMaterial;

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
const applySurface = (material: HostMaterial, description: SurfaceFields): boolean => {
  const side = sides[description.side];
  const recompile = material.transparent !== description.transparent || material.side !== side;
  material.opacity = description.opacity;
  material.transparent = description.transparent;
  material.side = side;
  material.wireframe = description.wireframe;
  return recompile;
};

const applyShaded = (
  material: Exclude<HostMaterial, MeshBasicMaterial>,
  description: Shaded,
): void => {
  const flatChanged = material.flatShading !== description.flatShading;
  material.flatShading = description.flatShading;
  if (applySurface(material, description) || flatChanged) material.needsUpdate = true;
};

const applyBasic = (material: MeshBasicMaterial, description: BasicMaterial): void => {
  material.color.setHex(description.color);
  if (applySurface(material, description)) material.needsUpdate = true;
};

const applyLambert = (material: MeshLambertMaterial, description: LambertMaterial): void => {
  material.color.setHex(description.color);
  material.emissive.setHex(description.emissive);
  applyShaded(material, description);
};

const applyPhong = (material: MeshPhongMaterial, description: PhongMaterial): void => {
  material.color.setHex(description.color);
  material.emissive.setHex(description.emissive);
  material.specular.setHex(description.specular);
  material.shininess = description.shininess;
  applyShaded(material, description);
};

const applyStandard = (
  material: MeshStandardMaterial,
  description: StandardMaterial | PhysicalMaterial,
): void => {
  material.color.setHex(description.color);
  material.roughness = description.roughness;
  material.metalness = description.metalness;
  material.emissive.setHex(description.emissive);
  material.emissiveIntensity = description.emissiveIntensity;
  applyShaded(material, description);
};

const applyPhysical = (material: MeshPhysicalMaterial, description: PhysicalMaterial): void => {
  applyStandard(material, description);
  // three's clearcoat and transmission setters recompile when crossing zero.
  material.clearcoat = description.clearcoat;
  material.clearcoatRoughness = description.clearcoatRoughness;
  material.transmission = description.transmission;
  material.ior = description.ior;
};

const applyNormal = (material: MeshNormalMaterial, description: NormalMaterial): void => {
  applyShaded(material, description);
};

/** Builds a new material for a description. */
export const buildMaterial = (description: SurfaceMaterial): HostMaterial => {
  switch (description._tag) {
    case 'Basic': {
      const material = new MeshBasicMaterial();
      applyBasic(material, description);
      return material;
    }
    case 'Lambert': {
      const material = new MeshLambertMaterial();
      applyLambert(material, description);
      return material;
    }
    case 'Phong': {
      const material = new MeshPhongMaterial();
      applyPhong(material, description);
      return material;
    }
    case 'Standard': {
      const material = new MeshStandardMaterial();
      applyStandard(material, description);
      return material;
    }
    case 'Physical': {
      const material = new MeshPhysicalMaterial();
      applyPhysical(material, description);
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
export const updateMaterial = (material: HostMaterial, description: SurfaceMaterial): boolean => {
  // MeshPhysicalMaterial extends MeshStandardMaterial, so test the exact kind by type.
  switch (description._tag) {
    case 'Basic':
      if (!(material instanceof MeshBasicMaterial)) return false;
      applyBasic(material, description);
      return true;
    case 'Lambert':
      if (!(material instanceof MeshLambertMaterial)) return false;
      applyLambert(material, description);
      return true;
    case 'Phong':
      if (!(material instanceof MeshPhongMaterial)) return false;
      applyPhong(material, description);
      return true;
    case 'Standard':
      if (material.type !== 'MeshStandardMaterial' || !(material instanceof MeshStandardMaterial)) {
        return false;
      }
      applyStandard(material, description);
      return true;
    case 'Physical':
      if (!(material instanceof MeshPhysicalMaterial)) return false;
      applyPhysical(material, description);
      return true;
    case 'Normal':
      if (!(material instanceof MeshNormalMaterial)) return false;
      applyNormal(material, description);
      return true;
  }
};
