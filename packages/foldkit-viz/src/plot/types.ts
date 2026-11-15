import type { ChartMargins, PlotBounds } from '../chart/layout.js';
import type { GeoObject } from '../shape/geo.js';
import type { CurveType } from '../shape/line.js';
import type { SymbolType } from '../shape/symbol.js';

// ── Spec: plain JSON, no functions (ADR 0037) ─────────────────────────────────

export type Value = number | string | boolean | null;
export type Row = Readonly<Record<string, Value>>;
/** One field's values, as a plain array or a typed array of numbers. */
export type Column =
  | ReadonlyArray<Value>
  | Float64Array
  | Float32Array
  | Int32Array
  | Int16Array
  | Int8Array
  | Uint32Array
  | Uint16Array
  | Uint8Array
  | Uint8ClampedArray;
/**
 * Data as named columns of equal length, as Polars, DuckDB and Arrow hold it.
 * Build one with `columnTable`, or from an Arrow table with `fromArrow`.
 */
export type ColumnTable = Readonly<{ length: number; columns: Readonly<Record<string, Column>> }>;
/** A plot's or a mark's data: row objects, or a column table. */
export type PlotData = ReadonlyArray<Row> | ColumnTable;
/** A field name, or a constant. */
export type Channel = string | Readonly<{ value: Value }>;

export type PositionScaleSpec = Readonly<{
  type?: 'linear' | 'log' | 'symlog' | 'pow' | 'time' | 'band';
  domain?: readonly [number, number] | ReadonlyArray<string>;
  label?: string;
  zero?: boolean;
  ticks?: number;
  grid?: boolean;
  base?: number;
  constant?: number;
  exponent?: number;
  zone?: 'utc' | 'local';
  /** Band scales only: share of each step left empty, in [0, 1). Default 0.1. */
  padding?: number;
  /** False hides the tick labels and grid, as for tile maps; positions still invert. */
  axis?: boolean;
}>;

export type ColorScaleSpec = Readonly<{
  type?: 'categorical' | 'sequential' | 'diverging';
  /** Any scheme in math/schemes. Defaults: tableau10, viridis, rdBu. */
  scheme?: string;
  domain?: readonly [number, number] | ReadonlyArray<string>;
  /** Categorical only: explicit colours, in domain order, instead of a scheme. */
  range?: ReadonlyArray<string>;
  legend?: boolean;
  label?: string;
}>;

export type SizeScaleSpec = Readonly<{ range?: readonly [number, number] }>;

/** Maps a dot mark's symbol field onto symbols. */
export type SymbolScaleSpec = Readonly<{
  domain?: ReadonlyArray<string>;
  /** Symbols in domain order. Default: circle, cross, diamond, square, star, triangle, wye. */
  range?: ReadonlyArray<SymbolType>;
  legend?: boolean;
  label?: string;
}>;

export type RegressionTransform = Readonly<{
  type: 'regression';
  degree?: number;
  band?: boolean;
  level?: number;
}>;
export type LoessTransform = Readonly<{ type: 'loess'; bandwidth?: number }>;
export type WindowTransform = Readonly<{
  type: 'window';
  size: number;
  reduce: 'mean' | 'median' | 'sum' | 'min' | 'max';
  anchor?: 'trailing' | 'centre';
}>;
export type DownsampleTransform = Readonly<{ type: 'downsample'; method: 'm4' | 'lttb' }>;
/**
 * Bins a rect mark's rows: `x` alone gives a histogram, `x` and `y` a
 * two-dimensional one. Thresholds are a count or, for `x` alone, explicit
 * breaks. Binned rows carry `x1`, `x2` (and `y1`, `y2`), `count` and, for a
 * histogram, `proportion`.
 */
export type BinTransform = Readonly<{
  type: 'bin';
  thresholds?: number | ReadonlyArray<number>;
  /** The x range to bin over. Default: the data's extent. */
  domain?: readonly [number, number];
  /** What a histogram's bar height shows. Default count. */
  reduce?: 'count' | 'proportion';
}>;

export type LineTransform =
  | RegressionTransform
  | LoessTransform
  | WindowTransform
  | DownsampleTransform;

/**
 * How stacked pieces sit: `zero` stacks positive values up and negative values
 * down from zero; `normalize` scales each stack to one; `center` and `wiggle`
 * give streamgraph baselines (areas only).
 */
