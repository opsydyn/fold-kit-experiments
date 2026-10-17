/**
 * The kernel's side of labels (distance-field text): an engine-neutral contract. An
 * engine package (troika, in `@opsydyn/effect-three-troika`) implements `LabelEngine`; the
 * scene graph hosts what it makes inside each label's wrapper.
 *
 * Behavioural reference: Drei's `Text` at `bf6f4ad` (`src/core/Text.tsx`): a troika mesh
 * per label, its properties set from props, `sync` run after each change and the frame
 * invalidated when it finishes, and the mesh disposed on unmount.
 *
 * @module
 */
import type { Object3D } from 'three';

import type { LabelNode } from './description.ts';

/** One label as an engine draws it. */
export type HostedLabel = {
  /** What to show inside the label's wrapper. */
  readonly object: Object3D;
  /** Applies new text or type settings; `ready` is called again when they are drawn. */
  readonly update: (label: LabelNode) => void;
  readonly dispose: () => void;
};

/**
 * Draws labels. `ready` is called whenever a label's glyphs have been built (fonts load
 * and glyphs build in the background), so the scene can draw again.
 */
export type LabelEngine = {
  readonly create: (label: LabelNode, ready: () => void) => HostedLabel;
};
