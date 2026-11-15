import type { PlotBounds } from '../chart/layout.js';
import {
  geoAlbers,
  geoEquirectangular,
  geoGraticule,
  geoMercator,
  geoNaturalEarth1,
  geoOrthographic,
  geoPath,
} from '../shape/geo.js';
import type {
  GeoFeature,
  GeoFeatureCollection,
  GeoObject,
  GeoPropertyValue,
  ProjectionObject,
} from '../shape/geo.js';
import {
  fail,
  highlightFactors,
  isFlag,
  isNumber,
  isText,
  keysOf,
  numeric,
  paintOf,
  read,
  titlesOf,
  withTitle,
} from './channels.js';
import type { ChannelName, Context, Graphics } from './channels.js';
import type {
  Channel,
  GeoMark,
  Graphic,
  GraticuleMark,
  MarkSpec,
  PlotSpec,
  ProjectionSpec,
  Row,
  Value,
} from './types.js';

/**
 * Maps: a projection fitted to the geo marks in each facet, GeoJSON features
 * drawn as paths, a graticule, and dots and text placed by longitude (x) and
 * latitude (y) through the projection.
 */

const PROJECTIONS = {
  equirectangular: geoEquirectangular,
  mercator: geoMercator,
  naturalEarth1: geoNaturalEarth1,
  orthographic: geoOrthographic,
  albers: geoAlbers,
} satisfies Readonly<
  Record<ProjectionSpec['type'], (config?: { scale?: number }) => ProjectionObject>
>;

const isProjectionType = (value: unknown): value is ProjectionSpec['type'] =>
  isText(value) && Object.hasOwn(PROJECTIONS, value);

export function validateProjection(spec: PlotSpec): void {
  const projection = spec.projection;
  if (projection === undefined) return;
  const type: unknown = projection.type;
  if (!isProjectionType(type))
    fail(
      'projection.type',
      `unknown projection "${String(type)}"; expected one of ${Object.keys(PROJECTIONS).join(', ')}`,
    );
  if (projection.zoom !== undefined && !(projection.zoom > 0))
    fail('projection.zoom', 'must be positive');
  if (spec.coordinates === 'polar') fail('projection', 'a projected plot cannot also be polar');
}

/** Anything a geo mark draws on its own: a feature, a geometry or the sphere. */
type Drawable = Exclude<GeoObject, GeoFeatureCollection>;

/** The features a geo mark draws, as a list. */
function featuresOf(object: GeoObject): ReadonlyArray<Drawable> {
  if (object.type === 'FeatureCollection') return object.features;
  return [object];
}

/** A feature's identity: its id, when it has one. */
const idOf = (object: GeoObject): Value => {
  // GeoJSON features may carry an id beside their properties, as TopoJSON's do.
  const id = Object.entries(object).find(([key]) => key === 'id')?.[1];
  return isText(id) || isNumber(id) ? id : null;
};

const scalar = (value: GeoPropertyValue): value is string | number | boolean | null =>
  value === null || isText(value) || isNumber(value) || isFlag(value);

/** One row per feature: its scalar properties, and its id as `id`. */
export function geoRows(mark: GeoMark): ReadonlyArray<Row> {
  return featuresOf(mark.features).map((object): Row => {
    const properties = object.type === 'Feature' ? (object.properties ?? {}) : {};
    const values = Object.entries(properties).filter((entry): entry is [string, Value] =>
      scalar(entry[1]),
    );
    return Object.fromEntries([['id', idOf(object)], ...values]);
  });
}

/**
 * The projection for a facet: fitted to every geo mark's features (or the
 * whole sphere when there are none), then zoomed about `center`.
 */
export function fitProjection(
  spec: PlotSpec,
  bounds: PlotBounds,
): ((lng: number, lat: number) => readonly [number, number]) | null {
  const options = spec.projection;
  if (options === undefined) return null;
  const base = PROJECTIONS[options.type]();
  const features: GeoFeature[] = [];
  for (const mark of spec.marks)
    if (mark.mark === 'geo')
      for (const object of featuresOf(mark.features))
        if (object.type === 'Feature') features.push(object);
        else if (object.type !== 'Sphere') features.push({ type: 'Feature', geometry: object });
  const pad = 4;
  const fitted = base.fitExtent(
    [
      [bounds.left + pad, bounds.top + pad],
      [bounds.right - pad, bounds.bottom - pad],
    ],
    features.length === 0 ? { type: 'Sphere' } : { type: 'FeatureCollection', features },
  );
  const zoom = options.zoom ?? 1;
  const mid: readonly [number, number] = [
    bounds.left + bounds.width / 2,
    bounds.top + bounds.height / 2,
  ];
  const [tx, ty] = fitted._translate;
  // Scale about the middle of the panel, then bring the centre there.
  const scaled = fitted
    .withScale(fitted._scale * zoom)
    .withTranslate([mid[0] - zoom * (mid[0] - tx), mid[1] - zoom * (mid[1] - ty)]);
  if (options.center === undefined) return scaled;
  const [cx, cy] = scaled(options.center[0], options.center[1]);
  const [sx, sy] = scaled._translate;
  return scaled.withTranslate([sx + mid[0] - cx, sy + mid[1] - cy]);
}

