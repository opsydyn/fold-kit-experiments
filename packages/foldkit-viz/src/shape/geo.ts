// Geographic projections and GeoJSON path rendering
// Simplified port of d3-geo (https://github.com/d3/d3-geo, BSD-3-Clause)
// Omits: adaptive resampling, rotation, antimeridian clipping.
// Suitable for world-map and regional-map use cases.
//
// Key additions over naive projection:
//   - fitSize() / fitExtent()  — auto-scale to fill SVG
//   - geoPath().bounds()       — bounding box in pixel space
//   - geoPath().centroid()     — centroid for label placement
//   - 6 projections            — equirectangular, Mercator, natural-earth,
//                                orthographic, Albers, Albers-USA

const DEG = Math.PI / 180;
const REF_SCALE = 150; // D3-geo reference scale used by fitSize algorithm

// ──── GeoJSON types ───────────────────────────────────────────────────────────

export type GeoCoord = readonly [number, number]; // [lng, lat]

export type GeoGeometry =
  | Readonly<{ type: 'Point'; coordinates: GeoCoord }>
  | Readonly<{ type: 'MultiPoint'; coordinates: ReadonlyArray<GeoCoord> }>
  | Readonly<{ type: 'LineString'; coordinates: ReadonlyArray<GeoCoord> }>
  | Readonly<{ type: 'MultiLineString'; coordinates: ReadonlyArray<ReadonlyArray<GeoCoord>> }>
  | Readonly<{ type: 'Polygon'; coordinates: ReadonlyArray<ReadonlyArray<GeoCoord>> }>
  | Readonly<{
      type: 'MultiPolygon';
      coordinates: ReadonlyArray<ReadonlyArray<ReadonlyArray<GeoCoord>>>;
    }>
  | Readonly<{ type: 'GeometryCollection'; geometries: ReadonlyArray<GeoGeometry> }>;

export type GeoFeature = Readonly<{
  type: 'Feature';
  geometry: GeoGeometry | null;
  properties?: Readonly<Record<string, unknown>>;
}>;

export type GeoFeatureCollection = Readonly<{
  type: 'FeatureCollection';
  features: ReadonlyArray<GeoFeature>;
}>;

/**
 * D3-geo sphere — pass to `fitSize`/`fitExtent` to fit the full world naturally
 * without being distorted by Antarctica's extreme southern extent.
 */
export type GeoSphere = Readonly<{ type: 'Sphere' }>;

export type GeoObject = GeoGeometry | GeoFeature | GeoFeatureCollection | GeoSphere;

// ──── Projection types ────────────────────────────────────────────────────────

/** Simple projection function — lon/lat → [x, y] */
export type Projection = (lng: number, lat: number) => readonly [number, number];

/** Bounding box: [[minX, minY], [maxX, maxY]] */
export type GeoBBox = readonly [readonly [number, number], readonly [number, number]];

/**
 * Rich projection object — callable AND has `fitSize`/`fitExtent`.
 * Returned by all projection factories.
 * Extends `Projection` structurally so it can be passed wherever a plain
 * projection function is expected.
 */
export type ProjectionObject = Projection & {
  /** Current scale */
  readonly _scale: number;
  /** Current translate [tx, ty] */
  readonly _translate: readonly [number, number];
  /** Internal 2D raw projection (radians → unit coordinates) */
  readonly _raw: (lambda: number, phi: number) => readonly [number, number];

  /** Return a new projection with the given scale */
  withScale(scale: number): ProjectionObject;
  /** Return a new projection with the given translate [tx, ty] */
  withTranslate(translate: readonly [number, number]): ProjectionObject;
  /**
   * Auto-fit the projection so the given GeoObject fills [0,0]→[w,h].
   * D3-geo `fitSize` parity. Pass `{ type: 'Sphere' }` for natural proportions.
   */
  fitSize(size: readonly [number, number], object: GeoObject | GeoSphere): ProjectionObject;
  /**
   * Auto-fit into an arbitrary pixel extent [[x0,y0],[x1,y1]].
   * D3-geo `fitExtent` parity.
   */
  fitExtent(extent: GeoBBox, object: GeoObject | GeoSphere): ProjectionObject;
};

// ──── Projection factory ──────────────────────────────────────────────────────

/** 2D raw projection: (lambda_rad, phi_rad) → [raw_x, raw_y] unit coordinates */
type RawProjection = (lambda: number, phi: number) => readonly [number, number];