export type StackOffset = 'zero' | 'normalize' | 'center' | 'wiggle';
/** Which series sits nearest the baseline. `input` keeps the order series first appear. */
export type StackOrder = 'input' | 'ascending' | 'descending' | 'insideOut';
export type Stack = StackOffset | Readonly<{ offset?: StackOffset; order?: StackOrder }>;

/**
 * Rows to keep at full opacity; the rest are dimmed. Matching is by a field
 * falling in a range (numbers, or ISO dates as instants) or among values.
 */
export type Highlight = Readonly<{
  field: string;
  range?: readonly [number, number] | readonly [string, string];
  values?: ReadonlyArray<Value>;
}>;

type CommonMark = Readonly<{
  data?: PlotData;
  /** Dims rows that do not match. Applies to dot, bar, cell, link and text marks. */
  highlight?: Highlight;
  /** Field giving each row a stable identity. Default: the row's position. */
  key?: string;
  title?: Channel;
  opacity?: number;
  strokeWidth?: number;
}>;

export type DotMark = CommonMark &
  Readonly<{
    mark: 'dot';
    x: Channel;
    y: Channel;
    r?: Channel;
    fill?: Channel;
    stroke?: Channel;
    /** A field mapped onto symbols, or a constant such as `{ value: 'square' }`. */
    symbol?: Channel;
    /**
     * Compile to one packed `points` graphic instead of a graphic per row, for
     * hundreds of thousands of rows drawn on canvas. Per-row keys and titles are
     * dropped; `indexPlot` names the row under the pointer instead.
     */
    dense?: boolean;
  }>;
export type LineMark = CommonMark &
  Readonly<{
    mark: 'line';
    x: Channel;
    y: Channel;
    /** Field splitting rows into series. Default: the stroke field, if any. */
    z?: string;
    stroke?: Channel;
    curve?: CurveType;
    /** One transform, or several applied in order, such as a window then a downsample. */
    transform?: LineTransform | ReadonlyArray<LineTransform>;
  }>;
export type AreaMark = CommonMark &
  Readonly<{
    mark: 'area';
    x: Channel;
    y: Channel;
    y0?: Channel;
    z?: string;
    fill?: Channel;
    curve?: CurveType;
    transform?: WindowTransform | ReadonlyArray<WindowTransform>;
    /** Stack the series (z, or the fill field) at each x. */
    stack?: Stack;
  }>;
export type BarMark = CommonMark &
  Readonly<{
    mark: 'bar';
    x: Channel;
    y: Channel;
    /** Where a vertical bar starts instead of zero, for interval bars such as candle bodies. */
    y0?: Channel;
    /** Where a horizontal bar starts instead of zero. */
    x0?: Channel;
    fill?: Channel;
    stroke?: Channel;
    /** Field splitting rows into series for stacking or grouping. Default: the fill field. */
    z?: string;
    /** Stack the series within each band. */
    stack?: Stack;
    /** Place the series side by side within each band. */
    group?: boolean;
  }>;
/** A box plot per category: one axis a band of categories, the other the values. */
export type BoxMark = CommonMark &
  Readonly<{ mark: 'box'; x: Channel; y: Channel; fill?: Channel; stroke?: Channel }>;
/** A mirrored kernel density per category, with its median. */
export type ViolinMark = CommonMark &
  Readonly<{
    mark: 'violin';
    x: Channel;
    y: Channel;
    fill?: Channel;
    stroke?: Channel;
    /** Kernel bandwidth in value units. Default: Silverman's rule per group. */
    bandwidth?: number;
  }>;
/**
 * A kernel density. With `x` alone, a density curve per series on a y axis of
 * density; with `x` and `y`, contour lines of point density.
 */
export type DensityMark = CommonMark &
  Readonly<{
    mark: 'density';
    x: Channel;
    y?: Channel;
    /** Field splitting rows into series. Default: the fill or stroke field, if any. */
    z?: string;
    fill?: Channel;
    stroke?: Channel;
    /**
     * Kernel bandwidth: in x's data units for a curve (default Silverman's rule
     * per series), in plot pixels for contours (default 20).
     */
    bandwidth?: number;
    /** Contours only: how many levels to draw. Default 8. */
    thresholds?: number;
  }>;
/** Straight segments from (x1, y1) to (x2, y2); x2 and y2 default to x1 and y1. */
export type LinkMark = CommonMark &
  Readonly<{
    mark: 'link';
    x1: Channel;
    y1: Channel;
    x2?: Channel;
    y2?: Channel;
    stroke?: Channel;
  }>;
