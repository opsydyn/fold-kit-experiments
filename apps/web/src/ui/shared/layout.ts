export type Margins = Readonly<{
  top: number;
  right: number;
  bottom: number;
  left: number;
}>;

export type Dims = Readonly<{
  width: number;
  height: number;
}>;

export type Layout = Readonly<{
  dims: Dims;
  margins: Margins;
  /** Plot width = dims.width - margins.left - margins.right */
  pw: number;
  /** Plot height = dims.height - margins.top - margins.bottom */
  ph: number;
}>;

export const DEFAULT_DIMS: Dims = { width: 480, height: 260 };

export const DEFAULT_MARGINS: Margins = { top: 24, right: 20, bottom: 44, left: 44 };

export function makeLayout(dims: Dims = DEFAULT_DIMS, margins: Margins = DEFAULT_MARGINS): Layout {
  return {
    dims,
    margins,
    pw: dims.width - margins.left - margins.right,
    ph: dims.height - margins.top - margins.bottom,
  };
}
