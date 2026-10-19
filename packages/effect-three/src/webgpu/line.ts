/**
 * The WebGPU kit's lines: three's fat lines for WebGPU (`Line2`, `LineSegments2` and `Line2NodeMaterial`,
 * the node-material twins of what Drei's `Line` uses), which size themselves to the viewport
 * before each draw.
 *
 * @module
 */
import { Group } from 'three';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { Line2 } from 'three/addons/lines/webgpu/Line2.js';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import { Line2NodeMaterial } from 'three/webgpu';

import type { LineNode } from '../kernel/description.ts';
import { drawable, fillLineGeometry } from '../kernel/lineGeometry.ts';
import type { HostedLine } from '../kernel/renderKit.ts';

/** The material's look from the description; vertex colours want white, as Drei sets. */
const style = (material: Line2NodeMaterial, line: LineNode): void => {
  material.color.setHex(line.vertexColors === null ? line.color : 0xffffff);
  if (material.vertexColors !== (line.vertexColors !== null)) {
    material.vertexColors = line.vertexColors !== null;
    material.needsUpdate = true;
  }
  material.linewidth = line.width;
  material.worldUnits = line.worldUnits;
  material.dashed = line.dashed;
  material.dashSize = line.dashSize;
  material.gapSize = line.gapSize;
  // The node material reads the dash scale as `scale`, as `LineDashedMaterial` names it.
  material.scale = line.dashScale;
  material.dashOffset = line.dashOffset;
  material.opacity = line.opacity;
  material.transparent = line.transparent;
};

const draw = (line: LineNode, material: Line2NodeMaterial): LineSegments2 => {
  const drawn = line.segments
    ? new LineSegments2(fillLineGeometry(new LineSegmentsGeometry(), line), material)
    : new Line2(fillLineGeometry(new LineGeometry(), line), material);
  drawn.computeLineDistances();
  drawn.visible = drawable(line);
  return drawn;
};

export const hostLine = (first: LineNode): HostedLine => {
  const object = new Group();
  const material = new Line2NodeMaterial();
  style(material, first);
  let drawn = draw(first, material);
  object.add(drawn);
  return {
    object,
    update: (next) => {
      style(material, next);
      drawn.removeFromParent();
      drawn.geometry.dispose();
      drawn = draw(next, material);
      object.add(drawn);
    },
    dispose: () => {
      drawn.geometry.dispose();
      material.dispose();
    },
  };
};