export type RuleMark = CommonMark &
  Readonly<{ mark: 'rule'; x?: Channel; y?: Channel; stroke?: Channel }>;
export type TextMark = CommonMark &
  Readonly<{
    mark: 'text';
    x: Channel;
    y: Channel;
    text: Channel;
    fill?: Channel;
    anchor?: 'start' | 'middle' | 'end';
    dx?: number;
    dy?: number;
  }>;
export type CellMark = CommonMark &
  Readonly<{ mark: 'cell'; x: Channel; y: Channel; fill?: Channel; stroke?: Channel }>;

/**
 * A rectangle from x1 to x2 and y1 to y2 on continuous axes; a missing x1 or
 * y1 starts at the axis baseline. With a bin transform, `x` (and `y`) are the
 * values to bin and the edges are computed.
 */
export type RectMark = CommonMark &
  Readonly<{
    mark: 'rect';
    x?: Channel;
    y?: Channel;
    x1?: Channel;
    x2?: Channel;
    y1?: Channel;
    y2?: Channel;
    /** Field splitting rows into series to bin separately. Default: the fill or stroke field. */
    z?: string;
    fill?: Channel;
    stroke?: Channel;
    /** Pixels left empty on each side across x, such as between histogram bars. Default 0. */
    inset?: number;
    transform?: BinTransform;
  }>;

/**
 * A pie, donut or gauge filling its panel: one slice per row, in order, over
 * the sweep from `start` to `end` degrees clockwise from twelve o'clock.
 */
export type ArcMark = CommonMark &
  Readonly<{
    mark: 'arc';
    value: Channel;
    fill?: Channel;
    stroke?: Channel;
    /** Written in the middle, from the first row, such as a total or a reading. */
    text?: Channel;
    /** Inner radius as a share of the outer, for a donut. Default 0. */
    inner?: number;
    /** Degrees. Default 0, and a full circle. */
    start?: number;
    end?: number;
    /** Gap between slices, in degrees. Default 0. */
    padAngle?: number;
    /** Write each slice's share on it when there is room. Default false. */
    labels?: boolean;
  }>;

/**
 * GeoJSON drawn through the plot's projection. Its rows are the features'
 * properties, with each feature's id as `id`, so `fill: 'gdp'` reads a property.
 */
export type GeoMark = CommonMark &
  Readonly<{ mark: 'geo'; features: GeoObject; fill?: Channel; stroke?: Channel }>;
/** Lines of latitude and longitude every `step` degrees (default 30). */
export type GraticuleMark = CommonMark &
  Readonly<{ mark: 'graticule'; step?: number; stroke?: Channel }>;

/**
 * A map projection, fitted to the geo marks in each facet (or the whole sphere).
 * `zoom` scales about `center`, given as longitude and latitude.
 */
export type ProjectionSpec = Readonly<{
  type: 'equirectangular' | 'mercator' | 'naturalEarth1' | 'orthographic' | 'albers';
  zoom?: number;
  center?: readonly [number, number];
}>;

/**
 * A tree of the rows' `path` fields, laid out tidy (default) or as a cluster
 * with every leaf level, left to right or `radial`. Leaves take their row's fill.
 */
export type TreeMark = CommonMark &
  Readonly<{
    mark: 'tree';
    path: Channel;
    separator?: string;
    layout?: 'tidy' | 'cluster';
    radial?: boolean;
    labels?: boolean;
    fill?: Channel;
    /** The links' colour. */
    stroke?: Channel;
  }>;
/** Circle packing of `path` and `value`; a branch takes its first leaf's fill. */
export type PackMark = CommonMark &
  Readonly<{
    mark: 'pack';
    path: Channel;
    value: Channel;
    separator?: string;
    fill?: Channel;
    labels?: boolean;
    /** Pixels between sibling circles. Default 3. */
    padding?: number;
  }>;
/** Flows between named groups as a chord diagram; groups take categorical colours. */
export type ChordMark = CommonMark &
  Readonly<{
    mark: 'chord';
    source: Channel;
    target: Channel;
    value: Channel;
    labels?: boolean;
    /** Degrees between groups. Default 2. */
    padAngle?: number;
  }>;
