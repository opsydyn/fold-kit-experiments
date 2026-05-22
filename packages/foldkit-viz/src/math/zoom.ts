// 2D affine transform matrix — ported from visx/visx-zoom/src/util/matrix.ts
// Extended with chart-specific helpers: scaleAt, translateBy, constrainScale,
// matrixToString, rescaleDomain.

export type TransformMatrix = Readonly<{
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
  skewX: number;
  skewY: number;
}>;

export type Point = Readonly<{ x: number; y: number }>;

// ---------------------------------------------------------------------------
// Constructors

export function identityMatrix(): TransformMatrix {
  return { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, skewX: 0, skewY: 0 };
}

export function createMatrix(partial: Partial<TransformMatrix>): TransformMatrix {
  return {
    scaleX: 1,
    scaleY: 1,
    translateX: 0,
    translateY: 0,
    skewX: 0,
    skewY: 0,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Core matrix math (D3 / visx parity)

export function inverseMatrix(m: TransformMatrix): TransformMatrix {
  const det = m.scaleX * m.scaleY - m.skewY * m.skewX;
  return {
    scaleX: m.scaleY / det,
    scaleY: m.scaleX / det,
    translateX: (m.scaleY * m.translateX - m.skewX * m.translateY) / -det,
    translateY: (m.skewY * m.translateX - m.scaleX * m.translateY) / det,
    skewX: m.skewX / -det,
    skewY: m.skewY / -det,
  };
}

export function applyMatrixToPoint(m: TransformMatrix, { x, y }: Point): Point {
  return {
    x: m.scaleX * x + m.skewX * y + m.translateX,
    y: m.skewY * x + m.scaleY * y + m.translateY,
  };
}

export function applyInverseMatrixToPoint(m: TransformMatrix, p: Point): Point {
  return applyMatrixToPoint(inverseMatrix(m), p);
}

export function scaleMatrix(scaleX: number, scaleY?: number): TransformMatrix {
  return createMatrix({ scaleX, scaleY: scaleY ?? scaleX });
}

export function translateMatrix(translateX: number, translateY: number): TransformMatrix {
  return createMatrix({ translateX, translateY });
}

export function multiplyMatrices(a: TransformMatrix, b: TransformMatrix): TransformMatrix {
  return {
    scaleX: a.scaleX * b.scaleX + a.skewX * b.skewY,
    scaleY: a.skewY * b.skewX + a.scaleY * b.scaleY,
    translateX: a.scaleX * b.translateX + a.skewX * b.translateY + a.translateX,
    translateY: a.skewY * b.translateX + a.scaleY * b.translateY + a.translateY,
    skewX: a.scaleX * b.skewX + a.skewX * b.scaleY,
    skewY: a.skewY * b.scaleX + a.scaleY * b.skewY,
  };
}

export function composeMatrices(...matrices: TransformMatrix[]): TransformMatrix {
  if (matrices.length === 0) throw new Error('composeMatrices requires at least one argument');
  if (matrices.length === 1) return matrices[0] as TransformMatrix;
  const [first, second, ...rest] = matrices as [TransformMatrix, TransformMatrix, ...TransformMatrix[]];
  const product = multiplyMatrices(first, second);
  return rest.length === 0 ? product : composeMatrices(product, ...rest);
}

// ---------------------------------------------------------------------------
// High-level helpers

/** Scale around an arbitrary point (the key zoom-at-cursor operation). */
export function scaleAt(
  m: TransformMatrix,
  sx: number,
  sy: number,
  point: Point,
): TransformMatrix {
  const local = applyInverseMatrixToPoint(m, point);
  return composeMatrices(
    m,
    translateMatrix(local.x, local.y),
    scaleMatrix(sx, sy),
    translateMatrix(-local.x, -local.y),
  );
}

/** Apply a relative translation to an existing transform. */
export function translateBy(m: TransformMatrix, tx: number, ty: number): TransformMatrix {
  return composeMatrices(m, translateMatrix(tx, ty));
}

/** Replace the translation component, keeping scale/skew. */
export function setTranslate(m: TransformMatrix, tx: number, ty: number): TransformMatrix {
  return { ...m, translateX: tx, translateY: ty };
}

/**
 * Clamp scale. Returns `prev` unchanged if the new matrix violates scale bounds —
 * matching visx's constrain semantics so the matrix stays valid.
 */
export function constrainScale(
  m: TransformMatrix,
  prev: TransformMatrix,
  minScale: number,
  maxScale: number,
): TransformMatrix {
  if (
    m.scaleX < minScale ||
    m.scaleX > maxScale ||
    m.scaleY < minScale ||
    m.scaleY > maxScale
  ) {
    return prev;
  }
  return m;
}

// ---------------------------------------------------------------------------
// SVG / CSS output

/** Returns the CSS / SVG `matrix(a,b,c,d,e,f)` string for a transform attribute. */
export function matrixToString(m: TransformMatrix): string {
  return `matrix(${m.scaleX},${m.skewY},${m.skewX},${m.scaleY},${m.translateX},${m.translateY})`;
}

export function matrixToInverseString(m: TransformMatrix): string {
  return matrixToString(inverseMatrix(m));
}

// ---------------------------------------------------------------------------
// Axis rescaling

/**
 * Given a linear scale mapping [domain] → [range], returns the new domain
 * that describes the visible portion of the data after applying `m`.
 *
 * Use this to re-render axes in a zoomed chart without applying an SVG
 * transform — the chart re-derives which data is visible and at what positions.
 */
export function rescaleDomain(
  domain: readonly [number, number],
  range: readonly [number, number],
  m: TransformMatrix,
  axis: 'x' | 'y',
): readonly [number, number] {
  const inv = inverseMatrix(m);
  const [r0, r1] = range;
  const [d0, d1] = domain;
  const rangeSpan = r1 - r0;
  if (rangeSpan === 0) return domain;

  const origR0 =
    axis === 'x'
      ? applyMatrixToPoint(inv, { x: r0, y: 0 }).x
      : applyMatrixToPoint(inv, { x: 0, y: r0 }).y;
  const origR1 =
    axis === 'x'
      ? applyMatrixToPoint(inv, { x: r1, y: 0 }).x
      : applyMatrixToPoint(inv, { x: 0, y: r1 }).y;

  const k = (d1 - d0) / rangeSpan;
  return [d0 + (origR0 - r0) * k, d0 + (origR1 - r0) * k];
}
