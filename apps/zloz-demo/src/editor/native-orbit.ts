import { Html } from '@effect/ui/html';
import type { ZlozNode } from '@opsydyn/foldkit-zloz';
import { Schema } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';

import type { Message } from './message';
import { architectureNativePanel } from './native-panel';

type OrbitArtwork = Readonly<{
  id: string;
  label: string;
  group?: boolean;
  selected?: boolean;
  preview?: boolean;
}>;

const orbitRings = ({ selected, preview }: OrbitArtwork) => [
  {
    radius: '48',
    fill: '#172554',
    stroke: preview ? '#5eead4' : selected ? '#f97316' : '#38bdf8',
    dashArray: preview ? '5 3' : 'none',
    strokeWidth: selected || preview ? '3' : '1',
  },
  { radius: '41', fill: 'none', stroke: '#38bdf8', dashArray: '2 3', strokeWidth: '0.4' },
];

export function orbitArtwork<M>(h: Html.H<M>, artwork: OrbitArtwork) {
  const { id, label, group } = artwork;
  if (group) return h.span.class('orbit-group-body').attr('data-orbit-body', id).children(label);
  const svg = (tag: 'svg' | 'circle') => new Html.Element<M>(tag);
  return h.span
    .class('orbit-node-body')
    .attr('data-orbit-body', id)
    .style({ display: 'contents' })
    .children(
      svg('svg')
        .attr('viewBox', '0 0 100 100')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('aria-hidden', 'true')
        .style({ display: 'block', pointerEvents: 'none' })
        .children(
          ...orbitRings(artwork).map(({ radius, fill, stroke, dashArray, strokeWidth }) =>
            svg('circle')
              .key(radius)
              .attr('cx', '50')
              .attr('cy', '50')
              .attr('r', radius)
              .attr('fill', fill)
              .attr('stroke', stroke)
              .attr('stroke-dasharray', dashArray)
              .attr('stroke-width', strokeWidth),
          ),
        ),
      h.span.class('orbit-node-caption').children(label),
    );
}

// The FoldKit server has no child mounts. Render the decorative snapshot with
// its builder while the browser owns the same artwork through Effect UI.
function staticOrbitArtwork(h: HtmlBuilder<Message>, artwork: OrbitArtwork) {
  const { id, label, group } = artwork;
  if (group)
    return h.span([h.Class('orbit-group-body'), h.DataAttribute('orbit-body', id)], [label]);
  return h.span(
    [
      h.Class('orbit-node-body'),
      h.DataAttribute('orbit-body', id),
      h.Style({ display: 'contents' }),
    ],
    [
      h.svg(
        [
          h.ViewBox('0 0 100 100'),
          h.Width('100%'),
          h.Height('100%'),
          h.AriaHidden(true),
          h.Style({ display: 'block', 'pointer-events': 'none' }),
        ],
        orbitRings(artwork).map(({ radius, fill, stroke, dashArray, strokeWidth }) =>
          h.circle(
            [
              h.Cx('50'),
              h.Cy('50'),
              h.R(radius),
              h.Fill(fill),
              h.Stroke(stroke),
              h.StrokeDasharray(dashArray),
              h.StrokeWidth(strokeWidth),
            ],
            [],
          ),
        ),
      ),
      h.span([h.Class('orbit-node-caption')], [label]),
    ],
  );
}

const orbitPanel = architectureNativePanel<OrbitArtwork>(
  'ArchitectureOrbitArtwork',
  Schema.is(Schema.Never),
  orbitArtwork,
);

export function orbitNodeBody(
  h: HtmlBuilder<Message>,
  { id, label }: ZlozNode,
  selected: boolean,
  preview: boolean,
) {
  const artwork = { id, label, selected, preview };
  return !('document' in globalThis)
    ? staticOrbitArtwork(h, artwork)
    : orbitPanel(h, artwork, 'architecture-orbit-node', id, true);
}

export function orbitGroupBody(h: HtmlBuilder<Message>, { id, label }: ZlozNode) {
  const artwork = { id, label, group: true };
  return !('document' in globalThis)
    ? staticOrbitArtwork(h, artwork)
    : orbitPanel(h, artwork, 'architecture-orbit-group', id, true);
}
