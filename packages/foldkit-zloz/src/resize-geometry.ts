import type { ResizeAlignment } from './alignment';
import { gridSpacing as defaultGridSpacing } from './geometry';
import { withDescendants } from './group-presentation';
import { expandParents } from './parent-expansion';
import type { Point, ResizeHandle, ZlozGraph } from './types';

export function resizeNodeGeometry(
  graph: ZlozGraph,
  id: string,
  delta: Point,
  handle: ResizeHandle = 'bottom-right',
  snapToGrid = false,
  spacing = defaultGridSpacing,
  alignment: readonly ResizeAlignment[] = [],
  groupOnly = true,
): ZlozGraph {
  const group = graph.nodes.find((node) => node.id === id && (!groupOnly || node.kind === 'group'));
  if (!group || (delta.x === 0 && delta.y === 0)) return graph;
  const left = handle.endsWith('left');
  const top = handle.startsWith('top');
  const horizontal = handle === 'left' || handle === 'right';
  const vertical = handle === 'top' || handle === 'bottom';
  const centerX = vertical && group.keepAspectRatio;
  const centerY = horizontal && group.keepAspectRatio;
  const middle = {
    x: group.position.x + group.size.width / 2,
    y: group.position.y + group.size.height / 2,
  };
  const right = group.position.x + group.size.width;
  const bottom = group.position.y + group.size.height;
  const snapped = (edge: number, offset: number) =>
    snapToGrid && offset !== 0 ? Math.round((edge + offset) / spacing) * spacing - edge : offset;
  const x = vertical
    ? 0
    : (alignment.find((match) => match.axis === 'x')?.offset ??
      snapped(left ? group.position.x : right, delta.x));
  const y = horizontal
    ? 0
    : (alignment.find((match) => match.axis === 'y')?.offset ??
      snapped(top ? group.position.y : bottom, delta.y));
  const growth = { x: left ? -x : x, y: top ? -y : y };
  if (growth.x === 0 && growth.y === 0) return graph;
  const included = withDescendants(graph, [id]);
  const contents = graph.nodes.filter((node) => node.id !== id && included.has(node.id));
  const limits = group.resizeLimits;
  let maximumWidth = limits?.maxWidth ?? Infinity;
  let maximumHeight = limits?.maxHeight ?? Infinity;
  const minimumWidth = Math.max(
    limits?.minWidth ?? Math.min(group.kind === 'group' ? 224 : 40, group.size.width, maximumWidth),
    Math.min(
      group.size.width,
      Math.max(
        1,
        ...contents.map((node) =>
          centerX
            ? Math.max(
                2 * (middle.x - node.position.x + 24),
                2 * (node.position.x + node.size.width + 24 - middle.x),
              )
            : left
              ? right - node.position.x + 24
              : node.position.x + node.size.width + 24 - group.position.x,
        ),
      ),
    ),
  );
  const minimumHeight = Math.max(
    limits?.minHeight ??
      Math.min(group.kind === 'group' ? 96 : 24, group.size.height, maximumHeight),
    Math.min(
      group.size.height,
      Math.max(
        1,
        ...contents.map((node) =>
          centerY
            ? Math.max(
                2 * (middle.y - node.position.y + 48),
                2 * (node.position.y + node.size.height + 24 - middle.y),
              )
            : top
              ? bottom - node.position.y + 48
              : node.position.y + node.size.height + 24 - group.position.y,
        ),
      ),
    ),
  );
  const parent = graph.nodes.find((node) => node.id === group.parentId);
  if (parent && group.extent === 'parent' && !group.expandParent) {
    maximumWidth = Math.min(
      maximumWidth,
      centerX
        ? Math.min(
            2 * (middle.x - parent.position.x),
            2 * (parent.position.x + parent.size.width - middle.x),
          )
        : left
          ? right - parent.position.x
          : parent.position.x + parent.size.width - group.position.x,
    );
    maximumHeight = Math.min(
      maximumHeight,
      centerY
        ? Math.min(
            2 * (middle.y - parent.position.y),
            2 * (parent.position.y + parent.size.height - middle.y),
          )
        : top
          ? bottom - parent.position.y
          : parent.position.y + parent.size.height - group.position.y,
    );
  }
  let width: number;
  let height: number;
  if (group.keepAspectRatio) {
    const minimumScale = Math.max(
      minimumWidth / group.size.width,
      minimumHeight / group.size.height,
    );
    const maximumScale = Math.min(
      maximumWidth / group.size.width,
      maximumHeight / group.size.height,
    );
    if (minimumScale > maximumScale) return graph;
    const x = growth.x / group.size.width;
    const y = growth.y / group.size.height;
    const driver = alignment[0]?.axis;
    const requested =
      1 + (driver === 'x' ? x : driver === 'y' ? y : Math.abs(x) >= Math.abs(y) ? x : y);
    const scale = Math.max(minimumScale, Math.min(maximumScale, requested));
    // Repeated edits at a floating-point boundary must not create history entries.
    if (Math.abs(scale - 1) <= Number.EPSILON * 4) return graph;
    width = group.size.width * scale;
    height = group.size.height * scale;
  } else {
    if (
      (growth.x !== 0 && minimumWidth > maximumWidth) ||
      (growth.y !== 0 && minimumHeight > maximumHeight)
    )
      return graph;
    width =
      growth.x === 0
        ? group.size.width
        : Math.max(minimumWidth, Math.min(maximumWidth, group.size.width + growth.x));
    height =
      growth.y === 0
        ? group.size.height
        : Math.max(minimumHeight, Math.min(maximumHeight, group.size.height + growth.y));
  }
  if (width === group.size.width && height === group.size.height) return graph;
  return expandParents(
    {
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              position: {
                x: centerX ? middle.x - width / 2 : left ? right - width : group.position.x,
                y: centerY ? middle.y - height / 2 : top ? bottom - height : group.position.y,
              },
              size: { width, height },
            }
          : node,
      ),
    },
    id,
  );
}
