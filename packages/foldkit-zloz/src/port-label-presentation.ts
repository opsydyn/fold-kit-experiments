import { portPosition } from './geometry';
import { ZlozError } from './graph';
import type { ZlozNode, Point, Port, PortSide } from './types';

export type ZlozPortLabelOptions = Readonly<{
  /** Defaults to the port's routing side. */
  placement?: PortSide;
  /** World-unit gap from the port center. Defaults to 18. */
  offset?: number;
}>;
export type ZlozPortLabelContext = Readonly<{
  node: ZlozNode;
  port: Port;
  label: string;
  /** Canonical port center in world coordinates. */
  position: Point;
  placement: PortSide;
  offset: number;
}>;
function validateOffset(offset: number): void {
  if (!Number.isFinite(offset) || offset < 0)
    throw new ZlozError('invalid-edit', 'Port label offset must be finite and non-negative');
}

export function portLabelLayout({ position, placement, offset }: ZlozPortLabelContext) {
  validateOffset(offset);
  const alignment = {
    left: { x: -offset, y: 0, transform: 'translate(-100%, -50%)' },
    right: { x: offset, y: 0, transform: 'translate(0, -50%)' },
    top: { x: 0, y: -offset, transform: 'translate(-50%, -100%)' },
    bottom: { x: 0, y: offset, transform: 'translate(-50%, 0)' },
  }[placement];
  return {
    position: { x: position.x + alignment.x, y: position.y + alignment.y },
    transform: alignment.transform,
  };
}

export function portLabelContexts(
  nodes: readonly ZlozNode[],
  options: boolean | ZlozPortLabelOptions | undefined,
): readonly ZlozPortLabelContext[] {
  if (!options) return [];
  const settings = options === true ? {} : options;
  const offset = settings.offset ?? 18;
  validateOffset(offset);
  return nodes.flatMap((node) =>
    node.ports.map((port) => ({
      node,
      port,
      label: port.label ?? port.id,
      position: portPosition(node, port.id),
      placement: settings.placement ?? port.side,
      offset,
    })),
  );
}