function makeProjection(
  raw: RawProjection,
  scale: number,
  translate: readonly [number, number],
): ProjectionObject {
  const [tx, ty] = translate;

  const fn = (lng: number, lat: number): readonly [number, number] => {
    const lambda = lng * DEG;
    const phi = lat * DEG;
    const [rx, ry] = raw(lambda, phi);
    return [tx + scale * rx, ty - scale * ry];
  };

  const proj = Object.assign(fn, {
    _scale: scale,
    _translate: translate,
    _raw: raw,

    withScale(s: number): ProjectionObject {
      return makeProjection(raw, s, translate);
    },

    withTranslate(t: readonly [number, number]): ProjectionObject {
      return makeProjection(raw, scale, t);
    },

    fitExtent(extent: GeoBBox, object: GeoObject | GeoSphere): ProjectionObject {
      const ref = makeProjection(raw, REF_SCALE, [0, 0]);
      const b = geoBoundsRaw(ref, object);
      if (!b) return proj as ProjectionObject;

      const [[bx0, by0], [bx1, by1]] = b;
      const dx = bx1 - bx0;
      const dy = by1 - by0;
      if (dx === 0 || dy === 0) return proj as ProjectionObject;

      const [[ex0, ey0], [ex1, ey1]] = extent;
      const w = ex1 - ex0;
      const h = ey1 - ey0;

      const k = Math.min(w / dx, h / dy) * REF_SCALE;
      const newTx = ex0 + (w - (k * (bx0 + bx1)) / REF_SCALE) / 2;
      const newTy = ey0 + (h - (k * (by0 + by1)) / REF_SCALE) / 2;

      return makeProjection(raw, k, [newTx, newTy]);
    },

    fitSize(size: readonly [number, number], object: GeoObject | GeoSphere): ProjectionObject {
      return (proj as ProjectionObject).fitExtent(
        [
          [0, 0],
          [size[0], size[1]],
        ],
        object,
      );
    },
  });

  return proj as ProjectionObject;
}

function makeProjectionFactory(
  raw: RawProjection,
  defaultScale: number,
  defaultTranslate: readonly [number, number] = [480, 250],
) {
  return (
    config: { scale?: number; translate?: readonly [number, number] } = {},
  ): ProjectionObject =>
    makeProjection(raw, config.scale ?? defaultScale, config.translate ?? defaultTranslate);
}

// ──── Projections ─────────────────────────────────────────────────────────────

/** Equirectangular (plate carrée) — D3 parity scale */
export const geoEquirectangular = makeProjectionFactory(
  (lambda, phi) => [lambda, phi] as const,
  152.63,
);

/** Mercator — conformal cylindrical, preserves shapes */
export const geoMercator = makeProjectionFactory(
  (lambda, phi) => [lambda, Math.log(Math.tan(Math.PI / 4 + phi / 2))] as const,
  961 / (2 * Math.PI),
);

/**
 * Natural Earth 1 — pseudocylindrical, pleasing aesthetics.
 * D3-geo parity: x = λ·k(φ²), y = φ·j(φ²) where k and j are polynomial
 * functions of latitude. Meridians converge toward the poles correctly.
 * Source: https://github.com/d3/d3-geo/blob/main/src/projection/naturalEarth1.js
 */
export const geoNaturalEarth1 = makeProjectionFactory((lambda, phi) => {
  const phi2 = phi * phi;
  const phi4 = phi2 * phi2;
  return [
    lambda *
      (0.8707 - 0.131979 * phi2 + phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4))),
    phi * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4))),
  ] as const;
}, 175.295);

/** Orthographic — globe perspective projection (centre at 0°,0°) */
export const geoOrthographic = makeProjectionFactory(
  (lambda, phi) => [Math.cos(phi) * Math.sin(lambda), Math.sin(phi)] as const,
  249.5,
);

/** Albers equal-area conic — standard for US maps */
export const geoAlbers = (() => {
  // Standard parallels: 29.5°N and 45.5°N (US standard)
  const phi1 = 29.5 * DEG;
  const phi2 = 45.5 * DEG;
  const lambda0 = -96 * DEG;
  const phi0 = 37.5 * DEG;
  const n = (Math.sin(phi1) + Math.sin(phi2)) / 2;
  const C = Math.cos(phi1) ** 2 + 2 * n * Math.sin(phi1);
  const rho0 = Math.sqrt(C - 2 * n * Math.sin(phi0)) / n;

  return makeProjectionFactory(
    (lambda, phi) => {
      const theta = n * (lambda - lambda0);
      const rho = Math.sqrt(Math.max(0, C - 2 * n * Math.sin(phi))) / n;
      return [rho * Math.sin(theta), rho0 - rho * Math.cos(theta)] as const;
    },
    1070,
    [480, 250],
  );
})();

