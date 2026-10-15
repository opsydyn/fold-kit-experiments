/**
 * Plain three.js helpers for loaded models.
 *
 * @module
 */
import { type Material, Mesh, type Object3D, Texture } from 'three';

/** Disposes every texture a material holds (maps of any kind). */
const disposeMaterial = (material: Material): void => {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) value.dispose();
  }
  material.dispose();
};

/** Disposes a mesh's geometry and materials; other objects hold nothing to free. */
function disposeMesh(object: Object3D): void {
  if (!(object instanceof Mesh)) return;
  object.geometry.dispose();
  const materials: ReadonlyArray<Material> = Array.isArray(object.material)
    ? object.material
    : [object.material];
  for (const material of materials) disposeMaterial(material);
}

/** Disposes a loaded model's GPU resources: it was ours, not the application's. */
export const disposeModel = (root: Object3D): void => {
  root.traverse(disposeMesh);
};

export const namesIn = (root: Object3D): ReadonlyArray<string> => {
  const names: Array<string> = [];
  root.traverse((object) => {
    if (object !== root && object.name !== '') names.push(object.name);
  });
  return names;
};
