import type { Html, HtmlBuilder } from 'foldkit/html';

import { gradientStops, validateDotPattern, validateHatch } from '../svg/paint-validation.js';
import type { GradientOptions, PatternOptions } from '../svg/paint-validation.js';

export type { GradientStop, GradientOptions, PatternOptions } from '../svg/paint-validation.js';

function stops<M>(h: HtmlBuilder<M>, options: GradientOptions): ReadonlyArray<Html> {
  return gradientStops(options).map(({ offset, colour, opacity }) =>
    h.stop([h.Offset(String(offset)), h.StopColor(colour), h.StopOpacity(String(opacity))], []),
  );
}
/** Return definitions to compose inside <defs>. IDs are caller-owned and must
 * be unique in the document. CSS variables and currentColor are supported.
 */
export function dotPattern<M>(
  h: HtmlBuilder<M>,
  options: PatternOptions & Readonly<{ radius?: number }>,
): Html {
  const radius = options.radius ?? 1;
  validateDotPattern(options.id, options.spacing, radius);
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
  const strokeWidth = options.strokeWidth ?? 1;
  const angle = options.angle ?? 45;
  validateHatch(options.id, options.spacing, strokeWidth, angle);
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
