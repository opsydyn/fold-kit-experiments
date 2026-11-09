import { createArchitectureNode, type ZlozGraph } from '@opsydyn/foldkit-zloz';

const input = { id: 'in', kind: 'input', side: 'left', offset: 0.5 } as const;
const output = { id: 'out', kind: 'output', side: 'right', offset: 0.5 } as const;

/** Illustrative DDD model; edge labels express authored intent, not executable invariants. */
export function createDddOrderGraph(): ZlozGraph {
  return {
    nodes: [
      createArchitectureNode({
        id: 'order-aggregate',
        label: 'Order aggregate',
        kind: 'group',
        position: { x: 40, y: 50 },
        size: { width: 680, height: 490 },
        ports: [],
        architecture: { family: 'ddd', role: 'aggregate' },
      }),
      ...(
        [
          {
            id: 'order',
            label: 'Order',
            role: 'aggregate-root',
            position: { x: 90, y: 155 },
            description: 'Owns order consistency and lifecycle.',
          },
          {
            id: 'line-item',
            label: 'Line item',
            role: 'entity',
            position: { x: 90, y: 350 },
            description: 'Identity remains stable as quantity changes.',
          },
          {
            id: 'money',
            label: 'Money',
            role: 'value-object',
            position: { x: 420, y: 350 },
            description: 'Amount and currency describe a value.',
          },
        ] as const
      ).map((node) => ({
        ...createArchitectureNode({
          id: node.id,
          label: node.label,
          position: node.position,
          size: { width: 250, height: 150 },
          ports:
            node.role === 'aggregate-root'
              ? [input, output, { ...output, id: 'items', side: 'bottom' }]
              : node.role === 'entity'
                ? [{ ...input, side: 'top' }, output]
                : [input, output],
          architecture: { family: 'ddd', role: node.role, description: node.description },
        }),
        parentId: 'order-aggregate',
      })),
      createArchitectureNode({
        id: 'ordering',
        label: 'Ordering',
        position: { x: 860, y: 600 },
        size: { width: 270, height: 180 },
        ports: [output],
        architecture: {
          family: 'ddd',
          role: 'bounded-context',
          subdomain: 'core',
          description: 'Owns the language used by this model.',
        },
      }),
      createArchitectureNode({
        id: 'pricing',
        label: 'Pricing policy',
        position: { x: 860, y: 330 },
        size: { width: 270, height: 160 },
        ports: [input, output],
        architecture: {
          family: 'ddd',
          role: 'domain-service',
          description: 'Coordinates pricing across domain concepts.',
        },
      }),
      createArchitectureNode({
        id: 'order-placed',
        label: 'Order placed',
        position: { x: 860, y: 70 },
        size: { width: 270, height: 160 },
        ports: [input],
        architecture: {
          family: 'ddd',
          role: 'domain-event',
          description: 'Records an accepted domain fact.',
        },
      }),
      createArchitectureNode({
        id: 'orders',
        label: 'Orders',
        position: { x: 90, y: 650 },
        size: { width: 250, height: 160 },
        ports: [{ ...output, side: 'left' }],
        architecture: {
          family: 'ddd',
          role: 'repository',
          description: 'Retrieves and stores whole aggregates.',
        },
        // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Authored node geometry uses the public shape contract.
        appearance: { shape: 'cylinder' },
      }),
    ],
    edges: [
      {
        id: 'has-line',
        source: { node: 'order', port: 'items' },
        target: { node: 'line-item', port: 'in' },
        label: 'Contains',
      },
      {
        id: 'has-value',
        source: { node: 'line-item', port: 'out' },
        target: { node: 'money', port: 'in' },
        label: 'Priced in',
      },
      {
        id: 'stored',
        source: { node: 'orders', port: 'out' },
        target: { node: 'order', port: 'in' },
        label: 'Loads aggregate',
        pathStyle: 'stepped',
      },
      {
        id: 'publishes',
        source: { node: 'order', port: 'out' },
        target: { node: 'order-placed', port: 'in' },
        label: 'Records',
      },
    ],
  };
}
