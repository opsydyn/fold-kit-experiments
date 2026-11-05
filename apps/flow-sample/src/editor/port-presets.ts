import type { FlowGraph, Point, Port, PortPosition, PortSide } from '@opsydyn/foldkit-flow';

import type { PortAnchorPreset } from './model';

const diagonal = 0.48 / Math.sqrt(2);
const anchors = {
  right: { x: 0.5 + diagonal, y: 0.5 - diagonal },
  left: { x: 0.5 - diagonal, y: 0.5 + diagonal },
  top: { x: 0.5 - diagonal, y: 0.5 - diagonal },
  bottom: { x: 0.5 + diagonal, y: 0.5 + diagonal },
} satisfies Readonly<Record<PortSide, Point>>;

export function presetPosition(port: Port, preset: PortAnchorPreset): PortPosition {
  if (preset === 'diagonal') return { side: port.side, anchor: anchors[port.side] };
  return { side: port.side, offset: 0.5 };
}

/** Derived from the authored document so Undo and imported custom positions stay honest. */
export function currentPreset(graph: FlowGraph): PortAnchorPreset | 'custom' {
  const ports = graph.nodes.flatMap((node) => node.ports);
  if (ports.every((port) => port.offset === 0.5)) return 'cardinal';
  if (
    ports.every(
      (port) => port.anchor?.x === anchors[port.side].x && port.anchor.y === anchors[port.side].y,
    )
  )
    return 'diagonal';
  return 'custom';
}
