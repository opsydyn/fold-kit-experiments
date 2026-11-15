import { createArchitectureNode } from './architecture-node';
import type { ZlozGraph } from './types';
/** Illustrative workshop starter; uses the explicitly selected workshop relationship convention. */
export function createEventStormingWorkshopPattern(): ZlozGraph {
  const nodes = [
    createArchitectureNode({
      id: 'workshop-lane',
      kind: 'group',
      label: 'Payment discovery',
      position: { x: 20, y: 20 },
      size: { width: 1040, height: 620 },
      ports: [],
      architecture: {
        family: 'event-storming',
        role: 'lane',
        description: 'Organization, not a runtime boundary',
      },
    }),
    ...(
      [
        { id: 'request', label: 'Request payment', role: 'command', x: 70, y: 150 },
        { id: 'provider', label: 'Payment provider', role: 'external-system', x: 400, y: 150 },
        { id: 'accepted', label: 'Payment accepted', role: 'domain-event', x: 730, y: 150 },
      ] as const
    ).map(({ id, label, role, x, y }) => ({
      ...createArchitectureNode({
        id,
        label,
        position: { x, y },
        size: { width: 210, height: 150 },
        ports: [
          { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
          { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
        ],
        architecture: { family: 'event-storming', role },
      }),
      parentId: 'workshop-lane',
    })),
    ...(
      [
        {
          id: 'retry-question',
          label: 'Who owns retries?',
          status: 'open',
          description: 'Clarify the handoff after a provider timeout.',
          x: 140,
          locked: false,
        },
        {
          id: 'timeout-agreement',
          label: 'Timeout contract agreed',
          status: 'resolved',
          description: 'Facilitator-approved decision; unlock to reopen.',
          x: 590,
          locked: true,
        },
      ] as const
    ).map(({ id, label, status, description, x, locked }) => ({
      ...createArchitectureNode({
        id,
        label,
        position: { x, y: 390 },
        size: { width: 330, height: 170 },
        ports: [],
        architecture: { family: 'event-storming', role: 'hotspot', status, description },
        data: { workshopStatusLocked: locked },
      }),
      parentId: 'workshop-lane',
    })),
  ];
  return {
    nodes,
    edges: [
      {
        id: 'provider-handles',
        label: 'Handled by',
        source: { node: 'request', port: 'out' },
        target: { node: 'provider', port: 'in' },
        architecture: { family: 'event-storming', role: 'handles' },
      },
      {
        id: 'provider-emits',
        label: 'Emits',
        source: { node: 'provider', port: 'out' },
        target: { node: 'accepted', port: 'in' },
        architecture: { family: 'event-storming', role: 'emits' },
      },
    ],
  };
}
