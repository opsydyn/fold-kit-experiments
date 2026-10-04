import type { SymbolType } from '../shape/symbol.js';

export type SeriesStyle = Readonly<{
  stroke: string;
  fill: string;
  opacity: number;
  strokeWidth: number;
  pointRadius: number;
  symbol: SymbolType;
  dashPattern: string;
}>;
export type ChartTheme = Readonly<{
  background: string;
  text: string;
  mutedText: string;
  grid: string;
  axis: string;
  focus: string;
  selection: string;
  tooltipBackground: string;
  tooltipText: string;
  fontFamily: string;
  labelSize: number;
  series: SeriesStyle;
}>;

const defaultSeries: SeriesStyle = {
  stroke: '#2563eb',
  fill: '#2563eb',
  opacity: 1,
  strokeWidth: 2,
  pointRadius: 4,
  symbol: 'circle',
  dashPattern: '',
};
export const lightTheme: ChartTheme = {
  background: '#ffffff',
  text: '#172033',
  mutedText: '#566176',
  grid: '#e1e6ef',
  axis: '#8a96ab',
  focus: '#2563eb',
  selection: '#172033',
  tooltipBackground: '#172033',
  tooltipText: '#ffffff',
  fontFamily: 'system-ui, sans-serif',
  labelSize: 12,
  series: defaultSeries,
};
export const darkTheme: ChartTheme = {
  background: '#111722',
  text: '#edf2fc',
  mutedText: '#a2b0c6',
  grid: '#2d384b',
  axis: '#71829f',
  focus: '#8fbaff',
  selection: '#ffffff',
  tooltipBackground: '#edf2fc',
  tooltipText: '#111722',
  fontFamily: 'system-ui, sans-serif',
  labelSize: 12,
  series: { ...defaultSeries, stroke: '#8fbaff', fill: '#8fbaff' },
};

/** Paint is opaque CSS. Opacity and size are separately validated numeric fields. */
export function resolveSeriesStyle(
  theme: ChartTheme,
  chart: Partial<SeriesStyle>,
  series: Partial<SeriesStyle>,
  datum: Partial<SeriesStyle>,
): SeriesStyle {
  const style = { ...defaultSeries, ...theme.series, ...chart, ...series, ...datum };
  if (!Number.isFinite(style.opacity) || style.opacity < 0 || style.opacity > 1)
    throw new RangeError('Series opacity must be between zero and one');
  if (
    !Number.isFinite(style.strokeWidth) ||
    style.strokeWidth < 0 ||
    !Number.isFinite(style.pointRadius) ||
    style.pointRadius < 0
  )
    throw new RangeError('Series stroke width and point radius must be finite non-negative sizes');
  return style;
}

/** Construct once from a stable series domain; duplicate IDs do not consume colours. */
export function createSeriesStyles(
  domain: ReadonlyArray<string>,
  palette: ReadonlyArray<string>,
  overrides: ReadonlyMap<string, Partial<SeriesStyle>> = new Map(),
): ReadonlyMap<string, SeriesStyle> {
  if (palette.length === 0) throw new RangeError('Series palette must contain at least one paint');
  const styles = new Map<string, SeriesStyle>();
  for (const key of domain) {
    if (styles.has(key)) continue;
    const paint = palette[styles.size % palette.length];
    // The non-empty palette and bounded index guarantee a paint; guard also helps JS callers.
    if (paint === undefined) throw new RangeError('Series palette contains a missing paint');
    styles.set(
      key,
      resolveSeriesStyle(lightTheme, { stroke: paint, fill: paint }, overrides.get(key) ?? {}, {}),
    );
  }
  return styles;
}

export type ChartThemeProperty =
  | '--chart-background'
  | '--chart-text'
  | '--chart-muted-text'
  | '--chart-grid'
  | '--chart-axis'
  | '--chart-focus'
  | '--chart-selection'
  | '--chart-tooltip-background'
  | '--chart-tooltip-text'
  | '--chart-font-family'
  | '--chart-label-size';
export function themeProperties(theme: ChartTheme) {
  return {
    '--chart-background': theme.background,
    '--chart-text': theme.text,
    '--chart-muted-text': theme.mutedText,
    '--chart-grid': theme.grid,
    '--chart-axis': theme.axis,
    '--chart-focus': theme.focus,
    '--chart-selection': theme.selection,
    '--chart-tooltip-background': theme.tooltipBackground,
    '--chart-tooltip-text': theme.tooltipText,
    '--chart-font-family': theme.fontFamily,
    '--chart-label-size': `${theme.labelSize}px`,
  } satisfies Readonly<Record<ChartThemeProperty, string>>;
}
