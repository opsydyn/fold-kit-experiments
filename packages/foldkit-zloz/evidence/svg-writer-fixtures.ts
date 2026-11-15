import {
  writeSvgExport,
  createArchitectureNode,
  portPosition,
  type ZlozGraph,
  type ZlozSvgExportOptions,
  type ZlozSvgAdapter,
} from '../src/index';
const graph: ZlozGraph = {
  nodes: [
    createArchitectureNode({
      id: 'platform',
      kind: 'group',
      label: 'Order platform',
      position: { x: 0, y: 0 },
      size: { width: 860, height: 520 },
      ports: [],
      architecture: { family: 'ddd', role: 'bounded-context', subdomain: 'core' },
    }),
    {
      id: 'storage',
      kind: 'group',
      parentId: 'platform',
      label: 'Fulfilment',
      position: { x: 410, y: 85 },
      size: { width: 410, height: 390 },
      ports: [],
    },
    {
      ...createArchitectureNode({
        id: 'client',
        label: 'Client <&>',
        position: { x: 65, y: 160 },
        size: { width: 190, height: 150 },
        ports: [{ id: 'orders', label: 'orders', kind: 'output', side: 'right', offset: 0.5 }],
        architecture: { family: 'c4', role: 'person', description: 'Places orders' },
      }),
      parentId: 'platform',
    },
    {
      ...createArchitectureNode({
        id: 'database',
        label: 'Stock repository',
        position: { x: 470, y: 190 },
        size: { width: 280, height: 180 },
        ports: [{ id: 'in', label: 'in', kind: 'input', side: 'left', offset: 0.5 }],
        architecture: { family: 'c4', role: 'container', technology: 'PostgreSQL' },
        // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Cylinder is a domain outline supported by core architecture geometry.
        appearance: { shape: 'cylinder' },
      }),
      parentId: 'storage',
    },
  ],
  edges: [
    {
      id: 'orders-stock',
      label: 'Orders & stock',
      source: { node: 'client', port: 'orders' },
      target: { node: 'database', port: 'in' },
      waypoints: [
        { id: 'a', position: { x: 340, y: 235 } },
        { id: 'b', position: { x: 340, y: 410 } },
        { id: 'c', position: { x: 470, y: 410 } },
      ],
    },
  ],
};
const options: ZlozSvgExportOptions = {
  title: 'Zloz architecture <&> review',
  description: 'Nested groups, ports, authored bends and labels.',
  region: { type: 'model', padding: 65 },
  theme: { colorScheme: 'light' },
  background: { type: 'theme' },
  font: { family: 'sans-serif', size: 14, weight: 400 },
  renderers: { nodes: 'built-in', edges: 'built-in' },
};
const adapter: ZlozSvgAdapter = {
  id: 'person-card',
  version: '1',
  render: (context) => {
    if (context.kind !== 'node') throw new Error('Node adapter only');
    const { node, theme } = context,
      p = node.position;
    return [
      {
        type: 'rect',
        position: p,
        width: node.size.width,
        height: node.size.height,
        radius: 20,
        fill: theme.tokens.nodeBackground,
        stroke: theme.tokens.outputPort,
        strokeWidth: 3,
      },
      {
        type: 'circle',
        center: { x: p.x + 35, y: p.y + 38 },
        radius: 13,
        fill: theme.tokens.outputPort,
      },
      {
        type: 'polyline',
        points: [
          { x: p.x + 20, y: p.y + 70 },
          { x: p.x + 35, y: p.y + 55 },
          { x: p.x + 50, y: p.y + 70 },
        ],
        stroke: theme.tokens.outputPort,
        strokeWidth: 3,
      },
      {
        type: 'text',
        position: { x: p.x + 16, y: p.y + 100 },
        text: node.label,
        fill: theme.tokens.nodeColor,
        weight: 700,
      },
      {
        type: 'text',
        position: { x: p.x + 16, y: p.y + 123 },
        text: '[C4 person]',
        fill: theme.tokens.nodeColor,
      },
      ...node.ports.map((port) => ({
        type: 'circle' as const,
        center: portPosition(node, port.id),
        radius: 5,
        fill: theme.tokens.outputPort,
        stroke: theme.tokens.portBorder,
      })),
    ];
  },
};
const custom = {
  ...options,
  theme: { colorScheme: 'dark' },
  renderers: {
    nodes: 'built-in',
    edges: 'built-in',
    overrides: [
      {
        target: { kind: 'node', id: 'client' },
        renderer: {
          type: 'svg',
          id: 'person-card',
          version: '1',
          bounds: { x: 60, y: 155, width: 205, height: 160 },
          fidelity: 'equivalent',
          reason: 'Host vector person card',
        },
      },
    ],
  },
} as const;
for (const [name, input, writing] of [
  ['light', options, {}],
  ['dark-custom', custom, { adapters: [adapter] }],
  ['viewport', { ...options, region: { type: 'viewport', size: { width: 780, height: 480 } } }, {}],
  [
    'transparent',
    {
      ...options,
      region: { type: 'bounds', bounds: { x: -65, y: -65, width: 990, height: 650 } },
      background: { type: 'transparent' },
    },
    {},
  ],
] as const) {
  const result = writeSvgExport({ graph, viewport: { x: -20, y: -20, zoom: 1.3 } }, input, writing);
  if (result.type !== 'written') throw new Error(JSON.stringify(result.findings));
  await Bun.write(new URL(`svg-writer-${name}.svg`, import.meta.url), result.svg);
}
