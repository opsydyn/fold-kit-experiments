import type { ZlozContextAction } from './context-menu';
import { ZlozError } from './graph';
import type { ZlozNode, Point, Viewport } from './types';

export type ZlozNodeToolbarPlacement = 'top' | 'right' | 'bottom' | 'left';

export type ZlozNodeToolbarOptions = Readonly<{
  /** The default places the toolbar above the node, or below if the node is near the top. */
  placement?: ZlozNodeToolbarPlacement | undefined;
  /** Gap between the node boundary and toolbar, in CSS pixels. Defaults to 8. */
  offset?: number;
}>;

export type ZlozNodeToolbarContext = Readonly<{
  /** The selected node with its visible dimensions, including collapsed groups. */
  node: ZlozNode;
  viewport: Viewport;
  /** Center of the chosen node side in canvas CSS pixels, before the offset. */
  anchor: Point;
  placement: ZlozNodeToolbarPlacement;
  offset: number;
  actions: Readonly<{ duplicate: ZlozContextAction; deleteNode: ZlozContextAction }>;
}>;

export function nodeToolbarContext(
  node: ZlozNode,
  viewport: Viewport,
  options: ZlozNodeToolbarOptions,
  actions: ZlozNodeToolbarContext['actions'],
): ZlozNodeToolbarContext {
  const offset = options.offset ?? 8;
  if (!Number.isFinite(offset) || offset < 0)
    throw new ZlozError('invalid-edit', 'Node toolbar offset must be finite and non-negative');
  const left = viewport.x + node.position.x * viewport.zoom;
  const top = viewport.y + node.position.y * viewport.zoom;
  const width = node.size.width * viewport.zoom;
  const height = node.size.height * viewport.zoom;
  const placement = options.placement ?? (top < 44 + offset ? 'bottom' : 'top');
  const anchors = {
    top: { x: left + width / 2, y: top },
    right: { x: left + width, y: top + height / 2 },
    bottom: { x: left + width / 2, y: top + height },
    left: { x: left, y: top + height / 2 },
  };
  return { node, viewport, anchor: anchors[placement], placement, offset, actions };
}

export function nodeToolbarPosition({ anchor, placement, offset }: ZlozNodeToolbarContext) {
  const positions = {
    top: { x: anchor.x, y: anchor.y - offset, translate: '-50% -100%' },
    right: { x: anchor.x + offset, y: anchor.y, translate: '0 -50%' },
    bottom: { x: anchor.x, y: anchor.y + offset, translate: '-50% 0' },
    left: { x: anchor.x - offset, y: anchor.y, translate: '-100% -50%' },
  };
  return positions[placement];
}
