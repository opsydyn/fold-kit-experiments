/**
 * Named colour schemes — parity with d3-scale-chromatic.
 *
 * Categorical arrays can be used with `ordinal()` from `math/scale`.
 * Sequential/diverging arrays can be passed to `interpolateRgbBasis()` from
 * `math/color` to produce a continuous interpolator.
 */

// ---- CATEGORICAL ----

/** Tableau10 — 10 visually distinct colours, best default for categorical data */
export const tableau10: ReadonlyArray<string> = [
  '#4e79a7',
  '#f28e2c',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc949',
  '#af7aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ab',
];

/** D3 category10 (same as Observable10) */
export const category10: ReadonlyArray<string> = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
];

/** Dark2 — 8 dark, print-safe colours */
export const dark2: ReadonlyArray<string> = [
  '#1b9e77',
  '#d95f02',
  '#7570b3',
  '#e7298a',
  '#66a61e',
  '#e6ab02',
  '#a6761d',
  '#666666',
];

/** Set1 — 9 bright colours */
export const set1: ReadonlyArray<string> = [
  '#e41a1c',
  '#377eb8',
  '#4daf4a',
  '#984ea3',
  '#ff7f00',
  '#ffff33',
  '#a65628',
  '#f781bf',
  '#999999',
];

// ---- SEQUENTIAL (light → dark, 9 stops for interpolation) ----

/** Blues — white to dark blue */
export const blues: ReadonlyArray<string> = [
  '#f7fbff',
  '#deebf7',
  '#c6dbef',
  '#9ecae1',
  '#6baed6',
  '#4292c6',
  '#2171b5',
  '#08519c',
  '#08306b',
];

/** Greens — white to dark green */
export const greens: ReadonlyArray<string> = [
  '#f7fcf5',
  '#e5f5e0',
  '#c7e9c0',
  '#a1d99b',
  '#74c476',
  '#41ab5d',
  '#238b45',
  '#006d2c',
  '#00441b',
];

/** Reds — white to dark red */
export const reds: ReadonlyArray<string> = [
  '#fff5f0',
  '#fee0d2',
  '#fcbba1',
  '#fc9272',
  '#fb6a4a',
  '#ef3b2c',
  '#cb181a',
  '#99000d',
  '#67000d',
];

/** Oranges — white to dark orange */
export const oranges: ReadonlyArray<string> = [
  '#fff5eb',
  '#fee6ce',
  '#fdd0a2',
  '#fdae6b',
  '#fd8d3c',
  '#f16913',
  '#d94801',
  '#a63603',
  '#7f2704',
];

/** Purples — white to dark purple */
export const purples: ReadonlyArray<string> = [
  '#fcfbfd',
  '#efedf5',
  '#dadaeb',
  '#bcbddc',
  '#9e9ac8',
  '#807dba',
  '#6a51a3',
  '#54278f',
  '#3f007d',
];

// ---- DIVERGING (11 stops: low → midpoint → high) ----

/** RdBu — red (low) → white (mid) → blue (high) */
export const rdBu: ReadonlyArray<string> = [
  '#67001f',
  '#b2182b',
  '#d6604d',
  '#f4a582',
  '#fddbc7',
  '#f7f7f7',
  '#d1e5f0',
  '#92c5de',
  '#4393c3',
  '#2166ac',
  '#053061',
];

/** Spectral — red → yellow → green → blue (perceptually balanced rainbow) */
export const spectral: ReadonlyArray<string> = [
  '#9e0142',
  '#d53e4f',
  '#f46d43',
  '#fdae61',
  '#fee08b',
  '#ffffbf',
  '#e6f598',
  '#abdda4',
  '#66c2a5',
  '#3288bd',
  '#5e4fa2',
];

/** RdYlGn — red → yellow → green */
export const rdYlGn: ReadonlyArray<string> = [
  '#a50026',
  '#d73027',
  '#f46d43',
  '#fdae61',
  '#fee08b',
  '#ffffbf',
  '#d9ef8b',
  '#a6d96a',
  '#66bd63',
  '#1a9850',
  '#006837',
];

/** BrBG — brown → white → teal */
export const brBG: ReadonlyArray<string> = [
  '#543005',
  '#8c510a',
  '#bf812d',
  '#dfc27d',
  '#f6e8c3',
  '#f5f5f5',
  '#c7eae5',
  '#80cdc1',
  '#35978f',
  '#01665e',
  '#003c30',
];
