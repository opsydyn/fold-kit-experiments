import { Html } from '@effect/ui/html';
import {
  architectureNodePresets,
  // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Shared SDK outline geometry.
  nodeShapeGeometry as outlineFor,
  type ZlozHistoryChange,
  type ZlozNode,
} from '@opsydyn/foldkit-zloz';

import { hotspotStatus } from './workshop';

export function workshopChangeLabel(change: ZlozHistoryChange<ZlozNode>): string | undefined {
  const architecture = (change.after ?? change.before)?.architecture;
  if (architecture?.family !== 'event-storming') return undefined;
  const role =
    architectureNodePresets.find(
      (preset) =>
        preset.architecture.family === architecture.family &&
        preset.architecture.role === architecture.role,
    )?.label ?? 'Note';
  if (change.kind !== 'changed') return `${role} ${change.kind}`;
  const { before, after } = change;
  const from = hotspotStatus(before);
  const to = hotspotStatus(after);
  const status = { open: 'Open', resolved: 'Resolved' };
  const transition = from && to && from !== to ? `${status[from]} → ${status[to]}` : '';
  const edits: string[] = [];
  if (before.position.x !== after.position.x || before.position.y !== after.position.y)
    edits.push('moved');
  if (before.size.width !== after.size.width || before.size.height !== after.size.height)
    edits.push('resized');
  if (before.label !== after.label) edits.push('renamed');
  if (transition) return [role, transition, ...edits].join(' · ');
  return `${role} ${edits.length ? edits.join(' and ') : 'changed'}`;
}

// The SDK owns the inert overlay and movement arrows. Customise just the workshop node mark.
export function workshopGhost<M>(change: ZlozHistoryChange<ZlozNode>, h: Html.H<M>) {
  const summary = workshopChangeLabel(change);
  if (!summary) return undefined;
  const node = change.before ?? change.after;
  const geometry = outlineFor(node);
  return h
    .el('g')
    .attr('data-zloz-history-node', change.kind)
    .attr('data-zloz-history-id', change.id)
    .attr('class', 'workshop-ghost')
    .attr('transform', `translate(${node.position.x} ${node.position.y})`)
    .children(
      ...[geometry.outlinePath, ...geometry.decorationPaths].map((path) =>
        h
          .el('path')
          .attr('d', path)
          .attr('fill', 'none')
          .attr('stroke', 'currentColor')
          .attr('stroke-width', '2')
          .attr('stroke-dasharray', change.kind === 'removed' ? '3 5' : '8 5')
          .children(),
      ),
      h
        .el('text')
        .attr('x', '4')
        .attr('y', '-24')
        .children(node.label || node.id),
      h.el('text').attr('x', '4').attr('y', '-8').children(summary),
    );
}
