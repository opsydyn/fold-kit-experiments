import type { SlowConfig } from 'foldkit/runtime';

/** Keep every slow-phase warning bounded before Vite forwards it to the local host. */
export const slow = {
  onSlow: (context) => {
    console.warn(
      `[zloz] Slow ${context._tag}: ${context.durationMs.toFixed(1)} ms (budget: ${context.thresholdMs} ms)`,
    );
  },
} satisfies SlowConfig<unknown, unknown>;
