import { applyMatrixToPoint, inverseMatrix } from '../math/zoom';

export type ChartPoint = Readonly<{ x: number; y: number }>;
export type AffineMatrix = Readonly<{
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}>;

/** Convert client coordinates using the actual SVG-local → client affine matrix. */
export function clientToLocal(point: ChartPoint, matrix: AffineMatrix): ChartPoint | null {
  if (![point.x, point.y, ...Object.values(matrix)].every(Number.isFinite))
    throw new RangeError('Coordinates and matrix fields must be finite');
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (determinant === 0 || !Number.isFinite(determinant)) return null;
  const inverse = inverseMatrix({
    scaleX: matrix.a,
    scaleY: matrix.d,
    skewX: matrix.c,
    skewY: matrix.b,
    translateX: 0,
    translateY: 0,
  });
  if (!Object.values(inverse).every(Number.isFinite)) return null;
  const result = applyMatrixToPoint(inverse, { x: point.x - matrix.e, y: point.y - matrix.f });
  return Number.isFinite(result.x) && Number.isFinite(result.y) ? result : null;
}
