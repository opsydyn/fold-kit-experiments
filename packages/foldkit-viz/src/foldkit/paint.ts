import type { Html, HtmlBuilder } from 'foldkit/html';

export type GradientStop = Readonly<{ offset: number; colour: string; opacity?: number }>;
export type GradientOptions = Readonly<{ id: string; stops: ReadonlyArray<GradientStop> }>;
export type PatternOptions = Readonly<{ id: string; colour: string; spacing: number }>;

function validId(id: string): void {
  if (!/^[A-Za-z][A-Za-z0-9_.:-]*$/.test(id))
    throw new RangeError('Paint id must be a non-empty SVG identifier');
}
function positive(value: number): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError('Paint dimensions must be finite and positive');
}
function stops<M>(h: HtmlBuilder<M>, options: GradientOptions): ReadonlyArray<Html> {
  validId(options.id);
  let previous = -1;
  if (options.stops.length === 0) throw new RangeError('Gradient requires at least one stop');
  return options.stops.map((stop) => {
    const opacity = stop.opacity ?? 1;
    if (
      !Number.isFinite(stop.offset) ||
      stop.offset < previous ||
      stop.offset < 0 ||
      stop.offset > 1 ||
      !Number.isFinite(opacity) ||
      opacity < 0 ||
      opacity > 1
    )
      throw new RangeError('Gradient stops must be ordered within [0, 1]');
    previous = stop.offset;
    return h.stop(
      [h.Offset(String(stop.offset)), h.StopColor(stop.colour), h.StopOpacity(String(opacity))],
      [],
    );
  });
}
/** Return definitions to compose inside <defs>. IDs are caller-owned and must
 * be unique in the document. CSS variables and currentColor are supported.
 */
export function dotPattern<M>(
  h: HtmlBuilder<M>,
  options: PatternOptions & Readonly<{ radius?: number }>,
): Html {
  validId(options.id);
  positive(options.spacing);
  const radius = options.radius ?? 1;
  positive(radius);
  if (radius * 2 >= options.spacing)
    throw new RangeError('Dot diameter must be smaller than spacing');
  return h.pattern(
    [
      h.Id(options.id),
      h.PatternUnits('userSpaceOnUse'),
      h.Width(String(options.spacing)),
      h.Height(String(options.spacing)),
    ],
    [
      h.circle(
        [
          h.Cx(String(options.spacing / 2)),
          h.Cy(String(options.spacing / 2)),
          h.R(String(radius)),
          h.Fill(options.colour),
        ],
        [],
      ),
    ],
  );
}
export function hatchPattern<M>(
  h: HtmlBuilder<M>,
  options: PatternOptions & Readonly<{ strokeWidth?: number; angle?: number }>,
): Html {
  validId(options.id);
  positive(options.spacing);
  const strokeWidth = options.strokeWidth ?? 1,
    angle = options.angle ?? 45;
  positive(strokeWidth);
  if (!Number.isFinite(angle)) throw new RangeError('Hatch angle must be finite');
  return h.pattern(
    [
      h.Id(options.id),
      h.PatternUnits('userSpaceOnUse'),
      h.Width(String(options.spacing)),
      h.Height(String(options.spacing)),
      h.PatternTransform(`rotate(${angle})`),
    ],
    [
      h.line(
        [
          h.X1('0'),
          h.X2('0'),
          h.Y1('0'),
          h.Y2(String(options.spacing)),
          h.Stroke(options.colour),
          h.StrokeWidth(String(strokeWidth)),
        ],
        [],
      ),
    ],
  );
}
export function linearGradient<M>(
  h: HtmlBuilder<M>,
  options: GradientOptions & Readonly<{ x1?: string; y1?: string; x2?: string; y2?: string }>,
): Html {
  return h.linearGradient(
    [
      h.Id(options.id),
      h.X1(options.x1 ?? '0%'),
      h.Y1(options.y1 ?? '0%'),
      h.X2(options.x2 ?? '100%'),
      h.Y2(options.y2 ?? '0%'),
    ],
    stops(h, options),
  );
}
export function radialGradient<M>(
  h: HtmlBuilder<M>,
  options: GradientOptions & Readonly<{ cx?: string; cy?: string; radius?: string }>,
): Html {
  return h.radialGradient(
    [
      h.Id(options.id),
      h.Cx(options.cx ?? '50%'),
      h.Cy(options.cy ?? '50%'),
      h.R(options.radius ?? '50%'),
    ],
    stops(h, options),
  );
}
