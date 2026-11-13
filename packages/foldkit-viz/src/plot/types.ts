import type { ChartMargins, PlotBounds } from '../chart/layout.js';
import type { CurveType } from '../shape/line.js';

// ── Spec: plain JSON, no functions (ADR 0037) ─────────────────────────────────

export type Value = number | string | boolean | null;
export type Row = Readonly<Record<string, Value>>;
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
export type LineTransform =
  | RegressionTransform
  | LoessTransform
  | WindowTransform
  | DownsampleTransform;

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
  data?: ReadonlyArray<Row>;
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
  | BoxMark
  | ViolinMark
  | LinkMark
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
  /** Rows for every mark without its own `data`. */
  data?: ReadonlyArray<Row>;
  x?: PositionScaleSpec;
  y?: PositionScaleSpec;
  color?: ColorScaleSpec;
  r?: SizeScaleSpec;
  /** Split every mark's rows into small multiples by these fields, on shared scales. */
  facet?: Readonly<{ x?: string; y?: string }>;
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

export type FacetGeometry = Readonly<{
  key: string;
  /** The facet's field values, for its heading; empty when there are no facets. */
  label: string;
  plot: PlotBounds;
  x: PlotAxis | null;
  y: PlotAxis | null;
  marks: ReadonlyArray<MarkGeometry>;
}>;

export type Legend =
  | Readonly<{
      kind: 'categorical';
      label: string;
      entries: ReadonlyArray<Readonly<{ key: string; label: string; color: string }>>;
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
}>;
