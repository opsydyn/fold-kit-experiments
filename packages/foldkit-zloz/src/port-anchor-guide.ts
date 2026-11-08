import type { Html, HtmlBuilder } from 'foldkit/html';

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
export type ZlozPortAnchorGuideRenderer<M> = (
  context: ZlozPortAnchorGuideContext,
  h: HtmlBuilder<M>,
) => Html | null | undefined;

/** Native guide geometry. Attributes customize paint; the package retains resolved positions. */
export function zlozPortAnchorGuide<M>(
  h: HtmlBuilder<M>,
  context: ZlozPortAnchorGuideContext,
  attributes: Parameters<HtmlBuilder<M>['circle']>[0] = [],
): Html {
  const color = context.active
    ? 'var(--flow-selection, #2563eb)'
    : 'var(--flow-alignment-guide, #7c3aed)';
  const paint = [
    h.Stroke(color),
    h.StrokeWidth(String(2 / context.viewport.zoom)),
    ...attributes,
    h.Style({ 'vector-effect': 'non-scaling-stroke' }),
  ];
  return context.target.type === 'edge'
    ? h.line(
        [
          h.StrokeDasharray(context.active ? 'none' : '5 3'),
          ...paint,
          h.X1(String(context.start.x)),
          h.Y1(String(context.start.y)),
          h.X2(String(context.end.x)),
          h.Y2(String(context.end.y)),
        ],
        [],
      )
    : h.circle(
        [
          h.Fill(
            context.active
              ? 'var(--flow-selection-background, rgb(37 99 235 / 0.12))'
              : 'var(--flow-node-background, #fff)',
          ),
          ...paint,
          h.Cx(String(context.start.x)),
          h.Cy(String(context.start.y)),
          h.R(String((context.active ? 6 : 4) / context.viewport.zoom)),
        ],
        [],
      );
}

/** Decorative world layer for the active anchor gesture; the caller applies diagnostic/opt-in gates. */
export function portAnchorGuideViews<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  nodes: readonly ZlozNode[],
  canEditPort: EditorPolicy['canEditPort'],
  render: ZlozPortAnchorGuideRenderer<M> | undefined,
): readonly Html[] {
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
  const views = portAnchorSnapGuideTargets(settings).flatMap((target) => {
    const name = target.type === 'corner' ? target.corner : target.side;
    const context: ZlozPortAnchorGuideContext = {
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
      settings: resolvePortAnchorSnapSettings(settings),
    };
    const custom = render?.(context, h);
    if (custom === null) return [];
    return [
      h.g(
        [
          h.Key(`guide:${target.type}:${name}`),
          h.DataAttribute('flow-anchor-guide', target.type),
          h.DataAttribute('flow-anchor-guide-target', name),
          h.DataAttribute('flow-anchor-guide-active', String(context.active)),
        ],
        [custom ?? zlozPortAnchorGuide(h, context)],
      ),
    ];
  });
  if (views.length === 0) return [];
  return [
    h.div(
      [
        h.DataAttribute('flow-anchor-guides', JSON.stringify(gesture.endpoint)),
        h.AriaHidden(true),
        h.Inert(true),
        h.Style({ position: 'absolute', inset: '0', 'pointer-events': 'none', 'z-index': '4' }),
      ],
      [
        h.svg(
          [
            h.Width('100%'),
            h.Height('100%'),
            h.Style({ overflow: 'visible', 'pointer-events': 'none' }),
          ],
          views,
        ),
      ],
    ),
  ];
}
