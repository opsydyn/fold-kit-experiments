// Geographic projections and GeoJSON path rendering
// Simplified port of d3-geo (https://github.com/d3/d3-geo, BSD-3-Clause)
// Omits: adaptive resampling, rotation, antimeridian clipping, clip angles.
// Suitable for most world-map and regional-map use cases.

const DEG = Math.PI / 180;

// ──── Projection types ────────────────────────────────────────────────────────

export type Projection = (lng: number, lat: number) => readonly [number, number];

export type ProjectionConfig = Readonly<{
  scale?: number;
  translate?: readonly [number, number];
}>;

function makeProjectionFactory(
  rawX: (lambda: number) => number,
  rawY: (phi: number) => number,
  defaultScale: number,
) {
  return (config: ProjectionConfig = {}): Projection => {
    const k = config.scale ?? defaultScale;
    const tx = config.translate?.[0] ?? 480;
    const ty = config.translate?.[1] ?? 250;
    return (lng: number, lat: number): readonly [number, number] => {
      const lambda = lng * DEG;
      const phi = lat * DEG;
      return [tx + k * rawX(lambda), ty - k * rawY(phi)];
    };
  };
}

// Equirectangular (plate carrée): x = λ, y = φ  (identity in radian space)
// Default scale matches d3-geo geoEquirectangular().scale(152.63)
export const geoEquirectangular = makeProjectionFactory(
  (lambda) => lambda,
  (phi) => phi,
  152.63,
);

// Mercator: x = λ, y = ln(tan(π/4 + φ/2))
// Default scale matches d3-geo geoMercator().scale(961/(2π))
export const geoMercator = makeProjectionFactory(
  (lambda) => lambda,
  (phi) => Math.log(Math.tan(Math.PI / 4 + phi / 2)),
  961 / (2 * Math.PI),
);

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

export type GeoObject = GeoGeometry | GeoFeature | GeoFeatureCollection;

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
  return d + 'Z';
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

// Returns a function that converts GeoJSON to an SVG path string
export function geoPath(projection: Projection): (obj: GeoObject) => string {
  return (obj: GeoObject): string => {
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
}

// ──── Graticule generator ─────────────────────────────────────────────────────

// Generates a lat/lng grid as a GeoGeometry (GeometryCollection of LineStrings).
// step: degree interval between lines (default 10)
export function geoGraticule(step = 10): GeoGeometry {
  const lines: GeoGeometry[] = [];
  // Meridians (longitude lines)
  for (let lng = -180; lng <= 180; lng += step) {
    const coords: GeoCoord[] = [];
    for (let lat = -90; lat <= 90; lat += 2) coords.push([lng, lat]);
    lines.push({ type: 'LineString', coordinates: coords });
  }
  // Parallels (latitude lines)
  for (let lat = -90; lat <= 90; lat += step) {
    const coords: GeoCoord[] = [];
    for (let lng = -180; lng <= 180; lng += 2) coords.push([lng, lat]);
    lines.push({ type: 'LineString', coordinates: coords });
  }
  return { type: 'GeometryCollection', geometries: lines };
}
