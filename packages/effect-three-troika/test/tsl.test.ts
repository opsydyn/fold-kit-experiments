import { expect, mock, test } from 'bun:test';

import { colorRange, label, type LabelNode } from '@opsydyn/effect-three';
import {
  InstancedBufferGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Texture,
} from 'three';
import * as troika from 'troika-three-text/dist/troika-three-text.esm.js';

import { troikaLabels } from '../src/webgpu.ts';

// No browser here: troika would lay text out in a worker and draw glyphs with WebGL.
// Answer each layout by hand instead, with one glyph per character.
type Layout = { readonly text: string; readonly answer: () => void };
const layouts: Array<Layout> = [];
const atlas = new Texture();
// The rest of troika stays real: the module mock holds for every test file in the run.
// Bun updates modules already imported, so the engine imported above sees the mock.
await mock.module('troika-three-text/dist/troika-three-text.esm.js', () => ({
  ...troika,
  getTextRenderInfo: (args: { readonly text: string }, callback: (info: unknown) => void) => {
    const count = args.text.length;
    layouts.push({
      text: args.text,
      answer: () =>
        callback({
          glyphBounds: new Float32Array(count * 4).map((_, index) => index),
          glyphAtlasIndices: new Uint16Array(count).map((_, index) => index),
          glyphColors: null,
          sdfTexture: atlas,
          sdfGlyphSize: 64,
          sdfExponent: 9,
          blockBounds: [-count / 2, -0.5, count / 2, 0.5],
          visibleBounds: [-count / 2, -0.4, count / 2, 0.4],
        }),
    });
  },
}));

const host = (node: LabelNode) => {
  layouts.length = 0;
  let readies = 0;
  const hosted = troikaLabels().createTsl?.(node, () => {
    readies += 1;
  });
  if (hosted === undefined) throw new Error('no TSL implementation');
  const mesh = hosted.object.children[0];
  if (!(mesh instanceof Mesh)) throw new Error('no glyph mesh');
  return { hosted, mesh, readies: () => readies };
};

test('the WebGPU entry draws with WebGL too, and with node materials for a TSL kit', () => {
  const engine = troikaLabels();
  expect(typeof engine.create).toBe('function');
  expect(typeof engine.createTsl).toBe('function');
});

test('a laid-out label is one instanced quad per glyph, with troika’s attributes', () => {
  const { hosted, mesh, readies } = host(label({ key: 'a', text: 'Hey', color: 0xff0000 }));
  expect(mesh.visible).toBe(false);
  expect(hosted.layout()).toBeUndefined();
  layouts[0]?.answer();
  expect(readies()).toBe(1);
  expect(mesh.visible).toBe(true);
  const geometry = mesh.geometry;
  expect(geometry).toBeInstanceOf(InstancedBufferGeometry);
  expect(geometry instanceof InstancedBufferGeometry ? geometry.instanceCount : 0).toBe(3);
  // Given as integers by troika, passed as floats (WebGPU's WebGL 2 backend needs them so).
  expect(geometry.getAttribute('aTroikaGlyphIndex').array).toBeInstanceOf(Float32Array);
  expect(geometry.getAttribute('aTroikaGlyphBounds').itemSize).toBe(4);
  // The label's colour on every glyph, linear as a material colour is.
  expect(Array.from(geometry.getAttribute('aTroikaGlyphColor').array)).toEqual([
    1, 0, 0, 1, 0, 0, 1, 0, 0,
  ]);
  expect(hosted.layout()?.block).toEqual([-1.5, -0.5, 1.5, 0.5]);
  // Culled by the text block's bounds, not the unit quad's.
  expect(geometry.boundingBox?.min.x).toBe(-1.5);
  hosted.dispose();
});

test('an outline is a first pass that does not write depth; without one, a single pass', () => {
  const plain = host(label({ key: 'a', text: 'Hi' }));
  expect(Array.isArray(plain.mesh.material)).toBe(false);
  plain.hosted.update(label({ key: 'a', text: 'Hi', outlineWidth: 0.02 }));
  const passes = plain.mesh.material;
  expect(Array.isArray(passes) ? passes.length : 1).toBe(2);
  expect(Array.isArray(passes) ? passes[0]?.depthWrite : true).toBe(false);
  plain.hosted.dispose();
});

test('a lent material is copied into its node-material class, and followed', () => {
  const { hosted, mesh } = host(label({ key: 'a', text: 'Hi' }));
  const lent = new MeshStandardMaterial({ roughness: 0.3 });
  hosted.setMaterial(lent);
  const drawn = mesh.material;
  expect(Reflect.get(drawn, 'isMeshStandardNodeMaterial')).toBe(true);
  expect(Reflect.get(drawn, 'roughness')).toBe(0.3);
  expect(drawn.transparent).toBe(true);
  hosted.setMaterial(new MeshPhysicalMaterial({ clearcoat: 0.6 }));
  expect(Reflect.get(mesh.material, 'isMeshPhysicalNodeMaterial')).toBe(true);
  hosted.dispose();
});

test('only the latest layout is shown, but a superseded one still asks to draw again', () => {
  const { hosted, mesh, readies } = host(label({ key: 'a', text: 'Hi' }));
  hosted.update(label({ key: 'a', text: 'Hello', colorRanges: [colorRange(0, 0x00ff00)] }));
  expect(layouts.map((layout) => layout.text)).toEqual(['Hi', 'Hello']);
  layouts[1]?.answer();
  layouts[0]?.answer();
  expect(readies()).toBe(2);
  expect(mesh.geometry instanceof InstancedBufferGeometry ? mesh.geometry.instanceCount : 0).toBe(
    5,
  );
  hosted.dispose();
  // Nothing after disposal.
  layouts.push(...layouts.slice(0, 1));
  layouts[2]?.answer();
  expect(readies()).toBe(2);
});
