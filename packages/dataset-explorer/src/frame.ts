import type { ChartFrame } from '@opsydyn/foldkit-viz/chart/cartesian';

const margins = { top: 24, right: 28, bottom: 58, left: 58 };

export const validChartWidth = (width: number): boolean =>
  Number.isFinite(width) && width > margins.left + margins.right;

export function frameForWidth(width: number): ChartFrame {
  if (!validChartWidth(width)) throw new RangeError('Chart width must leave positive plot space');
  return { width, height: 330, margins };
}

export const tickCountForFrame = (frame: ChartFrame): number =>
  Math.max(2, Math.floor((frame.width - frame.margins.left - frame.margins.right) / 80));