/**
 * Albers USA — combines Albers for contiguous US + insets for AK/HI.
 * Returns the appropriate sub-projection based on lon/lat.
 * Note: uses a composite approach; not suitable with fitSize.
 */
export function geoAlbersUsa(
  config: { scale?: number; translate?: readonly [number, number] } = {},
): Projection {
  const scale = config.scale ?? 1300;
  const [cx, cy] = config.translate ?? [480, 250];

  // Contiguous US: Albers conic
  const lower48 = geoAlbers({ scale, translate: [cx, cy] });

  // Alaska: scaled + repositioned to bottom-left
  const alaska = geoEquirectangular({ scale: scale * 0.35, translate: [cx - 370, cy + 120] });

  // Hawaii: repositioned to bottom
  const hawaii = geoMercator({ scale: scale * 0.35, translate: [cx - 150, cy + 120] });

  return (lng: number, lat: number): readonly [number, number] => {
    // Alaska: roughly [140°W–172°W, 51°N–72°N]
    if (lng < -127 && lat > 51) return alaska(lng, lat);
    // Hawaii: roughly [154°W–160°W, 18°N–22°N]
    if (lng < -140 && lat < 26) return hawaii(lng, lat);
    return lower48(lng, lat);
  };
}

// ──── Bounds + centroid ───────────────────────────────────────────────────────

/** Collect all projected coordinates from a GeoObject into an array */
function collectCoords(
  proj: Projection,
  obj: GeoObject | GeoSphere,
  out: Array<readonly [number, number]>,
): void {
  if (obj.type === 'Sphere') {
    // Sample the sphere boundary densely enough to find accurate projection extremes
    for (let lng = -180; lng <= 180; lng += 5) {
      for (let lat = -90; lat <= 90; lat += 5) out.push(proj(lng, lat));
    }
  } else if (obj.type === 'FeatureCollection') {
    for (const f of obj.features) if (f.geometry) collectGeomCoords(proj, f.geometry, out);
  } else if (obj.type === 'Feature') {
    if (obj.geometry) collectGeomCoords(proj, obj.geometry, out);
  } else {
    collectGeomCoords(proj, obj, out);
  }
}

function collectGeomCoords(
  proj: Projection,
  geom: GeoGeometry,
  out: Array<readonly [number, number]>,
): void {
  switch (geom.type) {
    case 'Point':
      out.push(proj(geom.coordinates[0], geom.coordinates[1]));
      break;
    case 'MultiPoint':
      for (const c of geom.coordinates) out.push(proj(c[0], c[1]));
      break;
    case 'LineString':
      for (const c of geom.coordinates) out.push(proj(c[0], c[1]));
      break;
    case 'MultiLineString':
      for (const line of geom.coordinates) for (const c of line) out.push(proj(c[0], c[1]));
      break;
    case 'Polygon':
      for (const ring of geom.coordinates) for (const c of ring) out.push(proj(c[0], c[1]));
      break;
    case 'MultiPolygon':
      for (const poly of geom.coordinates)
        for (const ring of poly) for (const c of ring) out.push(proj(c[0], c[1]));
      break;
    case 'GeometryCollection':
      for (const g of geom.geometries) collectGeomCoords(proj, g, out);
      break;
  }
}

