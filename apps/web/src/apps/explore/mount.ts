import { paintCanvas } from '@opsydyn/foldkit-viz/canvas/plot';
import type { PlotGeometry } from '@opsydyn/foldkit-viz/plot';
import { pointsLayer } from '@opsydyn/foldkit-viz/webgl/points';
import type { PointsLayer } from '@opsydyn/foldkit-viz/webgl/points';
import { Effect, Result, Schema } from 'effect';
import { define as defineMount } from 'foldkit/mount';

import { scatter, scatterByKey } from './charts';
import { Message } from './message';
import { Range } from './model';

/** The dark colours the canvas falls back to when the page sets no chart tokens. */
const fallback = {
  current: '#9aa7b4',
  text: '#e6edf3',
  mutedText: '#9aa7b4',
  grid: 'rgba(154, 167, 180, 0.15)',
  axis: 'rgba(154, 167, 180, 0.5)',
};

/**
 * The canvas's colours from the page's chart tokens where it sets them, so its
 * axes follow a light or dark page. The first name is foldkit-viz's, the second
 * this web app's.
 */
const colorsOf = (element: Element) => {
  const style = getComputedStyle(element);
  const read = (names: ReadonlyArray<string>, otherwise: string): string =>
    names.map((name) => style.getPropertyValue(name).trim()).find((value) => value !== '') ??
    otherwise;
  const mutedText = read(['--chart-muted-text', '--chart-label'], fallback.mutedText);
  return {
    current: mutedText,
    text: read(['--chart-text', '--page-text'], fallback.text),
    mutedText,
    grid: read(['--chart-grid'], fallback.grid),
    axis: read(['--chart-axis'], fallback.axis),
  };
};

/**
 * Paints the scatter's canvas when it enters the DOM: everything but the
 * points when a GPU layer draws them, else the points too. The canvas is
 * keyed so a change that needs repainting mounts a new one; hovering only
 * redraws the SVG overlay.
 */
export const PaintScatter = defineMount('PaintScatter', {
  args: { key: Schema.String, points: Schema.Boolean },
  messages: [Message.PaintedScatter],
  execute: ({ element, key, points }) =>
    Effect.sync(() => {
      const compiled = scatterByKey(key);
      if (compiled !== undefined && element instanceof HTMLCanvasElement)
        paintCanvas(element, compiled.geometry, {
          pixelRatio: window.devicePixelRatio || 1,
          colors: colorsOf(element),
          points,
        });
      return Message.PaintedScatter({ key });
    }),
});

type Span = readonly [number, number];

/** Each mounted points canvas's layer, and the zoom it was built for. */
const layers = new WeakMap<Element, Readonly<{ layer: PointsLayer; domain: string }>>();

export const pointsLayerOf = (element: Element) => layers.get(element);

/** The points canvas sized for the scatter at the device pixel ratio, with its WebGL context. */
type Prepared =
  | Readonly<{
      _tag: 'Ready';
      gl: WebGLRenderingContext;
      geometry: PlotGeometry;
      ratio: number;
    }>
  | Readonly<{ _tag: 'Unavailable'; reason: string }>;

function prepareCanvas(element: Element, domain: Span | null): Prepared {
  if (!(element instanceof HTMLCanvasElement))
    return { _tag: 'Unavailable', reason: 'the points layer needs a canvas' };
  const { geometry } = scatter(domain, null);
  const ratio = window.devicePixelRatio || 1;
  element.width = Math.round(geometry.width * ratio);
  element.height = Math.round(geometry.height * ratio);
  const gl = element.getContext('webgl', { antialias: false, premultipliedAlpha: true });
  return gl === null
    ? { _tag: 'Unavailable', reason: 'WebGL is unavailable' }
    : { _tag: 'Ready', gl, geometry, ratio };
}

/** The layer, highlighted with the brush current at mount, and drawn. pointsLayer throws a RangeError for a shader or colour it cannot use. */
function drawnLayer(
  { gl, geometry, ratio }: Extract<Prepared, { _tag: 'Ready' }>,
  domain: Span | null,
  initialBrushed: Span | null,
): PointsLayer {
  const layer = pointsLayer(gl, geometry, { pixelRatio: ratio });
  if (initialBrushed !== null) layer.highlight(scatter(domain, initialBrushed).geometry);
  layer.draw();
  return layer;
}

/**
 * Makes the GPU points layer when its canvas mounts and releases it when the
 * canvas goes. Brushes after that arrive as HighlightScatter Commands. If no
 * layer can be made, the app falls back to painting points on the canvas.
 */
export const MountPointsLayer = defineMount('MountPointsLayer', {
  args: { domain: Schema.NullOr(Range), initialBrushed: Schema.NullOr(Range) },
  messages: [Message.MountedPointsLayer, Message.FailedPointsLayer],
  execute: ({ element, domain, initialBrushed }) =>
    Effect.gen(function* () {
      const prepared = prepareCanvas(element, domain);
      if (prepared._tag === 'Unavailable')
        return Message.FailedPointsLayer({ reason: prepared.reason });
      const made = yield* Effect.try({
        try: () => drawnLayer(prepared, domain, initialBrushed),
        catch: (error) => String(error),
      }).pipe(Effect.result);
      if (Result.isFailure(made)) return Message.FailedPointsLayer({ reason: made.failure });
      const layer = made.success;
      layers.set(element, { layer, domain: JSON.stringify(domain) });
      // The Mount's scope closes when the canvas unmounts.
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          layer.dispose();
          layers.delete(element);
        }),
      );
      return Message.MountedPointsLayer();
    }),
});