type Project = (lng: number, lat: number) => readonly [number, number];

const round = (n: number): number => Math.round(n * 100) / 100;

export function geoGraphics(
  mark: GeoMark,
  rows: ReadonlyArray<Row>,
  path: string,
  index: number,
  context: Context,
  project: Project,
): Graphics {
  const draw = geoPath(project);
  const objects = featuresOf(mark.features);
  const keys = keysOf(rows, mark, index);
  const titles = titlesOf(rows, mark.title, `${path}.title`);
  const dims = highlightFactors(rows, mark.highlight, path);
  const fills = paintOf(rows, mark.fill, `${path}.fill`, context, 'none');
  const strokes = paintOf(
    rows,
    mark.stroke,
    `${path}.stroke`,
    context,
    mark.fill === undefined ? 'currentColor' : 'none',
  );
  return objects.flatMap((object, i): ReadonlyArray<Graphic> => {
    const d = draw(object);
    if (d === '') return [];
    return [
      {
        kind: 'path',
        key: keys[i] ?? `${index}:${i}`,
        d,
        fill: fills[i] ?? 'none',
        stroke: strokes[i] ?? 'none',
        strokeWidth: mark.strokeWidth ?? 0.5,
        opacity: (mark.opacity ?? 1) * (dims[i] ?? 1),
        ...withTitle(titles[i]),
      },
    ];
  });
}

export function graticuleGraphics(
  mark: GraticuleMark,
  path: string,
  index: number,
  context: Context,
  project: Project,
): Graphics {
  const step = mark.step ?? 30;
  if (!(step > 0 && step <= 90)) fail(`${path}.step`, 'must be in (0, 90]');
  const stroke =
    paintOf([{}], mark.stroke, `${path}.stroke`, context, 'currentColor')[0] ?? 'currentColor';
  return [
    {
      kind: 'path',
      key: `${index}:graticule`,
      d: geoPath(project)(geoGraticule(step)),
      fill: 'none',
      stroke,
      strokeWidth: mark.strokeWidth ?? 0.5,
      opacity: mark.opacity ?? 0.25,
    },
  ];
}

/** Dot and text marks in a projected plot: x is longitude and y latitude. */
export function projectedGraphics(
  mark: MarkSpec,
  rows: ReadonlyArray<Row>,
  path: string,
  index: number,
  context: Context,
  project: Project,
  channel: (name: ChannelName) => Channel | undefined,
): Graphics {
  if (mark.mark !== 'dot' && mark.mark !== 'text')
    return fail(path, `the ${mark.mark} mark cannot be drawn on a projected map`);
  const xs = read(rows, channel('x') ?? '', `${path}.x`),
    ys = read(rows, channel('y') ?? '', `${path}.y`);
  const keys = keysOf(rows, mark, index);
  const titles = titlesOf(rows, mark.title, `${path}.title`);
  const dims = highlightFactors(rows, mark.highlight, path);
  const fills = paintOf(rows, mark.fill, `${path}.fill`, context, 'currentColor');
  const opacity = mark.opacity ?? 1;
  const texts = mark.mark === 'text' ? read(rows, mark.text, `${path}.text`) : [];
  const sizes =
    mark.mark === 'dot' && mark.r !== undefined ? read(rows, mark.r, `${path}.r`) : undefined;
  const constantSize = mark.mark === 'dot' && mark.r !== undefined && !isText(mark.r);
  const strokes = paintOf(
    rows,
    mark.mark === 'dot' ? mark.stroke : undefined,
    `${path}.stroke`,
    context,
    'none',
  );
  return rows.flatMap((_, i): ReadonlyArray<Graphic> => {
    const lng = numeric(xs[i] ?? null),
      lat = numeric(ys[i] ?? null);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];
    const [px, py] = project(lng, lat);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return [];
    const key = keys[i] ?? `${index}:${i}`;
    if (mark.mark === 'text') {
      const text = texts[i];
      if (text === null || text === undefined) return [];
      return [
        {
          kind: 'text',
          key,
          x: round(px + (mark.dx ?? 0)),
          y: round(py + (mark.dy ?? 0)),
          text: String(text),
          fill: fills[i] ?? 'currentColor',
          anchor: mark.anchor ?? 'middle',
          opacity: opacity * (dims[i] ?? 1),
        },
      ];
    }
    const size = sizes?.[i] ?? null;
    return [
      {
        kind: 'circle',
        key,
        cx: round(px),
        cy: round(py),
        r: sizes === undefined ? 3 : constantSize ? numeric(size) : context.size(size),
        fill: fills[i] ?? 'currentColor',
        stroke: strokes[i] ?? 'none',
        strokeWidth: mark.strokeWidth ?? 1,
        opacity: opacity * (dims[i] ?? 1),
        ...withTitle(titles[i]),
      },
    ];
  });
}
