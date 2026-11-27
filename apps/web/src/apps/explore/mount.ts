import { Mount } from '@effect/ui';
import { paintCanvas } from '@opsydyn/foldkit-viz/canvas/plot';
import type { PlotGeometry } from '@opsydyn/foldkit-viz/plot';
import { pointsLayer } from '@opsydyn/foldkit-viz/webgl/points';
import { Effect, Schema, Stream } from 'effect';

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
export function paintScatter(element: HTMLCanvasElement, key: string, points: boolean) {
  const compiled = scatterByKey(key);
  if (compiled !== undefined)
    paintCanvas(element, compiled.geometry, {
      pixelRatio: element.ownerDocument.defaultView?.devicePixelRatio || 1,
      colors: colorsOf(element),
      points,
    });
  return Message.PaintedScatter({ key });
}

export const PaintScatter = Mount.make(
  'PaintScatter',
  { args: { key: Schema.String, points: Schema.Boolean } },
  (element: HTMLCanvasElement, { key, points }) =>
    Effect.sync(() => paintScatter(element, key, points)),
);

type Span = readonly [number, number];

/** The points canvas sized for the scatter at the device pixel ratio, with its WebGL context. */
type Prepared =
  | Readonly<{
      _tag: 'Ready';
      gl: WebGLRenderingContext;
      geometry: PlotGeometry;
      ratio: number;
    }>
  | Readonly<{ _tag: 'Unavailable'; reason: string }>;

function prepareCanvas(element: HTMLCanvasElement, domain: Span | null): Prepared {
  const { geometry } = scatter(domain, null);
  const ratio = element.ownerDocument.defaultView?.devicePixelRatio || 1;
  element.width = Math.round(geometry.width * ratio);
  element.height = Math.round(geometry.height * ratio);
  const gl = element.getContext('webgl', { antialias: false, premultipliedAlpha: true });
  return gl === null
    ? { _tag: 'Unavailable', reason: 'WebGL is unavailable' }
    : { _tag: 'Ready', gl, geometry, ratio };
}

const sameBrush = (a: Span | null, b: Span | null): boolean =>
  a === b || (a !== null && b !== null && a[0] === b[0] && a[1] === b[1]);

/** The canvas owns one GPU layer. Brush changes redraw it without remounting. */
export const MountPointsLayer = Mount.makeStream(
  'MountPointsLayer',
  { args: { domain: Schema.NullOr(Range), brushed: Schema.NullOr(Range) } },
  (element: HTMLCanvasElement, { domain }, changes) =>
    Stream.unwrap(
      Effect.gen(function* () {
        const prepared = prepareCanvas(element, domain);
        if (prepared._tag === 'Unavailable') return yield* Effect.fail(prepared.reason);
        const create = Effect.try({
          try: () => pointsLayer(prepared.gl, prepared.geometry, { pixelRatio: prepared.ratio }),
          catch: (error) => String(error),
        });
        const layer = yield* Effect.acquireRelease(create, (layer) =>
          Effect.sync(() => layer.dispose()),
        );
        return changes.pipe(
          Stream.map((args) => args.brushed),
          Stream.changesWith(sameBrush),
          Stream.mapEffect((brush) =>
            Effect.try({
              try: () => {
                layer.highlight(scatter(domain, brush).geometry);
                layer.draw();
              },
              catch: (error) => String(error),
            }),
          ),
          Stream.drain,
        );
      }),
    ).pipe(Stream.catch((reason) => Stream.make(Message.FailedPointsLayer({ reason })))),
);
