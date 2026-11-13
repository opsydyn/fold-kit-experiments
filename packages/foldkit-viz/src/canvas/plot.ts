import type { FacetGeometry, Graphic, PlotAxis, PlotGeometry } from '../plot/types.js';

/**
 * Paints compiled plot geometry (ADR 0037) on a 2D canvas context: grid,
 * axes, facet headings and every mark, with packed points drawn in one pass
 * per colour. Framework-free and listener-free: call it when the canvas
 * mounts or the geometry changes. Legends stay HTML; see foldkit/plot.
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

function paintPoints(
  ctx: PlotCanvasContext,
  g: Extract<Graphic, { kind: 'points' }>,
  settings: Settings,
): void {
  // One path per colour and dimmed state, so a million points are a few fills.
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < g.count; i += 1) {
    const bucket = (g.paint[i] ?? 0) * 2 + (g.dimmed?.[i] ?? 0);
    const list = buckets.get(bucket);
    if (list === undefined) buckets.set(bucket, [i]);
    else list.push(i);
  }
  for (const [bucket, indices] of buckets) {
    ctx.fillStyle = paintOf(g.palette[Math.floor(bucket / 2)] ?? 'currentColor', settings);
    ctx.globalAlpha = g.opacity * (bucket % 2 === 1 ? 0.15 : 1);
    ctx.beginPath();
    for (const i of indices) {
      const r = g.radius instanceof Float64Array ? (g.radius[i] ?? 0) : g.radius;
      const x = g.xs[i] ?? 0,
        y = g.ys[i] ?? 0;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, 2 * Math.PI);
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
    if (facet.x !== null) paintAxis(ctx, facet, facet.x, settings);
    if (facet.y !== null) paintAxis(ctx, facet, facet.y, settings);
    for (const mark of facet.marks) for (const g of mark.graphics) paintGraphic(ctx, g, settings);
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
