import type { ChartFrame } from '@opsydyn/foldkit-viz/chart/cartesian';
import { lightTheme } from '@opsydyn/foldkit-viz/chart/theme';
import type { ChartTheme } from '@opsydyn/foldkit-viz/chart/theme';

const margins = { top: 30, right: 24, bottom: 60, left: 48 };
export const validChartWidth = (width: number): boolean =>
  Number.isFinite(width) && width > margins.left + margins.right;
export function frameForWidth(width: number, height: number): ChartFrame {
  if (!validChartWidth(width)) throw new RangeError('Chart width must leave positive plot space');
  return { width, height, margins };
}
export const tickCountForWidth = (width: number): number => (width < 420 ? 3 : 5);

/** Replace these semantic tokens to brand all layers without changing geometry. */
export const exampleTheme: ChartTheme = {
  ...lightTheme,
  background: 'var(--chart-background, var(--surface, #fffefa))',
  text: 'var(--chart-text, var(--text, #151619))',
  mutedText: 'var(--chart-muted-text, var(--muted, #5d6574))',
  grid: 'var(--chart-grid, var(--border, #d9dce1))',
  axis: 'var(--chart-axis, var(--rule, #bcc2cc))',
  focus: 'var(--chart-focus, var(--blue, #3d79fa))',
  selection: 'var(--chart-selection, var(--text, #151619))',
  tooltipBackground: 'var(--chart-tooltip-background, var(--text, #151619))',
  tooltipText: 'var(--chart-tooltip-text, var(--surface, #fffefa))',
  labelSize: 12,
};
