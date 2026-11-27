import { constVoid } from 'effect/Function';
import { expect, it, onTestFinished } from 'vitest';

import { scatter, scatterKey } from './charts';
import { paintScatter } from './mount';

it('paints the requested scatter on the mounted canvas and returns its key', () => {
  const domain = [100, 500] as const;
  scatter(domain, null);
  const key = scatterKey(domain, null);

  const canvas = document.createElement('canvas');
  canvas.style.setProperty('--chart-axis', '#345678');
  document.body.append(canvas);
  onTestFinished(() => canvas.remove());

  const strokes: string[] = [];
  const fills: string[] = [];
  const context = {
    strokeStyle: '',
    fillStyle: '',
    stroke() {
      strokes.push(this.strokeStyle);
    },
    fill() {
      fills.push(this.fillStyle);
    },
    setTransform: constVoid,
    clearRect: constVoid,
    beginPath: constVoid,
    moveTo: constVoid,
    lineTo: constVoid,
    fillText: constVoid,
    save: constVoid,
    rect: constVoid,
    clip: constVoid,
    restore: constVoid,
  };
  Object.defineProperty(canvas, 'getContext', {
    value: (kind: string) => (kind === '2d' ? context : null),
  });

  const message = paintScatter(canvas, key, true);

  expect(strokes).toContain('#345678');
  expect(fills).toContain('#6aa7e8');
  expect(message).toEqual({ _tag: 'PaintedScatter', key });
});
