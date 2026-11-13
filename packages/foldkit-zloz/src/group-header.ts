import { ZlozError } from './graph';
import type { LayoutGroupHeader, LayoutGroupHeaderGeometry, ZlozNode } from './types';

/** Shared declared geometry: world header rectangle, minimum group size and child-area padding. */
export function resolveLayoutGroupHeader(
  node: ZlozNode,
  header: LayoutGroupHeader,
): LayoutGroupHeaderGeometry {
  const { size, padding, gap } = header;
  if (
    node.kind !== 'group' ||
    node.id !== header.id ||
    ![size.width, size.height].every((n) => Number.isFinite(n) && n > 0) ||
    ![gap, padding.top, padding.right, padding.bottom, padding.left].every(
      (n) => Number.isFinite(n) && n >= 0,
    )
  )
    throw new ZlozError(
      'invalid-layout',
      'Group headers require an existing group, positive finite size and nonnegative finite padding/gap',
    );
  const contentPadding = { ...padding, top: padding.top + size.height + gap };
  const minimumSize = {
    width: padding.left + size.width + padding.right,
    height: contentPadding.top + padding.bottom,
  };
  const position = { x: node.position.x + padding.left, y: node.position.y + padding.top };
  if (
    ![contentPadding.top, minimumSize.width, minimumSize.height, position.x, position.y].every(
      Number.isFinite,
    )
  )
    throw new ZlozError('invalid-layout', 'Group header bounds overflowed finite world geometry');
  return { position, size: { ...size }, minimumSize, contentPadding };
}