/** Nodes along a line, in order of first appearance, with an arc above for each link. */
export type ArcDiagramMark = CommonMark &
  Readonly<{
    mark: 'arc-diagram';
    source: Channel;
    target: Channel;
    /** Link weight, for the arcs' widths. Default 1. */
    value?: Channel;
    /** The nodes' colour. */
    fill?: Channel;
    /** The arcs' colour. */
    stroke?: Channel;
    labels?: boolean;
  }>;
/** A force-directed graph of links, laid out by a seeded simulation run to a fixed count. */
export type ForceMark = CommonMark &
  Readonly<{
    mark: 'force';
    source: Channel;
    target: Channel;
    fill?: Channel;
    stroke?: Channel;
    labels?: boolean;
    /** Simulation steps. Default 300. */
    iterations?: number;
    /** Link length in pixels. Default 60. */
    distance?: number;
    /** Charge between nodes; negative repels. Default -120. */
    strength?: number;
  }>;

/** Each point's Voronoi cell, clipped to the plot area. */
export type VoronoiMark = CommonMark &
  Readonly<{ mark: 'voronoi'; x: Channel; y: Channel; fill?: Channel; stroke?: Channel }>;

/** Marks that fill their panel instead of using the x and y axes. */
type HierarchyOptions = Readonly<{
  /** Field holding each leaf's path, such as "Cloud/AWS". */
  path: Channel;
  value: Channel;
  fill?: Channel;
  /** Path separator. Default "/". */
  separator?: string;
  /** Label nodes with room for it. Default true. */
  labels?: boolean;
}>;
export type TreemapMark = CommonMark &
  HierarchyOptions &
  Readonly<{ mark: 'treemap'; /** Gap between tiles in pixels. Default 2. */ padding?: number }>;
export type SunburstMark = CommonMark & HierarchyOptions & Readonly<{ mark: 'sunburst' }>;
/** Flows between named nodes; each row is one flow. Nodes take the categorical colours. */
export type SankeyMark = CommonMark &
  Readonly<{
    mark: 'sankey';
    source: Channel;
    target: Channel;
    value: Channel;
    nodeWidth?: number;
    nodePadding?: number;
    labels?: boolean;
  }>;
/** One vertical axis per numeric field and one polyline per row. */
export type ParallelMark = CommonMark &
  Readonly<{ mark: 'parallel'; dimensions: ReadonlyArray<string>; stroke?: Channel }>;

export type MarkSpec =
  | DotMark
  | LineMark
  | AreaMark
  | BarMark
  | RuleMark
  | TextMark
  | CellMark
  | RectMark
  | BoxMark
  | ViolinMark
  | DensityMark
  | LinkMark
  | ArcMark
  | GeoMark
  | GraticuleMark
  | TreeMark
  | PackMark
  | ChordMark
  | ArcDiagramMark
  | ForceMark
  | VoronoiMark
  | TreemapMark
  | SunburstMark
  | SankeyMark
  | ParallelMark;
export type MarkType = MarkSpec['mark'];

export type PlotSpec = Readonly<{
  width: number;
  height: number;
  margins?: Partial<ChartMargins>;
  title?: string;
  description?: string;
  /** Data for every mark without its own `data`: rows, or a column table. */
  data?: PlotData;
  x?: PositionScaleSpec;
  y?: PositionScaleSpec;
  color?: ColorScaleSpec;
  r?: SizeScaleSpec;
  symbol?: SymbolScaleSpec;
  /** Split every mark's rows into small multiples by these fields, on shared scales. */
  facet?: Readonly<{ x?: string; y?: string }>;
  /**
   * Clip marks to each facet's plot area, as a zoomed domain needs. Default
   * false, so dots on the edge of the domain are drawn whole.
   */
  clip?: boolean;
  /** Draws geo marks, and places dots and text by longitude and latitude, on a map. */
  projection?: ProjectionSpec;
  /** Polar maps x to angle and y to radius, in the largest circle each facet fits. */
  coordinates?: 'cartesian' | 'polar';
  /**
   * Polar layout: the inner radius as a share of the outer, and where the angle
   * starts, in degrees clockwise from twelve o'clock.
   */
  polar?: Readonly<{ inner?: number; start?: number }>;
  marks: ReadonlyArray<MarkSpec>;
}>;

// ── Output: positioned geometry, no rendering ─────────────────────────────────

