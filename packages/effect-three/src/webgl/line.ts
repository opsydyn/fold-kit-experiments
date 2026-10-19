/**
 * The WebGL kit's lines: three's fat lines (`Line2`, `LineSegments2` and `LineMaterial`,
 * which Drei's `Line` takes from three-stdlib), which size themselves to the viewport
 * before each draw.
 *
 * @module
 */
import { Group } from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

import type { LineNode } from '../kernel/description.ts';
import { drawable, fillLineGeometry } from '../kernel/lineGeometry.ts';
import type { HostedLine } from '../kernel/renderKit.ts';

/** The material's look from the description; vertex colours want white, as Drei sets. */
const style = (material: LineMaterial, line: LineNode): void => {
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
  material.dashScale = line.dashScale;
  material.dashOffset = line.dashOffset;
  material.opacity = line.opacity;
  material.transparent = line.transparent;
};

const draw = (line: LineNode, material: LineMaterial): LineSegments2 => {
  const drawn = line.segments
    ? new LineSegments2(fillLineGeometry(new LineSegmentsGeometry(), line), material)
    : new Line2(fillLineGeometry(new LineGeometry(), line), material);
  drawn.computeLineDistances();
  drawn.visible = drawable(line);
  return drawn;
};

export const hostLine = (first: LineNode): HostedLine => {
  const object = new Group();
  const material = new LineMaterial();
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
