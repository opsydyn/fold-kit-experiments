import { Html } from '@effect/ui/html';

export type OrbitArtwork = Readonly<{
  id: string;
  label: string;
  group?: boolean;
  selected?: boolean;
  preview?: boolean;
}>;

export const orbitRings = ({ selected, preview }: OrbitArtwork) => [
  {
    radius: '48',
    fill: '#172554',
    stroke: preview ? '#5eead4' : selected ? '#f97316' : '#38bdf8',
    dashArray: preview ? '5 3' : 'none',
    strokeWidth: selected || preview ? '3' : '1',
  },
  { radius: '41', fill: 'none', stroke: '#38bdf8', dashArray: '2 3', strokeWidth: '0.4' },
];

function orbitArtwork<M>(h: Html.H<M>, artwork: OrbitArtwork) {
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

function orbitArtworkById<M>(
  h: Html.H<M>,
  id: string,
  label: string,
  group: boolean,
  selected: boolean,
  preview: boolean,
) {
  return orbitArtwork(h, { id, label, group, selected, preview });
}

export function renderOrbitArtwork<M>(h: Html.H<M>, artwork: OrbitArtwork, retain: boolean) {
  const { id, label, group = false, selected = false, preview = false } = artwork;
  return retain
    ? h.lazy(orbitArtworkById, id, label, group, selected, preview)
    : orbitArtwork(h, artwork);
}
