import {
  architectureNodePresets,
  // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Shared SDK outline geometry.
  nodeShapeGeometry as outlineFor,
  type ZlozHistoryChange,
  type ZlozNode,
} from '@opsydyn/foldkit-zloz';
import type { HtmlBuilder } from 'foldkit/html';

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
export function workshopGhost<M>(change: ZlozHistoryChange<ZlozNode>, h: HtmlBuilder<M>) {
  const summary = workshopChangeLabel(change);
  if (!summary) return undefined;
  const node = change.before ?? change.after;
  const geometry = outlineFor(node);
  return h.g(
    [
      h.DataAttribute('zloz-history-node', change.kind),
      h.DataAttribute('zloz-history-id', change.id),
      h.Class('workshop-ghost'),
      h.Transform(`translate(${node.position.x} ${node.position.y})`),
    ],
    [
      ...[geometry.outlinePath, ...geometry.decorationPaths].map((path) =>
        h.path(
          [
            h.D(path),
            h.Fill('none'),
            h.Stroke('currentColor'),
            h.StrokeWidth('2'),
            h.StrokeDasharray(change.kind === 'removed' ? '3 5' : '8 5'),
          ],
          [],
        ),
      ),
      h.text([h.X('4'), h.Y('-24')], [node.label || node.id]),
      h.text([h.X('4'), h.Y('-8')], [summary]),
    ],
  );
}
