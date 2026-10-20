/**
 * Stills of a scene as SVG, drawn without a browser (`previewSvg`): what they show, lit as
 * three's diffuse term lights it, in the order a binary space partition paints it.
 */
import { expect, test } from 'bun:test';

import {
  BoxGeometry,
  BufferGeometry,
  Group,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';

import {
  ambientLight,
  basic,
  borrowed,
  box,
  createResourceStore,
  directionalLight,
  fixed,
  hemisphereLight,
  instance,
  instances,
  mesh,
  normalMaterial,
  perspectiveCamera,
  plane,
  pointLight,
  previewSvg,
  scene,
  type SceneDescription,
  type SceneNode,
  sphere,
  spin,
  spotLight,
  standard,
} from '../src/kernel/index.ts';
import { type Facet, paintOrder, unitOf } from '../src/kernel/paintOrder.ts';

const camera = perspectiveCamera({ fov: 45, position: [0, 3, 6], lookAt: [0, 0.5, 0] });

const still = (description: SceneDescription, at = 0): string => {
  const result = previewSvg(description, { width: 320, height: 200, at });
  expect(result._tag).toBe('Preview');
  return result._tag === 'Preview' ? result.svg : '';
};

const sceneOf = (...children: ReadonlyArray<SceneNode>) => scene({ camera, children });

/** Each path's fill, in the order painted. */
const fills = (svg: string): ReadonlyArray<string> =>
  [...svg.matchAll(/<path fill="(#[0-9a-f]{6})"/g)].map((match) => match[1] ?? '');

const floor = mesh({
  key: 'floor',
  rotation: fixed([-Math.PI / 2, 0, 0]),
  geometry: plane({ width: 6, height: 6 }),
  material: basic({ color: 0x0000ff }),
});

const cube = mesh({
  key: 'cube',
  position: [0, 0.5, 0],
  geometry: box(),
  material: basic({ color: 0xff0000 }),
});

test('a still is SVG of the size asked for, centred, behind it the colour asked for', () => {
  const result = previewSvg(sceneOf(cube), { width: 320, height: 200, background: 0xf4f1ea });
  expect(result._tag).toBe('Preview');
  const svg = result._tag === 'Preview' ? result.svg : '';
  expect(svg).toStartWith(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="-160 -100 320 200">',
  );
  expect(svg).toContain('<rect x="-160" y="-100" width="320" height="200" fill="#f4f1ea"/>');
  expect(fills(svg)).toContain('#ff0000');
  // The same scene makes the same picture.
  expect(still(sceneOf(cube))).toBe(still(sceneOf(cube)));
});

test('an invalid description is no picture, but why', () => {
  expect(previewSvg(sceneOf(cube, cube), { width: 10, height: 10 })).toEqual({
    _tag: 'Invalid',
    error: { _tag: 'DuplicateKey', key: 'cube' },
  });
});

test('a floor is painted before what stands on it, as a wall before what is in front of it', () => {
  // By depth alone the floor's near half would be painted over the cube's foot.
  const standing = fills(still(sceneOf(cube, floor)));
  expect(standing.indexOf('#0000ff')).toBeLessThan(standing.indexOf('#ff0000'));
  expect(standing.lastIndexOf('#0000ff')).toBeLessThan(standing.indexOf('#ff0000'));
  const wall = mesh({
    key: 'wall',
    position: [0, 1, -2],
    geometry: plane({ width: 6, height: 4 }),
    material: basic({ color: 0x00ff00 }),
  });
  const walled = fills(still(sceneOf(wall, cube)));
  expect(walled.lastIndexOf('#00ff00')).toBeLessThan(walled.indexOf('#ff0000'));
});

test('a face is lit by three’s diffuse term: ambient light of intensity π shows its colour', () => {
  const lit = (light: SceneNode) =>
    fills(
      still(
        sceneOf(
          light,
          mesh({ key: 'cube', geometry: box(), material: standard({ color: 0x336699 }) }),
        ),
      ),
    );
  expect(lit(ambientLight({ key: 'sky', intensity: Math.PI }))).toEqual(['#336699']);
  // A directional light lights only faces turned to it, by how far they are turned.
  const sun = lit(directionalLight({ key: 'sun', intensity: Math.PI, position: [0, 1, 0] }));
  expect(sun).toContain('#336699');
  expect(sun).toContain('#000000');
  // Without light, a lit material is black; a basic one is its colour.
  expect(lit(ambientLight({ key: 'none', intensity: 0 }))).toEqual(['#000000']);
});

test('each instance is drawn where it stands, in its own colour', () => {
  const row = instances({
    key: 'row',
    geometry: box({ width: 0.5, height: 0.5, depth: 0.5 }),
    material: basic(),
    instances: [
      instance({ key: 'a', position: [-1.5, 0, 0], color: 0xff0000 }),
      instance({ key: 'b', position: [0, 0, 0], color: 0x00ff00 }),
      instance({ key: 'c', position: [1.5, 0, 0], color: 0x0000ff }),
    ],
  });
  expect(new Set(fills(still(sceneOf(row))))).toEqual(new Set(['#ff0000', '#00ff00', '#0000ff']));
});

test('what is behind the camera or cut by its near plane draws no stray points', () => {
  const around = mesh({
    key: 'around',
    position: [0, 3, 6],
    geometry: sphere({ radius: 2 }),
    material: basic({ color: 0x00ff00, side: 'double' }),
  });
  const svg = still(sceneOf(around, cube));
  expect(svg).not.toMatch(/NaN|Infinity/);
  expect(fills(still(sceneOf(mesh({ ...cube, position: [0, 3, 20] }))))).toEqual([]);
});

test('scene time poses the still: a spinning cube is turned at the moment shown', () => {
  const spinning = sceneOf(
    mesh({
      key: 'cube',
      geometry: box(),
      material: basic({ color: 0xff0000 }),
      rotation: spin({ axis: 'y', radiansPerSecond: 1 }),
    }),
  );
  expect(still(spinning, 0)).not.toBe(still(spinning, 0.5));
});

const facet = (item: string, points: ReadonlyArray<readonly [number, number, number]>) =>
  ({
    _tag: 'Facet',
    points: points.map(([x, y, z]) => new Vector3(x, y, z)),
    item,
  }) satisfies Facet<string>;

test('paint order is far to near whatever order objects come in, and a solid paints as it is', () => {
  const eye = new Vector3(0, 0, 10);
  const near = facet('near', [
    [0, 0, 1],
    [1, 0, 1],
    [0, 1, 1],
  ]);
  const far = facet('far', [
    [0, 0, -1],
    [1, 0, -1],
    [0, 1, -1],
  ]);
  const order = (facets: ReadonlyArray<Facet<string>>) =>
    paintOrder(
      facets.map((one) => unitOf([one], [], eye)),
      eye,
    ).map((shape) => shape.item);
  expect(order([near, far])).toEqual(['far', 'near']);
  expect(order([far, near])).toEqual(['far', 'near']);
  // Two faces of a box turned to the eye hide neither: they may be painted as they are.
  const front = facet('front', [
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ]);
  const top = facet('top', [
    [0, 1, 1],
    [1, 1, 1],
    [1, 1, 0],
  ]);
  expect(unitOf([front, top], [], new Vector3(0.5, 5, 5)).selfOrdered).toBe(true);
  // A fold toward the eye is not a solid's outside: one face can hide the other.
  const fold = facet('fold', [
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 3],
  ]);
  expect(unitOf([front, fold], [], new Vector3(0.5, 0.5, 10)).selfOrdered).toBe(false);
});

