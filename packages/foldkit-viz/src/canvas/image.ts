import { standaloneLegends } from '../plot/legend.js';
import type { LegendLayout } from '../plot/legend.js';
import { paletteOf } from '../plot/theme.js';
import type { PlotTheme } from '../plot/theme.js';
import type { PlotGeometry } from '../plot/types.js';
import { paintPlot } from './plot.js';
import type { PlotCanvasColors, PlotCanvasContext, PlotCanvasElement, PlotPath } from './plot.js';

/**
 * A compiled plot as a whole image (ADR 0037): the theme's background, the
 * plot, and its legends below, the picture plotSvg draws, painted on any 2D
 * context with canvas/plot's painter. `plotPng` encodes one through a canvas
 * the caller supplies; foldkit-viz bundles no rasteriser.
 */

function fillRect(
  ctx: PlotCanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  colour: string,
): void {
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.fillStyle = colour;
  ctx.fill();
}

/** The browser's Path2D, available wherever a real canvas context is. */
declare const Path2D: new (d: string) => PlotPath;
const platformPath = (d: string) => new Path2D(d);

export type ImageOptions = Readonly<{
  /** Default `'light'`. A canvas has no page colour, so the theme's colours must be concrete. */
  theme?: PlotTheme;
  /** Draw the legends below the plot. Default true. */
  legend?: boolean;
  /** Paint the theme's background. Default true. */
  background?: boolean;
}>;

/** An image's size in CSS pixels. */
export type ImageSize = Readonly<{ width: number; height: number }>;

/** An image's size: the plot, and the legend rows below it. Matches plotSvg's. */
export function imageSize(geometry: PlotGeometry, options: ImageOptions = {}): ImageSize {
  const legends =
    options.legend === false
      ? 0
      : standaloneLegends(geometry, paletteOf(options.theme ?? 'light').labelSize).height;
  return { width: geometry.width, height: geometry.height + legends };
}

export type PaintImageOptions = ImageOptions &
  Readonly<{ pixelRatio?: number; makePath?: (d: string) => PlotPath }>;

function paintLegends(
  ctx: PlotCanvasContext,
  layout: LegendLayout,
  colors: PlotCanvasColors,
  font: string,
  labelSize: number,
  makePath: (d: string) => PlotPath,
): void {
  for (const mark of layout.marks)
    switch (mark.kind) {
      case 'swatch':
        fillRect(ctx, mark.x, mark.y, mark.size, mark.size, mark.color);
        break;
      case 'band':
        // A hair wider, so neighbouring bands leave no seam.
        fillRect(ctx, mark.x, mark.y, mark.width + 0.5, mark.height, mark.color);
        break;
      case 'symbol':
        ctx.save();
        ctx.translate(mark.x, mark.y);
        ctx.fillStyle = mark.color ?? colors.current;
        ctx.fill(makePath(mark.path));
        ctx.restore();
        break;
      case 'label':
        ctx.font = `${mark.title ? '600 ' : ''}${labelSize}px ${font}`;
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(mark.text, mark.x, mark.y);
        break;
    }
}

/**
 * The whole chart as an image on any 2D context: the theme's background, the
 * plot, then its legends below, the same picture plotSvg draws. Size the
 * canvas to `imageSize` times the pixel ratio first, or use plotPng.
 */
export function paintImage(
  ctx: PlotCanvasContext,
  geometry: PlotGeometry,
  options: PaintImageOptions = {},
): void {
  const palette = paletteOf(options.theme ?? 'light');
  if (palette.text === 'currentColor')
    throw new RangeError('a canvas has no page colour to inherit; choose a theme such as "light"');
  const ratio = options.pixelRatio ?? 1;
  const makePath = options.makePath ?? platformPath;
  const colors: PlotCanvasColors = {
    current: palette.text,
    text: palette.text,
    mutedText: palette.mutedText,
    grid: palette.grid,
    axis: palette.axis,
  };
  const background = options.background === false ? undefined : palette.background;
  const { width, height } = imageSize(geometry, options);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (background !== undefined) fillRect(ctx, 0, 0, width, height, background);
  const plotOptions = {
    pixelRatio: ratio,
    colors,
    fontFamily: palette.fontFamily,
    labelSize: palette.labelSize,
    makePath,
  };
  paintPlot(ctx, geometry, background === undefined ? plotOptions : { ...plotOptions, background });
  if (options.legend !== false)
    paintLegends(
      ctx,
      standaloneLegends(geometry, palette.labelSize),
      colors,
      palette.fontFamily,
      palette.labelSize,
      makePath,
    );
}

/** A canvas that encodes itself as a PNG, such as a browser's OffscreenCanvas. */
export type PngCanvas = PlotCanvasElement &
  Readonly<{
    convertToBlob: (
      options: Readonly<{ type: 'image/png' }>,
    ) => Promise<Readonly<{ arrayBuffer: () => Promise<ArrayBuffer> }>>;
  }>;

/** The largest image plotPng paints: 16,384 pixels a side and 16.7 million in all, within every browser's canvas limits. */
const MAX_SIDE = 16_384;
const MAX_PIXELS = 16_777_216;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * The chart as PNG bytes, painted on a canvas the caller supplies: in a
 * browser or worker, `new OffscreenCanvas(1, 1)`. foldkit-viz bundles no
 * rasteriser. In Bun, Node or Deno, paint with paintImage on a canvas library's
 * context and use its own encoder. An image over the size limits is refused
 * before the canvas is touched; output that is not a PNG of the painted size is
 * an error, never returned.
 */
export async function plotPng(
  geometry: PlotGeometry,
  canvas: PngCanvas,
  options: PaintImageOptions = {},
): Promise<Uint8Array> {
  const ratio = options.pixelRatio ?? 1;
  if (!Number.isFinite(ratio) || ratio <= 0)
    throw new RangeError(`pixelRatio must be a positive number, not ${ratio}`);
  const size = imageSize(geometry, options);
  const width = Math.ceil(size.width * ratio);
  const height = Math.ceil(size.height * ratio);
  if (width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS)
    throw new RangeError(
      `a ${width}×${height} image is over the ${MAX_SIDE}-pixel side or ${MAX_PIXELS}-pixel limit; lower pixelRatio`,
    );
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new RangeError('the canvas has no 2D context');
  paintImage(ctx, geometry, { ...options, pixelRatio: ratio });
  const bytes = new Uint8Array(
    await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer(),
  );
  if (bytes.length < 24 || PNG_SIGNATURE.some((byte, i) => bytes[i] !== byte))
    throw new RangeError('the canvas encoded something that is not a PNG');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const [encodedWidth, encodedHeight] = [view.getUint32(16), view.getUint32(20)];
  if (encodedWidth !== width || encodedHeight !== height)
    throw new RangeError(
      `the canvas encoded a ${encodedWidth}×${encodedHeight} PNG, not ${width}×${height}`,
    );
  return bytes;
}
