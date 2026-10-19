import { expect, test } from 'bun:test';

import { Group, type Object3D } from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { Line2 as GpuLine2 } from 'three/addons/lines/webgpu/Line2.js';
import { Line2NodeMaterial } from 'three/webgpu';

import {
  catmullRomColors,
  catmullRomPoints,
  catmullRomPointAt,
  createPicker,
  createSceneGraph,
  cubicBezierPoints,
  line,
  type LineNode,
  orthographicCamera,
  quadraticBezierPoints,
  scene,
} from '../src/index.ts';
import { webglKit } from '../src/webgl/index.ts';
import { webgpuKit } from '../src/webgpu/index.ts';

const zigzag: LineNode['points'] = [
  [-2, 0, 0],
  [-1, 1, 0],
  [0, 0, 0],
  [1, 1, 0],
];

const lineScene = (node: LineNode) =>
  scene({
    camera: orthographicCamera({ zoom: 40, position: [0, 0, 10], lookAt: [0, 0, 0] }),
    children: [node],
  });

/** The kit's line object inside the node's wrapper, and the wrapper. */
const drawnLine = (graph: ReturnType<typeof createSceneGraph>): Object3D | undefined =>
  graph.object('path')?.children[0]?.children[0];

test('a line is drawn by the WebGL kit as three’s Line2, styled from its description', () => {
  const graph = createSceneGraph({ kit: webglKit });
  graph.reconcile(
    lineScene(line({ key: 'path', points: zigzag, color: 0xff0000, width: 3, dashed: true })),
  );
  expect(graph.object('path')).toBeInstanceOf(Group);
  const drawn = drawnLine(graph);
  expect(drawn).toBeInstanceOf(Line2);
  const material = drawn instanceof Line2 ? drawn.material : undefined;
  expect(material).toBeInstanceOf(LineMaterial);
  expect(material?.linewidth).toBe(3);
  expect(material?.dashed).toBe(true);
  expect(material?.color.getHex()).toBe(0xff0000);
  // Three segments through four points, and distances along them for the dashes.
  expect(drawn instanceof Line2 ? drawn.geometry.instanceCount : 0).toBe(3);
  expect(
    drawn instanceof Line2 ? drawn.geometry.getAttribute('instanceDistanceEnd') : undefined,
  ).toBeDefined();
  graph.dispose();
});

test('vertex colours colour each point and turn the line white; segments pair points', () => {
  const graph = createSceneGraph({ kit: webglKit });
  graph.reconcile(
    lineScene(
      line({ key: 'path', points: zigzag, segments: true, vertexColors: [0xff0000, 0x0000ff] }),
    ),
  );
  const drawn = drawnLine(graph);
  expect(drawn).toBeInstanceOf(LineSegments2);
  expect(drawn instanceof Line2).toBe(false);
  const material = drawn instanceof LineSegments2 ? drawn.material : undefined;
  expect(material?.vertexColors).toBe(true);
  expect(material?.color.getHex()).toBe(0xffffff);
  // Two pairs of points: two segments.
  expect(drawn instanceof LineSegments2 ? drawn.geometry.instanceCount : 0).toBe(2);
  graph.dispose();
});

test('new points rebuild the line; a line of one point hides; disposal frees it', () => {
  const graph = createSceneGraph({ kit: webglKit });
  graph.reconcile(lineScene(line({ key: 'path', points: zigzag })));
  const first = drawnLine(graph);
  graph.reconcile(lineScene(line({ key: 'path', points: zigzag.slice(0, 2) })));
  const second = drawnLine(graph);
  expect(second).not.toBe(first);
  expect(second instanceof Line2 ? second.geometry.instanceCount : 0).toBe(1);
  graph.reconcile(lineScene(line({ key: 'path', points: [[0, 0, 0]] })));
  expect(drawnLine(graph)?.visible).toBe(false);
  // Moving it is the wrapper's business: the line itself stays.
  const kept = drawnLine(graph);
  graph.reconcile(lineScene(line({ key: 'path', points: [[0, 0, 0]], position: [1, 0, 0] })));
  expect(drawnLine(graph)).toBe(kept);
  graph.dispose();
});

test('the WebGPU kit draws the same line with node materials, the dash scale as `scale`', () => {
  const graph = createSceneGraph({ kit: webgpuKit });
  graph.reconcile(lineScene(line({ key: 'path', points: zigzag, dashed: true, dashScale: 2 })));
  const drawn = drawnLine(graph);
  expect(drawn).toBeInstanceOf(GpuLine2);
  const material = drawn instanceof GpuLine2 ? drawn.material : undefined;
  expect(material).toBeInstanceOf(Line2NodeMaterial);
  expect(Reflect.get(material ?? {}, 'scale')).toBe(2);
  graph.dispose();
});

test('without a kit a line is an empty wrapper', () => {
  const graph = createSceneGraph();
  graph.reconcile(lineScene(line({ key: 'path', points: zigzag })));
  expect(graph.object('path')?.children).toEqual([]);
  graph.dispose();
});

test('an interactive line is picked within its width', () => {
  const graph = createSceneGraph({ kit: webglKit });
  graph.reconcile(
    lineScene(
      line({
        key: 'path',
        points: [
          [-2, 0, 0],
          [2, 0, 0],
        ],
        width: 0.2,
        worldUnits: true,
        interactive: true,
      }),
    ),
  );
  const picker = createPicker(graph);
  expect(picker.pick(0, 0)).toMatchObject({ key: 'path' });
  graph.dispose();
});

test('curves give their points as Drei’s curve lines do', () => {
  const smooth = catmullRomPoints(zigzag, { segments: 12 });
  expect(smooth).toHaveLength(13);
  expect(smooth[0]).toEqual([-2, 0, 0]);
  expect(smooth.at(-1)).toEqual([1, 1, 0]);
  const cubic = cubicBezierPoints({
    start: [0, 0, 0],
    midA: [0, 1, 0],
    midB: [1, 1, 0],
    end: [1, 0, 0],
  });
  expect(cubic).toHaveLength(21);
  expect(cubic.at(-1)).toEqual([1, 0, 0]);
  // Without `mid`, Drei's: level with the start, over the end.
  const arc = quadraticBezierPoints({ start: [0, 2, 0], end: [4, 0, 0], segments: 2 });
  expect(arc[1]).toEqual([3, 1.5, 0]);
});

test('Catmull-Rom colours spread a few colours over every point, ends as given', () => {
  const colours = catmullRomColors([0xff0000, 0x0000ff], { segments: 4 });
  expect(colours).toHaveLength(5);
  expect(colours[0]).toBe(0xff0000);
  expect(colours.at(-1)).toBe(0x0000ff);
  // As many colours as points already: kept.
  expect(catmullRomColors([1, 2, 3], { segments: 2 })).toEqual([1, 2, 3]);
});

test('a point along a Catmull-Rom curve: its ends at 0 and 1, between them on the way', () => {
  expect(catmullRomPointAt(zigzag, 0)).toEqual([-2, 0, 0]);
  expect(catmullRomPointAt(zigzag, 1)).toEqual([1, 1, 0]);
  const middle = catmullRomPointAt(zigzag, 0.5);
  expect(middle[0]).toBeGreaterThan(-2);
  expect(middle[0]).toBeLessThan(1);
});
