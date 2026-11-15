import { paintCanvas } from '@opsydyn/foldkit-viz/canvas/plot';
import { Effect, Schema } from 'effect';
import { define as defineMount } from 'foldkit/mount';

import { scatterByKey } from './charts';
import { Message } from './message';

const colors = {
  current: '#9aa7b4',
  text: '#e6edf3',
  mutedText: '#9aa7b4',
  grid: 'rgba(154, 167, 180, 0.15)',
  axis: 'rgba(154, 167, 180, 0.5)',
};

/**
 * Paints the scatter's canvas when it enters the DOM. The canvas is keyed by
 * zoom and brush, so a change mounts a new canvas and this paints it again;
 * hovering only redraws the SVG overlay.
 */
export const PaintScatter = defineMount('PaintScatter', {
  args: { key: Schema.String },
  messages: [Message.PaintedScatter],
  execute: ({ element, key }) =>
    Effect.sync(() => {
      const compiled = scatterByKey(key);
      if (compiled !== undefined && element instanceof HTMLCanvasElement)
        paintCanvas(element, compiled.geometry, {
          pixelRatio: window.devicePixelRatio || 1,
          colors,
        });
      return Message.PaintedScatter({ key });
    }),
});
