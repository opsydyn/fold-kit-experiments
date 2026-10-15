/**
 * Summaries of scene updates, for the `scene-reconciled` event.
 *
 * @module
 */
import type { Op, ResourceStats } from '@opsydyn/effect-three';

import type { ReconciledDetail } from '../element.ts';

/** Counts operations by kind and snapshots resource counters. */
export const summarise = (ops: ReadonlyArray<Op>, stats: ResourceStats): ReconciledDetail => {
  const counts = {
    created: 0,
    updated: 0,
    moved: 0,
    removed: 0,
    replaced: 0,
    reordered: 0,
    configured: 0,
  };
  for (const op of ops) {
    switch (op._tag) {
      case 'Create':
        counts.created++;
        break;
      case 'Update':
        counts.updated++;
        break;
      case 'Move':
        counts.moved++;
        break;
      case 'Remove':
        counts.removed++;
        break;
      case 'Replace':
        counts.replaced++;
        break;
      case 'Order':
        counts.reordered++;
        break;
      case 'SetCamera':
      case 'DefineResources':
        counts.configured++;
        break;
    }
  }
  return {
    ops: counts,
    resources: { geometries: { ...stats.geometries }, materials: { ...stats.materials } },
  };
};
