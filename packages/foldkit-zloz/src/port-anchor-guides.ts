import { portAnchorSnapGuideTargets, resolvePortAnchorSnapSettings } from './port-anchor-snap';
import { portEditReason } from './port-edit';
import type {
  EditorPolicy,
  EditorState,
  ZlozNode,
  Point,
  Port,
  PortAnchorSnapGuide,
  PortAnchorSnapSettings,
  Viewport,
} from './types';

export type ZlozPortAnchorGuideContext = Readonly<{
  node: ZlozNode;
  port: Port;
  target: PortAnchorSnapGuide;
  /** World endpoints; equal for a point target. */
  start: Point;
  end: Point;
  active: boolean;
  viewport: Viewport;
  settings: PortAnchorSnapSettings;
}>;
export function resolvePortAnchorGuides(
  state: EditorState,
  nodes: readonly ZlozNode[],
  canEditPort: EditorPolicy['canEditPort'],
): readonly ZlozPortAnchorGuideContext[] {
  const gesture = state.gesture;
  if (state.readOnly || gesture.type !== 'port-anchor-drag' || gesture.snapBypassed) return [];
  const node = nodes.find(({ id }) => id === gesture.endpoint.node);
  const port = node?.ports.find(({ id }) => id === gesture.endpoint.port);
  if (
    !node ||
    !port ||
    portEditReason({ operation: 'position', node, port }, state.graph, canEditPort) !== null
  )
    return [];
  const settings = resolvePortAnchorSnapSettings(
    gesture.snapSettings ?? {
      distance: state.portAnchorSnapDistance,
      cornerDistance: state.portAnchorCornerSnapDistance,
      midpointDistance: state.portAnchorMidpointSnapDistance,
      hysteresis: state.portAnchorSnapHysteresis,
      priority: state.portAnchorSnapPriority,
    },
  );
  const world = (point: Point): Point => ({
    x: node.position.x + point.x * node.size.width,
    y: node.position.y + point.y * node.size.height,
  });
  return portAnchorSnapGuideTargets(settings).map((target) => ({
    node,
    port,
    target,
    start: world(target.type === 'edge' ? target.start : target.point),
    end: world(target.type === 'edge' ? target.end : target.point),
    active:
      target.type === 'corner'
        ? gesture.snappedCorner === target.corner
        : target.type === 'midpoint'
          ? gesture.snappedMidpoint === target.side
          : gesture.snappedSide === target.side,
    viewport: { ...state.viewport },
    settings,
  }));
}
