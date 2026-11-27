export type GradientStop = Readonly<{ offset: number; colour: string; opacity?: number }>;
export type GradientOptions = Readonly<{ id: string; stops: ReadonlyArray<GradientStop> }>;
export type PatternOptions = Readonly<{ id: string; colour: string; spacing: number }>;

export function validId(id: string): void {
  if (!/^[A-Za-z][A-Za-z0-9_.:-]*$/.test(id))
    throw new RangeError('Paint id must be a non-empty SVG identifier');
}

export function positive(value: number): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError('Paint dimensions must be finite and positive');
}

export function gradientStops(options: GradientOptions) {
  validId(options.id);
  let previous = -1;
  if (options.stops.length === 0) throw new RangeError('Gradient requires at least one stop');
  return options.stops.map(({ offset, colour, opacity = 1 }) => {
    if (
      !Number.isFinite(offset) ||
      offset < previous ||
      offset < 0 ||
      offset > 1 ||
      !Number.isFinite(opacity) ||
      opacity < 0 ||
      opacity > 1
    )
      throw new RangeError('Gradient stops must be ordered within [0, 1]');
    previous = offset;
    return { offset, colour, opacity };
  });
}

export function validateDotPattern(id: string, spacing: number, radius: number): void {
  validId(id);
  positive(spacing);
  positive(radius);
  if (radius * 2 >= spacing) throw new RangeError('Dot diameter must be smaller than spacing');
}

export function validateHatch(id: string, spacing: number, width: number, angle: number): void {
  validId(id);
  positive(spacing);
  positive(width);
  if (!Number.isFinite(angle)) throw new RangeError('Hatch angle must be finite');
}
