import { angularLabel, radialLabel, spokeOf } from '../plot/polar.js';
import type {
  FacetGeometry,
  Graphic,
  PlotAxis,
  PlotGeometry,
  PolarGeometry,
} from '../plot/types.js';

/**
 * Paints compiled plot geometry (ADR 0037) on a 2D canvas context: grid,
 * axes, facet headings and every mark, with packed points drawn in one pass
 * per colour. Framework-free and listener-free: call it when the canvas
 * mounts or the geometry changes. On a page, legends stay HTML (foldkit/plot);
 * canvas/image paints a whole image, legends and background included.
 */

/** A path built from SVG path data; Path2D in a browser. Opaque to the painter. */
export interface PlotPath {}

/**
 * The parts of CanvasRenderingContext2D the painter uses, typed without the DOM
 * library so the package needs none; a browser's context satisfies it.
 */
export type PlotCanvasContext = {
  /** Assigned colour strings; read types differ by platform. */
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  globalAlpha: number;
  font: string;
  textAlign: 'left' | 'right' | 'center' | 'start' | 'end';
  textBaseline: 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';
  save(): void;
  restore(): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  fill(path?: PlotPath): void;
  stroke(path?: PlotPath): void;
  fillText(text: string, x: number, y: number): void;
  translate(x: number, y: number): void;
  clip(): void;
};

export type PlotCanvasColors = Readonly<{
  /** Used wherever the geometry says currentColor. */
  current: string;
  text: string;
  mutedText: string;
  grid: string;
  axis: string;
}>;

export type PaintPlotOptions = Readonly<{
  /** Device pixels per CSS pixel. Default 1. */
  pixelRatio?: number;
  colors?: PlotCanvasColors;
  fontFamily?: string;
  labelSize?: number;
  /** Builds a path from SVG path data. Default: the platform's Path2D. */
  makePath?: (d: string) => PlotPath;
  /** Fills the plot area after clearing it. Default: left clear. */
  background?: string;
}>;

export const defaultCanvasColors: PlotCanvasColors = {
  current: '#9aa7b4',
  text: '#e6edf3',
  mutedText: '#9aa7b4',
  grid: 'rgba(154, 167, 180, 0.15)',
  axis: 'rgba(154, 167, 180, 0.5)',
};

type Settings = Readonly<{
  colors: PlotCanvasColors;
  font: string;
  labelSize: number;
  makePath: (d: string) => PlotPath;
}>;

const paintOf = (paint: string, settings: Settings): string =>
  paint === 'currentColor' ? settings.colors.current : paint;

const segment = (ctx: PlotCanvasContext, x1: number, y1: number, x2: number, y2: number): void => {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
};

function paintGrid(ctx: PlotCanvasContext, facet: FacetGeometry, settings: Settings): void {
  const { plot } = facet;
  ctx.strokeStyle = settings.colors.grid;
  ctx.lineWidth = 1;
  if (facet.x?.grid)
    for (const t of facet.x.ticks) segment(ctx, t.position, plot.top, t.position, plot.bottom);
  if (facet.y?.grid)
    for (const t of facet.y.ticks) segment(ctx, plot.left, t.position, plot.right, t.position);
}

function paintPolar(ctx: PlotCanvasContext, p: PolarGeometry, settings: Settings): void {
  ctx.lineWidth = 1;
  ctx.strokeStyle = settings.colors.grid;
  for (const t of p.radii) {
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, t.radius, 0, 2 * Math.PI);
    ctx.stroke();
  }
  for (const t of p.angles) {
    const [x1, y1, x2, y2] = spokeOf(p, t.angle);
    segment(ctx, x1, y1, x2, y2);
  }
  ctx.strokeStyle = settings.colors.axis;
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, p.outer, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.font = `${settings.labelSize}px ${settings.font}`;
  ctx.fillStyle = settings.colors.mutedText;
  ctx.textBaseline = 'middle';
  for (const t of p.angles) {
    const at = angularLabel(p, t.angle);
    ctx.textAlign = at.anchor === 'start' ? 'left' : at.anchor === 'end' ? 'right' : 'center';
    ctx.fillText(t.label, at.x, at.y);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  for (const t of p.radii) {
    const [x, y] = radialLabel(p, t.radius);
    ctx.fillText(t.label, x, y);
  }
}