type Paint = Readonly<{ opacity: number; title?: string }>;
export type Graphic =
  | (Paint &
      Readonly<{
        kind: 'circle';
        key: string;
        cx: number;
        cy: number;
        r: number;
        fill: string;
        stroke: string;
        strokeWidth: number;
      }>)
  | (Paint &
      Readonly<{
        kind: 'path';
        key: string;
        d: string;
        /** Where the path's origin sits, for paths drawn around a centre. */
        translate?: readonly [number, number];
        fill: string;
        stroke: string;
        strokeWidth: number;
      }>)
  | (Paint &
      Readonly<{
        kind: 'rect';
        key: string;
        x: number;
        y: number;
        width: number;
        height: number;
        fill: string;
        stroke: string;
      }>)
  | (Paint &
      Readonly<{
        kind: 'line';
        key: string;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        stroke: string;
        strokeWidth: number;
      }>)
  | (Paint &
      Readonly<{
        /** Many dots packed into typed arrays, from a dense dot mark. */
        kind: 'points';
        key: string;
        count: number;
        xs: Float64Array;
        ys: Float64Array;
        /** One radius for every point, or one per point. */
        radius: number | Float64Array;
        /** Distinct fills; `paint` holds each point's index into it. */
        palette: ReadonlyArray<string>;
        paint: Uint16Array;
        /** Each point's row in the mark's data. */
        rows: Uint32Array;
        /** 1 where a highlight dims the point. */
        dimmed?: Uint8Array;
      }>)
  | (Paint &
      Readonly<{
        kind: 'text';
        key: string;
        x: number;
        y: number;
        text: string;
        fill: string;
        anchor: 'start' | 'middle' | 'end';
      }>);

export type MarkGeometry = Readonly<{
  mark: MarkType;
  index: number;
  graphics: ReadonlyArray<Graphic>;
}>;

export type PlotTick = Readonly<{ value: number | string; position: number; label: string }>;
export type PlotAxis = Readonly<{
  type: NonNullable<PositionScaleSpec['type']>;
  orientation: 'bottom' | 'left';
  domain: readonly [number, number] | ReadonlyArray<string>;
  label: string;
  ticks: ReadonlyArray<PlotTick>;
  grid: boolean;
  /** Pixel range the domain maps onto: [left, right] across, [bottom, top] down. */
  range: readonly [number, number];
  /** Power axes: the exponent. Symlog axes: the constant. */
  exponent?: number;
  constant?: number;
}>;

/** A polar facet's frame: rings at the radial ticks and spokes at the angular ones. */
export type PolarGeometry = Readonly<{
  cx: number;
  cy: number;
  inner: number;
  outer: number;
  /** Angular ticks, in radians clockwise from twelve o'clock. */
  angles: ReadonlyArray<Readonly<{ value: number | string; angle: number; label: string }>>;
  radii: ReadonlyArray<Readonly<{ value: number; radius: number; label: string }>>;
  /** Where the radial tick labels run: midway between the first two spokes, clear of both. */
  radialAngle: number;
  /** The radial axis title. */
  label: string;
}>;

export type FacetGeometry = Readonly<{
  key: string;
  /** The facet's field values, for its heading; empty when there are no facets. */
  label: string;
  plot: PlotBounds;
  x: PlotAxis | null;
  y: PlotAxis | null;
  /** Polar plots: the frame to draw in place of x and y axes. */
  polar: PolarGeometry | null;
  marks: ReadonlyArray<MarkGeometry>;
}>;

export type Legend =
  | Readonly<{
      kind: 'categorical';
      label: string;
      entries: ReadonlyArray<Readonly<{ key: string; label: string; color: string }>>;
    }>
  | Readonly<{
      kind: 'symbol';
      label: string;
      /** Each symbol's path at 64 square pixels, centred on the origin; a colour when one field drives both. */
      entries: ReadonlyArray<
        Readonly<{ key: string; label: string; symbol: SymbolType; path: string; color?: string }>
      >;
    }>
  | Readonly<{
      kind: 'continuous';
      label: string;
      domain: readonly [number, number];
      /** Evenly spaced colours from the low to the high end, for a gradient. */
      stops: ReadonlyArray<string>;
    }>;

export type PlotGeometry = Readonly<{
  width: number;
  height: number;
  title: string;
  description: string;
  facets: ReadonlyArray<FacetGeometry>;
  legends: ReadonlyArray<Legend>;
  /** Whether renderers clip marks to each facet's plot area. */
  clip: boolean;
}>;
