import type { PlotCanvasContext } from '../src/canvas/plot';

/** A context that records what was drawn. */
export const canvasCalls = () => {
  const calls: Array<readonly [string, ...unknown[]]> = [];
  const record =
    (name: string) =>
    (...args: unknown[]): void => {
      calls.push([name, ...args]);
    };
  const ctx: PlotCanvasContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save: record('save'),
    restore: record('restore'),
    setTransform: record('setTransform'),
    clearRect: record('clearRect'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arc: record('arc'),
    rect: record('rect'),
    fill: (...args: unknown[]) => calls.push(['fill', ctx.fillStyle, ...args]),
    stroke: record('stroke'),
    fillText: record('fillText'),
    translate: record('translate'),
    clip: record('clip'),
  };
  const count = (name: string): number => calls.filter(([n]) => n === name).length;
  return { ctx, calls, count };
};
