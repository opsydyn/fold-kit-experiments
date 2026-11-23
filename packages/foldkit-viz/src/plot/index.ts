export { appendPoints, columnStore } from './append.js';
export type { ColumnStore } from './append.js';
export { compilePlot } from './compile.js';
export { pushdown } from './pushdown.js';
export type { SqlSource } from './pushdown.js';
export { columnTable, duckdbColumns, fromArrow, fromDuckDB, rowsOf } from './columns.js';
export type { ArrowTable, DuckDBReader } from './columns.js';
export { describePlot, plotTable } from './describe.js';
export type { PlotTable } from './describe.js';
export { angularLabel, spokeOf } from './polar.js';
export type * from './types.js';
export {
  highlightPoints,
  indexPlot,
  invertAxis,
  invertPlot,
  pointerToPlot,
  plotTargets,
} from './interaction.js';
export type {
  ClientPoint,
  ClientRect,
  PlotHit,
  PlotIndex,
  PlotLocation,
  PlotTarget,
} from './interaction.js';