test('a store lends what borrowed nodes show: lines, points, sprites and see-through faces', () => {
  const store = createResourceStore();
  const lent = new Group();
  const run = new LineSegments(
    new BufferGeometry().setFromPoints([new Vector3(-1, 0, 0), new Vector3(1, 0, 0)]),
    new LineDashedMaterial({ color: 0xff0000, dashSize: 0.2, gapSize: 0.1 }),
  );
  const dots = new Points(
    new BufferGeometry().setFromPoints([new Vector3(0, 1, 0)]),
    new PointsMaterial({ color: 0x00ff00, size: 0.1 }),
  );
  const marker = new Sprite(new SpriteMaterial({ color: 0x0000ff }));
  marker.position.set(0, 2, 0);
  const glass = new Mesh(
    new BoxGeometry(),
    new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
  );
  glass.position.set(2, 0.5, 0);
  lent.add(run, dots, marker, glass);
  store.lend('kit', lent);
  const result = previewSvg(sceneOf(borrowed({ key: 'kit', id: 'kit' })), {
    width: 320,
    height: 200,
    store,
  });
  const svg = result._tag === 'Preview' ? result.svg : '';
  expect(svg).toContain('stroke="#ff0000"');
  expect(svg).toContain('stroke-dasharray="0.2,0.1"');
  expect(svg).toContain('<path fill="#00ff00"');
  expect(svg).toContain('<path fill="#0000ff"');
  expect(svg).toContain('<path fill="#ffffff" fill-opacity="0.5"');
  // Without the store, nothing is lent and nothing drawn.
  expect(fills(still(sceneOf(borrowed({ key: 'kit', id: 'kit' }))))).toEqual([]);
});

test('point, spot and hemisphere light fall off as three’s do, and normals show as colours', () => {
  const lit = (light: SceneNode) =>
    fills(
      still(
        sceneOf(
          light,
          mesh({ key: 'cube', geometry: box(), material: standard({ color: 0xffffff }) }),
        ),
      ),
    );
  const near = lit(pointLight({ key: 'bulb', position: [0, 3, 3], intensity: 10 }));
  const far = lit(pointLight({ key: 'bulb', position: [0, 30, 30], intensity: 10 }));
  // A white cube's red channel says how bright each face is lit.
  const brightest = (shown: ReadonlyArray<string>) =>
    Math.max(...shown.map((fill) => Number.parseInt(fill.slice(1, 3), 16)));
  expect(brightest(near)).toBeGreaterThan(brightest(far));
  // Out of a spot's cone, nothing is lit.
  const away = lit(spotLight({ key: 'spot', position: [0, 3, 3], target: [0, 10, 3], angle: 0.2 }));
  expect(away.every((fill) => fill === '#000000')).toBe(true);
  expect(lit(hemisphereLight({ key: 'sky', intensity: Math.PI }))).toContain('#ffffff');
  const normals = fills(
    still(sceneOf(mesh({ key: 'cube', geometry: box(), material: normalMaterial() }))),
  );
  expect(new Set(normals).size).toBeGreaterThan(1);
});
