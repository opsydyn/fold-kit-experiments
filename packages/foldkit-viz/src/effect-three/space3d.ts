import { billboard, group, label, line, points } from '@opsydyn/effect-three/kernel';
import type { GroupNode, SceneNode } from '@opsydyn/effect-three/kernel';

import { rgbOf } from '../chart/space3d.js';
import type { Scatter3d, Space3d, Surface3d } from '../chart/space3d.js';
import { darkTheme } from '../chart/theme.js';
import type { ChartTheme } from '../chart/theme.js';

/**
 * 3D chart geometry (chart/space3d) as effect-three scene descriptions: plain
 * data the parent places in its scene, so the camera, gestures and selection
 * stay in its Model. Tick and axis labels are effect-three Labels, drawn when
 * the environment has a label engine (effect-three-troika) and empty without.
 * Optional: install @opsydyn/effect-three to use it.
 */

export type Space3dSceneOptions = Readonly<{
  /** The group's key, prefixing every node inside it. Keys must be unique in the scene. */
  key: string;
  /** Colours for the box, grid and labels. Default darkTheme. */
  theme?: Pick<ChartTheme, 'text' | 'mutedText' | 'grid' | 'axis'>;
  /** Label size in scene units. Default a tenth of the cube's half side. */
  fontSize?: number;
}>;

/** The cube's box, grid and labels. */
export function space3dNodes(
  space: Space3d,
  options: Space3dSceneOptions,
): ReadonlyArray<SceneNode> {
  const theme = options.theme ?? darkTheme;
  const fontSize = options.fontSize ?? space.half * 0.1;
  const { key } = options;
  return [
    line({ key: `${key}-box`, points: space.box.flat(), segments: true, color: rgbOf(theme.axis) }),
    line({
      key: `${key}-grid`,
      points: space.grid.flat(),
      segments: true,
      color: rgbOf(theme.grid),
      opacity: 0.6,
      transparent: true,
    }),
    ...space.axes.flatMap((axis) => [
      ...axis.ticks.map((tick, i) =>
        label({
          key: `${key}-${axis.name}-tick-${i}`,
          text: tick.label,
          position: tick.position,
          rotation: billboard(),
          fontSize,
          color: rgbOf(theme.mutedText),
          anchorX: 'center',
          anchorY: 'middle',
        }),
      ),
      label({
        key: `${key}-${axis.name}-title`,
        text: axis.label,
        position: axis.labelPosition,
        rotation: billboard(),
        fontSize: fontSize * 1.25,
        color: rgbOf(theme.text),
        anchorX: 'center',
        anchorY: 'middle',
      }),
    ]),
  ];
}

/** A 3D scatter: its axes and its points, round dots of `pointSize` pixels (default 6). */
export function scatter3dScene(
  scatter: Scatter3d,
  options: Space3dSceneOptions & Readonly<{ pointSize?: number }>,
): GroupNode {
  return group({
    key: options.key,
    children: [
      ...space3dNodes(scatter.space, options),
      points({
        key: `${options.key}-points`,
        positions: scatter.positions,
        colors: scatter.colors,
        size: options.pointSize ?? 6,
        sizeAttenuation: false,
        round: true,
      }),
    ],
  });
}

/** A surface: its axes and its wireframe, coloured by height. */
export function surface3dScene(surface: Surface3d, options: Space3dSceneOptions): GroupNode {
  return group({
    key: options.key,
    children: [
      ...space3dNodes(surface.space, options),
      line({
        key: `${options.key}-surface`,
        points: surface.points,
        segments: true,
        vertexColors: surface.colors,
        width: 1.5,
      }),
    ],
  });
}