function paintAxis(
  ctx: PlotCanvasContext,
  facet: FacetGeometry,
  axis: PlotAxis,
  settings: Settings,
): void {
  const { plot } = facet;
  const bottom = axis.orientation === 'bottom';
  const size = settings.labelSize;
  ctx.strokeStyle = settings.colors.axis;
  ctx.lineWidth = 1;
  if (bottom) segment(ctx, plot.left, plot.bottom, plot.right, plot.bottom);
  else segment(ctx, plot.left, plot.top, plot.left, plot.bottom);
  ctx.font = `${size}px ${settings.font}`;
  ctx.fillStyle = settings.colors.mutedText;
  ctx.textAlign = bottom ? 'center' : 'right';
  ctx.textBaseline = bottom ? 'top' : 'middle';
  for (const t of axis.ticks)
    if (t.label !== '')
      ctx.fillText(
        t.label,
        bottom ? t.position : plot.left - 6,
        bottom ? plot.bottom + 4 : t.position,
      );
  if (axis.label === '') return;
  ctx.font = `600 ${size}px ${settings.font}`;
  ctx.fillStyle = settings.colors.text;
  ctx.textAlign = bottom ? 'center' : 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(
    axis.label,
    bottom ? (plot.left + plot.right) / 2 : plot.left,
    bottom ? plot.bottom + size * 2 + 10 : plot.top - 6,
  );
}

/** The most points one path holds; see paintPoints. */
const PATH_CHUNK = 100_000;

function paintPoints(
  ctx: PlotCanvasContext,
  g: Extract<Graphic, { kind: 'points' }>,
  settings: Settings,
): void {
  // One path per colour and dimmed state, so a million points are a few fills.
  // Points are grouped by counting sort into typed arrays, dimmed buckets first
  // so highlighted points paint on top.
  const buckets = g.palette.length * 2;
  const bucketOf = (i: number) => (g.dimmed?.[i] === 1 ? 0 : g.palette.length) + (g.paint[i] ?? 0);
  const starts = new Uint32Array(buckets + 1);
  for (let i = 0; i < g.count; i += 1) {
    const b = bucketOf(i) + 1;
    starts[b] = (starts[b] ?? 0) + 1;
  }
  for (let b = 0; b < buckets; b += 1) starts[b + 1] = (starts[b + 1] ?? 0) + (starts[b] ?? 0);
  const order = new Uint32Array(g.count);
  const cursor = starts.slice(0, buckets);
  for (let i = 0; i < g.count; i += 1) {
    const b = bucketOf(i);
    order[cursor[b] ?? 0] = i;
    cursor[b] = (cursor[b] ?? 0) + 1;
  }
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const from = starts[bucket] ?? 0,
      to = starts[bucket + 1] ?? 0;
    if (from === to) continue;
    const dimmed = bucket < g.palette.length;
    ctx.fillStyle = paintOf(g.palette[bucket % g.palette.length] ?? 'currentColor', settings);
    ctx.globalAlpha = g.opacity * (dimmed ? 0.15 : 1);
    ctx.beginPath();
    for (let k = from; k < to; k += 1) {
      // Chromium silently draws nothing for one path of more than about
      // 180,000 circles, so a large group is filled a chunk at a time.
      if (k > from && (k - from) % PATH_CHUNK === 0) {
        ctx.fill();
        ctx.beginPath();
      }
      const i = order[k] ?? 0;
      const r = g.radius instanceof Float64Array ? (g.radius[i] ?? 0) : g.radius;
      const x = g.xs[i] ?? 0,
        y = g.ys[i] ?? 0;
      // At this size a square looks the same as a circle and fills far faster.
      if (r <= 1.5) ctx.rect(x - r, y - r, 2 * r, 2 * r);
      else {
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, 2 * Math.PI);
      }
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function paintGraphic(ctx: PlotCanvasContext, g: Graphic, settings: Settings): void {
  ctx.globalAlpha = g.opacity;
  switch (g.kind) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, g.r, 0, 2 * Math.PI);
      if (g.fill !== 'none') {
        ctx.fillStyle = paintOf(g.fill, settings);
        ctx.fill();
      }
      if (g.stroke !== 'none') {
        ctx.strokeStyle = paintOf(g.stroke, settings);
        ctx.lineWidth = g.strokeWidth;
        ctx.stroke();
      }
      break;
    case 'rect':
      ctx.beginPath();
      ctx.rect(g.x, g.y, g.width, g.height);
      if (g.fill !== 'none') {
        ctx.fillStyle = paintOf(g.fill, settings);
        ctx.fill();
      }
      if (g.stroke !== 'none') {
        ctx.strokeStyle = paintOf(g.stroke, settings);
        ctx.stroke();
      }
      break;
    case 'line':
      ctx.strokeStyle = paintOf(g.stroke, settings);
      ctx.lineWidth = g.strokeWidth;
      segment(ctx, g.x1, g.y1, g.x2, g.y2);
      break;
    case 'path': {
      const path = settings.makePath(g.d);
      ctx.save();
      if (g.translate !== undefined) ctx.translate(g.translate[0], g.translate[1]);
      if (g.fill !== 'none') {
        ctx.fillStyle = paintOf(g.fill, settings);
        ctx.fill(path);
      }
      if (g.stroke !== 'none' && g.strokeWidth > 0) {
        ctx.strokeStyle = paintOf(g.stroke, settings);
        ctx.lineWidth = g.strokeWidth;
        ctx.stroke(path);
      }
      ctx.restore();
      break;
    }
    case 'text':
      ctx.fillStyle = paintOf(g.fill, settings);
      ctx.font = `${settings.labelSize + 1}px ${settings.font}`;
      ctx.textAlign = g.anchor === 'middle' ? 'center' : g.anchor === 'end' ? 'right' : 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(g.text, g.x, g.y);
      break;
    case 'points':
      paintPoints(ctx, g, settings);
      break;
  }
  ctx.globalAlpha = 1;
}

