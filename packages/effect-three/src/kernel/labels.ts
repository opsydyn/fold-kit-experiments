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
import type { Material, Object3D } from 'three';

import type { LabelNode } from './description.ts';

/**
 * A label's laid-out size in its own units (before its scale), each as
 * `[minX, minY, maxX, maxY]`: `block` the whole text block, line height included, and
 * `visible` tight round the glyphs (troika's `blockBounds` and `visibleBounds`).
 */
export type LabelLayout = {
  readonly block: readonly [number, number, number, number];
  readonly visible: readonly [number, number, number, number];
};

/** One label as an engine draws it. */
export type HostedLabel = {
  /** What to show inside the label's wrapper. */
  readonly object: Object3D;
  /** Applies new text or type settings; `ready` is called again when they are drawn. */
  readonly update: (label: LabelNode) => void;
  /**
   * Draws the glyphs with a material the scene lends (`label({ material })`), or the
   * engine's own with `undefined`. The scene owns it: the engine never disposes it.
   */
  readonly setMaterial: (material: Material | undefined) => void;
  /** The text's laid-out size, once it has been laid out. */
  readonly layout: () => LabelLayout | undefined;
  readonly dispose: () => void;
};

/**
 * Draws labels. `ready` is called whenever a label's glyphs have been built (fonts load
 * and glyphs build in the background), so the scene can draw again.
 */
export type LabelEngine = {
  readonly create: (label: LabelNode, ready: () => void) => HostedLabel;
};
