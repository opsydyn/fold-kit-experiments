import { Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { scatter } from './charts';
import { Message } from './message';
import { Range } from './model';
import { pointsLayerOf } from './mount';

/**
 * Repaints the GPU points layer with a new highlight, in place: one byte per
 * point is uploaded and the points redrawn, within a frame. A layer built for
 * another zoom is left alone; the Mount that replaces it applies the brush.
 */
export const HighlightScatter = Command.define('HighlightScatter', {
  args: { domain: Schema.NullOr(Range), brushed: Schema.NullOr(Range) },
  messages: [Message.HighlightedScatter],
  execute: ({ domain, brushed }) =>
    Effect.sync(() => {
      const element = globalThis.document.querySelector(
        '[data-explore="scatter"] canvas.plot-points',
      );
      const mounted = element === null ? undefined : pointsLayerOf(element);
      if (mounted !== undefined && mounted.domain === JSON.stringify(domain)) {
        mounted.layer.highlight(scatter(domain, brushed).geometry);
        mounted.layer.draw();
      }
      return Message.HighlightedScatter();
    }),
});