/** Returns [[minX, minY], [maxX, maxY]] of projected GeoObject. null if empty. */
function geoBoundsRaw(proj: Projection, obj: GeoObject | GeoSphere): GeoBBox | null {
  const pts: Array<readonly [number, number]> = [];
  collectCoords(proj, obj, pts);
  if (pts.length === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

/**
 * Bounding box of a GeoObject in projected pixel space.
 * Returns `null` for empty objects.
 */
export function geoBounds(proj: Projection, obj: GeoObject | GeoSphere): GeoBBox | null {
  return geoBoundsRaw(proj, obj);
}

/**
 * Centroid of a GeoObject in projected pixel space.
 * Uses arithmetic mean of all coordinate positions.
 */
export function geoCentroid(
  proj: Projection,
  obj: GeoObject | GeoSphere,
): readonly [number, number] | null {
  const pts: Array<readonly [number, number]> = [];
  collectCoords(proj, obj, pts);
  if (pts.length === 0) return null;
  let sx = 0,
    sy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
  }
  return [sx / pts.length, sy / pts.length];
}

// ──── Path renderer ───────────────────────────────────────────────────────────

function ringPath(proj: Projection, ring: ReadonlyArray<GeoCoord>): string {
  if (ring.length === 0) return '';
  const first = ring[0];
  if (!first) return '';
  const [x0, y0] = proj(first[0], first[1]);
  let d = `M${x0.toFixed(1)},${y0.toFixed(1)}`;
  for (let i = 1; i < ring.length; i++) {
    const coord = ring[i];
    if (!coord) continue;
    const [xi, yi] = proj(coord[0], coord[1]);
    d += `L${xi.toFixed(1)},${yi.toFixed(1)}`;
  }
  return `${d}Z`;
}

function linePath(proj: Projection, coords: ReadonlyArray<GeoCoord>): string {
  if (coords.length === 0) return '';
  const first = coords[0];
  if (!first) return '';
  const [x0, y0] = proj(first[0], first[1]);
  let d = `M${x0.toFixed(1)},${y0.toFixed(1)}`;
  for (let i = 1; i < coords.length; i++) {
    const coord = coords[i];
    if (!coord) continue;
    const [xi, yi] = proj(coord[0], coord[1]);
    d += `L${xi.toFixed(1)},${yi.toFixed(1)}`;
  }
  return d;
}

function geometryPath(proj: Projection, geom: GeoGeometry): string {
  switch (geom.type) {
    case 'Point': {
      const [x, y] = proj(geom.coordinates[0], geom.coordinates[1]);
      return `M${x.toFixed(1)},${y.toFixed(1)}`;
    }
    case 'MultiPoint':
      return geom.coordinates
        .map((c) => {
          const [x, y] = proj(c[0], c[1]);
          return `M${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join('');
    case 'LineString':
      return linePath(proj, geom.coordinates);
    case 'MultiLineString':
      return geom.coordinates.map((l) => linePath(proj, l)).join('');
    case 'Polygon':
      return geom.coordinates.map((r) => ringPath(proj, r)).join('');
    case 'MultiPolygon':
      return geom.coordinates.flatMap((poly) => poly.map((r) => ringPath(proj, r))).join('');
    case 'GeometryCollection':
      return geom.geometries.map((g) => geometryPath(proj, g)).join('');
  }
}

/** Path renderer result — callable + `.bounds()` + `.centroid()` */
export type GeoPathFn = {
  (obj: GeoObject): string;
  /** Bounding box in pixel space */
  bounds(obj: GeoObject): GeoBBox | null;
  /** Centroid in pixel space */
  centroid(obj: GeoObject): readonly [number, number] | null;
};

/**
 * Build a GeoJSON → SVG path renderer using the given projection.
 * Returns a function with `.bounds()` and `.centroid()` methods.
 *
 * ```typescript
 * const proj = geoNaturalEarth1().fitSize([960, 500], featureCollection);
 * const path = geoPath(proj);
 * const d = path(feature);           // SVG path string
 * const [[x0,y0],[x1,y1]] = path.bounds(feature);  // bounding box
 * const [cx, cy] = path.centroid(feature);           // centroid
 * ```
 */
export function geoPath(projection: Projection): GeoPathFn {
  const fn = (obj: GeoObject): string => {
    if (obj.type === 'Sphere') return '';
    if (obj.type === 'FeatureCollection') {
      return obj.features
        .map((f) => (f.geometry ? geometryPath(projection, f.geometry) : ''))
        .join('');
    }
    if (obj.type === 'Feature') {
      return obj.geometry ? geometryPath(projection, obj.geometry) : '';
    }
    return geometryPath(projection, obj);
  };

  return Object.assign(fn, {
    bounds: (obj: GeoObject) => geoBoundsRaw(projection, obj),
    centroid: (obj: GeoObject) => geoCentroid(projection, obj),
  }) as GeoPathFn;
}

// ──── Graticule generator ─────────────────────────────────────────────────────

/** Lat/lng grid as a GeoGeometry. step = degree interval (default 10). */
export function geoGraticule(step = 10): GeoGeometry {
  const lines: GeoGeometry[] = [];
  for (let lng = -180; lng <= 180; lng += step) {
    const coords: GeoCoord[] = [];
    for (let lat = -90; lat <= 90; lat += 2) coords.push([lng, lat]);
    lines.push({ type: 'LineString', coordinates: coords });
  }
  for (let lat = -90; lat <= 90; lat += step) {
    const coords: GeoCoord[] = [];
    for (let lng = -180; lng <= 180; lng += 2) coords.push([lng, lat]);
    lines.push({ type: 'LineString', coordinates: coords });
  }
  return { type: 'GeometryCollection', geometries: lines };
}
