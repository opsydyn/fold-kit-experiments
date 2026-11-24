import {
  architectureNodePresets,
  createArchitectureNode,
  type ZlozNode,
  type ZlozOperationDocument,
} from '@opsydyn/foldkit-zloz';
import { Schema } from 'effect';

export const WorkshopRole = Schema.Literals([
  'domain-event',
  'hotspot',
  'command',
  'policy',
  'actor',
  'external-system',
]);
export const WorkshopStatus = Schema.Literals(['open', 'resolved']);
export const workshopNotes = [
  { role: 'domain-event', label: 'Add event' },
  { role: 'hotspot', label: 'Add hotspot' },
  { role: 'command', label: 'Add command' },
  { role: 'policy', label: 'Add policy' },
  { role: 'actor', label: 'Add actor' },
  { role: 'external-system', label: 'Add external system' },
] as const;

export function createWorkshopNote(
  role: typeof WorkshopRole.Type,
  id: string,
  existing: readonly ZlozNode[],
) {
  const occupied = new Set(existing.map(({ position }) => `${position.x}:${position.y}`));
  const positionAt = (index: number) => ({
    x: 60 + (index % 6) * 190,
    y: 80 + Math.floor(index / 6) * 130,
  });
  let index = 0;
  let position = positionAt(index);
  while (occupied.has(`${position.x}:${position.y}`)) position = positionAt(++index);
  const label = architectureNodePresets.find(
    ({ architecture }) => architecture.family === 'event-storming' && architecture.role === role,
  )?.label;
  return createArchitectureNode({
    id,
    label: role === 'hotspot' ? 'What needs discussion?' : (label ?? 'Workshop note'),
    architecture:
      role === 'hotspot'
        ? { family: 'event-storming', role, status: 'open' }
        : { family: 'event-storming', role },
    position,
    size: { width: 172, height: 100 },
    ports:
      role === 'hotspot'
        ? []
        : [
            { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
            { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
          ],
  });
}

export function hotspotStatus(node: ZlozNode | undefined) {
  const a = node?.architecture;
  return a?.family === 'event-storming' && a.role === 'hotspot' ? a.status : null;
}

export function changedHotspots(before: ZlozOperationDocument, after: ZlozOperationDocument) {
  if (before.graph.nodes === after.graph.nodes || before.version >= after.version) return [];
  const known = new Map(before.nodes.map((clock) => [clock.id, clock]));
  const nodes = new Map(before.graph.nodes.map((node) => [node.id, node]));
  return after.graph.nodes.flatMap((node) => {
    const status = hotspotStatus(node);
    const clock = known.get(node.id);
    // A tombstone represents a previously seen note restored by Undo.
    return status && (!clock || (clock.present && hotspotStatus(nodes.get(node.id)) !== status))
      ? [{ id: node.id, status }]
      : [];
  });
}

export function revealHotspots(
  run: number,
  changes: readonly { id: string; status: typeof WorkshopStatus.Type }[],
) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const board = document.querySelector(
    `[data-edge-motion-run="${run}"][data-canvas-emphasis="event-storming"]`,
  );
  if (!board) return;
  for (const { id, status } of changes) {
    const ring = board.querySelector(
      `[data-hotspot-flare="${CSS.escape(id)}"][data-hotspot-state="${status}"]`,
    );
    if (!ring) continue;
    for (const animation of ring.getAnimations()) animation.cancel();
    ring.animate(
      status === 'open'
        ? [
            { opacity: 0.85, transform: 'scale(0.94)' },
            { opacity: 0, transform: 'scale(1.4)' },
          ]
        : [
            { opacity: 0.7, transform: 'scale(1.3)' },
            { opacity: 0, transform: 'scale(1)' },
          ],
      { duration: 360, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
  }
}
