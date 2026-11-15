import { Option } from 'effect';
import type { Html, HtmlBuilder } from 'foldkit/html';

import type { OrbitGeometry, OrbitNode } from '../chart/orbit.js';
import { arc } from '../shape/arc.js';

export type OrbitNodeStyle = Readonly<{
  /** Fill of the node itself. */
  fill: string;
  /** Colour of the outline ring drawn just outside it. */
  stroke: string;
}>;

export type OrbitCentreLine = Readonly<{ text: string; colour: string; size?: number }>;

export type OrbitChartOptions<T, M> = Readonly<{
  geometry: OrbitGeometry<T>;
  title: string;
  description: string;
  /** Fill of the core: a colour, a CSS variable or a `url(#id)` paint from `defs`. */
  coreFill: string;
  coreStroke?: string;
  haloColour: (key: string) => string;
  nodeStyle: (node: OrbitNode<T>) => OrbitNodeStyle;
  /** Names a node, as its tooltip and accessible label. */
  labelFor: (datum: T) => string;
  /** Lines of text stacked at the centre, hidden from assistive technology. */
  centre?: ReadonlyArray<OrbitCentreLine>;
  /** A ring between the core and the halo, classed `chart-orbit-pulse` so CSS can animate it. */
  pulse?: Readonly<{ radius: number; colour: string }>;
  /** Paint definitions, such as `radialGradient` from `foldkit/paint`. */
  defs?: ReadonlyArray<Html>;
  /** The node being inspected, by hover or focus. */
  activeKey?: string | null;
  selectedKey?: string | null;
  /** Called with a key when a node is hovered or focused, and with null when it is left. */
  onInspect?: (key: string | null) => M;
  /** Called when a node is clicked, or activated with Enter or Space. Makes nodes focusable buttons. */
  onSelect?: (key: string) => M;
}>;

const centreText = <M>(
  h: HtmlBuilder<M>,
  lines: ReadonlyArray<OrbitCentreLine>,
): ReadonlyArray<Html> => {
  const heights = lines.map((line) => (line.size ?? 14) + 4);
  const total = heights.reduce((sum, height) => sum + height, 0);
  let offset = -total / 2;
  return lines.map((line, index) => {
    const height = heights[index] ?? 0;
    const y = offset + height / 2;
    offset += height;
    return h.text(
      [
        h.Class('chart-orbit-centre'),
        h.X('0'),
        h.Y(String(y)),
        h.TextAnchor('middle'),
        h.DominantBaseline('central'),
        h.FontSize(String(line.size ?? 14)),
        h.Fill(line.colour),
        h.AriaHidden(true),
      ],
      [line.text],
    );
  });
};

/**
 * Renders orbit geometry as one SVG with the parent's builder.
 *
 * Without `onSelect` the chart is an image whose nodes name themselves in
 * native tooltips, so it reads completely as static HTML. With `onSelect`
 * each node is a focusable button, inspected on focus as well as hover.
 * Pair it with `dataTable` from `foldkit/cartesian` for a non-visual reading.
 */
export function orbitChart<T, M>(h: HtmlBuilder<M>, options: OrbitChartOptions<T, M>): Html {
  const { geometry } = options;
  const interactive = options.onSelect !== undefined;

  const halo = geometry.halo.arcs.map((slice) => {
    const colour = options.haloColour(slice.key);
    return h.path(
      [
        h.Class('chart-orbit-halo'),
        h.Key(`halo-${slice.key}`),
        h.D(arc(slice)),
        h.Fill(colour),
        h.FillOpacity('0.45'),
        h.Stroke(colour),
        h.StrokeOpacity('0.65'),
      ],
      [h.title([], [`${slice.key}: ${slice.count}`])],
    );
  });

  const core = h.circle(
    [
      h.Class('chart-orbit-core'),
      h.R(String(geometry.core.radius)),
      h.Fill(options.coreFill),
      ...(options.coreStroke === undefined
        ? []
        : [h.Stroke(options.coreStroke), h.StrokeWidth('2')]),
    ],
    [],
  );

  const pulse =
    options.pulse === undefined
      ? []
      : [
          h.circle(
            [
              h.Class('chart-orbit-pulse'),
              h.R(String(options.pulse.radius)),
              h.Fill('none'),
              h.Stroke(options.pulse.colour),
              h.StrokeWidth('1.5'),
              h.StrokeOpacity('0.45'),
              h.AriaHidden(true),
            ],
            [],
          ),
        ];

  const nodes = geometry.nodes.map((node) => {
    const style = options.nodeStyle(node);
    const selected = node.key === options.selectedKey;
    const emphasised = selected || node.key === options.activeKey;
    const label = options.labelFor(node.datum);
    const { onInspect, onSelect } = options;
    return h.g(
      [h.Key(node.key), h.Class('chart-orbit-node'), h.Transform(`translate(${node.x},${node.y})`)],
      [
        h.circle(
          [
            h.Class('chart-orbit-outline'),
            h.R(String(node.radius + (emphasised ? 4 : 2))),
            h.Fill('none'),
            h.Stroke(style.stroke),
            h.StrokeWidth(emphasised ? '2' : '1'),
            h.Opacity(emphasised ? '0.95' : '0.6'),
            h.AriaHidden(true),
          ],
          [],
        ),
        h.circle(
          [
            h.Class('chart-orbit-mark'),
            h.R(String(node.radius)),
            h.Fill(style.fill),
            h.FillOpacity('0.85'),
            h.AriaLabel(label),
            ...(onInspect === undefined
              ? []
              : [
                  h.OnMouseEnter(onInspect(node.key)),
                  h.OnMouseLeave(onInspect(null)),
                  h.OnFocus(onInspect(node.key)),
                  h.OnBlur(onInspect(null)),
                ]),
            ...(onSelect === undefined
              ? []
              : [
                  h.Role('button'),
                  h.Tabindex(0),
                  h.AriaPressed(selected ? 'true' : 'false'),
                  h.OnClick(onSelect(node.key)),
                  h.OnKeyDownPreventDefault((key) =>
                    key === 'Enter' || key === ' '
                      ? Option.some(onSelect(node.key))
                      : Option.none(),
                  ),
                  h.Style({ cursor: 'pointer' }),
                ]),
          ],
          [h.title([], [label])],
        ),
      ],
    );
  });

  return h.svg(
    [
      h.Class('chart-orbit'),
      h.ViewBox(`0 0 ${geometry.size} ${geometry.size}`),
      h.Width('100%'),
      h.Style({ display: 'block', 'max-width': `${geometry.size}px`, height: 'auto' }),
      // An image hides its children from assistive technology, so an
      // interactive orbit is a labelled group of buttons instead.
      h.Role(interactive ? 'group' : 'img'),
      h.AriaLabel(`${options.title}. ${options.description}`),
    ],
    [
      h.title([], [options.title]),
      h.desc([], [options.description]),
      ...(options.defs === undefined || options.defs.length === 0
        ? []
        : [h.defs([], [...options.defs])]),
      h.g(
        [h.Transform(`translate(${geometry.centre},${geometry.centre})`)],
        [...halo, core, ...pulse, ...centreText(h, options.centre ?? []), ...nodes],
      ),
    ],
  );
}
