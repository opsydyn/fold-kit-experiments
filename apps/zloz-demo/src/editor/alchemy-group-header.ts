import type { LayoutGroupHeader, LayoutGroupHeaderSpec, ZlozNode } from '@opsydyn/foldkit-zloz';
/** Shared by the native group renderer and explicit layout request. No source metadata is changed. */
const declaredSize = { width: 640, height: 112 } as const;
export function alchemyGroupHeaderSpec(node: ZlozNode): LayoutGroupHeaderSpec | undefined {
  return node.kind === 'group' &&
    (node.architecture?.family === 'ddd' || node.architecture?.family === 'c4')
    ? {
        id: node.id,
        padding: { top: 24, right: 24, bottom: 24, left: 24 },
        gap: 24,
      }
    : undefined;
}
export function alchemyGroupHeader(node: ZlozNode): LayoutGroupHeader | undefined {
  const spec = alchemyGroupHeaderSpec(node);
  return spec ? { ...spec, size: declaredSize } : undefined;
}
