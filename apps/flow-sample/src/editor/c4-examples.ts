/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Geometric node shapes are domain concepts here, not structural placeholders. */
import { createArchitectureNode, type FlowGraph, type FlowNode } from '@opsydyn/foldkit-flow';

const output = { id: 'out', kind: 'output', side: 'right', offset: 0.5 } as const;
const input = { id: 'in', kind: 'input', side: 'left', offset: 0.5 } as const;
const customer = (): FlowNode =>
  createArchitectureNode({
    id: 'customer',
    label: 'Customer',
    position: { x: 40, y: 180 },
    size: { width: 200, height: 180 },
    ports: [output],
    architecture: {
      family: 'c4',
      role: 'person',
      description: 'Places orders and follows deliveries.',
    },
  });

/** Authored system-context fixture. Detail views are separate rather than mixing C4 levels. */
export function createC4ContextGraph(): FlowGraph {
  return {
    nodes: [
      customer(),
      createArchitectureNode({
        id: 'orders',
        label: 'Order platform',
        position: { x: 460, y: 170 },
        size: { width: 280, height: 190 },
        ports: [input, output],
        architecture: {
          family: 'c4',
          role: 'software-system',
          description: 'Accepts orders and coordinates fulfilment.',
          scope: 'internal',
        },
        appearance: { shape: 'rounded-rectangle' },
      }),
      createArchitectureNode({
        id: 'identity',
        label: 'Identity provider',
        position: { x: 980, y: 40 },
        size: { width: 230, height: 160 },
        ports: [input],
        architecture: {
          family: 'c4',
          role: 'software-system',
          description: 'Authenticates customers.',
          scope: 'external',
        },
        appearance: { shape: 'rounded-rectangle' },
      }),
      createArchitectureNode({
        id: 'payments',
        label: 'Payment provider',
        position: { x: 980, y: 330 },
        size: { width: 230, height: 160 },
        ports: [input],
        architecture: {
          family: 'c4',
          role: 'software-system',
          description: 'Authorizes and captures payments.',
          scope: 'external',
        },
        appearance: { shape: 'rounded-rectangle' },
      }),
    ],
    edges: [
      {
        id: 'places-order',
        source: { node: 'customer', port: 'out' },
        target: { node: 'orders', port: 'in' },
        label: 'Places and tracks orders',
      },
      {
        id: 'authenticates',
        source: { node: 'orders', port: 'out' },
        target: { node: 'identity', port: 'in' },
        label: 'Authenticates · HTTPS / OIDC',
      },
      {
        id: 'charges',
        source: { node: 'orders', port: 'out' },
        target: { node: 'payments', port: 'in' },
        label: 'Charges orders · HTTPS',
      },
    ],
  };
}

/** Companion detail fixture exercises portless system boundaries and data-store outlines. */
export function createC4ContainerGraph(): FlowGraph {
  return {
    nodes: [
      customer(),
      createArchitectureNode({
        id: 'platform-boundary',
        kind: 'group',
        label: 'Order platform',
        position: { x: 380, y: 40 },
        size: { width: 560, height: 490 },
        ports: [],
        architecture: { family: 'c4', role: 'software-system' },
      }),
      {
        ...createArchitectureNode({
          id: 'orders-api',
          label: 'Order API',
          position: { x: 430, y: 90 },
          size: { width: 220, height: 180 },
          ports: [input, output, { id: 'records', kind: 'output', side: 'bottom', offset: 0.5 }],
          architecture: {
            family: 'c4',
            role: 'container',
            technology: 'TypeScript / HTTP',
            description: 'Accepts orders and coordinates payment.',
          },
          appearance: { shape: 'rounded-rectangle' },
        }),
        parentId: 'platform-boundary',
      },
      {
        ...createArchitectureNode({
          id: 'orders-db',
          label: 'Order records',
          position: { x: 670, y: 310 },
          size: { width: 220, height: 180 },
          ports: [{ ...input, side: 'top', offset: 0.25 }],
          architecture: {
            family: 'c4',
            role: 'container',
            technology: 'PostgreSQL',
            description: 'Stores accepted orders.',
          },
          appearance: { shape: 'cylinder' },
        }),
        parentId: 'platform-boundary',
      },
      createArchitectureNode({
        id: 'payments',
        label: 'Payment provider',
        position: { x: 1050, y: 90 },
        size: { width: 230, height: 170 },
        ports: [input],
        architecture: {
          family: 'c4',
          role: 'software-system',
          description: 'Processes payments.',
          scope: 'external',
        },
        appearance: { shape: 'rounded-rectangle' },
      }),
    ],
    edges: [
      {
        id: 'places-order',
        source: { node: 'customer', port: 'out' },
        target: { node: 'orders-api', port: 'in' },
        label: 'Places orders · HTTPS',
      },
      {
        id: 'stores-order',
        source: { node: 'orders-api', port: 'records' },
        target: { node: 'orders-db', port: 'in' },
        label: 'Reads / writes · SQL',
      },
      {
        id: 'charges',
        source: { node: 'orders-api', port: 'out' },
        target: { node: 'payments', port: 'in' },
        label: 'Charges orders · HTTPS',
      },
    ],
  };
}
