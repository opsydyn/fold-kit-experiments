import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Schema } from 'effect';

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
  /** Paint definitions, such as `radialGradient` from `effect-ui/paint`. */
  defs?: View.Children<M, never>;
  /** The node being inspected, by hover or focus. */
  activeKey?: string | null;
  selectedKey?: string | null;
  /** Called with a key when a node is hovered or focused, and with null when it is left. */
  onInspect?: (key: string | null) => M;
  /** Called when a node is clicked, or activated with Enter or Space. Makes nodes focusable buttons. */
  onSelect?: (key: string) => M;
}>;

const isKeyPress = Schema.is(Schema.Struct({ key: Schema.String, composing: Schema.Boolean }));

function centreText<M>(h: Html.H<M>, lines: ReadonlyArray<OrbitCentreLine>) {
  const heights = lines.map((line) => (line.size ?? 14) + 4);
  let offset = -heights.reduce((sum, height) => sum + height, 0) / 2;
  return lines.map((line, index) => {
    const height = heights[index] ?? 0;
    const y = offset + height / 2;
    offset += height;
    return h
      .el('text')
      .attrs({
        class: 'chart-orbit-centre',
        x: '0',
        y: String(y),
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        'font-size': String(line.size ?? 14),
        fill: line.colour,
        'aria-hidden': 'true',
      })
      .children(line.text);
  });
}

function orbitNode<T, M>(h: Html.H<M>, node: OrbitNode<T>, options: OrbitChartOptions<T, M>) {
  const style = options.nodeStyle(node);
  const selected = node.key === options.selectedKey;
  const emphasised = selected || node.key === options.activeKey;
  const label = options.labelFor(node.datum);
  const { onInspect, onSelect } = options;
  let mark = h.el('circle').attrs({
    class: 'chart-orbit-mark',
    r: String(node.radius),
    fill: style.fill,
    'fill-opacity': '0.85',
    'aria-label': label,
  });
  if (onInspect !== undefined) {
    mark = mark
      .on('mouseenter', () => onInspect(node.key))
      .on('mouseleave', () => onInspect(null))
      .on('focus', () => onInspect(node.key))
      .on('blur', () => onInspect(null));
  }
  if (onSelect !== undefined) {
    mark = mark
      .attrs({
        role: 'button',
        tabindex: '0',
        'aria-pressed': String(selected),
        style: 'cursor:pointer',
      })
      .on('click', () => onSelect(node.key))
      .on(
        'keydown',
        (payload) => {
          if (!isKeyPress(payload) || payload.composing) return undefined;
          return payload.key === 'Enter' || payload.key === ' ' ? onSelect(node.key) : undefined;
        },
        { preventDefault: true },
      );
  }
  return h
    .el('g')
    .key(node.key)
    .attrs({
      class: 'chart-orbit-node',
      transform: `translate(${node.x},${node.y})`,
    })
    .children(
      h.el('circle').attrs({
        class: 'chart-orbit-outline',
        r: String(node.radius + (emphasised ? 4 : 2)),
        fill: 'none',
        stroke: style.stroke,
        'stroke-width': emphasised ? '2' : '1',
        opacity: emphasised ? '0.95' : '0.6',
        'aria-hidden': 'true',
      }),
      mark.children(h.el('title').children(label)),
    );
}

/** Renders orbit geometry as an image or as a group of focusable node controls. */
export function orbitChart<T, M>(h: Html.H<M>, options: OrbitChartOptions<T, M>) {
  const { geometry, pulse, coreStroke, defs } = options;
  const halo = geometry.halo.arcs.map((slice) => {
    const colour = options.haloColour(slice.key);
    return h
      .el('path')
      .key(`halo-${slice.key}`)
      .attrs({
        class: 'chart-orbit-halo',
        d: arc(slice),
        fill: colour,
        'fill-opacity': '0.45',
        stroke: colour,
        'stroke-opacity': '0.65',
      })
      .children(h.el('title').children(`${slice.key}: ${slice.count}`));
  });

  return h
    .el('svg')
    .attrs({
      class: 'chart-orbit',
      viewBox: `0 0 ${geometry.size} ${geometry.size}`,
      width: '100%',
      style: `display:block;max-width:${geometry.size}px;height:auto`,
      role: options.onSelect === undefined ? 'img' : 'group',
      'aria-label': `${options.title}. ${options.description}`,
    })
    .children(
      h.el('title').children(options.title),
      h.el('desc').children(options.description),
      defs?.length ? h.el('defs').children(defs) : undefined,
      h
        .el('g')
        .attr('transform', `translate(${geometry.centre},${geometry.centre})`)
        .children(
          halo,
          h.el('circle').attrs({
            class: 'chart-orbit-core',
            r: String(geometry.core.radius),
            fill: options.coreFill,
            stroke: coreStroke,
            'stroke-width': coreStroke === undefined ? undefined : '2',
          }),
          pulse === undefined
            ? undefined
            : h.el('circle').attrs({
                class: 'chart-orbit-pulse',
                r: String(pulse.radius),
                fill: 'none',
                stroke: pulse.colour,
                'stroke-width': '1.5',
                'stroke-opacity': '0.45',
                'aria-hidden': 'true',
              }),
          centreText(h, options.centre ?? []),
          geometry.nodes.map((node) => orbitNode(h, node, options)),
        ),
    );
}
