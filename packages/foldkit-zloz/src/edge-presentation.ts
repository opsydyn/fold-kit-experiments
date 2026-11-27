import type { ZlozConnectionPreview } from './connection-preview';
import { ZlozError } from './graph';
import type { Point, ZlozEdge } from './types';

export type ZlozEdgeAppearance = Readonly<{
  stroke?: string;
  strokeWidth?: number;
  dashArray?: string;
  /** Selection corridor in world units. Defaults to 12. */
  hitWidth?: number;
}>;

export type ZlozEdgeRenderContext = Readonly<{
  edge: ZlozEdge;
  path: string;
  labelPosition: Point | undefined;
  selected: boolean;
  stroke: string;
  strokeWidth: string;
  dashArray: string;
  markerEnd: string;
}>;

/** Geometry, core target feedback and default appearance for a decorative preview renderer. */
export type ZlozConnectionRenderContext = ZlozConnectionPreview &
  Readonly<{
    stroke: string;
    strokeWidth: string;
    dashArray: string;
  }>;

export function edgeHitWidth(width = 12): string {
  if (!Number.isFinite(width) || width <= 0)
    throw new ZlozError('invalid-edit', 'Edge hit width must be positive and finite');
  return String(width);
}

export function connectionRenderContext(
  preview: ZlozConnectionPreview,
): ZlozConnectionRenderContext {
  const colors = {
    valid: 'var(--flow-valid-target, #0f766e)',
    invalid: 'var(--flow-invalid-target, #dc2626)',
    free: 'var(--flow-selection, #2563eb)',
  } as const;
  return { ...preview, stroke: colors[preview.feedback.type], strokeWidth: '3', dashArray: '6 4' };
}

export function connectionDropRadii(
  connectionDropRadius = 0,
  reconnectionDropRadius = connectionDropRadius,
) {
  if (!Number.isFinite(connectionDropRadius) || connectionDropRadius < 0)
    throw new RangeError('Connection drop radius must be finite and non-negative');
  if (!Number.isFinite(reconnectionDropRadius) || reconnectionDropRadius < 0)
    throw new RangeError('Reconnection drop radius must be finite and non-negative');
  return { connectionDropRadius, reconnectionDropRadius };
}
