import { describe, expect, it } from 'bun:test';

import type {
  GroupNode,
  LabelNode,
  LineNode,
  PointsNode,
  SceneNode,
} from '@opsydyn/effect-three/kernel';

import { rgbOf, scatter3d, surface3d } from '../src/chart/space3d.js';
import { darkTheme, lightTheme } from '../src/chart/theme.js';
import { scatter3dScene, surface3dScene } from '../src/effect-three/space3d.js';

const rows = [
  { a: 1, b: 2, c: 3, kind: 'p' },
  { a: 2, b: 4, c: 1, kind: 'q' },
];
const scatter = scatter3d(rows, {
  x: (d) => d.a,
  y: (d) => d.b,
  z: (d) => d.c,
  color: (d) => d.kind,
});

const childrenOf = (node: GroupNode): ReadonlyArray<SceneNode> => node.children;
const ofTag = <T extends SceneNode['_tag']>(nodes: ReadonlyArray<SceneNode>, tag: T) =>
  nodes.filter((node): node is Extract<SceneNode, { _tag: T }> => node._tag === tag);

describe('scatter3dScene', () => {
  const scene = scatter3dScene(scatter, { key: 'chart' });

  it('is one keyed group: the box, the grid, labels facing the camera, and the points', () => {
    expect(scene._tag).toBe('Group');
    expect(scene.key).toBe('chart');
    const children = childrenOf(scene);
    const lines: ReadonlyArray<LineNode> = ofTag(children, 'Line');
    expect(lines.map((line) => line.key)).toEqual(['chart-box', 'chart-grid']);
    expect(lines[0]?.segments).toBe(true);
    expect(lines[0]?.points).toHaveLength(24);
    const labels: ReadonlyArray<LabelNode> = ofTag(children, 'Label');
    const ticks = scatter.space.axes.reduce((sum, axis) => sum + axis.ticks.length, 0);
    expect(labels).toHaveLength(ticks + 3);
    expect(labels.every((label) => label.rotation._tag === 'Billboard')).toBe(true);
    const [points]: ReadonlyArray<PointsNode> = ofTag(children, 'Points');
    expect(points?.look._tag).toBe('Dots');
    if (points?.look._tag === 'Dots') {
      expect(points.look.positions).toEqual(scatter.positions);
      expect(points.look.colors).toEqual(scatter.colors);
    }
  });

  it('gives every node a key of its own', () => {
    const keys = childrenOf(scene).map((node) => node.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('draws in the theme: dark by default, or the one given', () => {
    const box = (node: GroupNode) => ofTag(childrenOf(node), 'Line')[0]?.color;
    expect(box(scene)).toBe(rgbOf(darkTheme.axis));
    expect(box(scatter3dScene(scatter, { key: 'c', theme: lightTheme }))).toBe(
      rgbOf(lightTheme.axis),
    );
  });
});

describe('surface3dScene', () => {
  const surface = surface3d({
    xs: [0, 1, 2],
    ys: [0, 1],
    z: [
      [0, 1, 2],
      [3, 4, 5],
    ],
  });

  it('draws the surface as coloured segments over the axes', () => {
    const scene = surface3dScene(surface, { key: 'hill' });
    const wire = ofTag(childrenOf(scene), 'Line').find((line) => line.key === 'hill-surface');
    expect(wire?.segments).toBe(true);
    expect(wire?.points).toEqual(surface.points);
    expect(wire?.vertexColors).toEqual(surface.colors);
  });
});
