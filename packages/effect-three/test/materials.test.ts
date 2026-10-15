import { expect, test } from 'bun:test';

import {
  FrontSide,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshNormalMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from 'three';

import {
  basic,
  box,
  createSceneGraph,
  lambert,
  mesh,
  normalMaterial,
  phong,
  physical,
  scene,
  sharedMaterial,
  type SurfaceMaterial,
  standard,
} from '../src/kernel/index.ts';

/** Every field of a description, read back from a three.js material of the same kind. */
const readBack = (description: SurfaceMaterial, material: Material): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(description)) {
    if (key === '_tag') continue;
    const value: unknown = Reflect.get(material, key);
    result[key] =
      typeof value === 'object' &&
      value !== null &&
      'getHex' in value &&
      typeof value.getHex === 'function'
        ? value.getHex()
        : value;
  }
  result['side'] = material.side === FrontSide ? 'front' : String(material.side);
  return result;
};

test('material defaults match three.js', () => {
  const pairs = [
    [basic(), new MeshBasicMaterial()],
    [lambert(), new MeshLambertMaterial()],
    [phong(), new MeshPhongMaterial()],
    [standard(), new MeshStandardMaterial()],
    [physical(), new MeshPhysicalMaterial()],
    [normalMaterial(), new MeshNormalMaterial()],
  ] as const;
  for (const [description, reference] of pairs) {
    const { _tag, ...fields } = description;
    expect(readBack(description, reference)).toEqual(fields);
    reference.dispose();
  }
});

const materialOf = (graph: ReturnType<typeof createSceneGraph>, key: string): Material => {
  const object = graph.object(key);
  if (!(object instanceof Mesh)) throw new Error(`"${key}" is not a mesh`);
  return object.material;
};

const painted = (material: SurfaceMaterial) =>
  scene({ children: [mesh({ key: 'a', geometry: box(), material })] });

test('owned materials update in place within a kind and are replaced across kinds', () => {
  const graph = createSceneGraph();
  graph.reconcile(painted(standard({ color: 0xff0000 })));
  const first = materialOf(graph, 'a');
  graph.reconcile(painted(standard({ color: 0x00ff00, emissive: 0x111111 })));
  expect(materialOf(graph, 'a')).toBe(first);

  graph.reconcile(painted(physical({ color: 0x00ff00, clearcoat: 1 })));
  const replaced = materialOf(graph, 'a');
  expect(replaced).not.toBe(first);
  expect(replaced).toBeInstanceOf(MeshPhysicalMaterial);
  expect(graph.store.stats().materials).toEqual({ created: 2, disposed: 1, live: 1 });

  // Physical extends Standard in three.js; going back must still build a new material.
  graph.reconcile(painted(standard({ color: 0x00ff00 })));
  expect(materialOf(graph, 'a').type).toBe('MeshStandardMaterial');
  expect(graph.store.stats().materials.live).toBe(1);
  graph.dispose();
});

test('changes compiled into the shader flag the material for recompilation', () => {
  const graph = createSceneGraph();
  graph.reconcile(painted(lambert({ color: 0xffffff })));
  const material = materialOf(graph, 'a');
  const version = material.version;
  graph.reconcile(painted(lambert({ color: 0x000000 })));
  expect(material.version).toBe(version);
  graph.reconcile(painted(lambert({ color: 0x000000, transparent: true, opacity: 0.5 })));
  expect(material.version).toBeGreaterThan(version);
  const afterTransparent = material.version;
  graph.reconcile(
    painted(lambert({ color: 0x000000, transparent: true, opacity: 0.5, flatShading: true })),
  );
  expect(material.version).toBeGreaterThan(afterTransparent);
  graph.dispose();
});

test('changing a shared material kind swaps the replacement onto every user', () => {
  const graph = createSceneGraph();
  const shared = (material: SurfaceMaterial) =>
    scene({
      resources: { materials: [{ id: 'paint', material }] },
      children: ['a', 'b'].map((key) =>
        mesh({ key, geometry: box(), material: sharedMaterial('paint') }),
      ),
    });
  graph.reconcile(shared(phong({ color: 0x3366ff })));
  const before = materialOf(graph, 'a');
  graph.reconcile(shared(phong({ color: 0x3366ff, shininess: 80 })));
  expect(materialOf(graph, 'a')).toBe(before);

  graph.reconcile(shared(basic({ color: 0x3366ff })));
  const after = materialOf(graph, 'a');
  expect(after).not.toBe(before);
  if (!(after instanceof MeshBasicMaterial)) throw new Error('expected a basic material');
  expect(materialOf(graph, 'b')).toBe(after);
  expect(graph.store.sharedMaterialId(after)).toBe('paint');
  expect(graph.store.stats().materials).toEqual({ created: 2, disposed: 1, live: 1 });
  graph.dispose();
  expect(graph.store.stats().materials.live).toBe(0);
});
