// 2D density estimation and marching-squares contour lines
// D3 d3-contour parity (contour geometry layer only — no SVG path stitching to polygons)

export type Point2D = readonly [number, number];
export type Segment2D = readonly [Point2D, Point2D];

export type Density2dConfig = Readonly<{
  nx: number;
  ny: number;
  x: readonly [number, number];
  y: readonly [number, number];
  bandwidth?: number;
}>;

// Epanechnikov kernel density estimate on a 2D grid
export function density2d(
  points: ReadonlyArray<readonly [number, number]>,
  config: Density2dConfig,
): Float64Array {
  const { nx, ny, bandwidth = 1 } = config;
  const [x0, x1] = config.x;
  const [y0, y1] = config.y;
  const h2 = bandwidth * bandwidth;
  const cellW = (x1 - x0) / (nx - 1);
  const cellH = (y1 - y0) / (ny - 1);
  const values = new Float64Array(nx * ny);

  for (let j = 0; j < ny; j++) {
    const gy = y0 + j * cellH;
    for (let i = 0; i < nx; i++) {
      const gx = x0 + i * cellW;
      let sum = 0;
      for (const pt of points) {
        const dx = (gx - pt[0]) / bandwidth;
        const dy = (gy - pt[1]) / bandwidth;
        const d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          const w = 1 - d2;
          sum += w * w;
        }
      }
      values[j * nx + i] = sum / (points.length * h2 * Math.PI);
    }
  }
  return values;
}

// Marching squares — emits line segments for the given threshold
// Grid values are in row-major order: values[j * nx + i] = value at column i, row j
// Returned coordinates are in grid space: x ∈ [0, nx-1], y ∈ [0, ny-1]
// Bit encoding (matching D3 d3-contour/src/contours.js):
//   bit 0 = BL (i, j)  bit 1 = BR (i+1, j)
//   bit 2 = TR (i+1, j+1)  bit 3 = TL (i, j+1)
export function contourLines(
  values: Float64Array | ReadonlyArray<number>,
  nx: number,
  ny: number,
  thresh: number,
): ReadonlyArray<Segment2D> {
  const segs: Segment2D[] = [];

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const v00 = values[j * nx + i] ?? 0; // BL
      const v10 = values[j * nx + i + 1] ?? 0; // BR
      const v11 = values[(j + 1) * nx + i + 1] ?? 0; // TR
      const v01 = values[(j + 1) * nx + i] ?? 0; // TL

      const c =
        (v00 >= thresh ? 1 : 0) |
        (v10 >= thresh ? 2 : 0) |
        (v11 >= thresh ? 4 : 0) |
        (v01 >= thresh ? 8 : 0);

      if (c === 0 || c === 15) continue;

      // Linear interpolation parameter on each edge
      const tb = v10 !== v00 ? (thresh - v00) / (v10 - v00) : 0.5;
      const tr = v11 !== v10 ? (thresh - v10) / (v11 - v10) : 0.5;
      const tt = v11 !== v01 ? (thresh - v01) / (v11 - v01) : 0.5;
      const tl = v01 !== v00 ? (thresh - v00) / (v01 - v00) : 0.5;

      const bottom: Point2D = [i + tb, j];
      const right: Point2D = [i + 1, j + tr];
      const top: Point2D = [i + tt, j + 1];
      const left: Point2D = [i, j + tl];

      switch (c) {
        case 1:
        case 14:
          segs.push([left, bottom]);
          break;
        case 2:
        case 13:
          segs.push([bottom, right]);
          break;
        case 3:
        case 12:
          segs.push([left, right]);
          break;
        case 4:
        case 11:
          segs.push([right, top]);
          break;
        case 5:
          segs.push([left, bottom], [right, top]);
          break;
        case 6:
        case 9:
          segs.push([bottom, top]);
          break;
        case 7:
        case 8:
          segs.push([left, top]);
          break;
        case 10:
          segs.push([bottom, right], [top, left]);
          break;
      }
    }
  }
  return segs;
}

// Convert contour segments to an SVG path string using caller-supplied scale functions
export function segmentsToPath(
  segments: ReadonlyArray<Segment2D>,
  xScale: (x: number) => number,
  yScale: (y: number) => number,
): string {
  return segments
    .map(([a, b]) => `M${xScale(a[0])},${yScale(a[1])}L${xScale(b[0])},${yScale(b[1])}`)
    .join('');
}
