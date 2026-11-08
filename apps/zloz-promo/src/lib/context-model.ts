import { createArchitectureNode, type FlowGraph } from '@opsydyn/foldkit-flow';
import { exportMermaid } from '@opsydyn/foldkit-flow-mermaid';

const input = { id: 'in', kind: 'input', side: 'left', offset: 0.5 } as const;
const output = { id: 'out', kind: 'output', side: 'right', offset: 0.5 } as const;

/** Authored system-context fixture; preview geometry and both exports share this model. */
export const contextGraph: FlowGraph = {
  nodes: [
    createArchitectureNode({
      id: 'customer',
      label: 'Customer',
      position: { x: 20, y: 176 },
      size: { width: 150, height: 128 },
      ports: [output],
      architecture: { family: 'c4', role: 'person', description: 'Places an order.' },
    }),
    createArchitectureNode({
      id: 'orders',
      label: 'Order platform',
      position: { x: 280, y: 176 },
      size: { width: 180, height: 128 },
      ports: [input, output],
      architecture: {
        family: 'c4',
        role: 'software-system',
        scope: 'internal',
        description: 'Coordinates checkout.',
      },
    }),
    createArchitectureNode({
      id: 'payments',
      label: 'Payments',
      position: { x: 570, y: 64 },
      size: { width: 150, height: 128 },
      ports: [input],
      architecture: {
        family: 'c4',
        role: 'software-system',
        scope: 'external',
        description: 'Captures payment.',
      },
    }),
    createArchitectureNode({
      id: 'delivery',
      label: 'Delivery',
      position: { x: 570, y: 336 },
      size: { width: 150, height: 128 },
      ports: [input],
      architecture: {
        family: 'c4',
        role: 'software-system',
        scope: 'external',
        description: 'Ships the order.',
      },
    }),
  ],
  edges: [
    {
      id: 'places-order',
      source: { node: 'customer', port: 'out' },
      target: { node: 'orders', port: 'in' },
      label: 'Places order',
      pathStyle: 'smooth',
    },
    {
      id: 'charges',
      source: { node: 'orders', port: 'out' },
      target: { node: 'payments', port: 'in' },
      label: 'Charges',
      pathStyle: 'smooth',
    },
    {
      id: 'dispatches',
      source: { node: 'orders', port: 'out' },
      target: { node: 'delivery', port: 'in' },
      label: 'Dispatches',
      pathStyle: 'smooth',
    },
  ],
};

const conversion = exportMermaid(contextGraph, { lossPolicy: 'report' });
if (conversion.status !== 'converted')
  throw new Error('The promo context fixture must export to Mermaid');
export const mermaidBundle = conversion.value;