/** The browser's Path2D, available wherever a real canvas context is. */
declare const Path2D: new (d: string) => PlotPath;
const platformPath = (d: string) => new Path2D(d);

export function paintPlot(
  ctx: PlotCanvasContext,
  geometry: PlotGeometry,
  options: PaintPlotOptions = {},
): void {
  const ratio = options.pixelRatio ?? 1;
  const settings: Settings = {
    colors: options.colors ?? defaultCanvasColors,
    font: options.fontFamily ?? 'system-ui, sans-serif',
    labelSize: options.labelSize ?? 11,
    makePath: options.makePath ?? platformPath,
  };
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, geometry.width, geometry.height);
  if (options.background !== undefined) {
    ctx.beginPath();
    ctx.rect(0, 0, geometry.width, geometry.height);
    ctx.fillStyle = options.background;
    ctx.fill();
  }
  for (const facet of geometry.facets) {
    if (facet.label !== '') {
      ctx.font = `600 ${settings.labelSize + 1}px ${settings.font}`;
      ctx.fillStyle = settings.colors.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(
        facet.label,
        (facet.plot.left + facet.plot.right) / 2,
        facet.plot.top - settings.labelSize - 10,
      );
    }
    paintGrid(ctx, facet, settings);
    if (facet.polar !== null) paintPolar(ctx, facet.polar, settings);
    if (facet.x !== null) paintAxis(ctx, facet, facet.x, settings);
    if (facet.y !== null) paintAxis(ctx, facet, facet.y, settings);
    // A clipped plot keeps marks inside their plot area, so a zoomed axis never
    // paints over the axes.
    ctx.save();
    if (geometry.clip) {
      ctx.beginPath();
      ctx.rect(facet.plot.left, facet.plot.top, facet.plot.width, facet.plot.height);
      ctx.clip();
    }
    for (const mark of facet.marks) for (const g of mark.graphics) paintGraphic(ctx, g, settings);
    ctx.restore();
  }
}

/** The parts of HTMLCanvasElement used to size and paint a canvas. */
export type PlotCanvasElement = {
  width: number;
  height: number;
  getContext(kind: '2d'): PlotCanvasContext | null;
};

/** Sizes a canvas for the pixel ratio and paints the geometry on it. */
export function paintCanvas(
  canvas: PlotCanvasElement,
  geometry: PlotGeometry,
  options: PaintPlotOptions = {},
): void {
  const ratio = options.pixelRatio ?? 1;
  canvas.width = Math.round(geometry.width * ratio);
  canvas.height = Math.round(geometry.height * ratio);
  const ctx = canvas.getContext('2d');
  if (ctx !== null) paintPlot(ctx, geometry, { ...options, pixelRatio: ratio });
}
