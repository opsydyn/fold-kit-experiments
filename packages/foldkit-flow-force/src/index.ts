import type { LayoutEngine } from '@opsydyn/foldkit-flow';

import { arrangeWithForce } from './layout';

export { supportsForceLayout } from './eligibility';

/** Bounded, deterministic force layout using measured card sizes. */
export function createForceLayout(): LayoutEngine {
  return async (request) => arrangeWithForce(request);
}
