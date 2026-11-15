import type { Attribute, Html, HtmlBuilder } from 'foldkit/html';
import type { MountAction } from 'foldkit/mount';

import {
  currentColorPalette,
  descriptionOf,
  overlayMarks,
  plotExtras,
  plotFigure,
} from '../plot/render.js';
import type {
  AccessibleOptions,
  PlotChartOptions,
  PlotOverlay,
  PlotPalette,
} from '../plot/render.js';
import type { PlotGeometry } from '../plot/types.js';

/**
 * Renders compiled plot geometry (ADR 0037) with the parent's builder: one
 * accessible SVG and an HTML legend. The drawing lives in plot/render, which
 * svg/plot shares, so a page and an exported SVG file always agree.
 */

export { currentColorPalette };
export type { PlotChartOptions, PlotOverlay, PlotPalette };

export function plotChart<M>(
  h: HtmlBuilder<M>,
  geometry: PlotGeometry,
  options: PlotChartOptions = {},
): Html {
  return plotFigure<Attribute<M>, Html>(h, geometry, options);
}

export type PlotCanvasOptions<M> = Readonly<{
  /**
   * Paints the canvas when it enters the DOM: the parent's Mount, which calls
   * `paintCanvas` from canvas/plot with the same geometry. foldkit-viz installs
   * nothing itself.
   */
  onMount: MountAction<M>;
  /** Changes whenever the geometry does, so a new canvas mounts and repaints. */
  key: string;
  palette?: PlotPalette;
  legend?: boolean;
  overlay?: PlotOverlay;
}> &
  AccessibleOptions;

/**
 * A canvas-painted plot for marks too large for SVG, such as dense dot marks,
 * with interaction drawn in an SVG overlay above it. The overlay re-renders on
 * every hover while the canvas, keyed by its geometry, is left alone. The
 * canvas sizes by CSS aspect ratio, not width and height attributes, so a
 * re-render never resets (and so clears) its pixels.
 */
export function plotCanvas<M>(
  h: HtmlBuilder<M>,
  geometry: PlotGeometry,
  options: PlotCanvasOptions<M>,
): Html {
  const palette = options.palette ?? currentColorPalette;
  const label = [geometry.title, descriptionOf(geometry, options)]
    .filter((part) => part !== '')
    .join('. ');
  return h.figure(
    [h.Class('plot plot-canvas'), h.Style({ margin: '0', 'font-family': palette.fontFamily })],
    [
      h.div(
        [h.Style({ position: 'relative', width: '100%', 'max-width': `${geometry.width}px` })],
        [
          h.canvas(
            [
              h.Key(options.key),
              h.Role('img'),
              ...(label === '' ? [] : [h.AriaLabel(label)]),
              h.Style({
                display: 'block',
                width: '100%',
                height: 'auto',
                'aspect-ratio': `${geometry.width} / ${geometry.height}`,
              }),
              h.OnMount(options.onMount),
            ],
            [],
          ),
          h.svg(
            [
              h.Class('plot-canvas-overlay'),
              h.ViewBox(`0 0 ${geometry.width} ${geometry.height}`),
              h.AriaHidden(true),
              h.Style({
                position: 'absolute',
                inset: '0',
                width: '100%',
                height: '100%',
                'pointer-events': 'none',
                overflow: 'visible',
              }),
            ],
            options.overlay === undefined
              ? []
              : overlayMarks<Attribute<M>, Html>(h, geometry, options.overlay),
          ),
        ],
      ),
      ...plotExtras<Attribute<M>, Html>(h, geometry, options),
    ],
  );
}
